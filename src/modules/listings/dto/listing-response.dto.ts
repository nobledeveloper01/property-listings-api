import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { Listing } from '../entities/listing.entity.js';
import { ListingType } from '../enums/listing-type.enum.js';

/**
 * What a client sees. Separate from the entity on purpose: the entity is a
 * database shape and will grow columns that have no business on the wire,
 * and `location` in particular is a PostGIS structure rather than something
 * a mobile app wants to parse.
 */
export class ListingResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ description: 'Price in kobo.' }) priceMinor!: number;
  @ApiProperty({ enum: ListingType }) type!: ListingType;
  @ApiProperty() bedrooms!: number;
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
      title: listing.title,
      // bigint arrives from pg as a string; the wire contract is a number.
      priceMinor: Number(listing.priceMinor),
      type: listing.type,
      bedrooms: listing.bedrooms,
      latitude,
      longitude,
      agentId: listing.agentId,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      ...(distanceMetres === undefined ? {} : { distanceMetres: Math.round(distanceMetres) }),
    };
  }
}
