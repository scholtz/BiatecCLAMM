import { describe, test, expect } from '@jest/globals';
import pickNarrowestPool from '../../src/common/pickNarrowestPool';

describe('pickNarrowestPool', () => {
  test('returns undefined when no pool has liquidity', () => {
    expect(
      pickNarrowestPool([
        { appId: 1n, priceMin: 100n, priceMax: 200n, liquidity: 0n },
        { appId: 2n, priceMin: 90n, priceMax: 110n, liquidity: 0n },
      ])
    ).toBeUndefined();
  });

  test('picks the pool with the smallest priceMax/priceMin ratio', () => {
    const wide = { appId: 1n, priceMin: 100n, priceMax: 400n, liquidity: 1_000n }; // ratio 4
    const narrow = { appId: 2n, priceMin: 100n, priceMax: 110n, liquidity: 1_000n }; // ratio 1.1
    const medium = { appId: 3n, priceMin: 100n, priceMax: 200n, liquidity: 1_000n }; // ratio 2
    expect(pickNarrowestPool([wide, narrow, medium])).toBe(narrow);
  });

  test('ignores pools without liquidity even if their band is narrower', () => {
    const narrowButEmpty = { appId: 1n, priceMin: 100n, priceMax: 101n, liquidity: 0n };
    const wideButFunded = { appId: 2n, priceMin: 100n, priceMax: 400n, liquidity: 1_000n };
    expect(pickNarrowestPool([narrowButEmpty, wideButFunded])).toBe(wideButFunded);
  });

  test('a flat-price pool (priceMin === priceMax) is the narrowest possible band', () => {
    const flat = { appId: 1n, priceMin: 100n, priceMax: 100n, liquidity: 1_000n };
    const narrow = { appId: 2n, priceMin: 100n, priceMax: 110n, liquidity: 1_000n };
    expect(pickNarrowestPool([flat, narrow])).toBe(flat);
  });
});
