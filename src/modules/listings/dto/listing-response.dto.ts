import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { Listing } from '../entities/listing.entity.js';
import { Furnishing } from '../enums/furnishing.enum.js';
import { ListingStatus } from '../enums/listing-status.enum.js';
import { ListingType } from '../enums/listing-type.enum.js';
import { PricePeriod } from '../enums/price-period.enum.js';
import { PropertyCategory } from '../enums/property-category.enum.js';

/**
 * What a client sees. Separate from the entity on purpose: the entity is a
 * database shape that will grow columns with no business on the wire, and
 * `location` in particular is a PostGIS structure rather than something a
 * mobile app wants to parse.
 */
export class ListingResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'EL-7K2M9Q', description: 'The reference a caller quotes.' }) reference!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ListingType }) type!: ListingType;
  @ApiProperty({ enum: PropertyCategory }) category!: PropertyCategory;
  @ApiProperty({ enum: ListingStatus }) status!: ListingStatus;

  @ApiProperty({ description: 'Price in kobo.' }) priceMinor!: number;
  @ApiProperty({ enum: PricePeriod }) pricePeriod!: PricePeriod;
  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Annual service charge in kobo, when the listing states one.' })
  serviceChargeMinor!: number | null;

  @ApiProperty() bedrooms!: number;
  @ApiProperty() bathrooms!: number;
  @ApiProperty() toilets!: number;
  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Floor area in square metres, when known.' })
  areaSqm!: number | null;
  @ApiProperty({ enum: Furnishing }) furnishing!: Furnishing;
  @ApiProperty({ type: [String] }) amenities!: string[];
  @ApiProperty({ type: [String] }) images!: string[];

  @ApiProperty() addressLine!: string;
  @ApiProperty() locality!: string;
  @ApiProperty() state!: string;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;

  @ApiProperty({ format: 'uuid' }) agentId!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  /** Present only on search results that supplied a location. */
  @ApiPropertyOptional({ description: 'Metres from the searched point.' })
  distanceMetres?: number;

  static from(listing: Listing, distanceMetres?: number): ListingResponseDto {
    const [longitude, latitude] = listing.location.coordinates;

    return {
      id: listing.id,
      reference: listing.reference,
      title: listing.title,
      description: listing.description,
      type: listing.type,
      category: listing.category,
      status: listing.status,
      // bigint arrives from pg as a string; the wire contract is a number.
      priceMinor: Number(listing.priceMinor),
      pricePeriod: listing.pricePeriod,
      serviceChargeMinor: listing.serviceChargeMinor === null ? null : Number(listing.serviceChargeMinor),
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      toilets: listing.toilets,
      areaSqm: listing.areaSqm,
      furnishing: listing.furnishing,
      amenities: listing.amenities,
      images: listing.images,
      addressLine: listing.addressLine,
      locality: listing.locality,
      state: listing.state,
      latitude,
      longitude,
      agentId: listing.agentId,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      ...(distanceMetres === undefined ? {} : { distanceMetres: Math.round(distanceMetres) }),
    };
  }
}
