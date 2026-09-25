/**
 * Canonical logarithmic tick grid.
 *
 * The grid is an **absolute** set of price boundaries, fixed once and for all per
 * precision — it does not depend on the current price, on where a walk starts, or on
 * any previously computed boundary. Two integrators (or the same UI on two different
 * days, at two different market prices) therefore always land on exactly the same bins,
 * which is what lets liquidity from many providers concentrate in shared pools.
 *
 * The grid is decade-periodic: the same set of mantissas in `[1, 10]`, scaled by `10^k`
 * for every decade. It follows the log10 tick rule — the tick at a price is
 * `10^-precision` of the price, rounded to one significant digit — so a bin is always
 * roughly the same fraction of the price:
 *
 * | precision | tick type | rule                              | mantissas of one decade                                   |
 * | --------- | --------- | --------------------------------- | --------------------------------------------------------- |
 * | 0         | `wide`    | anchors `1, 2, 5` (≈100 % steps)  | 1, 2, 5, 10                                               |
 * | 1         | `normal`  | tick ≈ 10 % of the price          | 1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, |
 * |           |           |                                   | 3.6, 4, 4.4, 5, 6, 7, 8, 9, 10 (21 bins)                  |
 * | 2         | `narrow`  | tick ≈ 1 % of the price           | 1, 1.01, …, 1.49, 1.5, 1.52, …, 2.48, 2.52, 2.55, … (≈1 %) |
 *
 * For precision ≥ 1 the decade is split into the ten "leading digit" regions
 * `n = round(mantissa)` (`[1, 1.5)`, `[1.5, 2.5)`, …, `[8.5, 9.5)`, `[9.5, 10]`); inside
 * region `n` the tick is `n × 10^-precision` and the boundaries are multiples of it,
 * starting at the region's entry boundary. The entry of region `n + 1` is the first
 * multiple of its own tick at or after `last boundary of region n + tick of region n` —
 * i.e. the candidate that crosses into the next region is snapped onto that region's
 * grid, and a remainder narrower than the new tick is merged into the bin (`0.9 → 1.0`,
 * not `0.9 → 0.99`). Everything is derived from the decade start `1 × 10^k`, so every
 * decade and every caller gets the same boundaries. Precision 0 is the one special case:
 * a ≈100 % tick cannot be decade-periodic, so it is simply the `1, 2, 5` anchors.
 *
 * All boundaries are short decimals, so they round-trip exactly through JS numbers:
 * results are built from integer mantissa units and a decimal exponent, never by
 * accumulating floating point additions.
 */

/** Mantissa anchors of the `wide` grid (precision 0): the bins `[1,2)`, `[2,5)`, `[5,10)`. */
export const TICK_GRID_ANCHORS: readonly number[] = [1, 2, 5];

/** Safety cap for any boundary walk, so a degenerate window can never spin. */
export const MAX_TICK_GRID_BOUNDARIES = 1000;

/** Cap for {@link tickGridDecadeMantissas} (a decade at precision 5 has ~230k bins). */
const MAX_DECADE_MANTISSAS = 1_000_000;

/** A grid boundary: `units × 10^(exponent - precision)`, `units` in `[scale, 10 × scale)`. */
interface GridPoint {
  exponent: number;
  units: number;
}

const normalizePrecision = (precision: number): number => (Number.isFinite(precision) && precision > 0 ? Math.floor(precision) : 0);

const scaleFor = (precision: number): number => 10 ** precision;

/**
 * Per precision (≥ 1): for each leading-digit region `n = 1…10`, the first boundary
 * (`entries[n]`) and the last boundary (`lasts[n]`) of the region, in mantissa units.
 * `entries[11]` is the closing `10 × scale`.
 */
interface Regions {
  entries: number[];
  lasts: number[];
}

const regionsCache = new Map<number, Regions>();

const regionsFor = (precision: number): Regions => {
  const cached = regionsCache.get(precision);
  if (cached) return cached;
  const scale = scaleFor(precision);
  const entries: number[] = [];
  const lasts: number[] = [];
  entries[1] = scale;
  for (let n = 1; n <= 10; n += 1) {
    // Region n covers [(n - 0.5) × scale, (n + 0.5) × scale) — region 10 runs to 10 × scale.
    const end = n === 10 ? 10 * scale + 1 : (n + 0.5) * scale;
    // Boundaries are entries[n] + k × n; the last one is the largest below `end`.
    lasts[n] = entries[n] + n * Math.floor((Math.ceil(end) - 1 - entries[n]) / n);
    // The candidate that crosses into region n + 1 snaps onto that region's grid.
    entries[n + 1] = n === 10 ? 10 * scale : Math.ceil((lasts[n] + n) / (n + 1)) * (n + 1);
  }
  const regions = { entries, lasts };
  regionsCache.set(precision, regions);
  return regions;
};

/** Leading-digit region (1…10) of a mantissa in units, `[scale, 10 × scale]`. */
const regionOf = (units: number, scale: number): number => Math.min(10, Math.max(1, Math.round(units / scale)));

const wideTable = [...TICK_GRID_ANCHORS, 10];

