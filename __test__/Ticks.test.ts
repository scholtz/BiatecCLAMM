import { describe, test, expect } from '@jest/globals';
import {
  TICK_TYPES,
  DEFAULT_TICK_TYPE,
  TICK_TYPE_TO_PRECISION,
  PRECISION_TO_TICK_TYPE,
  precisionForTickType,
  tickTypeForPrecision,
  tickDecimals,
  cleanLogTick,
  getTickSize,
  getTickDecimals,
  snapPriceToTick,
  suggestTickTypeForRange,
  initPriceDecimals,
  priceTickDecimals,
  toFixedBigInt,
  fromFixedBigInt,
  TickType,
  TICK_GRID_ANCHORS,
  MAX_TICK_GRID_BOUNDARIES,
  tickGridBoundaryBelow,
  tickGridBoundaryAbove,
  nextTickGridBoundary,
  prevTickGridBoundary,
  tickGridWidthAt,
  tickGridBoundaries,
} from '../src/ticks';

/** Canonical mantissas of one decade per precision, as documented in tickGrid.ts. */
const decadeMantissas = (precision: number): number[] => {
  if (precision === 0) return [1, 2, 5];
  const out: number[] = [];
  const segments: [number, number][] = [
    [1, 2],
    [2, 5],
    [5, 10],
  ];
  for (const [anchor, next] of segments) {
    const step = anchor / 10 ** precision;
    for (let value = anchor; value < next - 1e-12; value += step) {
      out.push(Number(value.toFixed(precision)));
    }
  }
  return out;
};

describe('tick type mapping', () => {
  test('exposes three widths widest -> narrowest', () => {
    expect(TICK_TYPES).toEqual(['wide', 'normal', 'narrow']);
    expect(DEFAULT_TICK_TYPE).toBe('normal');
  });

  test('precision <-> tick type are consistent', () => {
    for (const type of TICK_TYPES) {
      const precision = precisionForTickType(type);
      expect(TICK_TYPE_TO_PRECISION[type]).toBe(precision);
      expect(PRECISION_TO_TICK_TYPE[precision]).toBe(type);
      expect(tickTypeForPrecision(precision)).toBe(type);
    }
  });

  test('lower precision means wider ticks', () => {
    expect(precisionForTickType('wide')).toBeLessThan(precisionForTickType('normal'));
    expect(precisionForTickType('normal')).toBeLessThan(precisionForTickType('narrow'));
  });

  test('non-level precision snaps to the nearest tick type', () => {
    // asset-derived precisions like 4 or 6 must still resolve to a valid width
    expect(tickTypeForPrecision(4)).toBe('narrow');
    expect(tickTypeForPrecision(0)).toBe('wide');
    expect(tickTypeForPrecision(6)).toBe('narrow');
  });
});

