export interface CandidatePool {
  appId: bigint;
  priceMin: bigint;
  priceMax: bigint;
  liquidity: bigint;
}

/**
 * Picks the pool with the tightest [priceMin, priceMax] band (smallest priceMax/priceMin ratio) among pools
 * that currently hold liquidity. A narrower band concentrates the same amount of liquidity into a smaller price
 * range, giving better capital efficiency for new deposits added around the current price.
 */
const pickNarrowestPool = (pools: CandidatePool[]): CandidatePool | undefined => {
  const withLiquidity = pools.filter((p) => p.liquidity > 0n && p.priceMin > 0n && p.priceMax >= p.priceMin);
  if (withLiquidity.length === 0) return undefined;
  return withLiquidity.reduce((narrowest, candidate) => {
    // candidate.priceMax / candidate.priceMin < narrowest.priceMax / narrowest.priceMin, cross-multiplied to
    // stay in integer math
    const candidateIsNarrower = candidate.priceMax * narrowest.priceMin < narrowest.priceMax * candidate.priceMin;
    return candidateIsNarrower ? candidate : narrowest;
  });
};
export default pickNarrowestPool;
