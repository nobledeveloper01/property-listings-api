# Property Listings API

A listings service for a Nigerian property marketplace. It stores listings for
rent, sale and shortlet, and answers the question the search box actually asks:
*what is available within X km of here, in my budget, with enough bedrooms?*

Built with NestJS, PostgreSQL and PostGIS. Swagger UI is at `/docs` once the
app is running.

## Quick start

You need Docker and Node 20+. The database runs in Docker; the API runs on the
host.

```bash
pnpm install
cp .env.example .env
docker compose up -d          # PostGIS on host port 5433
pnpm migration:run            # creates the table, indexes and extensions
pnpm seed                     # six real Lagos listings, fixed ids
pnpm start:dev
```

Then open http://localhost:3000/docs.

The seeded listings have stable ids and references, so the examples in Swagger
resolve against a freshly seeded database rather than 404ing.

A search that returns something. Rentals within 20 km of Victoria Island,
nearest first:

```bash
curl "http://localhost:3000/listings?latitude=6.4281&longitude=3.4219&radiusKm=20&type=rent"
```

The seeded listings are spread from Yaba out to Ajah, so the radius is worth
varying: at 5 km the only thing near Victoria Island is the shortlet.

### Tests

```bash
pnpm db:test:create   # once
pnpm test             # 16 unit tests, no database needed
pnpm test:e2e         # 17 integration tests against real PostGIS
```

The integration suite truncates between cases, so it runs against its own
database (`TEST_DATABASE_URL`). That is enforced in `app.module.ts` rather than
documented here, because a README note is not a guarantee: when `NODE_ENV` is
`test` the module reads the test URL and cannot open the development database
even by accident. I found this the hard way, after a test run quietly emptied
the database I was demoing from.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/listings` | Create |
| `GET` | `/listings` | List and search, paginated |
| `GET` | `/listings/search` | Alias for the above |
| `GET` | `/listings/:id` | Fetch by uuid |
| `GET` | `/listings/reference/:reference` | Fetch by human reference (`EL-YABA23`) |
| `PATCH` | `/listings/:id` | Partial update |
| `DELETE` | `/listings/:id` | Soft delete |
| `GET` | `/health` | Liveness, checks the database |

## Design choices

### Search and list are one operation

Searching is listing with arguments, so the filters live on `GET /listings`
rather than in a second handler with its own copy of the pagination, the
ordering and the response envelope. A client that starts with an unfiltered
feed and then applies a filter keeps the same URL instead of switching
endpoints halfway through.

`GET /listings/search` exists as an alias, because it is the path people reach
for first and a 404 there is a poor welcome. It delegates to the same handler
rather than reimplementing it, and a test asserts the two return byte-identical
bodies for the same query, so they cannot drift apart later.

Every filter is optional. Supply `latitude`, `longitude` and `radiusKm`
together and the results come back nearest first, each carrying
`distanceMetres`; supply none and you get everything available.

```
GET /listings?type=rent&bedrooms=3&minPrice=100000000&maxPrice=500000000
             &latitude=6.4281&longitude=3.4219&radiusKm=20&page=1&limit=20