describe('canonical tick grid', () => {
  test('anchors every decade at 1, 2, 5', () => {
    expect(TICK_GRID_ANCHORS).toEqual([1, 2, 5]);
  });

  test('wide grid is exactly 1, 2, 5 x 10^k', () => {
    expect(tickGridBoundaries(0.05, 20, 0)).toEqual([0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
    expect(tickGridBoundaries(1000, 5000, 0)).toEqual([1000, 2000, 5000]);
  });

  test('normal grid subdivides each anchor segment into 10% / 4% / 10% bins', () => {
    expect(tickGridBoundaries(1, 2, 1)).toEqual([1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2]);
    expect(tickGridBoundaries(2, 3, 1)).toEqual([2, 2.2, 2.4, 2.6, 2.8, 3]);
    expect(tickGridBoundaries(5, 10, 1)).toEqual([5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]);
    expect(tickGridBoundaries(0.9, 1.0, 1)).toEqual([0.9, 0.95, 1]);
  });

  test('narrow grid subdivides each anchor segment into 1% / 0.4% / 1% bins', () => {
    expect(tickGridBoundaries(1, 1.05, 2)).toEqual([1, 1.01, 1.02, 1.03, 1.04, 1.05]);
    expect(tickGridBoundaries(2, 2.1, 2)).toEqual([2, 2.02, 2.04, 2.06, 2.08, 2.1]);
    expect(tickGridBoundaries(5, 5.2, 2)).toEqual([5, 5.05, 5.1, 5.15, 5.2]);
  });

  test('a whole decade has 3 / 35 / 350 bins for wide / normal / narrow', () => {
    for (const [precision, bins] of [
      [0, 3],
      [1, 35],
      [2, 350],
    ] as const) {
      const boundaries = tickGridBoundaries(1, 10, precision);
      expect(boundaries.length - 1).toBe(bins);
      expect(boundaries).toEqual([...decadeMantissas(precision), 10]);
    }
  });

  test('boundaries are exact short decimals at any magnitude (no float drift)', () => {
    for (const precision of [0, 1, 2]) {
      for (const exponent of [-6, -3, -1, 0, 2, 5, 9]) {
        const scale = 10 ** exponent;
        const expected = [...decadeMantissas(precision), 10].map((m) => Number(`${m}e${exponent}`));
        expect(tickGridBoundaries(scale, 10 * scale, precision)).toEqual(expected);
      }
    }
  });

  test('is anchor independent: the boundaries do not depend on where the walk starts', () => {
    // The production bug: three visits at mid prices ~1000/1500/1600 created gold/algo
    // pools bounded at 536-2140, 1080-2160 and 1090-2180. Every window that contains
    // 1500 must now contain exactly the same bin around it.
    for (const precision of [0, 1, 2]) {
      const reference = tickGridBoundaries(1000, 2000, precision);
      for (const from of [536, 800, 1000, 1080, 1090, 1234.5678, 1499.99]) {
        const boundaries = tickGridBoundaries(from, 2500, precision);
        // Every reference boundary inside this window must be reproduced exactly.
        for (const bound of reference.filter((b) => b >= boundaries[0])) {
          expect(boundaries).toContain(bound);
        }
        // And the bin containing 1500 is always the same one.
        const index = boundaries.findIndex((b, i) => b <= 1500 && boundaries[i + 1] > 1500);
        expect(boundaries[index]).toBe(tickGridBoundaryBelow(1500, precision));
        expect(boundaries[index + 1]).toBe(tickGridBoundaryAbove(1500, precision));
      }
    }
    expect(tickGridBoundaryBelow(1500, 0)).toBe(1000);
    expect(tickGridBoundaryAbove(1500, 0)).toBe(2000);
    expect(tickGridBoundaryBelow(1080, 0)).toBe(1000);
    expect(tickGridBoundaryBelow(536, 0)).toBe(500);
  });

  test('a wider window yields a superset of a narrower one', () => {
    for (const precision of [0, 1, 2]) {
      const inner = tickGridBoundaries(0.3, 3, precision);
      const outer = tickGridBoundaries(0.01, 30, precision);
      for (const bound of inner) expect(outer).toContain(bound);
    }
  });

  test('first boundary is <= from and last boundary is >= to', () => {
    for (const precision of [0, 1, 2]) {
      for (const [from, to] of [
        [0.00123, 0.0456],
        [0.9, 1.0],
        [536, 2140],
        [1080, 2160],
        [7, 7.0001],
      ] as const) {
        const boundaries = tickGridBoundaries(from, to, precision);
        expect(boundaries.length).toBeGreaterThanOrEqual(2);
        expect(boundaries[0]).toBeLessThanOrEqual(from);
        expect(boundaries[boundaries.length - 1]).toBeGreaterThanOrEqual(to);
        boundaries.slice(1).forEach((bound, i) => {
          expect(bound).toBeGreaterThan(boundaries[i]);
        });
      }
    }
  });

  test('below / above / next / prev agree with each other', () => {
    for (const precision of [0, 1, 2, 4]) {
      for (const price of [0.0013, 0.09, 0.5, 0.94, 1, 1.07, 2, 4.99, 5, 9.99, 42, 536, 1500, 99999]) {
        const below = tickGridBoundaryBelow(price, precision);
        const above = tickGridBoundaryAbove(price, precision);
        expect(below).toBeLessThanOrEqual(price);
        expect(above).toBeGreaterThan(price);
        expect(nextTickGridBoundary(below, precision)).toBe(above);
        expect(prevTickGridBoundary(above, precision)).toBe(below);
        expect(tickGridWidthAt(price, precision)).toBeCloseTo(above - below, 12);
        // A boundary is its own "below".
        expect(tickGridBoundaryBelow(below, precision)).toBe(below);
      }
    }
  });

  test('crosses decades correctly in both directions', () => {
    expect(nextTickGridBoundary(5, 0)).toBe(10);
    expect(prevTickGridBoundary(10, 0)).toBe(5);
    expect(prevTickGridBoundary(1, 0)).toBe(0.5);
    expect(nextTickGridBoundary(9.5, 1)).toBe(10);
    expect(prevTickGridBoundary(10, 1)).toBe(9.5);
    expect(prevTickGridBoundary(1, 1)).toBe(0.95);
    expect(prevTickGridBoundary(2, 1)).toBe(1.9);
    expect(prevTickGridBoundary(5, 1)).toBe(4.8);
    expect(prevTickGridBoundary(1, 2)).toBe(0.995);
  });

  test('bin widths are the documented 1, 3, 5 (wide) and 1, 2, 5 x 10^n (finer) values', () => {
    expect(tickGridWidthAt(1500, 0)).toBe(1000);
    expect(tickGridWidthAt(3000, 0)).toBe(3000);
    expect(tickGridWidthAt(7000, 0)).toBe(5000);
    expect(tickGridWidthAt(1500, 1)).toBe(100);
    expect(tickGridWidthAt(3000, 1)).toBe(200);
    expect(tickGridWidthAt(7000, 1)).toBe(500);
    expect(tickGridWidthAt(0.0015, 2)).toBe(0.00001);
    expect(tickGridWidthAt(0.003, 2)).toBe(0.00002);
    expect(tickGridWidthAt(0.007, 2)).toBe(0.00005);
  });

  test('rejects unusable input without spinning', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(tickGridBoundaryBelow(bad, 1)).toBe(0);
      expect(tickGridBoundaryAbove(bad, 1)).toBe(0);
      expect(tickGridWidthAt(bad, 1)).toBe(0);
      expect(tickGridBoundaries(bad, 10, 1)).toEqual([]);
      expect(tickGridBoundaries(1, bad, 1)).toEqual([]);
    }
    expect(tickGridBoundaries(2, 1, 1)).toEqual([]);
    expect(tickGridBoundaries(1, 1, 1)).toEqual([]);
    // Huge spans hit the cap instead of walking forever.
    const capped = tickGridBoundaries(1e-9, 1e9, 2);
    expect(capped.length).toBe(MAX_TICK_GRID_BOUNDARIES);
    expect(tickGridBoundaries(1e-9, 1e9, 2, 50).length).toBe(50);
  });
});

