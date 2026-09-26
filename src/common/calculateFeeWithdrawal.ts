/**
 * Mirrors BiatecClammPool.algo.ts payOutLiquidity() / calculateAssetAWithdrawOnLpDeposit() exactly - same
 * base-scale uint256 arithmetic and floor division - so a script can preview what
 * removeLiquidityAdmin(amount=0) would pay out for the biatec fee share, without spending a transaction to
 * find out.
 */
export interface FeeWithdrawalInput {
  liquidityBiatecFromFees: bigint; // Lb, base scale
  liquidity: bigint; // L, base scale
  assetABalanceBaseScale: bigint;
  assetBBalanceBaseScale: bigint;
  assetADecimalsScaleFromBase: bigint;
  assetBDecimalsScaleFromBase: bigint;
}

export interface FeeWithdrawalResult {
  assetAAmount: bigint; // in asset A's own decimals
  assetBAmount: bigint; // in asset B's own decimals
}

const calculateFeeWithdrawal = (input: FeeWithdrawalInput): FeeWithdrawalResult => {
  if (input.liquidity === 0n || input.liquidityBiatecFromFees === 0n) {
    return { assetAAmount: 0n, assetBAmount: 0n };
  }
  const assetABase = (input.assetABalanceBaseScale * input.liquidityBiatecFromFees) / input.liquidity;
  const assetBBase = (input.assetBBalanceBaseScale * input.liquidityBiatecFromFees) / input.liquidity;
  return {
    assetAAmount: assetABase / input.assetADecimalsScaleFromBase,
    assetBAmount: assetBBase / input.assetBDecimalsScaleFromBase,
  };
};
export default calculateFeeWithdrawal;
