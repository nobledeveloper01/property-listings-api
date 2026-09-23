import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEnum, IsInt, IsLatitude, IsLongitude, IsNotEmpty,
  IsOptional, IsPositive, IsString, IsUrl, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Furnishing } from '../enums/furnishing.enum.js';
import { ListingType } from '../enums/listing-type.enum.js';
import { PricePeriod } from '../enums/price-period.enum.js';
import { PropertyCategory } from '../enums/property-category.enum.js';

export class CreateListingDto {
  @ApiProperty({ example: 'Three bedroom flat, Herbert Macaulay Way, Yaba' })
  @IsString() @IsNotEmpty() @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Newly built three bedroom flat with a fitted kitchen and 24/7 power.' })
  @IsString() @IsNotEmpty() @MaxLength(5_000)
  description!: string;

  @ApiProperty({ enum: ListingType, example: ListingType.Rent })
  @IsEnum(ListingType)
  type!: ListingType;

  @ApiProperty({ enum: PropertyCategory, example: PropertyCategory.Apartment })
  @IsEnum(PropertyCategory)
  category!: PropertyCategory;

  /** Kobo, not naira. Integer arithmetic all the way to the client, which formats it. */
  @ApiProperty({ example: 450_000_000, description: 'Price in kobo. ₦4,500,000 is 450000000.' })
  @Type(() => Number) @IsInt() @IsPositive()
  priceMinor!: number;

  @ApiProperty({ enum: PricePeriod, example: PricePeriod.PerAnnum, description: 'The price is meaningless without this.' })
  @IsEnum(PricePeriod)
  pricePeriod!: PricePeriod;

  @ApiPropertyOptional({ example: 50_000_000, description: 'Annual service charge in kobo.' })
  @Type(() => Number) @IsInt() @Min(0) @IsOptional()
  serviceChargeMinor?: number;

  @ApiProperty({ minimum: 0, maximum: 20, example: 3 })
  @Type(() => Number) @IsInt() @Min(0) @Max(20)
  bedrooms!: number;

  @ApiProperty({ minimum: 0, maximum: 20, example: 3 })
  @Type(() => Number) @IsInt() @Min(0) @Max(20)
  bathrooms!: number;

  @ApiProperty({ minimum: 0, maximum: 20, example: 4, description: 'Counted separately from bathrooms, as Nigerian listings do.' })
  @Type(() => Number) @IsInt() @Min(0) @Max(20)
  toilets!: number;

  @ApiPropertyOptional({ example: 145, description: 'Floor area in square metres.' })
  @Type(() => Number) @IsInt() @IsPositive() @IsOptional()
  areaSqm?: number;

  @ApiPropertyOptional({ enum: Furnishing, default: Furnishing.Unfurnished })
  @IsEnum(Furnishing) @IsOptional()
  furnishing?: Furnishing;

  @ApiPropertyOptional({ type: [String], example: ['borehole', 'gated estate', 'prepaid meter'] })
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true }) @IsOptional()
  amenities?: string[];

  @ApiPropertyOptional({ type: [String], example: ['https://cdn.example.ng/listings/1.jpg'] })
  @IsArray() @ArrayMaxSize(20) @IsUrl({}, { each: true }) @IsOptional()
  images?: string[];

  @ApiProperty({ example: '14 Herbert Macaulay Way' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  addressLine!: string;

  @ApiProperty({ example: 'Yaba', description: 'The area a person would name.' })
  @IsString() @IsNotEmpty() @MaxLength(120)
  locality!: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString() @IsNotEmpty() @MaxLength(80)
  state!: string;

  @ApiProperty({ example: 6.5095, description: 'Latitude, WGS84.' })
  @Type(() => Number) @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 3.3711, description: 'Longitude, WGS84.' })
  @Type(() => Number) @IsLongitude()
  longitude!: number;

  @ApiProperty({ format: 'uuid', example: '80e3754d-328b-4a42-bac4-fe9dc50f2bc0' })
  @IsUUID()
  agentId!: string;
}
