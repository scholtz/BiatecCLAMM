import initPriceDecimals, { IInitPriceDecimalsReturn, toFixedBigInt, fromFixedBigInt } from './initPriceDecimals';
import priceTickDecimals from './priceTickDecimals';
import { tickDecimals } from './tickDecimals';
import { TICK_GRID_ANCHORS, MAX_TICK_GRID_BOUNDARIES, tickGridBoundaryBelow, tickGridBoundaryAbove, nextTickGridBoundary, prevTickGridBoundary, tickGridWidthAt, tickGridBoundaries } from './tickGrid';

/**
 * Human friendly tick selection.
 *
 * The Biatec CLAMM uses a logarithmic tick grid (see `tickGrid.ts`): boundaries are an
 * absolute, canonical set of "nice" prices (`1, 2, 5 × 10^k`, subdivided per precision),
 * so a bin's width is roughly a fixed fraction of the price. Instead of asking
 * integrators to reason about the raw numeric `precision`, expose a small set of named
 * tick widths. Lower precision → wider ticks.
 *
 * - `wide`   – one bin per anchor segment: `[1,2)`, `[2,5)`, `[5,10)` × 10^k (≈100% steps, precision 0).
 * - `normal` – 35 bins per decade, 4%–10% of the price (precision 1). Good default.
 * - `narrow` – 350 bins per decade, 0.4%–1% of the price (precision 2).
 */
export type TickType = 'wide' | 'normal' | 'narrow';

/** All tick types, widest → narrowest. Handy for building selectors. */
export const TICK_TYPES: readonly TickType[] = ['wide', 'normal', 'narrow'] as const;

/** Sensible default tick width. */
export const DEFAULT_TICK_TYPE: TickType = 'normal';

/** Maps a {@link TickType} to the numeric precision used by the tick math. */
export const TICK_TYPE_TO_PRECISION: Readonly<Record<TickType, number>> = {
  wide: 0,
  normal: 1,
  narrow: 2,
};

/** Reverse of {@link TICK_TYPE_TO_PRECISION}. */
export const PRECISION_TO_TICK_TYPE: Readonly<Record<number, TickType>> = {
  0: 'wide',
  1: 'normal',
  2: 'narrow',
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
  return TICK_TYPES.reduce<TickType>((best, type) => {
    const diff = Math.abs(TICK_TYPE_TO_PRECISION[type] - precision);
    const bestDiff = Math.abs(TICK_TYPE_TO_PRECISION[best] - precision);
    return diff < bestDiff ? type : best;
  }, DEFAULT_TICK_TYPE);
};

const toPrecision = (precisionOrType: number | TickType): number => (typeof precisionOrType === 'string' ? precisionForTickType(precisionOrType) : precisionOrType);

/**
 * Width of the canonical grid bin containing `price` — the tick size at that price.
 *
 * Correct at any magnitude (`10000` at `normal` → `1000`, `0.001` at `normal` →
 * `0.0001`). Because the grid is absolute, this is the exact distance to the next
 * boundary, not an approximation of "some fraction of the price".
 *
 * @param price - The price to compute a tick for.
 * @param precisionOrType - A {@link TickType} or a raw numeric precision.
 */
export const cleanLogTick = (price: number, precisionOrType: number | TickType): number => tickGridWidthAt(price, toPrecision(precisionOrType));

/**
 * Tick size for a price and tick type — the developer-friendly entry point.
 * Alias of {@link cleanLogTick} keyed by {@link TickType}.
 *
 * @example
 * getTickSize(0.9, 'normal');   // 0.05  (bin [0.9, 0.95))
 * getTickSize(1500, 'wide');    // 1000  (bin [1000, 2000))
 * getTickSize(10000, 'normal'); // 1000  (bin [10000, 11000))
 */
export const getTickSize = (price: number, tickType: TickType): number => cleanLogTick(price, tickType);

/** Number of decimals to display for a price at a given tick type. */
export const getTickDecimals = (price: number, tickType: TickType): number => tickDecimals(getTickSize(price, tickType));

/** Rounding mode when snapping a price to the tick grid. */
export type TickRounding = 'nearest' | 'down' | 'up';

