import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import type { Agent } from '../../agents/entities/agent.entity.js';
import { AgentsRepository } from '../../agents/repositories/agents.repository.js';
import type { CreateListingDto } from '../dto/create-listing.dto.js';
import { ListingResponseDto } from '../dto/listing-response.dto.js';
import type { SearchListingsDto } from '../dto/search-listings.dto.js';
import type { UpdateListingDto } from '../dto/update-listing.dto.js';
import { Listing } from '../entities/listing.entity.js';
import { ListingsRepository } from '../repositories/listings.repository.js';
import { generateListingReference } from '../utils/listing-reference.js';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listings: Repository<Listing>,
    private readonly searchRepository: ListingsRepository,
    private readonly agents: AgentsRepository,
  ) {}

  async create(dto: CreateListingDto): Promise<ListingResponseDto> {
    // Only checked when one was supplied; a listing without an agent is valid.
    const agent = dto.agentId === undefined ? undefined : await this.requireAgent(dto.agentId);

    const listing = await this.searchRepository.createWithReference(
      this.toEntity(dto),
      generateListingReference,
    );

    // The agent we just validated, reused rather than re-queried, so a created
    // listing carries the same contact details a fetched one does.
    if (agent !== undefined) {
      listing.agent = agent;
    }

    return ListingResponseDto.from(listing);
  }

  async findAll(criteria: SearchListingsDto): Promise<PaginatedResponseDto<ListingResponseDto>> {
    const [results, total] = await this.searchRepository.search(criteria);

    return PaginatedResponseDto.of(
      results.map(({ listing, distanceMetres }) => ListingResponseDto.from(listing, distanceMetres)),
      total,
      criteria.page,
      criteria.limit,
    );
  }

  async findOne(id: string): Promise<ListingResponseDto> {
    return ListingResponseDto.from(await this.getOrFail(id));
  }

  /** Lookup by the reference a caller quotes rather than the UUID. */
  async findByReference(reference: string): Promise<ListingResponseDto> {
    const listing = await this.listings.findOne({ where: { reference }, relations: { agent: true } });

    if (listing === null) {
      throw new NotFoundException(`No listing with reference ${reference}.`);
    }

    return ListingResponseDto.from(listing);
  }

  async update(id: string, dto: UpdateListingDto): Promise<ListingResponseDto> {
    const reassignedTo = dto.agentId === undefined ? undefined : await this.requireAgent(dto.agentId);

    const listing = await this.getOrFail(id);

    // `merge` rather than `save(dto)`: only the keys present in the request
    // are touched, so a partial update cannot blank a field the caller never
    // mentioned. The reference and the id are not in UpdateListingDto at all,
    // so neither can be reassigned through this route.
    this.listings.merge(listing, this.toEntity(dto));

    // Keep the loaded relation in step with the column, or a reassignment
    // would answer with the previous agent's name against the new agent's id.
    if (reassignedTo !== undefined) {
      listing.agent = reassignedTo;
    }

    return ListingResponseDto.from(await this.listings.save(listing));
  }

  async remove(id: string): Promise<void> {
    const result = await this.listings.delete({ id });

    if (result.affected === 0) {
      throw new NotFoundException(`No listing with id ${id}.`);
    }
  }

  private async getOrFail(id: string): Promise<Listing> {
    const listing = await this.listings.findOne({ where: { id }, relations: { agent: true } });

    if (listing === null) {
      throw new NotFoundException(`No listing with id ${id}.`);
    }

    return listing;
  }

  /**
   * DTO to entity.
   *
   * The only real work is the location: the API takes latitude and longitude
   * because that is how people write coordinates, while GeoJSON and PostGIS
   * both order them longitude first. Doing the swap here, once, is why the
   * rest of the codebase never has to think about it.
   */
  private toEntity(dto: CreateListingDto | UpdateListingDto): Partial<Listing> {
    const { latitude, longitude, priceMinor, serviceChargeMinor, ...rest } = dto;

    return {
      ...rest,
      ...(priceMinor === undefined ? {} : { priceMinor: String(priceMinor) }),
      ...(serviceChargeMinor === undefined
        ? {}
        : { serviceChargeMinor: String(serviceChargeMinor) }),
      ...(latitude === undefined || longitude === undefined
        ? {}
        : { location: { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] } }),
    };
  }

  /**
   * Rejects a listing for an agent who does not exist.
   *
   * The foreign key would refuse the row anyway, but it would surface as a
   * database error and a 500. Checking first turns it into a 400 that names
   * the problem, which is the difference between a caller fixing their request
   * and a caller filing a bug.
   *
   * This is a check, not a lock: an agent deleted between here and the insert
   * still hits the constraint. That race is acceptable because the constraint
   * is the thing actually guaranteeing correctness, and the check exists only
   * to give a better message in the overwhelmingly common case.
   *
   * Returns the agent so the caller can attach it to the response without
   * asking the database for the same row twice.
   */
  private async requireAgent(agentId: string): Promise<Agent> {
    const agent = await this.agents.findById(agentId);

    if (agent === null) {
      throw new BadRequestException(`No agent with id ${agentId}. Register the agent first.`);
    }

    return agent;
  }
}
