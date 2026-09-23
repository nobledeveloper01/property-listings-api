import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The listings table, its enums, and the indexes the search depends on.
 *
 * Written by hand rather than generated. A generated migration would produce
 * the same columns but would not create the GiST index, which is the single
 * thing that decides whether the distance search is usable at scale, and it
 * belongs next to a comment saying why.
 */
export class CreateListings1758560000000 implements MigrationInterface {
  name = 'CreateListings1758560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Everything geospatial depends on this. IF NOT EXISTS so the migration
    // is safe against a database where an operator enabled it already.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE listing_type_enum AS ENUM ('rent', 'sale', 'shortlet')
    `);
    await queryRunner.query(`
      CREATE TYPE property_category_enum AS ENUM
        ('apartment', 'house', 'duplex', 'terrace', 'bungalow', 'self_contain', 'land', 'commercial')
    `);
    await queryRunner.query(`
      CREATE TYPE listing_status_enum AS ENUM ('available', 'under_offer', 'taken', 'withdrawn')
    `);
    await queryRunner.query(`
      CREATE TYPE price_period_enum AS ENUM ('per_annum', 'per_month', 'per_night', 'outright')
    `);
    await queryRunner.query(`
      CREATE TYPE furnishing_enum AS ENUM ('unfurnished', 'part_furnished', 'furnished')
    `);

    await queryRunner.query(`
      CREATE TABLE listings (
        id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        reference            varchar(12) NOT NULL,

        title                varchar(200) NOT NULL,
        description          text NOT NULL,
        type                 listing_type_enum NOT NULL,
        category             property_category_enum NOT NULL,
        status               listing_status_enum NOT NULL DEFAULT 'available',

        price_minor          bigint NOT NULL CHECK (price_minor > 0),
        price_period         price_period_enum NOT NULL,
        service_charge_minor bigint CHECK (service_charge_minor IS NULL OR service_charge_minor >= 0),

        bedrooms             smallint NOT NULL CHECK (bedrooms BETWEEN 0 AND 20),
        bathrooms            smallint NOT NULL CHECK (bathrooms BETWEEN 0 AND 20),
        toilets              smallint NOT NULL CHECK (toilets BETWEEN 0 AND 20),
        area_sqm             int CHECK (area_sqm IS NULL OR area_sqm > 0),
        furnishing           furnishing_enum NOT NULL DEFAULT 'unfurnished',
        amenities            text[] NOT NULL DEFAULT '{}',
        images               text[] NOT NULL DEFAULT '{}',

        address_line         varchar(255) NOT NULL,
        locality             varchar(120) NOT NULL,
        state                varchar(80) NOT NULL,
        location             geography(Point, 4326) NOT NULL,

        agent_id             uuid NOT NULL,
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now()
      )
    `);

    // The reason this project uses PostGIS at all.
    //
    // ST_DWithin on a geography column can use a GiST index to discard
    // everything outside the radius before computing a single distance.
    // Without it — or with a Haversine expression in the WHERE clause —
    // every search reads the whole table, which is fine on seed data and
    // useless at fifty thousand listings.
    await queryRunner.query(`
      CREATE INDEX idx_listings_location ON listings USING GIST (location)
    `);

    // The public reference is quoted by people, so it must be unique and it
    // is looked up directly.
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_listings_reference ON listings (reference)
    `);

    // Search filters on status first (non-available listings are excluded by
    // default), then type and bedrooms, so one composite index serves it.
    await queryRunner.query(`
      CREATE INDEX idx_listings_status_type_bedrooms ON listings (status, type, bedrooms)
    `);
    await queryRunner.query(`CREATE INDEX idx_listings_price ON listings (price_minor)`);
    await queryRunner.query(`CREATE INDEX idx_listings_locality ON listings (locality)`);
    await queryRunner.query(`CREATE INDEX idx_listings_agent ON listings (agent_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS listings`);
    await queryRunner.query(`DROP TYPE IF EXISTS furnishing_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS price_period_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS listing_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS property_category_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS listing_type_enum`);
    // The extensions are left alone: another schema in the same database may
    // depend on them, and dropping a shared extension on a rollback is rude.
  }
}
