import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsPositive, Max, Min, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { ListingStatus } from '../enums/listing-status.enum.js';
import { ListingType } from '../enums/listing-type.enum.js';
import { PropertyCategory } from '../enums/property-category.enum.js';

/**
 * The search the whole API exists for.
 *
 * Location is three fields that are meaningless apart, so they are validated
 * together: give all of `latitude`, `longitude` and `radiusKm`, or none. Half
 * a location is the kind of input that otherwise returns a plausible looking
 * page of the wrong houses.
 */
export class SearchListingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ListingType })
  @IsEnum(ListingType)
  @IsOptional()
  type?: ListingType;

  @ApiPropertyOptional({ description: 'Minimum price in kobo, inclusive.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in kobo, inclusive.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 20,
    description:
      'Minimum bedrooms, not an exact match. Somebody who asks for 2 will take 3; filtering ' +
      'exactly would hide the better flat next door.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  bedrooms?: number;

  @ApiPropertyOptional({ enum: PropertyCategory })
  @IsEnum(PropertyCategory)
  @IsOptional()
  category?: PropertyCategory;

  /**
   * Defaults to `available` rather than returning everything. A portal that
   * shows let properties by default is the thing every user complains about,
   * so the safe result is the default and seeing the rest is opt-in.
   */
  @ApiPropertyOptional({ enum: ListingStatus, default: ListingStatus.Available })
  @IsEnum(ListingStatus)
  @IsOptional()
  status: ListingStatus = ListingStatus.Available;

  @ApiPropertyOptional({ example: 6.5244, description: 'Centre of the search. Required with longitude and radiusKm.' })
  @ValidateIf((dto: SearchListingsDto) => dto.hasAnyLocationPart)
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 3.3792 })
  @ValidateIf((dto: SearchListingsDto) => dto.hasAnyLocationPart)
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: 5, maximum: 500, description: 'Search radius in kilometres.' })
  @ValidateIf((dto: SearchListingsDto) => dto.hasAnyLocationPart)
  @Type(() => Number)
  @IsPositive()
  @Max(500)
  radiusKm?: number;

  /** True when the caller supplied at least one part of a location. */
  get hasAnyLocationPart(): boolean {
    return this.latitude !== undefined || this.longitude !== undefined || this.radiusKm !== undefined;
  }

  /** True only when the location is complete and therefore usable. */
  get hasLocation(): boolean {
    return this.latitude !== undefined && this.longitude !== undefined && this.radiusKm !== undefined;
  }
}
