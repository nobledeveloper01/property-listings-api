import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() pages!: number;
  @ApiProperty() hasNext!: boolean;
}

/**
 * One response envelope for every paginated endpoint, so a client writes the
 * paging logic once. Generic in the item type; Swagger needs the shape spelled
 * out per endpoint, which `ApiPaginatedResponse` handles.
 */
export class PaginatedResponseDto<T> {
  data!: T[];
  meta!: PaginationMetaDto;

  static of<T>(data: T[], total: number, page: number, limit: number): PaginatedResponseDto<T> {
    const pages = limit > 0 ? Math.ceil(total / limit) : 0;
    return {
      data,
      meta: { page, limit, total, pages, hasNext: page < pages },
    };
  }
}