/** Largest boundary <= `units` (which may be off-grid), same decade. */
const snapDownUnits = (units: number, precision: number): number => {
  const scale = scaleFor(precision);
  if (precision === 0) {
    let best = wideTable[0];
    wideTable.forEach((anchor) => {
      if (anchor <= units && anchor < 10) best = anchor;
    });
    return best;
  }
  const { entries, lasts } = regionsFor(precision);
  const n = regionOf(units, scale);
  const entry = entries[n];
  // Between the region seam and the region's entry lies the merged tail of the
  // previous region's last bin.
  if (units < entry) return lasts[n - 1];
  return Math.min(lasts[n], entry + n * Math.floor((units - entry) / n));
};

/** Boundary right after an on-grid `units`; may return the closing `10 × scale`. */
const nextUnits = (units: number, precision: number): number => {
  const scale = scaleFor(precision);
  if (precision === 0) return wideTable[wideTable.indexOf(units) + 1];
  const { entries, lasts } = regionsFor(precision);
  const n = regionOf(units, scale);
  return units + n <= lasts[n] ? units + n : entries[n + 1];
};

/** Boundary right before an on-grid `units` (`units` may be the closing `10 × scale`). */
const prevUnits = (units: number, precision: number): number => {
  const scale = scaleFor(precision);
  if (precision === 0) return wideTable[wideTable.indexOf(units) - 1];
  const { entries, lasts } = regionsFor(precision);
  const n = regionOf(units, scale);
  return units > entries[n] ? units - n : lasts[n - 1];
};

/** `floor(log10(price))`, corrected for floating point error at exact powers of ten. */
const decadeOf = (price: number): number => {
  let exponent = Math.floor(Math.log10(price));
  while (10 ** exponent > price) exponent -= 1;
  while (10 ** (exponent + 1) <= price) exponent += 1;
  return exponent;
};

/** Exact decimal reconstruction (`Number("11e-1") === 1.1`, unlike `11 * 0.1`). */
const pointValue = (point: GridPoint, precision: number): number => Number(`${point.units}e${point.exponent - precision}`);

/** Relative tolerance treating a price a hair below a boundary as on it (float noise). */
const UNIT_EPSILON = 1e-9;

/** The bin containing `price` (largest boundary <= price, allowing for float noise). */
const snapDown = (price: number, precision: number): GridPoint => {
  const scale = scaleFor(precision);
  let exponent = decadeOf(price);
  let units = price * 10 ** (precision - exponent);
  units += units * UNIT_EPSILON;
  if (units >= 10 * scale) {
    exponent += 1;
    units = scale;
  }
  return { exponent, units: snapDownUnits(units, precision) };
};

const nextPoint = (point: GridPoint, precision: number): GridPoint => {
  const scale = scaleFor(precision);
  const units = nextUnits(point.units, precision);
  if (units >= 10 * scale) return { exponent: point.exponent + 1, units: scale };
  return { exponent: point.exponent, units };
};

const prevPoint = (point: GridPoint, precision: number): GridPoint => {
  const scale = scaleFor(precision);
  if (point.units <= scale) {
    return { exponent: point.exponent - 1, units: prevUnits(10 * scale, precision) };
  }
  return { exponent: point.exponent, units: prevUnits(point.units, precision) };
};

const isUsablePrice = (price: number): boolean => Number.isFinite(price) && price > 0;

/**
 * Mantissas (`1 … 10`) of one decade of the grid, e.g. `[1, 1.1, 1.2, …, 9, 10]` at
 * precision 1. Meant for documentation, tests and UIs at the named precisions — a
 * decade at precision 5 already has ~230k bins; the result is capped at 1,000,000.
 */
export const tickGridDecadeMantissas = (precision: number): number[] => {
  const p = normalizePrecision(precision);
  const scale = scaleFor(p);
  const mantissas: number[] = [];
  let units = scale;
  while (units < 10 * scale && mantissas.length < MAX_DECADE_MANTISSAS) {
    mantissas.push(Number(`${units}e-${p}`));
    units = nextUnits(units, p);
  }
  mantissas.push(10);
  return mantissas;
};

/**
 * Largest canonical boundary `<= price` (the start of the bin containing `price`).
 * Returns `0` for a non-finite or non-positive price.
 */
export const tickGridBoundaryBelow = (price: number, precision: number): number => {
  if (!isUsablePrice(price)) return 0;
  const p = normalizePrecision(precision);
  return pointValue(snapDown(price, p), p);
};

/**
 * Smallest canonical boundary `> price` (the end of the bin containing `price`).
 * Returns `0` for a non-finite or non-positive price.
 */
export const tickGridBoundaryAbove = (price: number, precision: number): number => {
  if (!isUsablePrice(price)) return 0;
  const p = normalizePrecision(precision);
  return pointValue(nextPoint(snapDown(price, p), p), p);
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
  return pointValue(prevPoint(snapDown(boundary, p), p), p);
};

/**
 * Width of the canonical bin containing `price` (`boundaryAbove - boundaryBelow`),
 * computed exactly. Returns `0` for an unusable price.
 */
export const tickGridWidthAt = (price: number, precision: number): number => {
  if (!isUsablePrice(price)) return 0;
  const p = normalizePrecision(precision);
  const below = snapDown(price, p);
  const widthUnits = nextUnits(below.units, p) - below.units;
  return Number(`${widthUnits}e${below.exponent - p}`);
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
  let point = snapDown(from, p);
  const boundaries: number[] = [pointValue(point, p)];
  while (boundaries[boundaries.length - 1] < to && boundaries.length < cap) {
    point = nextPoint(point, p);
    boundaries.push(pointValue(point, p));
  }
  return boundaries;
};
