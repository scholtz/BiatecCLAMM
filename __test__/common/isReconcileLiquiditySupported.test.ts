import { describe, test, expect } from '@jest/globals';
import isReconcileLiquiditySupported from '../../src/common/isReconcileLiquiditySupported';

describe('isReconcileLiquiditySupported', () => {
  test('rejects pools with no reported version', () => {
    expect(isReconcileLiquiditySupported(undefined)).toBe(false);
    expect(isReconcileLiquiditySupported('')).toBe(false);
  });

  test('rejects pools deployed before reconcileLiquidity existed (BIATEC-CLAMM-01-06-04 and earlier)', () => {
    expect(isReconcileLiquiditySupported('BIATEC-CLAMM-01-06-04')).toBe(false);
    expect(isReconcileLiquiditySupported('BIATEC-CLAMM-01-06-00')).toBe(false);
    expect(isReconcileLiquiditySupported('BIATEC-CLAMM-01-05-99')).toBe(false);
    expect(isReconcileLiquiditySupported('BIATEC-CLAMM-00-99-99')).toBe(false);
  });

  test('accepts pools deployed with reconcileLiquidity or later', () => {
    expect(isReconcileLiquiditySupported('BIATEC-CLAMM-01-06-05')).toBe(true);
    expect(isReconcileLiquiditySupported('BIATEC-CLAMM-01-06-07')).toBe(true);
    expect(isReconcileLiquiditySupported('BIATEC-CLAMM-01-07-00')).toBe(true);
    expect(isReconcileLiquiditySupported('BIATEC-CLAMM-02-00-00')).toBe(true);
  });

  test('rejects versions from a different contract family', () => {
    expect(isReconcileLiquiditySupported('BIATEC-PP-01-05-04')).toBe(false);
    expect(isReconcileLiquiditySupported('BIATEC-CONFIG-01-02-01')).toBe(false);
  });
});
