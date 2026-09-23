import dataSource from '../data-source.js';
import { Agent } from '../../modules/agents/entities/agent.entity.js';
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
/**
 * Two agents, because every listing must belong to one.
 *
 * One works for a firm and one is independent, which is the split you actually
 * see here, and it exercises `agencyName` being null as a normal state rather
 * than missing data.
 */
const AGENTS: Array<Partial<Agent> & { id: string }> = [
  {
    id: '80e3754d-328b-4a42-bac4-fe9dc50f2bc0',
    name: 'Chinedu Okafor',
    phone: '+2348031234567',
    email: 'chinedu@lagosrealty.ng',
    agencyName: 'Lagos Realty',
  },
  {
    id: '62cd7ee5-8541-4393-a3ba-25c0daf18e4f',
    name: 'Aisha Bello',
    phone: '08129876543',
    email: 'aisha.bello@example.ng',
    agencyName: null,
  },
];

/**
 * Ids and references are fixed rather than generated.
 *
 * Seeding truncates and rewrites, so generated ones change on every run —
 * which means no example in the API documentation can ever be correct, and a
 * reviewer who copies an id from one response gets a 404 after the next
 * reseed. Pinning them makes "Try it out" work out of the box.
 *
 * They are real randomUUID output, generated once and pasted, not values like
 * 1111...1111 typed out by hand. Fixed is the property this needs; guessable
 * is not, and a readable id in a fixture is how a readable id ends up
 * somewhere it matters.
 */
const SEED: Array<Partial<Listing> & { latitude: number; longitude: number; reference: string; id: string }> = [
  {
    id: '5f14d1fa-6534-49ed-b23f-c4d5cb83c759',
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
    id: '5edae5aa-602d-4357-b5a7-bb538203b91b',
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
    id: 'e6c94c58-6e9b-4ea1-831d-1b1b4c297523',
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
    id: '38f3de18-6969-4d8f-a9c9-0c6d999c03f0',
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
    id: '0cd00b31-017c-4790-bfb4-a96736f98868',
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
    id: '2e55a58a-1c27-4242-84f2-631d2dc25c47',
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
  const agents = dataSource.getRepository(Agent);

  // Idempotent: running it twice should not double the catalogue, and a
  // reviewer will run it twice. Listings go first because they point at
  // agents, and CASCADE lets one statement clear both in the right order.
  await repository.query('TRUNCATE listings, agents CASCADE');

  await agents.save(AGENTS.map((agent) => agents.create(agent)));

  await repository.save(
    SEED.map(({ latitude, longitude, ...rest }, index) =>
      repository.create({
        ...rest,
        agentId: AGENTS[index % AGENTS.length].id,
        location: { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] },
      }),
    ),
  );

  process.stdout.write(`Seeded ${AGENTS.length} agents and ${SEED.length} listings.\n`);

  await dataSource.destroy();
}

void seed();
