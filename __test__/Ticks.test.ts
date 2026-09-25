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
  tickGridDecadeMantissas,
} from '../src/ticks';

/** The documented `normal` decade: tick ≈ 10 % of the price, one significant digit. */
const NORMAL_DECADE = [1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 4, 4.4, 5, 6, 7, 8, 9, 10];

const strictlyIncreasing = (values: number[]) => values.slice(1).every((value, i) => value > values[i]);

describe('tick type mapping', () => {
  test('exposes three widths widest -> narrowest', () => {
    expect(TICK_TYPES).toEqual(['wide', 'normal', 'narrow']);
    expect(DEFAULT_TICK_TYPE).toBe('normal');
  });

  test('precision <-> tick type are consistent', () => {
    TICK_TYPES.forEach((type) => {
      const precision = precisionForTickType(type);
      expect(TICK_TYPE_TO_PRECISION[type]).toBe(precision);
      expect(PRECISION_TO_TICK_TYPE[precision]).toBe(type);
      expect(tickTypeForPrecision(precision)).toBe(type);
    });
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
  test('wide anchors every decade at 1, 2, 5', () => {
    expect(TICK_GRID_ANCHORS).toEqual([1, 2, 5]);
    expect(tickGridDecadeMantissas(0)).toEqual([1, 2, 5, 10]);
    expect(tickGridBoundaries(0.05, 20, 0)).toEqual([0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
    expect(tickGridBoundaries(1000, 5000, 0)).toEqual([1000, 2000, 5000]);
  });

  test('normal follows the log10 rule: tick = 10 % of the price, one significant digit', () => {
    expect(tickGridDecadeMantissas(1)).toEqual(NORMAL_DECADE);
    // 0.9 -> 1.0 is exactly one normal tick.
    expect(tickGridBoundaries(0.9, 1.0, 1)).toEqual([0.9, 1]);
    expect(tickGridWidthAt(0.9, 1)).toBe(0.1);
    expect(tickGridBoundaries(1, 2, 1)).toEqual([1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2]);
    expect(tickGridBoundaries(2, 3, 1)).toEqual([2, 2.2, 2.4, 2.7, 3]);
    expect(tickGridBoundaries(4, 10, 1)).toEqual([4, 4.4, 5, 6, 7, 8, 9, 10]);
    expect(tickGridBoundaries(0.1, 0.2, 1)).toEqual([0.1, 0.11, 0.12, 0.13, 0.14, 0.16, 0.18, 0.2]);
    expect(tickGridBoundaries(1000, 2000, 1)).toEqual([1000, 1100, 1200, 1300, 1400, 1600, 1800, 2000]);
  });

  test('narrow follows the log10 rule at 1 % of the price', () => {
    expect(tickGridBoundaries(1, 1.05, 2)).toEqual([1, 1.01, 1.02, 1.03, 1.04, 1.05]);
    expect(tickGridBoundaries(1.48, 1.56, 2)).toEqual([1.48, 1.49, 1.5, 1.52, 1.54, 1.56]);
    expect(tickGridBoundaries(2.46, 2.58, 2)).toEqual([2.46, 2.48, 2.52, 2.55, 2.58]);
    expect(tickGridBoundaries(0.98, 1.02, 2)).toEqual([0.98, 0.99, 1, 1.01, 1.02]);
    const mantissas = tickGridDecadeMantissas(2);
    expect(mantissas[0]).toBe(1);
    expect(mantissas[mantissas.length - 1]).toBe(10);
    expect(strictlyIncreasing(mantissas)).toBe(true);
    // Every bin is between half and twice the nominal 1 % tick of its start.
    mantissas.slice(0, -1).forEach((m, i) => {
      const width = mantissas[i + 1] - m;
      expect(width).toBeGreaterThanOrEqual(0.005 * m);
      expect(width).toBeLessThanOrEqual(0.02 * m + 1e-12);
    });
  });

  test('every decade repeats the same mantissa table', () => {
    [0, 1, 2].forEach((precision) => {
      const mantissas = tickGridDecadeMantissas(precision);
      [-6, -3, -1, 0, 2, 5, 9].forEach((exponent) => {
        const scale = 10 ** exponent;
        const expected = mantissas.map((m) => Number(`${m}e${exponent}`));
        expect(tickGridBoundaries(scale, 10 * scale, precision)).toEqual(expected);
      });
    });
  });

  test('is anchor independent: the boundaries do not depend on where the walk starts', () => {
    // The production bug: three visits at mid prices ~1000/1500/1600 created gold/algo
    // pools bounded at 536-2140, 1080-2160 and 1090-2180. Every window that contains
    // 1500 must now contain exactly the same bin around it.
    [0, 1, 2].forEach((precision) => {
      const reference = tickGridBoundaries(1000, 2000, precision);
      [536, 800, 1000, 1080, 1090, 1234.5678, 1499.99].forEach((from) => {
        const boundaries = tickGridBoundaries(from, 2500, precision);
        // Every reference boundary inside this window must be reproduced exactly.
        reference
          .filter((b) => b >= boundaries[0])
          .forEach((bound) => {
            expect(boundaries).toContain(bound);
          });
        // And the bin containing 1500 is always the same one.
        const index = boundaries.findIndex((b, i) => b <= 1500 && boundaries[i + 1] > 1500);
        expect(boundaries[index]).toBe(tickGridBoundaryBelow(1500, precision));
        expect(boundaries[index + 1]).toBe(tickGridBoundaryAbove(1500, precision));
      });
    });
    expect(tickGridBoundaryBelow(1500, 0)).toBe(1000);
    expect(tickGridBoundaryAbove(1500, 0)).toBe(2000);
    expect(tickGridBoundaryBelow(1500, 1)).toBe(1400);
    expect(tickGridBoundaryAbove(1500, 1)).toBe(1600);
    expect(tickGridBoundaryBelow(536, 0)).toBe(500);
  });

  test('a wider window yields a superset of a narrower one', () => {
    [0, 1, 2].forEach((precision) => {
      const inner = tickGridBoundaries(0.3, 3, precision);
      const outer = tickGridBoundaries(0.01, 30, precision);
      inner.forEach((bound) => expect(outer).toContain(bound));
    });
  });

  test('first boundary is <= from and last boundary is >= to', () => {
    [0, 1, 2].forEach((precision) => {
      (
        [
          [0.00123, 0.0456],
          [0.9, 1.0],
          [536, 2140],
          [1080, 2160],
          [7, 7.0001],
        ] as const
      ).forEach(([from, to]) => {
        const boundaries = tickGridBoundaries(from, to, precision);
        expect(boundaries.length).toBeGreaterThanOrEqual(2);
        expect(boundaries[0]).toBeLessThanOrEqual(from);
        expect(boundaries[boundaries.length - 1]).toBeGreaterThanOrEqual(to);
        expect(strictlyIncreasing(boundaries)).toBe(true);
      });
    });
  });

  test('below / above / next / prev agree with each other', () => {
    [0, 1, 2, 4].forEach((precision) => {
      [0.0013, 0.09, 0.5, 0.94, 1, 1.07, 2, 4.99, 5, 9.99, 42, 536, 1500, 99999].forEach((price) => {
        const below = tickGridBoundaryBelow(price, precision);
        const above = tickGridBoundaryAbove(price, precision);
        expect(below).toBeLessThanOrEqual(price);
        expect(above).toBeGreaterThan(price);
        expect(nextTickGridBoundary(below, precision)).toBe(above);
        expect(prevTickGridBoundary(above, precision)).toBe(below);
        expect(tickGridWidthAt(price, precision)).toBeCloseTo(above - below, 12);
        // A boundary is its own "below".
        expect(tickGridBoundaryBelow(below, precision)).toBe(below);
      });
    });
  });

  test('crosses decades correctly in both directions', () => {
    expect(nextTickGridBoundary(5, 0)).toBe(10);
    expect(prevTickGridBoundary(10, 0)).toBe(5);
    expect(prevTickGridBoundary(1, 0)).toBe(0.5);
    expect(nextTickGridBoundary(9, 1)).toBe(10);
    expect(nextTickGridBoundary(0.9, 1)).toBe(1);
    expect(prevTickGridBoundary(10, 1)).toBe(9);
    expect(prevTickGridBoundary(1, 1)).toBe(0.9);
    expect(prevTickGridBoundary(2, 1)).toBe(1.8);
    expect(prevTickGridBoundary(5, 1)).toBe(4.4);
    expect(prevTickGridBoundary(1, 2)).toBe(0.99);
    expect(nextTickGridBoundary(0.99, 2)).toBe(1);
  });

  test('bin widths follow the rule at any magnitude', () => {
    expect(tickGridWidthAt(1500, 0)).toBe(1000);
    expect(tickGridWidthAt(3000, 0)).toBe(3000);
    expect(tickGridWidthAt(7000, 0)).toBe(5000);
    expect(tickGridWidthAt(1500, 1)).toBe(200);
    expect(tickGridWidthAt(1000, 1)).toBe(100);
    expect(tickGridWidthAt(3000, 1)).toBe(300);
    expect(tickGridWidthAt(7000, 1)).toBe(1000);
    expect(tickGridWidthAt(0.0015, 2)).toBe(0.00002);
    expect(tickGridWidthAt(0.00123, 2)).toBe(0.00001);
  });

  test('rejects unusable input without spinning', () => {
    [0, -1, Number.NaN, Number.POSITIVE_INFINITY].forEach((bad) => {
      expect(tickGridBoundaryBelow(bad, 1)).toBe(0);
      expect(tickGridBoundaryAbove(bad, 1)).toBe(0);
      expect(tickGridWidthAt(bad, 1)).toBe(0);
      expect(tickGridBoundaries(bad, 10, 1)).toEqual([]);
      expect(tickGridBoundaries(1, bad, 1)).toEqual([]);
    });
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
    expect(getTickSize(0.9, 'normal')).toBe(0.1);
    expect(cleanLogTick(0.9, 'normal')).toBe(0.1);
    expect(getTickSize(1.23, 'normal')).toBe(0.1);
    expect(getTickSize(1.5, 'normal')).toBe(0.2);
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
    [0.0013, 0.9, 1, 12.34, 1000, 10000].forEach((price) => {
      expect(getTickSize(price, 'narrow')).toBeLessThanOrEqual(getTickSize(price, 'normal'));
      expect(getTickSize(price, 'normal')).toBeLessThanOrEqual(getTickSize(price, 'wide'));
    });
  });
});

describe('getTickDecimals', () => {
  test('matches the decimals of the tick size', () => {
    TICK_TYPES.forEach((type) => {
      [0.001, 0.9, 1, 12.34, 1000, 10000].forEach((price) => {
        expect(getTickDecimals(price, type)).toBe(tickDecimals(getTickSize(price, type)));
      });
    });
    expect(getTickDecimals(0.001, 'narrow')).toBe(5);
    expect(getTickDecimals(10000, 'normal')).toBe(0);
  });
});

describe('snapPriceToTick', () => {
  test('snaps to the nearest canonical boundary by default', () => {
    expect(snapPriceToTick(0.94, 'normal')).toBe(0.9);
    expect(snapPriceToTick(0.96, 'normal')).toBe(1);
    expect(snapPriceToTick(1500, 'wide')).toBe(2000);
    expect(snapPriceToTick(1400, 'wide')).toBe(1000);
    expect(snapPriceToTick(1080, 'normal')).toBe(1100);
    expect(snapPriceToTick(1500, 'normal')).toBe(1600);
  });

  test('supports down / up rounding', () => {
    expect(snapPriceToTick(10123, 'normal', 'down')).toBe(10000);
    expect(snapPriceToTick(10123, 'normal', 'up')).toBe(11000);
    expect(snapPriceToTick(1500, 'wide', 'down')).toBe(1000);
    expect(snapPriceToTick(1500, 'wide', 'up')).toBe(2000);
  });

  test('a price already on the grid is returned unchanged in every rounding mode', () => {
    TICK_TYPES.forEach((type) => {
      [0.5, 1, 2, 5, 1000, 2000].forEach((price) => {
        expect(snapPriceToTick(price, type, 'down')).toBe(price);
        expect(snapPriceToTick(price, type, 'up')).toBe(price);
        expect(snapPriceToTick(price, type)).toBe(price);
      });
    });
  });

  test('a snapped price is stable (idempotent)', () => {
    TICK_TYPES.forEach((type) => {
      [0.0013, 0.9, 1.07, 42, 9999, 536, 1090].forEach((price) => {
        const once = snapPriceToTick(price, type);
        expect(snapPriceToTick(once, type)).toBe(once);
      });
    });
  });

  test('never returns a negative price', () => {
    expect(snapPriceToTick(0, 'normal')).toBe(0);
    expect(snapPriceToTick(-10, 'normal')).toBe(0);
  });

  test('snapped price sits on a canonical boundary', () => {
    TICK_TYPES.forEach((type) => {
      const precision = precisionForTickType(type);
      [1.2345, 0.0777, 6543.21].forEach((price) => {
        const snapped = snapPriceToTick(price, type);
        expect(tickGridBoundaryBelow(snapped, precision)).toBe(snapped);
      });
    });
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
    expect(fromFixedBigInt(res.tick)).toBe(0.1);
    expect(res.priceDecimals).toBe(1n);

    const wide = initPriceDecimals(toFixedBigInt(1500), 0n);
    expect(fromFixedBigInt(wide.fitPrice)).toBe(1000);
    expect(fromFixedBigInt(wide.tick)).toBe(1000);
    expect(wide.priceDecimals).toBe(0n);
  });

  test('walking fitPrice + tick reproduces the canonical grid from any start', () => {
    [0n, 1n, 2n].forEach((precision) => {
      [536, 1080, 1090, 1500].forEach((start) => {
        const walked: number[] = [];
        let price = toFixedBigInt(start);
        Array.from({ length: 6 }).forEach(() => {
          const step = initPriceDecimals(price, precision);
          walked.push(fromFixedBigInt(step.fitPrice));
          price = step.fitPrice + step.tick;
        });
        const canonical = tickGridBoundaries(start, 1e9, Number(precision), 7);
        expect(walked).toEqual(canonical.slice(0, 6));
      });
    });
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

  test('prefers the widest fitting width (range = 1 tick at its native grid)', () => {
    // One wide bin exactly.
    expect(suggestTickTypeForRange(1000, 2000)).toBe('wide');
    expect(suggestTickTypeForRange(2000, 5000)).toBe('wide');
    // 0.9..1.0 is not a wide bin (0.5..1 is), but exactly one normal tick of 0.1.
    expect(suggestTickTypeForRange(0.9, 1.0)).toBe('normal');
    expect(suggestTickTypeForRange(1.4, 1.6)).toBe('normal');
    // A single narrow bin.
    expect(suggestTickTypeForRange(1, 1.01)).toBe('narrow');
  });

  test('the chosen width spans between minBins and maxBins ticks', () => {
    (
      [
        [0.9, 1.0],
        [100, 110],
        [0.001, 0.0012],
        [536, 2140],
      ] as const
    ).forEach(([low, high]) => {
      const type = suggestTickTypeForRange(low, high);
      expect(type).not.toBeNull();
      const precision = precisionForTickType(type as TickType);
      const bins = tickGridBoundaries(snapPriceToTick(low, type as TickType), snapPriceToTick(high, type as TickType), precision).length - 1;
      expect(bins).toBeGreaterThanOrEqual(1);
      expect(bins).toBeLessThanOrEqual(40);
    });
  });

  test('respects custom bin bounds', () => {
    expect(suggestTickTypeForRange(0.9, 1.0, { minBins: 50 })).toBeNull();
    expect(suggestTickTypeForRange(1000, 2000, { minBins: 2 })).toBe('normal');
  });
});
