import { randomInt } from 'node:crypto';

/**
 * The reference a person quotes down the phone.
 *
 * The UUID primary key is the system's identifier and is fine for machines,
 * but nobody reads `9f8c1a2e-…` to an agent, and a marketplace needs
 * something an agent can write on a signboard and a caller can repeat without
 * spelling it twice.
 *
 * Two deliberate choices:
 *
 * 1. **Random, not sequential.** A counting reference tells competitors how
 *    many listings exist and how fast they are added, and it lets anyone walk
 *    the catalogue by incrementing a number.
 *
 * 2. **An alphabet without ambiguous characters.** No 0/O, no 1/I/L. Those
 *    are the characters people get wrong reading a code aloud, and the whole
 *    point of this field is being read aloud.
 *
 * 28 usable characters over 6 positions is roughly 481 million combinations,
 * which is ample for the collision-retry the repository does on insert.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 6;
const PREFIX = 'EL';

export function generateListingReference(): string {
  let body = '';

  for (let i = 0; i < LENGTH; i += 1) {
    // randomInt over Math.random: this is an identifier, and a predictable
    // one would let somebody guess references for listings they cannot see.
    body += ALPHABET[randomInt(ALPHABET.length)];
  }

  return `${PREFIX}-${body}`;
}

/** Shape check, used by the route parameter so a bad reference 404s rather than hitting the database. */
export const LISTING_REFERENCE_PATTERN = new RegExp(`^${PREFIX}-[${ALPHABET}]{${LENGTH}}$`);

export function isListingReference(value: string): boolean {
  return LISTING_REFERENCE_PATTERN.test(value);
}