/**
 * Snap a price onto the canonical tick grid for the given tick type.
 *
 * This is what a UI should call when a user types an arbitrary price, and what an
 * integrator should call before creating a pool so its bounds land on canonical ticks
 * shared across the whole ecosystem. A price already on the grid is returned as is,
 * whatever the rounding mode.
 *
 * @param price - Arbitrary price to snap.
 * @param tickType - Desired tick width.
 * @param rounding - `nearest` (default; ties round up), `down`, or `up`.
 * @returns The snapped price (never negative). `0` for an unusable price.
 *
 * @example
 * snapPriceToTick(0.94, 'normal');        // 0.95
 * snapPriceToTick(0.91, 'normal');        // 0.9
 * snapPriceToTick(1500, 'wide');          // 2000  (nearest of 1000 / 2000)
 * snapPriceToTick(1500, 'wide', 'down');  // 1000
 * snapPriceToTick(10123, 'normal', 'up'); // 11000
 */
export const snapPriceToTick = (price: number, tickType: TickType, rounding: TickRounding = 'nearest'): number => {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const precision = precisionForTickType(tickType);
  const below = tickGridBoundaryBelow(price, precision);
  if (below === price) return price;
  const above = tickGridBoundaryAbove(price, precision);
  if (rounding === 'down') return below;
  if (rounding === 'up') return above;
  return price - below < above - price ? below : above;
};

/** Options for {@link suggestTickTypeForRange}. */
export interface SuggestTickTypeOptions {
  /** Minimum number of ticks the range must span to qualify (default 1). */
  minBins?: number;
  /** Maximum number of ticks before a width is considered too fine (default 40). */
  maxBins?: number;
}

/**
 * Number of canonical bins between two on-grid boundaries (`0` when `high <= low`),
 * capped at `limit` so a huge range never walks forever.
 */
const countBinsBetween = (low: number, high: number, precision: number, limit: number): number => {
  if (!(high > low)) return 0;
  let boundary = low;
  let bins = 0;
  while (boundary < high && bins <= limit) {
    boundary = nextTickGridBoundary(boundary, precision);
    bins += 1;
    if (!(boundary > 0)) break;
  }
  return bins;
};

/**
 * Pick the tick width that represents a price range `[low, high]`.
 *
 * **Widest-first** (coarsest ticks / lowest precision first): the widest width where
 * the range, snapped to that width's grid, still spans at least `minBins` (and no more
 * than `maxBins`) bins is returned. Because it defaults to `minBins: 1`, an existing
 * pool's `[min, max]` maps to a *single* bin at its native (widest fitting) width — so
 * pre-filling an "add liquidity" form with it keeps the exact range and adds to that
 * same pool instead of splitting it into finer, brand-new pools. Users can still slide
 * into neighbouring bins from there. Returns `null` for a degenerate range
 * (`high <= low`, a wall / single-price position) or when no width fits.
 *
 * @example
 * suggestTickTypeForRange(1000, 2000); // 'wide'   (exactly one wide bin)
 * suggestTickTypeForRange(0.9, 1.0);   // 'normal' (two normal bins of 0.05)
 * suggestTickTypeForRange(1, 1);       // null     (wall / single price)
 */
export const suggestTickTypeForRange = (low: number, high: number, options: SuggestTickTypeOptions = {}): TickType | null => {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= low) return null;
  const minBins = options.minBins ?? 1;
  const maxBins = options.maxBins ?? 40;
  // TICK_TYPES is ordered widest → narrowest, so this returns the widest fit.
  const fit = TICK_TYPES.find((type) => {
    const precision = precisionForTickType(type);
    const snappedLow = snapPriceToTick(low, type);
    const snappedHigh = snapPriceToTick(high, type);
    const bins = countBinsBetween(snappedLow, snappedHigh, precision, maxBins);
    return bins >= minBins && bins <= maxBins;
  });
  return fit ?? null;
};

export {
  initPriceDecimals,
  priceTickDecimals,
  toFixedBigInt,
  fromFixedBigInt,
  tickDecimals,
  TICK_GRID_ANCHORS,
  MAX_TICK_GRID_BOUNDARIES,
  tickGridBoundaryBelow,
  tickGridBoundaryAbove,
  nextTickGridBoundary,
  prevTickGridBoundary,
  tickGridWidthAt,
  tickGridBoundaries,
};
export type { IInitPriceDecimalsReturn };
