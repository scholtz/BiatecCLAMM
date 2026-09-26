// reconcileLiquidity was added to the BiatecClammPool contract in this release; see
// contracts/BiatecClammPool.algo.ts reconcileLiquidity() docstring and scripts/survey-orphaned-liquidity.ts.
const MIN_SUPPORTED_VERSION = 'BIATEC-CLAMM-01-06-05';

/**
 * Pools deployed with an older approval program do not implement the reconcileLiquidity ABI method at all;
 * calling it on such a pool is rejected by the AVM's method router with an unhelpful 'err opcode executed'
 * (the call falls through to the router's default reject branch, outside any mapped source line).
 *
 * @param scver value of the pool's 'scver' global state key (BiatecClammPoolClient state.global.version)
 */
const isReconcileLiquiditySupported = (scver: string | undefined): boolean => {
  if (!scver) return false;
  if (!scver.startsWith('BIATEC-CLAMM-')) return false;
  return scver >= MIN_SUPPORTED_VERSION;
};
export default isReconcileLiquiditySupported;