```

That one finds the 3 bedroom flat in Yaba. `bedrooms` is a minimum rather than
an exact match, because somebody who asks for 2 will happily take 3. The prices are kobo, so it reads as
"between ₦1m and ₦5m a year", for the reason in the next section but one.

### The radius search is index-backed, and that is the whole point

The obvious way to find listings within X km is to compute the distance to
every row and keep the close ones. It works, and it degrades badly, because
computing a distance for every row means reading every row.

PostGIS gives you a way out. The `location` column is
`geography(Point,4326)` with a GiST index, and the query filters with
`ST_DWithin`, which the planner can answer from that index. `ST_Distance`
appears only in the `SELECT`, to sort and return the distance for rows that
already survived the filter.

Measured on 50,000 listings, same radius, same machine:

| Query | Plan | Time |
|---|---|---|
| `ST_DWithin(location, point, 3000)` | Bitmap Index Scan on `idx_listings_location` | **48 ms** |
| `ST_Distance(location, point) <= 3000` | Parallel Seq Scan | 399 ms |

Eight times faster at fifty thousand rows, and the gap widens with the table.
This is the reason for the PostGIS dependency, and it is why the migration is
hand written instead of generated: TypeORM will not emit a GiST index, so the
one thing the feature depends on would have been silently missing.

### Money is an integer, never a float

Prices are stored as `priceMinor`, a `bigint` count of kobo. Naira rents run
into millions and floating point cannot represent 0.1 exactly, so a `float`
column turns ₦2,500,000.00 into ₦2,499,999.99 sooner or later. Integers do not
have that problem.

`pricePeriod` sits beside it because a Nigerian rent figure is meaningless
without it: ₦3.5m is a normal annual rent in Lekki and an absurd monthly one.

### Both kinds of identifier

Every listing has a `uuid` primary key, generated by the database, and a short
human `reference` like `EL-YABA23`. UUIDs are correct for machines and hostile
to people, and an agent reading a reference over the phone needs something
sayable. The reference alphabet drops `0`, `O`, `1`, `I` and `L` for the same
reason. It is minted with `crypto.randomInt`, checked by a unique index, and
retried on collision, which is proved by the test that creates 40 listings
concurrently and gets 40 distinct references.

### Validation twice, on purpose

The DTOs validate with `class-validator`, and the table repeats the important
rules as `CHECK` constraints (`price_minor > 0`, `bedrooms BETWEEN 0 AND 20`,
latitude and longitude in range). The DTOs give callers a useful 400; the
constraints mean a bad row cannot arrive through a migration, a seed or a
console. `whitelist` and `forbidNonWhitelisted` are on, so a request that tries
to set `status`, `reference` or `id` is rejected rather than quietly ignored.

### Layout

Each module owns its layers in folders (`controllers/`, `services/`,
`repositories/`, `dto/`, `entities/`, `enums/`, `utils/`), so a feature is one
directory rather than seven files scattered across seven top-level folders.

The repository is the only place that writes SQL. `search()` and
`countMatching()` share one `applyFilters()` helper, because a count that
disagrees with its own result set shows up as a pagination control that is off
by a page, and that bug is unpleasant to find.

### Everything else

- **Rate limiting.** `@nestjs/throttler`, per IP, configurable, returning 429.
- **Middleware.** A request logger that honours an inbound `x-request-id` and
  logs on response finish. Middleware rather than an interceptor because
  middleware still sees requests that the throttler rejects, and those are
  exactly the ones worth logging.
- **One error shape.** A global exception filter, so callers parse one
  envelope: `statusCode`, `error`, `message`, `path`, `timestamp`, for a 404, a
  validation failure, a 429 and an unhandled crash alike. `error` is the HTTP
  status text and never a class name, which is a rule worth stating because
  Nest's own `ThrottlerException` published its own name until I checked.
  Unexpected errors log their stack and return a generic 500 message.
- **Pagination.** `page` and `limit`, `limit` capped at 100, `page` capped at
  10,000. That cap is not cosmetic: without it `page=1e21` overflowed the
  `OFFSET` and returned a 500, and a deep offset is a cheap way to make the
  database work hard.
- **helmet**, CORS and a validated environment. The app refuses to boot on a
  missing or malformed variable rather than failing on the first request.

## What I would do next

**Authentication, first.** There is none. `agentId` is supplied by the client,
so anyone can post a listing as any agent, and anyone can delete one. For a
timeboxed exercise I chose to spend the time on the search and the data model
and to say so plainly rather than ship a token check that looked like security
without being it. In production this needs real auth, `agentId` taken from the
token instead of the body, and ownership checks on update and delete.

After that, in order:

- **Caching.** Popular searches (2 bed in Lekki) repeat constantly. Redis with
  a short TTL, keyed on the normalised query.
- **Cursor pagination** for the listing feed. `OFFSET` gets slower the deeper
  you go and can skip or repeat rows when listings are being written underneath
  you.
- **Images as uploads.** They are URLs today. Real ones need a signed upload to
  object storage, and resizing, because agents upload 8 MB photos.
- **Full text search** on title and locality, so "ikoyi 3 bedroom" works.
  Postgres `tsvector` before reaching for Elasticsearch.
- **Observability.** Structured JSON logs and metrics on search latency, which
  is the number that will degrade first.
- **Geocoding.** Callers send coordinates now. Most Nigerian users type an
  estate name, so an address to coordinates step belongs in front of this.

## Notes

Migrations are explicit and `synchronize` is off, including in development.
Auto synchronise is convenient until the day it decides to drop a column.

The e2e suite runs against a real PostGIS instance rather than mocks. The
behaviour worth testing here is the SQL, and a mocked repository would have
tested my assumptions instead of the database's. Those tests check the returned
distances against an independently computed haversine and agree within 0.5%,
the difference being that PostGIS measures on the WGS84 spheroid and haversine
assumes a sphere.
