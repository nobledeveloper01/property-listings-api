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
 * TypeORM was called with a string, which proves nothing. Run
 * `docker compose up -d` first.
 */
describe('Listings (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Three real places, so the distances in the assertions are checkable
  // against a map rather than being whatever the code happened to produce.
  const YABA = { latitude: 6.5095, longitude: 3.3711 };
  const IKEJA_GRA = { latitude: 6.6018, longitude: 3.3515 };
  const LEKKI = { latitude: 6.4698, longitude: 3.5852 };

  const agentId = '3f8c1a2e-2222-4b2c-8d3e-9a7b6c5d4e3f';

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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // The same pipeline main.ts installs. Testing against a differently
    // configured app would pass while production rejected the same request.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    dataSource = moduleRef.get(getDataSourceToken());
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
