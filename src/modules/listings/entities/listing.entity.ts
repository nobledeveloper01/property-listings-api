import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Furnishing } from '../enums/furnishing.enum.js';
import { ListingStatus } from '../enums/listing-status.enum.js';
import { ListingType } from '../enums/listing-type.enum.js';
import { PricePeriod } from '../enums/price-period.enum.js';
import { PropertyCategory } from '../enums/property-category.enum.js';

/**
 * A property on the market.
 *
 * Field names follow the RESO Data Dictionary where an equivalent exists, so
 * an import from an MLS-shaped feed later is a mapping rather than a rewrite.
 * Three decisions are worth knowing before reading the columns.
 *
 * 1. `location` is a PostGIS `geography(Point,4326)`, not a pair of floats.
 *    Storing lat and lng separately forces every distance test into either
 *    application code or a Haversine expression in the WHERE clause, and
 *    neither can use an index. A geography column with a GiST index lets
 *    `ST_DWithin` answer "within X km" from the index, which is the only
 *    version of this that survives a growing table.
 *
 * 2. Money is an integer in kobo, never a float in naira. ₦45,000,000.00 in
 *    a double is a bug waiting for someone to sum a page of results.
 *
 * 3. `price` means nothing without `pricePeriod`. Nigerian rent is quoted per
 *    annum, shortlets per night, sales outright, and the same number belongs
 *    to all three.
 */
@Entity('listings')
// Search filters on these together, so they are indexed together. Status
// leads because every search excludes non-available listings by default.
@Index('idx_listings_status_type_bedrooms', ['status', 'type', 'bedrooms'])
@Index('idx_listings_price', ['priceMinor'])
export class Listing {
  /** The system identifier. Stable, opaque, and what every relation points at. */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * The public reference, `EL-7K2M9Q`. What an agent puts on a signboard and
   * a caller quotes. Unique, random rather than sequential, and drawn from an
   * alphabet with no characters people misread aloud. See `listing-reference.ts`.
   */
  @Column({ type: 'varchar', length: 12 })
  @Index('idx_listings_reference', { unique: true })
  reference!: string;

  // --- What it is -----------------------------------------------------

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: ListingType })
  type!: ListingType;

  @Column({ type: 'enum', enum: PropertyCategory })
  category!: PropertyCategory;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.Available })
  status!: ListingStatus;

  // --- What it costs --------------------------------------------------

  @Column({ type: 'bigint', name: 'price_minor' })
  priceMinor!: string;

  @Column({ type: 'enum', enum: PricePeriod, name: 'price_period' })
  pricePeriod!: PricePeriod;

  /**
   * Annual service charge, in kobo. Nigerian rentals quote it separately from
   * rent and a tenant budgeting without it is short by a meaningful amount,
   * so it is a column rather than a line in the description.
   */
  @Column({ type: 'bigint', name: 'service_charge_minor', nullable: true })
  serviceChargeMinor!: string | null;

  // --- What is in it --------------------------------------------------

  @Column({ type: 'smallint' })
  bedrooms!: number;

  @Column({ type: 'smallint' })
  bathrooms!: number;

  /**
   * Nigerian listings count toilets separately from bathrooms, because a
   * guest toilet without a shower is a real and advertised distinction.
   */
  @Column({ type: 'smallint' })
  toilets!: number;

  @Column({ type: 'int', name: 'area_sqm', nullable: true })
  areaSqm!: number | null;

  @Column({ type: 'enum', enum: Furnishing, default: Furnishing.Unfurnished })
  furnishing!: Furnishing;

  /**
   * Free-form because the useful ones here are local and change faster than a
   * schema should: borehole, POP ceiling, gated estate, prepaid meter, BQ.
   * An enum would be wrong within a year.
   */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  amenities!: string[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  images!: string[];

  // --- Where it is ----------------------------------------------------

  @Column({ type: 'varchar', length: 255, name: 'address_line' })
  addressLine!: string;

  /** The area a person would name: Yaba, Lekki Phase 1, Wuse II. */
  @Column({ type: 'varchar', length: 120 })
  @Index('idx_listings_locality')
  locality!: string;

  @Column({ type: 'varchar', length: 80 })
  state!: string;

  /**
   * WGS84 point. Written as `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` —
   * note the order: PostGIS takes longitude first, which is the reverse of
   * how everyone says it out loud, and is a reliable source of listings that
   * appear somewhere in the Gulf of Guinea.
   */
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: { type: 'Point'; coordinates: [number, number] };

  // --- Who is selling it ----------------------------------------------

  @Column({ type: 'uuid', name: 'agent_id' })
  @Index('idx_listings_agent')
  agentId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
