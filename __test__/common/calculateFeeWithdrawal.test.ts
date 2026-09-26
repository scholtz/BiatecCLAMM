import { describe, test, expect } from '@jest/globals';
import calculateFeeWithdrawal from '../../src/common/calculateFeeWithdrawal';

describe('calculateFeeWithdrawal', () => {
  test('returns zero when there is no biatec fee liquidity to withdraw', () => {
    expect(
      calculateFeeWithdrawal({
        liquidityBiatecFromFees: 0n,
        liquidity: 1_000_000_000n,
        assetABalanceBaseScale: 1_000_000_000n,
        assetBBalanceBaseScale: 1_000_000_000n,
        assetADecimalsScaleFromBase: 1_000n,
        assetBDecimalsScaleFromBase: 1_000n,
      })
    ).toEqual({ assetAAmount: 0n, assetBAmount: 0n });
  });

  test('returns zero when liquidity is zero (avoids division by zero)', () => {
    expect(
      calculateFeeWithdrawal({
        liquidityBiatecFromFees: 100n,
        liquidity: 0n,
        assetABalanceBaseScale: 0n,
        assetBBalanceBaseScale: 0n,
        assetADecimalsScaleFromBase: 1_000n,
        assetBDecimalsScaleFromBase: 1_000n,
      })
    ).toEqual({ assetAAmount: 0n, assetBAmount: 0n });
  });

  test('computes the pro-rata share, matching calculateAssetAWithdrawOnLpDeposit floor division', () => {
    // Lb is 10% of L; pool holds 500 (base scale) of each asset; 9 decimals base -> 6 decimal assets (scale 1000)
    const result = calculateFeeWithdrawal({
      liquidityBiatecFromFees: 100_000_000_000n,
      liquidity: 1_000_000_000_000n,
      assetABalanceBaseScale: 500_000_000_000n,
      assetBBalanceBaseScale: 500_000_000_000n,
      assetADecimalsScaleFromBase: 1_000n,
      assetBDecimalsScaleFromBase: 1_000n,
    });
    // aToSendBase = 500_000_000_000 * 100_000_000_000 / 1_000_000_000_000 = 50_000_000_000
    // assetAAmount = 50_000_000_000 / 1_000 = 50_000_000 (i.e. 50 units of a 6-decimal asset)
    expect(result).toEqual({ assetAAmount: 50_000_000n, assetBAmount: 50_000_000n });
  });

  test('floors fractional results the same way the AVM does', () => {
    const result = calculateFeeWithdrawal({
      liquidityBiatecFromFees: 1n,
      liquidity: 3n,
      assetABalanceBaseScale: 10n,
      assetBBalanceBaseScale: 10n,
      assetADecimalsScaleFromBase: 1n,
      assetBDecimalsScaleFromBase: 1n,
    });
    // 10 * 1 / 3 = 3.33.. -> floors to 3
    expect(result).toEqual({ assetAAmount: 3n, assetBAmount: 3n });
  });
});
