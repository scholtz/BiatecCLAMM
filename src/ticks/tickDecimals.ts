/**
 * Number of decimal places needed to represent a tick (bin width). Logarithmic: a wide
 * tick like `100` needs `0` decimals while a tiny tick like `1e-6` needs `6`.
 */
export const tickDecimals = (tick: number): number => {
  if (!Number.isFinite(tick) || tick <= 0) return 0;
  return Math.max(0, -Math.floor(Math.log10(tick) + 1e-9));
};
