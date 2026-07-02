import initPriceDecimals, { IInitPriceDecimalsReturn, toFixedBigInt, fromFixedBigInt } from './initPriceDecimals';
import priceTickDecimals from './priceTickDecimals';

/**
 * Human friendly tick selection.
 *
 * The Biatec CLAMM uses logarithmic ticks (a tick is a fixed fraction of the price).
 * Instead of asking integrators to reason about the raw numeric `precision`, expose a
 * small set of named tick widths. Lower precision → wider ticks.
 *
 * - `wide`   – coarse ticks, few price levels (≈10% steps).
 * - `normal` – balanced ticks (≈1% steps). Good default.
 * - `narrow` – fine ticks, many price levels (≈0.1% steps).
 */
export type TickType = 'wide' | 'normal' | 'narrow';

/** All tick types, widest → narrowest. Handy for building selectors. */
export const TICK_TYPES: readonly TickType[] = ['wide', 'normal', 'narrow'] as const;

/** Sensible default tick width. */
export const DEFAULT_TICK_TYPE: TickType = 'normal';

/** Maps a {@link TickType} to the numeric precision used by the tick math. */
export const TICK_TYPE_TO_PRECISION: Readonly<Record<TickType, number>> = {
  wide: 1,
  normal: 2,
  narrow: 3,
};

/** Reverse of {@link TICK_TYPE_TO_PRECISION}. */
export const PRECISION_TO_TICK_TYPE: Readonly<Record<number, TickType>> = {
  1: 'wide',
  2: 'normal',
  3: 'narrow',
};

/** Numeric precision for a tick type. */
export const precisionForTickType = (tickType: TickType): number => TICK_TYPE_TO_PRECISION[tickType];

/**
 * Tick type for a numeric precision. Precisions that are not an exact level are
 * snapped to the nearest one (e.g. an asset-derived precision of 4 → `narrow`).
 */
export const tickTypeForPrecision = (precision: number): TickType => {
  const exact = PRECISION_TO_TICK_TYPE[precision];
  if (exact) return exact;
  let best: TickType = DEFAULT_TICK_TYPE;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const type of TICK_TYPES) {
    const diff = Math.abs(TICK_TYPE_TO_PRECISION[type] - precision);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = type;
    }
  }
  return best;
};

const toPrecision = (precisionOrType: number | TickType): number =>
  typeof precisionOrType === 'string' ? precisionForTickType(precisionOrType) : precisionOrType;

/**
 * Number of decimal places needed to represent a tick. Mirrors the logarithmic scheme
 * of {@link priceTickDecimals}: a wide tick like `100` needs `0` decimals while a tiny
 * tick like `1e-6` needs `6`.
 */
export const tickDecimals = (tick: number): number => {
  if (!Number.isFinite(tick) || tick <= 0) return 0;
  return Math.max(0, -Math.floor(Math.log10(tick) + 1e-9));
};

/**
 * Clean logarithmic tick for a price, rounded to a "nice" 1/2/5×10^k value.
 *
 * Use this for UI steppers and for snapping: it fixes the raw sub-1 ticks
 * ({@link initPriceDecimals} gives `0.09` at price `0.9`) to clean values (`0.1`), and
 * is correct at any magnitude (`10000` at `normal`/precision 2 → `100`).
 *
 * @param price - The price to compute a tick for.
 * @param precisionOrType - A {@link TickType} or a raw numeric precision.
 */
export const cleanLogTick = (price: number, precisionOrType: number | TickType): number => {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const precision = toPrecision(precisionOrType);
  const raw = fromFixedBigInt(initPriceDecimals(toFixedBigInt(price), BigInt(precision)).tick);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const exp = Math.floor(Math.log10(raw));
  const frac = raw / 10 ** exp;
  const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
  return nice * 10 ** exp;
};

/**
 * Tick size for a price and tick type — the developer-friendly entry point.
 * Alias of {@link cleanLogTick} keyed by {@link TickType}.
 *
 * @example
 * getTickSize(0.9, 'wide');    // 0.1
 * getTickSize(10000, 'normal'); // 100
 */
export const getTickSize = (price: number, tickType: TickType): number =>
  cleanLogTick(price, tickType);

/** Number of decimals to display for a price at a given tick type. */
export const getTickDecimals = (price: number, tickType: TickType): number =>
  tickDecimals(getTickSize(price, tickType));

/** Rounding mode when snapping a price to the tick grid. */
export type TickRounding = 'nearest' | 'down' | 'up';

/**
 * Snap a price onto the tick grid for the given tick type.
 *
 * This is what a UI should call when a user types an arbitrary price, and what an
 * integrator should call before creating a pool so its bounds land on canonical ticks
 * shared across the whole ecosystem.
 *
 * @param price - Arbitrary price to snap.
 * @param tickType - Desired tick width.
 * @param rounding - `nearest` (default), `down`, or `up`.
 * @returns The snapped price (never negative), rounded to the tick's decimals to avoid
 *          floating point noise.
 *
 * @example
 * snapPriceToTick(0.94, 'wide');        // 0.9
 * snapPriceToTick(0.96, 'wide');        // 1
 * snapPriceToTick(10123, 'normal', 'up'); // 10200
 */
export const snapPriceToTick = (
  price: number,
  tickType: TickType,
  rounding: TickRounding = 'nearest'
): number => {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const tick = getTickSize(price, tickType);
  if (!Number.isFinite(tick) || tick <= 0) return price;
  const units = price / tick;
  const snappedUnits =
    rounding === 'down' ? Math.floor(units) : rounding === 'up' ? Math.ceil(units) : Math.round(units);
  const snapped = snappedUnits * tick;
  const decimals = tickDecimals(tick);
  return Number(Math.max(0, snapped).toFixed(decimals));
};

export { initPriceDecimals, priceTickDecimals, toFixedBigInt, fromFixedBigInt };
export type { IInitPriceDecimalsReturn };
