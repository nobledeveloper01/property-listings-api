/**
 * What kind of building it is, as Nigerian listings describe it.
 *
 * RESO calls this PropertySubType and its vocabulary is North American, so
 * this is the local equivalent: `self_contain` (a single room with its own
 * bathroom and kitchen) and `duplex` carry meanings here that do not map onto
 * the RESO list, and `land` is a first-class category in a market where
 * undeveloped plots are a large share of what is traded.
 */
export enum PropertyCategory {
  Apartment = 'apartment',
  House = 'house',
  Duplex = 'duplex',
  Terrace = 'terrace',
  Bungalow = 'bungalow',
  SelfContain = 'self_contain',
  Land = 'land',
  Commercial = 'commercial',
}
