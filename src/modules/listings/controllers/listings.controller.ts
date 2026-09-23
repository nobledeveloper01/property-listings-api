import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

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
   * Search and plain listing are the same endpoint.
   *
   * A separate `/listings/search` would duplicate pagination, ordering and
   * the response envelope for the sake of a word in the path, and a client
   * that starts unfiltered and adds a filter would have to change URL
   * mid-journey. Every filter is optional; supplying none lists everything
   * available.
   */
  @Get()
  @ApiOperation({
    summary: 'Search listings by type, price, bedrooms and distance from a point.',
    description:
      'All filters are optional. Supply latitude, longitude and radiusKm together to search by ' +
      'distance; results are then ordered nearest first and carry distanceMetres.',
  })
  @ApiOkResponse({ type: ListingResponseDto, isArray: true })
  findAll(@Query() criteria: SearchListingsDto) {
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