describe('tickDecimals', () => {
  test('scales logarithmically with the tick', () => {
    expect(tickDecimals(100)).toBe(0);
    expect(tickDecimals(1)).toBe(0);
    expect(tickDecimals(0.1)).toBe(1);
    expect(tickDecimals(0.02)).toBe(2);
    expect(tickDecimals(0.05)).toBe(2);
    expect(tickDecimals(0.001)).toBe(3);
    expect(tickDecimals(1e-6)).toBe(6);
  });

  test('handles invalid input', () => {
    expect(tickDecimals(0)).toBe(0);
    expect(tickDecimals(-1)).toBe(0);
    expect(tickDecimals(Number.NaN)).toBe(0);
  });
});

describe('cleanLogTick / getTickSize', () => {
  test('is the width of the canonical bin containing the price, at any magnitude', () => {
    expect(getTickSize(0.9, 'normal')).toBe(0.05);
    expect(cleanLogTick(0.9, 'normal')).toBe(0.05);
    expect(getTickSize(1.23, 'normal')).toBe(0.1);
    expect(getTickSize(10000, 'normal')).toBe(1000);
    expect(getTickSize(10000, 'wide')).toBe(10000);
    expect(getTickSize(1500, 'wide')).toBe(1000);
    expect(getTickSize(0.001, 'normal')).toBe(0.0001);
    expect(getTickSize(1000, 'wide')).toBe(1000);
    expect(getTickSize(0.001, 'narrow')).toBe(0.00001);
  });

  test('accepts a raw numeric precision too', () => {
    expect(cleanLogTick(10000, precisionForTickType('normal'))).toBe(getTickSize(10000, 'normal'));
  });

  test('returns 0 for invalid prices', () => {
    expect(cleanLogTick(0, 'normal')).toBe(0);
    expect(cleanLogTick(-5, 'normal')).toBe(0);
    expect(cleanLogTick(Number.NaN, 'normal')).toBe(0);
  });

  test('narrower tick type gives a smaller (or equal) tick', () => {
    for (const price of [0.0013, 0.9, 1, 12.34, 1000, 10000]) {
      expect(getTickSize(price, 'narrow')).toBeLessThanOrEqual(getTickSize(price, 'normal'));
      expect(getTickSize(price, 'normal')).toBeLessThanOrEqual(getTickSize(price, 'wide'));
    }
  });
});

