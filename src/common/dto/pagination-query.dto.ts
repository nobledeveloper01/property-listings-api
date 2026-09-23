import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Offset pagination, shared by every list endpoint.
 *
 * Offset rather than cursor, deliberately. Cursor pagination is the better
 * answer for a deep, stable feed, but search results here are ordered by
 * distance from a point the caller chose, so there is no stable cursor key
 * across requests. Offset is honest about what it is, and `limit` is capped
 * so a caller cannot ask for the whole table.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based page number.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
