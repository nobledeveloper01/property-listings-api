/**
 * The three ways a Nigerian property is offered. `shortlet` is the local term
 * for a furnished let by the night or week, and it behaves differently enough
 * from `rent` in pricing and search that it earns its own type rather than a
 * flag on a rental.
 */
export enum ListingType {
  Rent = 'rent',
  Sale = 'sale',
  Shortlet = 'shortlet',
}