describe('getTickDecimals', () => {
  test('matches the decimals of the tick size', () => {
    for (const type of TICK_TYPES) {
      for (const price of [0.001, 0.9, 1, 12.34, 1000, 10000]) {
        expect(getTickDecimals(price, type)).toBe(tickDecimals(getTickSize(price, type)));
      }
    }
    expect(getTickDecimals(0.001, 'narrow')).toBe(5);
    expect(getTickDecimals(10000, 'normal')).toBe(0);
  });
});

describe('snapPriceToTick', () => {
  test('snaps to the nearest canonical boundary by default', () => {
    expect(snapPriceToTick(0.94, 'normal')).toBe(0.95);
    expect(snapPriceToTick(0.91, 'normal')).toBe(0.9);
    expect(snapPriceToTick(1500, 'wide')).toBe(2000);
    expect(snapPriceToTick(1400, 'wide')).toBe(1000);
    expect(snapPriceToTick(1080, 'normal')).toBe(1100);
  });

  test('supports down / up rounding', () => {
    expect(snapPriceToTick(10123, 'normal', 'down')).toBe(10000);
    expect(snapPriceToTick(10123, 'normal', 'up')).toBe(11000);
    expect(snapPriceToTick(1500, 'wide', 'down')).toBe(1000);
    expect(snapPriceToTick(1500, 'wide', 'up')).toBe(2000);
  });

  test('a price already on the grid is returned unchanged in every rounding mode', () => {
    for (const type of TICK_TYPES) {
      for (const price of [0.5, 1, 2, 5, 1000, 2000]) {
        expect(snapPriceToTick(price, type, 'down')).toBe(price);
        expect(snapPriceToTick(price, type, 'up')).toBe(price);
        expect(snapPriceToTick(price, type)).toBe(price);
      }
    }
  });

  test('a snapped price is stable (idempotent)', () => {
    for (const type of TICK_TYPES) {
      for (const price of [0.0013, 0.9, 1.07, 42, 9999, 536, 1090]) {
        const once = snapPriceToTick(price, type);
        expect(snapPriceToTick(once, type)).toBe(once);
      }
    }
  });

  test('never returns a negative price', () => {
    expect(snapPriceToTick(0, 'normal')).toBe(0);
    expect(snapPriceToTick(-10, 'normal')).toBe(0);
  });

  test('snapped price sits on a canonical boundary', () => {
    for (const type of TICK_TYPES) {
      const precision = precisionForTickType(type);
      for (const price of [1.2345, 0.0777, 6543.21]) {
        const snapped = snapPriceToTick(price, type);
        expect(tickGridBoundaryBelow(snapped, precision)).toBe(snapped);
      }
    }
  });
});

