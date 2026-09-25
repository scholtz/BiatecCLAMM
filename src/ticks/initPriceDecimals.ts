import { tickDecimals } from './tickDecimals';
import { tickGridBoundaryBelow, tickGridWidthAt } from './tickGrid';

/**
 * Fixed-point scale used to represent fractional prices as `bigint`. All `bigint`
 * price/tick values in this module are the real value multiplied by this scale.
 */
export const TICK_FIXED_SCALE = 10n ** 18n;
const TICK_FIXED_DECIMALS = 18;

/**
 * Converts a plain JS number price into the fixed-point `bigint` representation.
 * Goes through the number's shortest decimal representation (not `value * 1e18`,
 * which is inexact above 2^53 — `50000 * 1e18` is not representable as a double), so
 * every short decimal such as a grid boundary converts exactly. Rounds half up when
 * the value has more than 18 decimals.
 */
export const toFixedBigInt = (value: number): bigint => {
  if (!Number.isFinite(value)) return 0n;
  const [mantissa, exponent] = value.toExponential().split('e');
  const negative = mantissa.startsWith('-');
  const digits = mantissa.replace('-', '').replace('.', '');
  const fractionDigits = digits.length - 1;
  const shift = Number(exponent) - fractionDigits + TICK_FIXED_DECIMALS;
  let result: bigint;
  if (shift >= 0) {
    result = BigInt(digits) * 10n ** BigInt(shift);
  } else {
    const divisor = 10n ** BigInt(-shift);
    result = (BigInt(digits) + divisor / 2n) / divisor;
  }
  return negative ? -result : result;
};

/** Converts a fixed-point `bigint` price back into a plain JS number, exactly for short decimals. */
export const fromFixedBigInt = (value: bigint): number => Number(`${value}e-${TICK_FIXED_DECIMALS}`);

export interface IInitPriceDecimalsReturn {
  /** Number of decimal places that represent the tick size. */
  priceDecimals: bigint;
  /** Width of the canonical grid bin containing the price, fixed-point scaled by {@link TICK_FIXED_SCALE}. */
  tick: bigint;
  /** `price` snapped down onto the canonical grid (start of its bin), fixed-point scaled by {@link TICK_FIXED_SCALE}. */
  fitPrice: bigint;
}

/**
 * Low level tick descriptor for a single price on the **canonical** grid (see
 * `tickGrid.ts`): `fitPrice` is the start of the bin containing `price` and `tick` is
 * that bin's width, so `fitPrice + tick` is the next canonical boundary. Walking
 * `fitPrice + tick` repeatedly therefore reproduces the same absolute boundaries no
 * matter which price the walk started from.
 *
 * Kept for integrators that already consume the fixed-point `bigint` form; new code
 * should prefer the number-based `tickGridBoundaries` / `snapPriceToTick` helpers.
 *
 * @param price - The price to describe, fixed-point scaled.
 * @param precision - Tick precision (see {@link TickType}), a plain integer. Defaults to 4.
 */
const initPriceDecimals = (price: bigint, precision: bigint = 4n): IInitPriceDecimalsReturn => {
  const value = price > 0n ? fromFixedBigInt(price) : 0;
  if (!(value > 0) || !Number.isFinite(value)) {
    return {
      priceDecimals: 6n,
      tick: toFixedBigInt(0.001),
      fitPrice: toFixedBigInt(0.001),
    };
  }
  const numericPrecision = Number(precision);
  const width = tickGridWidthAt(value, numericPrecision);
  const fit = tickGridBoundaryBelow(value, numericPrecision);
  return {
    priceDecimals: BigInt(tickDecimals(width)),
    tick: toFixedBigInt(width),
    fitPrice: toFixedBigInt(fit),
  };
};

export default initPriceDecimals;
