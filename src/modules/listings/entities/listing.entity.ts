import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { ListingType } from '../enums/listing-type.enum.js';

/**
 * A property on the market.
 *
 * Two decisions worth knowing about before reading the columns:
 *
 * 1. `location` is a PostGIS `geography(Point,4326)`, not a pair of floats.
 *    Storing lat and lng separately forces every distance test into either
 *    application code or a Haversine expression in the WHERE clause, and
 *    neither can use an index. A geography column with a GiST index lets
 *    `ST_DWithin` answer "within X km" from the index, which is the only
 *    version of this that survives a growing table.
 *
 * 2. `priceMinor` is an integer in kobo, not a float in naira. Prices are
 *    money, money is not a float, and ₦45,000,000.00 in a double is a bug
 *    waiting for someone to sum a page of results.
 */
@Entity('listings')
@Index('idx_listings_type_bedrooms', ['type', 'bedrooms'])
@Index('idx_listings_price', ['priceMinor'])
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'bigint', name: 'price_minor' })
  priceMinor!: string;

  @Column({ type: 'enum', enum: ListingType })
  type!: ListingType;

  @Column({ type: 'smallint' })
  bedrooms!: number;

  /**
   * WGS84 point. Written as `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` —
   * note the order: PostGIS takes longitude first, which is the reverse of
   * how everyone says it out loud, and is a reliable source of listings that
   * appear somewhere in the Gulf of Guinea.
   */
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location!: { type: 'Point'; coordinates: [number, number] };

  @Column({ type: 'uuid', name: 'agent_id' })
  @Index('idx_listings_agent')
  agentId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
