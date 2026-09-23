import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateListingDto } from '../dto/create-listing.dto.js';
import { Listing } from '../entities/listing.entity.js';
import { ListingType } from '../enums/listing-type.enum.js';
import { PricePeriod } from '../enums/price-period.enum.js';
import { PropertyCategory } from '../enums/property-category.enum.js';
import { ListingsRepository } from '../repositories/listings.repository.js';
import { ListingsService } from './listings.service.js';

/**
 * Unit tests for the service, with the database mocked.
 *
 * What is worth testing here is the translation the service does — latitude
 * and longitude into a GeoJSON point in the order PostGIS expects, numbers
 * into the strings the bigint columns need, and partial updates that leave
 * untouched fields alone. Whether a WHERE clause is correct is not a question
 * a mock can answer, so that is left to the integration tests.
 */
describe('ListingsService', () => {
  let service: ListingsService;
  let listings: { findOne: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; merge: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let searchRepository: { createWithReference: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn> };

  const anyListing = (overrides: Partial<Listing> = {}): Listing =>
    ({
      id: '3f8c1a2e-1111-4b2c-8d3e-9a7b6c5d4e3f',
      reference: 'EL-7K2M9Q',
      title: 'Three bedroom flat, Yaba',
      description: 'Newly built.',
      type: ListingType.Rent,
      category: PropertyCategory.Apartment,
      status: 'available',
      priceMinor: '450000000',
      pricePeriod: PricePeriod.PerAnnum,
      serviceChargeMinor: null,
      bedrooms: 3,
      bathrooms: 3,
      toilets: 4,
      areaSqm: 145,
      furnishing: 'unfurnished',
      amenities: [],
      images: [],
      addressLine: '14 Herbert Macaulay Way',
      locality: 'Yaba',
      state: 'Lagos',
      location: { type: 'Point', coordinates: [3.3711, 6.5095] },
      agentId: '3f8c1a2e-2222-4b2c-8d3e-9a7b6c5d4e3f',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-01T00:00:00Z'),
      ...overrides,
    }) as Listing;

  beforeEach(async () => {
    listings = { findOne: vi.fn(), save: vi.fn(), merge: vi.fn(), delete: vi.fn() };
    searchRepository = { createWithReference: vi.fn(), search: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: getRepositoryToken(Listing), useValue: listings },
        { provide: ListingsRepository, useValue: searchRepository },
      ],
    }).compile();

    service = moduleRef.get(ListingsService);
  });

  describe('create', () => {
    const dto: CreateListingDto = {
      title: 'Three bedroom flat, Yaba',
      description: 'Newly built.',
      type: ListingType.Rent,
      category: PropertyCategory.Apartment,
      priceMinor: 450_000_000,
      pricePeriod: PricePeriod.PerAnnum,
      bedrooms: 3,
      bathrooms: 3,
      toilets: 4,
      addressLine: '14 Herbert Macaulay Way',
      locality: 'Yaba',
      state: 'Lagos',
      latitude: 6.5095,
      longitude: 3.3711,
      agentId: '3f8c1a2e-2222-4b2c-8d3e-9a7b6c5d4e3f',
    };

    it('writes the point longitude first, which is the order PostGIS wants', async () => {
      searchRepository.createWithReference.mockResolvedValue(anyListing());

      await service.create(dto);

      const [data] = searchRepository.createWithReference.mock.calls[0];

      // The single most common geospatial bug: latitude and longitude the
      // wrong way round puts a Lagos listing in the Gulf of Guinea.
      expect(data.location).toEqual({ type: 'Point', coordinates: [3.3711, 6.5095] });
    });

    it('hands money to the bigint column as a string', async () => {
      searchRepository.createWithReference.mockResolvedValue(anyListing());

      await service.create(dto);

      const [data] = searchRepository.createWithReference.mock.calls[0];

      expect(data.priceMinor).toBe('450000000');
    });

    it('returns the reference the database minted, not one it invented', async () => {
      searchRepository.createWithReference.mockResolvedValue(anyListing({ reference: 'EL-ABC234' }));

      await expect(service.create(dto)).resolves.toMatchObject({ reference: 'EL-ABC234' });
    });
  });

  describe('findOne', () => {
    it('converts the stored point back to latitude and longitude', async () => {
      listings.findOne.mockResolvedValue(anyListing());

      const result = await service.findOne('3f8c1a2e-1111-4b2c-8d3e-9a7b6c5d4e3f');

      expect(result).toMatchObject({ latitude: 6.5095, longitude: 3.3711 });
    });

    it('raises a 404 rather than returning null', async () => {
      listings.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('touches only the fields the request mentioned', async () => {
      const existing = anyListing();
      listings.findOne.mockResolvedValue(existing);
      listings.save.mockResolvedValue(existing);

      await service.update(existing.id, { bedrooms: 4 });

      const [, changes] = listings.merge.mock.calls[0];

      // A partial update that quietly blanked the title would be the kind of
      // bug an agent notices a week later.
      expect(changes).toEqual({ bedrooms: 4 });
      expect(changes).not.toHaveProperty('title');
      expect(changes).not.toHaveProperty('location');
    });
  });

  describe('remove', () => {
    it('raises a 404 when nothing was deleted', async () => {
      listings.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
