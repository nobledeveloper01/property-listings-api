import dataSource from '../data-source.js';
import { Listing } from '../../modules/listings/entities/listing.entity.js';
import { Furnishing } from '../../modules/listings/enums/furnishing.enum.js';
import { ListingType } from '../../modules/listings/enums/listing-type.enum.js';
import { PricePeriod } from '../../modules/listings/enums/price-period.enum.js';
import { PropertyCategory } from '../../modules/listings/enums/property-category.enum.js';

/**
 * Enough real Lagos geography for the search to be worth trying.
 *
 * The coordinates are actual places, spread from Yaba out to Ajah, so a
 * reviewer running `GET /listings?latitude=6.5095&longitude=3.3711&radiusKm=5`
 * gets an answer they can check against a map rather than a list of points
 * that were generated to make the test pass.
 */
const AGENTS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];

/**
 * Ids and references are fixed rather than generated.
 *
 * Seeding truncates and rewrites, so generated ones change on every run —
 * which means no example in the API documentation can ever be correct, and a
 * reviewer who copies an id from one response gets a 404 after the next
 * reseed. Pinning them makes "Try it out" work out of the box.
 */
const SEED: Array<Partial<Listing> & { latitude: number; longitude: number; reference: string; id: string }> = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    reference: 'EL-YABA23',
    title: 'Three bedroom flat, Herbert Macaulay Way',
    description: 'Newly built three bedroom flat with a fitted kitchen and a borehole.',
    type: ListingType.Rent, category: PropertyCategory.Apartment,
    priceMinor: '450000000', pricePeriod: PricePeriod.PerAnnum, serviceChargeMinor: '50000000',
    bedrooms: 3, bathrooms: 3, toilets: 4, areaSqm: 145, furnishing: Furnishing.Unfurnished,
    amenities: ['borehole', 'prepaid meter', 'gated compound'],
    addressLine: '14 Herbert Macaulay Way', locality: 'Yaba', state: 'Lagos',
    latitude: 6.5095, longitude: 3.3711,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    reference: 'EL-PHAS24',
    title: 'Two bedroom serviced flat, Lekki Phase 1',
    description: 'Serviced two bedroom with 24 hour power and a shared gym.',
    type: ListingType.Rent, category: PropertyCategory.Apartment,
    priceMinor: '850000000', pricePeriod: PricePeriod.PerAnnum, serviceChargeMinor: '150000000',
    bedrooms: 2, bathrooms: 2, toilets: 3, areaSqm: 98, furnishing: Furnishing.PartFurnished,
    amenities: ['24/7 power', 'gym', 'security'],
    addressLine: '7 Admiralty Way', locality: 'Lekki Phase 1', state: 'Lagos',
    latitude: 6.4698, longitude: 3.5852,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    reference: 'EL-GRA345',
    title: 'Four bedroom detached duplex, Ikeja GRA',
    description: 'Detached duplex on a quiet street, with a boys quarters.',
    type: ListingType.Sale, category: PropertyCategory.Duplex,
    priceMinor: '32000000000', pricePeriod: PricePeriod.Outright,
    bedrooms: 4, bathrooms: 4, toilets: 5, areaSqm: 320, furnishing: Furnishing.Unfurnished,
    amenities: ['BQ', 'borehole', 'parking for four'],
    addressLine: '12 Oduduwa Way', locality: 'Ikeja GRA', state: 'Lagos',
    latitude: 6.6018, longitude: 3.3515,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    reference: 'EL-VCTRA2',
    title: 'Furnished one bedroom shortlet, Victoria Island',
    description: 'Fully furnished one bedroom, let by the night.',
    type: ListingType.Shortlet, category: PropertyCategory.Apartment,
    priceMinor: '8500000', pricePeriod: PricePeriod.PerNight,
    bedrooms: 1, bathrooms: 1, toilets: 2, areaSqm: 62, furnishing: Furnishing.Furnished,
    amenities: ['wifi', 'air conditioning', 'inverter'],
    addressLine: '1 Adeola Odeku Street', locality: 'Victoria Island', state: 'Lagos',
    latitude: 6.4281, longitude: 3.4219,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    reference: 'EL-SURU25',
    title: 'Self contain, Surulere',
    description: 'Single room self contain with its own kitchen and bathroom.',
    type: ListingType.Rent, category: PropertyCategory.SelfContain,
    priceMinor: '90000000', pricePeriod: PricePeriod.PerAnnum,
    bedrooms: 1, bathrooms: 1, toilets: 1, areaSqm: 28, furnishing: Furnishing.Unfurnished,
    amenities: ['prepaid meter'],
    addressLine: '23 Adeniran Ogunsanya Street', locality: 'Surulere', state: 'Lagos',
    latitude: 6.4969, longitude: 3.3541,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    reference: 'EL-AJAH26',
    title: 'Five bedroom duplex, Ajah',
    description: 'Newly finished five bedroom duplex in a gated estate.',
    type: ListingType.Sale, category: PropertyCategory.Duplex,
    priceMinor: '18500000000', pricePeriod: PricePeriod.Outright,
    bedrooms: 5, bathrooms: 5, toilets: 6, areaSqm: 410, furnishing: Furnishing.Unfurnished,
    amenities: ['gated estate', 'borehole', 'solar'],
    addressLine: '4 Lekki Epe Expressway', locality: 'Ajah', state: 'Lagos',
    latitude: 6.4698, longitude: 3.5679,
  },
];

async function seed(): Promise<void> {
  await dataSource.initialize();

  const repository = dataSource.getRepository(Listing);

  // Idempotent: running it twice should not double the catalogue, and a
  // reviewer will run it twice.
  await repository.query('TRUNCATE listings');

  await repository.save(
    SEED.map(({ latitude, longitude, ...rest }, index) =>
      repository.create({
        ...rest,
        agentId: AGENTS[index % AGENTS.length],
        location: { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] },
      }),
    ),
  );

  process.stdout.write(`Seeded ${SEED.length} listings.\n`);

  await dataSource.destroy();
}

void seed();
