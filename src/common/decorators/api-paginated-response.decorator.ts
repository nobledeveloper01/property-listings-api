import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { PaginatedResponseDto, PaginationMetaDto } from '../dto/paginated-response.dto.js';

/**
 * Documents a paginated endpoint in one line.
 *
 * Swagger cannot read a generic, so without this every paginated route has to
 * spell out the `{ data: [...], meta: {...} }` envelope by hand — and the day
 * one of them is written slightly differently, the published contract stops
 * matching the code. One decorator, one definition of the envelope.
 */
export function ApiPaginatedResponse<TModel extends Type<unknown>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, PaginationMetaDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: { $ref: getSchemaPath(PaginationMetaDto) },
            },
            required: ['data', 'meta'],
          },
        ],
      },
    }),
  );
}
