/**
 * Canonical logarithmic tick grid.
 *
 * The grid is an **absolute** set of price boundaries, fixed once and for all per
 * precision — it does not depend on the current price, on where a walk starts, or on
 * any previously computed boundary. Two integrators (or the same UI on two different
 * days, at two different market prices) therefore always land on exactly the same bins,
 * which is what lets liquidity from many providers concentrate in shared pools.
 *
 * Structure: every decade `[10^k, 10^(k+1))` is split at the anchors `1, 2, 5` (so
 * `1, 2, 5, 10, 20, 50, 100, …`). Each anchor segment `[a, b)` (`[1,2)`, `[2,5)`,
 * `[5,10)`, scaled by `10^k`) is then subdivided into bins of width `a * 10^-precision`:
 *
 * | precision | tick type | bins per decade | bin width (relative)      | example boundaries near 1500      |
 * | --------- | --------- | --------------- | ------------------------- | --------------------------------- |
 * | 0         | `wide`    | 3               | one bin per anchor segment | 1000, 2000, 5000                 |
 * | 1         | `normal`  | 35              | 4% – 10% of the price      | 1000, 1100, … 1900, 2000, 2200, … |
 * | 2         | `narrow`  | 350             | 0.4% – 1% of the price     | 1000, 1010, … 1990, 2000, 2020, … |
 *
 * (Precision 0 is the one special case: a segment is exactly one bin, so the bin
 * widths are `1, 3, 5 × 10^k`. For every precision ≥ 1 the bin width inside a segment
 * is `a × 10^(k-precision)`, i.e. one of `1, 2, 5 × 10^n` — a "nice" number.)
 *
 * All boundaries are short decimals, so they round-trip exactly through JS numbers:
 * results are built from integer mantissa units and a decimal exponent, never by
 * accumulating floating point additions.
 */

/** Mantissa anchors of every decade: the segments `[1,2)`, `[2,5)`, `[5,10)`. */
export const TICK_GRID_ANCHORS: readonly number[] = [1, 2, 5];

/** Safety cap for any boundary walk, so a degenerate window can never spin. */
export const MAX_TICK_GRID_BOUNDARIES = 1000;

/**
 * A grid position: `value = units * 10^(exponent - precision)`, where `units` is an
 * integer mantissa in `[scale, 10 * scale)` with `scale = 10^precision`.
 */
interface GridPoint {
  exponent: number;
  units: number;
}

const normalizePrecision = (precision: number): number => (Number.isFinite(precision) && precision > 0 ? Math.floor(precision) : 0);

const scaleFor = (precision: number): number => 10 ** precision;

/** `floor(log10(price))`, corrected for floating point error at exact powers of ten. */
const decadeOf = (price: number): number => {
  let exponent = Math.floor(Math.log10(price));
  while (10 ** exponent > price) exponent -= 1;
  while (10 ** (exponent + 1) <= price) exponent += 1;
  return exponent;
};

/** Anchor segment containing `units` (which may be off-grid), in mantissa units. */
const segmentOf = (units: number, precision: number): { anchorUnits: number; nextUnits: number; stepUnits: number } => {
  const scale = scaleFor(precision);
  let anchor: number;
  let next: number;
  if (units < 2 * scale) {
    anchor = 1;
    next = 2;
  } else if (units < 5 * scale) {
    anchor = 2;
    next = 5;
  } else {
    anchor = 5;
    next = 10;
  }
  // Precision 0: the whole anchor segment is a single bin. Otherwise the bin is
  // `anchor * 10^-precision`, i.e. exactly `anchor` mantissa units.
  const stepUnits = precision === 0 ? (next - anchor) * scale : anchor;
  return { anchorUnits: anchor * scale, nextUnits: next * scale, stepUnits };
};

/** Exact decimal reconstruction (`Number("11e-1") === 1.1`, unlike `11 * 0.1`). */
const pointValue = (point: GridPoint, precision: number): number => Number(`${point.units}e${point.exponent - precision}`);

/**
 * Decompose a price into its decade and (possibly off-grid) integer mantissa units.
 * Values within 1e-9 units of the next integer are treated as that integer, so a
 * boundary that went through floating point arithmetic still counts as on-grid.
 */
const decompose = (price: number, precision: number): GridPoint => {
  const exponent = decadeOf(price);
  const raw = price * 10 ** (precision - exponent);
  let units = Math.floor(raw);
  if (raw - units > 1 - 1e-9) units += 1;
  const scale = scaleFor(precision);
  if (units >= 10 * scale) return { exponent: exponent + 1, units: scale };
  if (units < scale) return { exponent, units: scale };
  return { exponent, units };
};

