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
  /**
   * Capped, and not only for tidiness. `@IsInt()` happily accepts 1e21
   * because that is an integer, and the resulting OFFSET overflowed
   * Postgres' bigint and turned a bad request into a 500. Deep offset paging
   * is also meaningless — nobody reads page forty thousand — and scanning
   * that far is a cheap way to make the database work hard on request.
   */
  @ApiPropertyOptional({ minimum: 1, maximum: 10_000, default: 1, description: 'One-based page number.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
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
