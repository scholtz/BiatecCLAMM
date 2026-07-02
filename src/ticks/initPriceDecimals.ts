/**
 * Fixed-point scale used to represent fractional prices as `bigint`. All `bigint`
 * price/tick values in this module are the real value multiplied by this scale.
 */
export const TICK_FIXED_SCALE = 10n ** 18n;

/** Converts a plain JS number price into the fixed-point `bigint` representation. */
export const toFixedBigInt = (value: number): bigint => {
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.round(value * Number(TICK_FIXED_SCALE)));
};

/** Converts a fixed-point `bigint` price back into a plain JS number. */
export const fromFixedBigInt = (value: bigint): number => Number(value) / Number(TICK_FIXED_SCALE);

export interface IInitPriceDecimalsReturn {
  /** Number of decimal places that represent the tick size. */
  priceDecimals: bigint;
  /** Raw tick size at this price (a fraction of the price ~ price * 10^-precision), fixed-point scaled by {@link TICK_FIXED_SCALE}. */
  tick: bigint;
  /** `price` snapped down onto the tick grid, fixed-point scaled by {@link TICK_FIXED_SCALE}. */
  fitPrice: bigint;
}

const numDigits = (value: bigint): number => (value === 0n ? 1 : value.toString().length);

/** `floor(log10(value / scale))` computed exactly on integers, no floating point. */
const floorLog10Fixed = (value: bigint, scale: bigint): bigint => {
  let k = BigInt(numDigits(value) - numDigits(scale));
  const atLeast = (exp: bigint): boolean => (exp >= 0n ? value >= scale * 10n ** exp : value * 10n ** -exp >= scale);
  while (!atLeast(k)) k -= 1n;
  while (atLeast(k + 1n)) k += 1n;
  return k;
};

/** Rounds a fixed-point value to `places` decimal digits (round-half-up), same scale in/out. */
const roundToDecimalPlaces = (value: bigint, places: bigint, scale: bigint): bigint => {
  const scaleDigits = BigInt(numDigits(scale) - 1);
  if (places >= scaleDigits) return value;
  const divisor = 10n ** (scaleDigits - places);
  const truncated = (value / divisor) * divisor;
  const remainder = value - truncated;
  return remainder * 2n >= divisor ? truncated + divisor : truncated;
};

/** Count of significant (non-trailing-zero) decimal places in a fixed-point value. */
const decimalPlacesOf = (value: bigint, scale: bigint): bigint => {
  if (value === 0n) return 0n;
  const fracDigits = BigInt(numDigits(scale) - 1);
  let x = value;
  let trailingZeros = 0n;
  while (x % 10n === 0n) {
    x /= 10n;
    trailingZeros += 1n;
  }
  const result = fracDigits - trailingZeros;
  return result > 0n ? result : 0n;
};

const maxBig = (a: bigint, b: bigint): bigint => (a > b ? a : b);

/**
 * Low level, logarithmic tick descriptor for a single price.
 *
 * This is the primitive the whole tick system is built on. The tick is roughly
 * `price * 10^-precision`, so it scales with magnitude and stays reasonable for any
 * price (e.g. a sensible tick exists both at 1000 and at 0.001). The raw tick can be
 * non-round for sub-1 prices (0.9 → 0.09); use {@link cleanLogTick} when you need a
 * clean 1/2/5×10^k value for a UI stepper.
 *
 * All monetary values are `bigint`, fixed-point scaled by {@link TICK_FIXED_SCALE}
 * (use {@link toFixedBigInt} / {@link fromFixedBigInt} to convert at the boundary).
 *
 * @param price - The price to describe, fixed-point scaled.
 * @param precision - Tick precision (see {@link TickType}), a plain integer. Defaults to 4.
 */
const initPriceDecimals = (price: bigint, precision: bigint = 4n): IInitPriceDecimalsReturn => {
  const scale = TICK_FIXED_SCALE;
  try {
    if (!price) {
      return {
        priceDecimals: 6n,
        tick: toFixedBigInt(0.001),
        fitPrice: toFixedBigInt(0.001),
      };
    }

    // Order of magnitude (number of digits before the decimal point) of the price.
    const sigPrecision = floorLog10Fixed(price, scale);

    // How many decimal places to keep based on the desired precision and magnitude.
    let precisionDiff = maxBig(0n, precision - sigPrecision);
    let calcPrice = price;

    // For prices >= 1, normalize into [1,10) so the tick is computed on the mantissa
    // and scaled back, keeping at least 2 decimals of resolution.
    if (sigPrecision > 0n) {
      calcPrice = price / 10n ** sigPrecision;
      precisionDiff = maxBig(2n, precision - sigPrecision);
    }

    // Round the (normalized) price to the calculated precision difference.
    const roundedPrice = roundToDecimalPlaces(calcPrice, precisionDiff, scale);

    // Tick size = rounded price / 10^precision (the minimum price increment).
    const roundedTickSize = roundToDecimalPlaces(roundedPrice / 10n ** precision, precisionDiff, scale);

    const priceDecimalsNum = decimalPlacesOf(roundedTickSize, scale);

    // Fit the price onto the tick grid by removing the remainder.
    const modulo = roundedTickSize === 0n ? 0n : calcPrice % roundedTickSize;
    const fitPrice = roundToDecimalPlaces(calcPrice - modulo, precisionDiff, scale);

    if (sigPrecision > 0n) {
      const tick = roundedTickSize * 10n ** sigPrecision;
      return {
        priceDecimals: tick < scale ? 1n : 0n,
        tick,
        fitPrice: fitPrice * 10n ** sigPrecision,
      };
    }

    return {
      priceDecimals: priceDecimalsNum,
      tick: roundedTickSize,
      fitPrice,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Error in initPriceDecimals:', e);
    return {
      priceDecimals: 1n,
      tick: toFixedBigInt(0.01),
      fitPrice: toFixedBigInt(0.01),
    };
  }
};

export default initPriceDecimals;
