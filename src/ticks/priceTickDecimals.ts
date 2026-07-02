/**
 * Number of decimal places that are meaningful for a price at a given precision.
 *
 * The Biatec CLAMM uses a *logarithmic* tick system: a tick is a fixed fraction of
 * the price, so the number of decimals needed grows as the price shrinks. This helper
 * returns how many decimals should be shown/kept for `price` at the requested
 * `precision` (higher precision → finer ticks → more decimals).
 *
 * @param price - The price (asset A denominated in asset B). `0` returns 3.
 * @param precision - Tick precision (see {@link TickType}). Defaults to 4.
 * @returns Non-negative integer count of decimal places.
 *
 * @example
 * priceTickDecimals(1000, 4); // 0  -> tick 1
 * priceTickDecimals(0.001, 4); // 6 -> tick 1e-6
 */
const priceTickDecimals = (price: number | bigint, precision: number = 4): number => {
  if (price === 0 || price === 0n) return 3;
  const sigDecimal = Number(price) / 10 ** precision;
  const ret = -Math.floor(Math.log10(Math.abs(sigDecimal)) + 1);
  return Math.max(0, ret);
};

export default priceTickDecimals;
