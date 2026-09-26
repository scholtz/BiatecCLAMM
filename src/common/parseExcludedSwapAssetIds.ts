// The native asset (ALGO) is always excluded, regardless of env config - it is needed to cover minimum balance
// and network fees for the rest of the run (opt-ins, swaps, add-liquidity).
const ALWAYS_EXCLUDED = [0n];

/**
 * Parses a comma-separated list of asset ids (env var excludeSwapAssetIds) into the set of assets a rebalance
 * step should never swap away, always including the native asset.
 */
const parseExcludedSwapAssetIds = (envValue: string | undefined): Set<bigint> => {
  const ids = (envValue ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => BigInt(s));
  return new Set([...ALWAYS_EXCLUDED, ...ids]);
};
export default parseExcludedSwapAssetIds;
