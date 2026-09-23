import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/** Trims, and turns an empty optional string into null rather than storing `''`. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateAgentDto {
  @ApiProperty({ example: 'Chinedu Okafor', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name!: string;

  /**
   * Nigerian mobile numbers, in either of the two forms people actually type:
   * `08031234567` or `+2348031234567`. Stored as given rather than normalised,
   * because rewriting what somebody typed into their own contact details is a
   * decision that belongs with the product, not with a validator.
   */
  @ApiProperty({ example: '+2348031234567', description: 'Nigerian mobile, as 0803... or +23480...' })
  @Transform(trim)
  @IsString()
  @Matches(/^(?:\+234|0)[789][01]\d{8}$/, {
    message: 'phone must be a Nigerian mobile number, like 08031234567 or +2348031234567',
  })
  phone!: string;

  @ApiProperty({ example: 'chinedu@lagosrealty.ng' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ example: 'Lagos Realty', maxLength: 160, description: 'Leave out for an independent agent.' })
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  @IsOptional()
  agencyName?: string;
}
