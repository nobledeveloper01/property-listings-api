import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator.js';

import { CreateListingDto } from '../dto/create-listing.dto.js';
import { ListingResponseDto } from '../dto/listing-response.dto.js';
import { SearchListingsDto } from '../dto/search-listings.dto.js';
import { UpdateListingDto } from '../dto/update-listing.dto.js';
import { ListingsService } from '../services/listings.service.js';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a listing and mint its public reference.' })
  @ApiCreatedResponse({ type: ListingResponseDto })
  create(@Body() dto: CreateListingDto): Promise<ListingResponseDto> {
    return this.listings.create(dto);
  }

  /**
   * Listing and searching are one operation with different arguments.
   *
   * Every filter is optional, so an unfiltered call lists what is available
   * and adding parameters narrows it. A client that starts with a feed and
   * then applies a filter keeps the same URL instead of switching endpoints
   * halfway through.
   */
  @Get()
  @ApiOperation({
    summary: 'Search listings by type, price, bedrooms and distance from a point.',
    description:
      'All filters are optional. Supply latitude, longitude and radiusKm together to search by ' +
      'distance; results are then ordered nearest first and carry distanceMetres.',
  })
  @ApiPaginatedResponse(ListingResponseDto)
  findAll(@Query() criteria: SearchListingsDto) {
    return this.listings.findAll(criteria);
  }

  /**
   * `/listings/search` is an alias for the query above.
   *
   * Callers reach for it, and a search that 404s because the path was
   * spelled the obvious way is a poor welcome. It delegates rather than
   * reimplements, so the two cannot answer differently — a test asserts they
   * return the same body for the same query.
   *
   * Declared before `:id`, like the reference route below, or the UUID route
   * would swallow the word "search" and reject it as a malformed id.
   */
  @Get('search')
  @ApiOperation({
    summary: 'Alias for GET /listings, for callers that expect a search path.',
    description: 'Identical behaviour and identical response to GET /listings with the same query.',
  })
  @ApiPaginatedResponse(ListingResponseDto)
  search(@Query() criteria: SearchListingsDto) {
    return this.listings.findAll(criteria);
  }

  /**
   * Declared before `:id` on purpose. Nest matches routes in declaration
   * order, so with this second, `reference/EL-7K2M9Q` would be swallowed by
   * the UUID route and rejected as a malformed id.
   */
  @Get('reference/:reference')
  @ApiOperation({ summary: 'Fetch a listing by the reference a caller quotes.' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiNotFoundResponse()
  findByReference(@Param('reference') reference: string): Promise<ListingResponseDto> {
    return this.listings.findByReference(reference);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a listing by id.' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ListingResponseDto> {
    return this.listings.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update part of a listing.' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiNotFoundResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<ListingResponseDto> {
    return this.listings.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a listing.' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.listings.remove(id);
  }
}
