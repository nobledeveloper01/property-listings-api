import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsPositive, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { ListingType } from '../enums/listing-type.enum.js';

export class CreateListingDto {
  @ApiProperty({ example: 'Three bedroom flat, Herbert Macaulay Way, Yaba' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /**
   * Kobo, not naira. Integer arithmetic all the way to the client, which
   * formats it. See the note on `Listing.priceMinor`.
   */
  @ApiProperty({ example: 4_500_000_00, description: 'Price in kobo. ₦4,500,000 is 450000000.' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  priceMinor!: number;

  @ApiProperty({ enum: ListingType, example: ListingType.Rent })
  @IsEnum(ListingType)
  type!: ListingType;

  @ApiProperty({ minimum: 0, maximum: 20, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  bedrooms!: number;

  @ApiProperty({ example: 6.5095, description: 'Latitude, WGS84.' })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 3.3711, description: 'Longitude, WGS84.' })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  agentId!: string;
}
