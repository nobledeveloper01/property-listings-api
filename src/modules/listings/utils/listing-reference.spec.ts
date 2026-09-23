import { describe, expect, it } from 'vitest';

import { generateListingReference, isListingReference } from './listing-reference.js';

describe('listing reference', () => {
  it('matches the documented shape', () => {
    expect(generateListingReference()).toMatch(/^EL-[A-Z2-9]{6}$/);
  });

  it('never emits a character that is misread aloud', () => {
    // 0/O and 1/I/L are the pairs people get wrong reading a code over the
    // phone, which is the only thing this identifier is for.
    //
    // Only the random body is checked. The `EL-` prefix is constant and
    // contains an L, which is not a misreading risk precisely because it
    // never varies — but it does mean this assertion has to be aimed at the
    // part that does.
    const bodies = Array.from({ length: 500 }, () => generateListingReference().split('-')[1]).join('');

    expect(bodies).not.toMatch(/[01OIL]/);
  });

  it('does not collide across a realistic batch', () => {
    const batch = new Set(Array.from({ length: 10_000 }, generateListingReference));

    // Not a guarantee, a smoke test: a generator that had lost its randomness
    // would fail this immediately rather than in production.
    expect(batch.size).toBeGreaterThan(9_990);
  });

  it('recognises its own output and rejects near misses', () => {
    expect(isListingReference(generateListingReference())).toBe(true);
    expect(isListingReference('EL-7K2M9')).toBe(false); // too short
    expect(isListingReference('XX-7K2M9Q')).toBe(false); // wrong prefix
    expect(isListingReference('EL-7K2M9O')).toBe(false); // excluded character
  });
});
