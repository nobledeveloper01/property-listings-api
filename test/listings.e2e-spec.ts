import { config as loadEnv } from 'dotenv';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';

/**
 * Integration tests against a real PostGIS database.
 *
 * These deliberately do not mock the database. The whole risk in this service
 * is a query — whether `ST_DWithin` returns the right rows, in the right
 * order, with the right distances — and a mocked repository would assert that
 * TypeORM was called with a string, which proves nothing.
 *
 * They run against TEST_DATABASE_URL, never DATABASE_URL. The suite truncates
 * between cases, so pointing it at the development database wipes whatever
 * you were looking at — which happened, and showed up as an API returning an
 * empty array with nothing to explain why. A separate database is the fix; a
 * note in the README asking people to remember is not.
 *
 * `docker compose up -d` then `pnpm test:e2e` is the whole setup. Migrations
 * run below, so there is no separate step to forget.
 */
describe('Listings (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Three real places, so the distances in the assertions are checkable
  // against a map rather than being whatever the code happened to produce.
  const YABA = { latitude: 6.5095, longitude: 3.3711 };
  const IKEJA_GRA = { latitude: 6.6018, longitude: 3.3515 };
  const LEKKI = { latitude: 6.4698, longitude: 3.5852 };

  // Set in beforeAll. Every listing must belong to a registered agent now, so
  // the suite registers one rather than inventing a UUID the database will
  // refuse.
  let agentId: string;

  const listing = (over: Record<string, unknown> = {}) => ({
    title: 'Test listing',
    description: 'Seeded by the integration suite.',
    type: 'rent',
    category: 'apartment',
    priceMinor: 450_000_000,
    pricePeriod: 'per_annum',
    bedrooms: 3,
    bathrooms: 2,
    toilets: 3,
    addressLine: '1 Test Road',
    locality: 'Yaba',
    state: 'Lagos',
    ...YABA,
    agentId,
    ...over,
  });

  beforeAll(async () => {
    loadEnv();

    // Vitest sets NODE_ENV to test, and AppModule reads TEST_DATABASE_URL in
    // that mode, so the suite cannot reach the development database.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // The same pipeline main.ts installs. Testing against a differently
    // configured app would pass while production rejected the same request.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    dataSource = moduleRef.get(getDataSourceToken());

    // Idempotent: TypeORM records what it has applied, so this costs one
    // query on every run after the first, and means `pnpm test:e2e` is the
    // only command needed on a fresh checkout.
    await dataSource.runMigrations();

    // Agents outlive the per-test truncation below, so this runs once.
    await dataSource.query('TRUNCATE listings, agents CASCADE');

    const { body } = await request(app.getHttpServer())
      .post('/agents')
      .send({
        name: 'Test Agent',
        phone: '+2348030000001',
        email: 'test.agent@example.ng',
        agencyName: 'Test Realty',
      })
      .expect(201);

    agentId = body.id;
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE listings');
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/listings').send(body);

  describe('POST /listings', () => {
    it('creates a listing and mints a quotable reference', async () => {
      const { body, status } = await post(listing());

      expect(status).toBe(201);
      expect(body.reference).toMatch(/^EL-[A-Z2-9]{6}$/);
      expect(body.latitude).toBeCloseTo(YABA.latitude, 4);
      expect(body.longitude).toBeCloseTo(YABA.longitude, 4);
      expect(body.status).toBe('available');
    });

    it('rejects a field that is not on the DTO instead of ignoring it', async () => {
      const { body, status } = await post({ ...listing(), isVerified: true });

      // Silently dropping it would let a client believe it had set something.
      expect(status).toBe(400);
      expect(body.message).toContain('property isVerified should not exist');
    });

    it('rejects coordinates outside the world', async () => {
      const { status } = await post(listing({ latitude: 91 }));

      expect(status).toBe(400);
    });
  });

  describe('GET /listings — distance search', () => {
    beforeEach(async () => {
      await post(listing({ title: 'Yaba flat', locality: 'Yaba', ...YABA }));
      await post(listing({ title: 'Ikeja duplex', locality: 'Ikeja GRA', type: 'sale', category: 'duplex', bedrooms: 4, priceMinor: 32_000_000_000, pricePeriod: 'outright', ...IKEJA_GRA }));
      await post(listing({ title: 'Lekki flat', locality: 'Lekki Phase 1', bedrooms: 2, priceMinor: 850_000_000, ...LEKKI }));
    });

    it('returns only listings inside the radius', async () => {
      // Ikeja GRA is about 10.4 km from Yaba, so 5 km must exclude it.
      const { body } = await request(app.getHttpServer())
        .get('/listings')
        .query({ ...YABA, radiusKm: 5 });

      expect(body.meta.total).toBe(1);
      expect(body.data[0].locality).toBe('Yaba');
    });

    it('orders by distance, nearest first, and reports it', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/listings')
        .query({ ...YABA, radiusKm: 30 });

      expect(body.data.map((l: { locality: string }) => l.locality)).toEqual([
        'Yaba',
        'Ikeja GRA',
        'Lekki Phase 1',
      ]);

      // Checkable against a map: Yaba to Ikeja GRA is roughly 10.4 km.
      expect(body.data[1].distanceMetres).toBeGreaterThan(9_000);
      expect(body.data[1].distanceMetres).toBeLessThan(12_000);
    });

    it('combines distance with the other filters', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/listings')
        .query({ ...YABA, radiusKm: 30, type: 'rent', bedrooms: 3 });

      expect(body.meta.total).toBe(1);
      expect(body.data[0].locality).toBe('Yaba');
    });

    it('treats bedrooms as a minimum, which is what a searcher means', async () => {
      const { body } = await request(app.getHttpServer()).get('/listings').query({ bedrooms: 3 });

      expect(body.data.map((l: { bedrooms: number }) => l.bedrooms).toSorted()).toEqual([3, 4]);
    });

    it('filters on an inclusive price range', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/listings')
        .query({ minPrice: 450_000_000, maxPrice: 850_000_000 });

      expect(body.meta.total).toBe(2);
    });

    it('refuses half a location rather than guessing the rest', async () => {
      const { status, body } = await request(app.getHttpServer())
        .get('/listings')
        .query({ latitude: YABA.latitude });

      expect(status).toBe(400);
      expect(body.message.join(' ')).toMatch(/longitude|radiusKm/);
    });

    it('hides listings that are no longer available unless asked', async () => {
      const { body: created } = await post(listing({ title: 'Already let', locality: 'Surulere' }));
      await request(app.getHttpServer()).patch(`/listings/${created.id}`).send({});
      await dataSource.query(`UPDATE listings SET status = 'taken' WHERE id = $1`, [created.id]);

      const { body: defaultSearch } = await request(app.getHttpServer()).get('/listings');
      expect(defaultSearch.data.map((l: { title: string }) => l.title)).not.toContain('Already let');

      const { body: explicit } = await request(app.getHttpServer())
        .get('/listings')
        .query({ status: 'taken' });
      expect(explicit.meta.total).toBe(1);
    });

    it('paginates with honest metadata', async () => {
      const { body } = await request(app.getHttpServer()).get('/listings').query({ page: 1, limit: 2 });

      expect(body.data).toHaveLength(2);
      expect(body.meta).toMatchObject({ page: 1, limit: 2, total: 3, pages: 2, hasNext: true });
    });
  });

  describe('GET /listings/search — the alias', () => {
    beforeEach(async () => {
      await post(listing({ title: 'Yaba flat', locality: 'Yaba', ...YABA }));
      await post(listing({ title: 'Lekki flat', locality: 'Lekki Phase 1', bedrooms: 2, ...LEKKI }));
    });

    it('answers identically to GET /listings for the same query', async () => {
      const query = { ...YABA, radiusKm: 30, type: 'rent' };

      const [alias, canonical] = await Promise.all([
        request(app.getHttpServer()).get('/listings/search').query(query),
        request(app.getHttpServer()).get('/listings').query(query),
      ]);

      expect(alias.status).toBe(canonical.status);
      // Deep equality, not a spot check: the alias delegates, so any
      // divergence at all means somebody reimplemented it.
      expect(alias.body).toEqual(canonical.body);
      expect(alias.body.meta.total).toBeGreaterThan(0);
    });

    it('is not swallowed by the :id route', async () => {
      // `search` is not a UUID, so if it were declared after `:id` this would
      // come back 400 rather than a result set.
      await request(app.getHttpServer()).get('/listings/search').expect(200);
    });
  });

  describe('agents', () => {
    it('refuses a listing for an agent that does not exist', async () => {
      // The foreign key would refuse this anyway; the point of the check in
      // the service is that the caller gets a 400 they can act on.
      const { body } = await request(app.getHttpServer())
        .post('/listings')
        .send(listing({ agentId: '11111111-2222-4333-8444-555555555555' }))
        .expect(400);

      expect(body.message).toMatch(/No agent with id/);
    });

    it('returns who to call, not just an id', async () => {
      const { body: created } = await post(listing({ title: 'Flat with a contact' }));

      const { body } = await request(app.getHttpServer())
        .get(`/listings/${created.id}`)
        .expect(200);

      expect(body.agentId).toBe(agentId);
      expect(body.agent).toMatchObject({
        id: agentId,
        name: 'Test Agent',
        phone: '+2348030000001',
        agencyName: 'Test Realty',
      });
    });

    it('keeps the agent email out of listing responses', async () => {
      await post(listing());

      const { body } = await request(app.getHttpServer()).get('/listings').expect(200);

      // A search returning a page of listings should not hand out a page of
      // email addresses. The full record is available from /agents/:id.
      expect(JSON.stringify(body)).not.toContain('test.agent@example.ng');
      expect(body.data[0].agent.phone).toBe('+2348030000001');
    });

    it('carries the agent on a freshly created listing too', async () => {
      const { body: created } = await post(listing({ title: 'Created with contact' }));

      expect(created.agent).toMatchObject({ id: agentId, name: 'Test Agent' });
    });

    it('accepts a listing with no agent at all', async () => {
      // An owner advertising their own property. Not every listing goes
      // through an agent, and requiring one would push callers into inventing
      // a fake agent, which is worse than having none.
      const { agentId: _omitted, ...withoutAgent } = listing({ title: 'Owner listing' });

      const { body, status } = await post(withoutAgent);

      expect(status).toBe(201);
      expect(body.agentId).toBeNull();
      expect(body.agent).toBeUndefined();
    });

    it('still finds an agentless listing in a search', async () => {
      const { agentId: _omitted, ...withoutAgent } = listing({ title: 'Owner listing', ...YABA });
      await post(withoutAgent).expect(201);

      const { body } = await request(app.getHttpServer())
        .get('/listings')
        .query({ ...YABA, radiusKm: 5 })
        .expect(200);

      expect(body.data.some((l: { title: string }) => l.title === 'Owner listing')).toBe(true);
    });

    it('refuses a second agent on the same phone number', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/agents')
        .send({ name: 'Someone Else', phone: '+2348030000001', email: 'different@example.ng' })
        .expect(409);

      expect(body.message).toMatch(/phone number/);
    });

    it('refuses a second agent on the same email', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/agents')
        .send({ name: 'Someone Else', phone: '+2348039999999', email: 'test.agent@example.ng' })
        .expect(409);

      expect(body.message).toMatch(/email/);
    });

    it('rejects a phone number that is not a Nigerian mobile', async () => {
      await request(app.getHttpServer())
        .post('/agents')
        .send({ name: 'Bad Phone', phone: '+14155550123', email: 'bad.phone@example.ng' })
        .expect(400);
    });

    it('treats a missing agency as independent rather than as missing data', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/agents')
        .send({ name: 'Independent Agent', phone: '08031112222', email: 'independent@example.ng' })
        .expect(201);

      expect(body.agencyName).toBeNull();
    });

    it('fetches an agent by id and 404s for one that does not exist', async () => {
      const { body } = await request(app.getHttpServer()).get(`/agents/${agentId}`).expect(200);
      expect(body.email).toBe('test.agent@example.ng');

      await request(app.getHttpServer()).get('/agents/11111111-2222-4333-8444-555555555555').expect(404);
    });
  });

  describe('lookup, update and delete', () => {
    it('finds a listing by the reference a caller quotes', async () => {
      const { body: created } = await post(listing());

      const { body } = await request(app.getHttpServer()).get(`/listings/reference/${created.reference}`);

      expect(body.id).toBe(created.id);
    });

    it('updates only what was sent', async () => {
      const { body: created } = await post(listing({ title: 'Original title' }));

      const { body } = await request(app.getHttpServer())
        .patch(`/listings/${created.id}`)
        .send({ bedrooms: 5 });

      expect(body.bedrooms).toBe(5);
      expect(body.title).toBe('Original title');
      expect(body.reference).toBe(created.reference);
    });

    it('deletes, then 404s', async () => {
      const { body: created } = await post(listing());

      await request(app.getHttpServer()).delete(`/listings/${created.id}`).expect(204);
      await request(app.getHttpServer()).get(`/listings/${created.id}`).expect(404);
    });

    it('rejects a malformed id before it reaches the database', async () => {
      await request(app.getHttpServer()).get('/listings/not-a-uuid').expect(400);
    });
  });
});