describe('initPriceDecimals / priceTickDecimals (primitives)', () => {
  test('priceTickDecimals scales with magnitude', () => {
    expect(priceTickDecimals(1000, 4)).toBe(0);
    expect(priceTickDecimals(1, 4)).toBe(3);
    expect(priceTickDecimals(0.001, 4)).toBe(6);
    expect(priceTickDecimals(0, 4)).toBe(3);
  });

  test('initPriceDecimals describes the canonical bin containing the price', () => {
    const res = initPriceDecimals(toFixedBigInt(0.9), 1n);
    expect(fromFixedBigInt(res.fitPrice)).toBe(0.9);
    expect(fromFixedBigInt(res.tick)).toBe(0.05);
    expect(res.priceDecimals).toBe(2n);

    const wide = initPriceDecimals(toFixedBigInt(1500), 0n);
    expect(fromFixedBigInt(wide.fitPrice)).toBe(1000);
    expect(fromFixedBigInt(wide.tick)).toBe(1000);
    expect(wide.priceDecimals).toBe(0n);
  });

  test('walking fitPrice + tick reproduces the canonical grid from any start', () => {
    for (const precision of [0n, 1n, 2n]) {
      for (const start of [536, 1080, 1090, 1500]) {
        const walked: number[] = [];
        let price = toFixedBigInt(start);
        Array.from({ length: 6 }).forEach(() => {
          const step = initPriceDecimals(price, precision);
          walked.push(fromFixedBigInt(step.fitPrice));
          price = step.fitPrice + step.tick;
        });
        const canonical = tickGridBoundaries(start, 1e9, Number(precision), 7);
        expect(walked).toEqual(canonical.slice(0, 6));
      }
    }
  });

  test('initPriceDecimals falls back safely for a zero price', () => {
    const res = initPriceDecimals(0n, 1n);
    expect(res.tick).toBeGreaterThan(0n);
    expect(res.fitPrice).toBeGreaterThan(0n);
  });
});

describe('suggestTickTypeForRange', () => {
  test('returns null for a degenerate / wall range', () => {
    expect(suggestTickTypeForRange(1, 1)).toBeNull();
    expect(suggestTickTypeForRange(1.1, 1)).toBeNull();
    expect(suggestTickTypeForRange(0, 1)).toBeNull();
    expect(suggestTickTypeForRange(Number.NaN, 1)).toBeNull();
  });

  test('prefers the widest fitting width', () => {
    // One wide bin exactly.
    expect(suggestTickTypeForRange(1000, 2000)).toBe('wide');
    expect(suggestTickTypeForRange(2000, 5000)).toBe('wide');
    // 0.9..1.0 is not a wide bin (0.5..1 is), but two normal bins of 0.05.
    expect(suggestTickTypeForRange(0.9, 1.0)).toBe('normal');
    // A single narrow bin.
    expect(suggestTickTypeForRange(1, 1.01)).toBe('narrow');
  });

  test('the chosen width spans between minBins and maxBins ticks', () => {
    for (const [low, high] of [
      [0.9, 1.0],
      [100, 110],
      [0.001, 0.0012],
      [536, 2140],
    ] as const) {
      const type = suggestTickTypeForRange(low, high);
      expect(type).not.toBeNull();
      const precision = precisionForTickType(type as TickType);
      const bins = tickGridBoundaries(snapPriceToTick(low, type as TickType), snapPriceToTick(high, type as TickType), precision).length - 1;
      expect(bins).toBeGreaterThanOrEqual(1);
      expect(bins).toBeLessThanOrEqual(40);
    }
  });

  test('respects custom bin bounds', () => {
    expect(suggestTickTypeForRange(0.9, 1.0, { minBins: 50 })).toBeNull();
    expect(suggestTickTypeForRange(1000, 2000, { minBins: 2 })).toBe('normal');
  });
});
