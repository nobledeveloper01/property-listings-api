/**
 * Where the listing is in its life.
 *
 * The single most common complaint about property portals is listings that
 * are still advertised after the property is gone, so this is not decoration:
 * search excludes everything but `available` unless a caller asks otherwise,
 * and an agent marking a property `taken` is the cheapest trust mechanism
 * the platform has.
 */
export enum ListingStatus {
  Available = 'available',
  UnderOffer = 'under_offer',
  Taken = 'taken',
  Withdrawn = 'withdrawn',
}
