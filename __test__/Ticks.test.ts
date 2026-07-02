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
  initPriceDecimals,
  priceTickDecimals,
  toFixedBigInt,
  fromFixedBigInt,
  TickType,
} from '../src/ticks';

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

describe('tickDecimals', () => {
  test('scales logarithmically with the tick', () => {
    expect(tickDecimals(100)).toBe(0);
    expect(tickDecimals(1)).toBe(0);
    expect(tickDecimals(0.1)).toBe(1);
    expect(tickDecimals(0.02)).toBe(2);
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
  test('produces clean 1/2/5x10^k ticks and is reasonable at any magnitude', () => {
    // the classic broken case: raw tick would be 0.09, clean tick is 0.1
    expect(cleanLogTick(0.9, 'wide')).toBeCloseTo(0.1, 12);
    expect(getTickSize(0.9, 'wide')).toBeCloseTo(0.1, 12);
    // reasonable ticks far from 1
    expect(getTickSize(10000, 'normal')).toBeCloseTo(100, 6);
    expect(getTickSize(10000, 'wide')).toBeCloseTo(1000, 6);
    expect(getTickSize(0.001, 'normal')).toBeCloseTo(0.00001, 12);
    expect(getTickSize(1000, 'wide')).toBeCloseTo(100, 6);
  });

  test('accepts a raw numeric precision too', () => {
    expect(cleanLogTick(10000, 2)).toBeCloseTo(getTickSize(10000, 'normal'), 6);
  });

  test('returns 0 for invalid prices', () => {
    expect(cleanLogTick(0, 'normal')).toBe(0);
    expect(cleanLogTick(-5, 'normal')).toBe(0);
  });

  test('narrower tick type gives a smaller (or equal) tick', () => {
    const price = 12.34;
    expect(getTickSize(price, 'narrow')).toBeLessThanOrEqual(getTickSize(price, 'normal'));
    expect(getTickSize(price, 'normal')).toBeLessThanOrEqual(getTickSize(price, 'wide'));
  });
});

describe('getTickDecimals', () => {
  test('matches the decimals of the tick size', () => {
    for (const type of TICK_TYPES) {
      for (const price of [0.001, 0.9, 1, 12.34, 1000, 10000]) {
        expect(getTickDecimals(price, type)).toBe(tickDecimals(getTickSize(price, type)));
      }
    }
  });
});

describe('snapPriceToTick', () => {
  test('snaps to the nearest tick by default', () => {
    // wide tick near 0.9 is 0.1
    expect(snapPriceToTick(0.94, 'wide')).toBeCloseTo(0.9, 12);
    expect(snapPriceToTick(0.96, 'wide')).toBeCloseTo(1, 12);
  });

  test('supports down / up rounding', () => {
    expect(snapPriceToTick(10123, 'normal', 'down')).toBeCloseTo(10100, 6);
    expect(snapPriceToTick(10123, 'normal', 'up')).toBeCloseTo(10200, 6);
  });

  test('a snapped price is stable (idempotent)', () => {
    for (const type of TICK_TYPES) {
      for (const price of [0.0013, 0.9, 1.07, 42, 9999]) {
        const once = snapPriceToTick(price, type);
        const twice = snapPriceToTick(once, type);
        expect(twice).toBeCloseTo(once, 9);
      }
    }
  });

  test('never returns a negative price', () => {
    expect(snapPriceToTick(0, 'normal')).toBe(0);
    expect(snapPriceToTick(-10, 'normal')).toBe(0);
  });

  test('snapped price sits on a tick multiple', () => {
    const type: TickType = 'normal';
    const snapped = snapPriceToTick(1.2345, type);
    const tick = getTickSize(snapped, type);
    const units = snapped / tick;
    expect(Math.abs(units - Math.round(units))).toBeLessThan(1e-6);
  });
});

describe('initPriceDecimals / priceTickDecimals (primitives)', () => {
  test('priceTickDecimals scales with magnitude', () => {
    expect(priceTickDecimals(1000, 4)).toBe(0);
    expect(priceTickDecimals(1, 4)).toBe(3);
    expect(priceTickDecimals(0.001, 4)).toBe(6);
    expect(priceTickDecimals(0, 4)).toBe(3);
  });

  test('initPriceDecimals returns a positive tick and a grid-aligned fitPrice', () => {
    const res = initPriceDecimals(toFixedBigInt(0.9), 1n);
    expect(fromFixedBigInt(res.tick)).toBeGreaterThan(0);
    expect(fromFixedBigInt(res.fitPrice)).toBeLessThanOrEqual(0.9);
    expect(fromFixedBigInt(res.fitPrice)).toBeGreaterThan(0);
  });
});
