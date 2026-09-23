/**
 * What the price is per.
 *
 * Without this the price column is meaningless: ₦4,500,000 is an ordinary
 * annual rent in Lekki, an absurd monthly one, and a cheap outright sale.
 * Nigerian rent is quoted per annum rather than per month, which is the
 * default most foreign-built systems get wrong.
 */
export enum PricePeriod {
  PerAnnum = 'per_annum',
  PerMonth = 'per_month',
  PerNight = 'per_night',
  Outright = 'outright',
}