/** Largest grid point <= the given (possibly off-grid) point. */
const snapDown = (point: GridPoint, precision: number): GridPoint => {
  const { anchorUnits, stepUnits } = segmentOf(point.units, precision);
  const units = anchorUnits + Math.floor((point.units - anchorUnits) / stepUnits) * stepUnits;
  return { exponent: point.exponent, units };
};

/** The grid point right after an on-grid point. */
const nextPoint = (point: GridPoint, precision: number): GridPoint => {
  const scale = scaleFor(precision);
  const { stepUnits } = segmentOf(point.units, precision);
  const units = point.units + stepUnits;
  if (units >= 10 * scale) return { exponent: point.exponent + 1, units: scale };
  return { exponent: point.exponent, units };
};

/** The grid point right before an on-grid point. */
const prevPoint = (point: GridPoint, precision: number): GridPoint => {
  const scale = scaleFor(precision);
  if (point.units <= scale) {
    // Roll into the previous decade: its last bin starts one step below 10.
    const { stepUnits } = segmentOf(10 * scale - 1, precision);
    return { exponent: point.exponent - 1, units: 10 * scale - stepUnits };
  }
  // `units - 1` sits in the segment whose step applies just below this boundary.
  const { stepUnits } = segmentOf(point.units - 1, precision);
  return { exponent: point.exponent, units: point.units - stepUnits };
};

const isUsablePrice = (price: number): boolean => Number.isFinite(price) && price > 0;

/**
 * Largest canonical boundary `<= price` (the start of the bin containing `price`).
 * Returns `0` for a non-finite or non-positive price.
 */
export const tickGridBoundaryBelow = (price: number, precision: number): number => {
  if (!isUsablePrice(price)) return 0;
  const p = normalizePrecision(precision);
  return pointValue(snapDown(decompose(price, p), p), p);
};

/**
 * Smallest canonical boundary `> price` (the end of the bin containing `price`).
 * Returns `0` for a non-finite or non-positive price.
 */
export const tickGridBoundaryAbove = (price: number, precision: number): number => {
  if (!isUsablePrice(price)) return 0;
  const p = normalizePrecision(precision);
  return pointValue(nextPoint(snapDown(decompose(price, p), p), p), p);
};

/**
 * The canonical boundary right after `boundary` (which must itself be on the grid —
 * an off-grid value is first snapped down). Returns `0` for an unusable input.
 */
export const nextTickGridBoundary = (boundary: number, precision: number): number => tickGridBoundaryAbove(boundary, precision);

/**
 * The canonical boundary right before `boundary` (an off-grid value is first snapped
 * down, so this is the start of the bin below the one containing it). Returns `0`
 * for an unusable input.
 */
export const prevTickGridBoundary = (boundary: number, precision: number): number => {
  if (!isUsablePrice(boundary)) return 0;
  const p = normalizePrecision(precision);
  return pointValue(prevPoint(snapDown(decompose(boundary, p), p), p), p);
};

/**
 * Width of the canonical bin containing `price` (`boundaryAbove - boundaryBelow`),
 * computed exactly. Returns `0` for an unusable price.
 */
export const tickGridWidthAt = (price: number, precision: number): number => {
  if (!isUsablePrice(price)) return 0;
  const p = normalizePrecision(precision);
  const below = snapDown(decompose(price, p), p);
  const above = nextPoint(below, p);
  // Express both in the lower point's decade so the difference is an exact integer.
  const aboveUnits = above.units * 10 ** (above.exponent - below.exponent);
  return Number(`${aboveUnits - below.units}e${below.exponent - p}`);
};

/**
 * All canonical boundaries covering `[from, to]`: the first is the boundary at or
 * below `from`, the last the boundary at or above `to`. Independent of any anchor —
 * the same window always yields the same boundaries, and a wider window yields a
 * superset. Empty for an unusable window (`from <= 0`, `to <= from`, NaN, Infinity).
 * Never returns more than `maxCount` boundaries.
 */
export const tickGridBoundaries = (from: number, to: number, precision: number, maxCount: number = MAX_TICK_GRID_BOUNDARIES): number[] => {
  if (!isUsablePrice(from) || !Number.isFinite(to) || !(to > from)) return [];
  const p = normalizePrecision(precision);
  const cap = Math.max(2, Math.floor(maxCount));
  let point = snapDown(decompose(from, p), p);
  const boundaries: number[] = [pointValue(point, p)];
  while (boundaries[boundaries.length - 1] < to && boundaries.length < cap) {
    point = nextPoint(point, p);
    boundaries.push(pointValue(point, p));
  }
  return boundaries;
};
