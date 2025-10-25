/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import { convertToBigInt } from '../test-data/convertToBigInt';
import calculatePriceData from '../test-data/calculate-price.json';
import calculateAssetBWithdrawData from '../test-data/calculate-asset-b-withdraw-on-asset-a-deposit.json';
import calculateAssetAWithdrawData from '../test-data/calculate-asset-a-withdraw-on-asset-b-deposit.json';
import calculateLiquidityData from '../test-data/calculate-liquidity.json';
import calculateAssetAWithdrawLpData from '../test-data/calculate-asset-a-withdraw-on-lp-deposit.json';
import calculateAssetBWithdrawLpData from '../test-data/calculate-asset-b-withdraw-on-lp-deposit.json';
import calculateAssetBDepositData from '../test-data/calculate-asset-b-deposit-on-asset-a-deposit.json';
import calculateAssetADepositData from '../test-data/calculate-asset-a-deposit-on-asset-b-deposit.json';
import {
  setupPool,
  assetAId,
  assetBId,
  deployer,
  SCALE,
  SCALE_A,
  SCALE_B,
  fixture,
} from './shared-setup';

describe('BiatecClammPool - calculations', () => {
  test('calculatePrice returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculatePriceData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const result = await clientBiatecClammPoolProvider.appClient.calculatePrice({
          args: {
            assetAQuantity: BigInt(t.x * SCALE),
            assetBQuantity: BigInt(t.y * SCALE),
            liquidity: t.L * SCALE,
            priceMinSqrt: Math.sqrt(t.P1) * SCALE,
            priceMaxSqrt: Math.sqrt(t.P2) * SCALE,
          },
        });
        expect(result).toEqual(BigInt(t.P * SCALE));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('calculateAssetBWithdrawOnAssetADeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetBWithdrawData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const result = await clientBiatecClammPoolProvider.appClient.calculateAssetBWithdrawOnAssetADeposit({
          args: {
            inAmount: BigInt(t.deposit * SCALE),
            assetABalance: BigInt(t.x * SCALE),
            assetBBalance: BigInt(t.y * SCALE),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
            liquidity: BigInt(t.L * SCALE),
          },
        });

        expect(result).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('calculateAssetAWithdrawOnAssetBDeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetAWithdrawData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });
        if (t.P1 === t.P2) {
          const l = await clientBiatecClammPoolProvider.appClient.calculateLiquidityFlatPrice({
            args: {
              x: BigInt(t.x * SCALE),
              y: BigInt(t.x * SCALE),
              price: BigInt(t.P1 * SCALE),
            },
          });
          expect(l).toBeGreaterThan(0);
          if (!l) throw Error('L is zero');
          const input = {
            inAmount: BigInt(t.depositB * SCALE),
            assetABalance: BigInt(t.x * SCALE),
            assetBBalance: BigInt(t.y * SCALE),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
            liquidity: l,
          };
          const result = await clientBiatecClammPoolProvider.appClient.calculateAssetAWithdrawOnAssetBDeposit({
            args: input,
          });
          expect(result).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
        } else {
          const dSqrt = await clientBiatecClammPoolProvider.appClient.calculateLiquidityD({
            args: {
              x: BigInt(t.x * SCALE),
              y: BigInt(t.x * SCALE),
              priceMin: BigInt(t.P1 * SCALE),
              priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
              priceMax: BigInt(t.P2 * SCALE),
              priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
            },
          });
          if (!dSqrt) throw Error('dSqrt is expected here');
          const l = await clientBiatecClammPoolProvider.appClient.calculateLiquidityWithD({
            args: {
              x: BigInt(t.x * SCALE),
              y: BigInt(t.x * SCALE),
              priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
              priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
              dSqrt,
            },
          });
          expect(l).toBeGreaterThan(0);
          if (!l) throw Error('L is zero');
          const result = await clientBiatecClammPoolProvider.appClient.calculateAssetAWithdrawOnAssetBDeposit({
            args: {
              inAmount: BigInt(t.depositB * SCALE),
              assetABalance: BigInt(t.x * SCALE),
              assetBBalance: BigInt(t.y * SCALE),
              priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
              priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
              liquidity: l,
            },
          });
          expect(result).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('calculateLiquidity returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateLiquidityData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const dSqrt = await clientBiatecClammPoolProvider.appClient.calculateLiquidityD({
          args: {
            x: BigInt(t.x * SCALE),
            y: BigInt(t.y * SCALE),
            priceMin: BigInt(t.P1 * SCALE),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMax: BigInt(t.P2 * SCALE),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
          },
        });
        expect(dSqrt).toBe(BigInt(t.dSqrt * SCALE));
        if (dSqrt === undefined) throw Error('dSqrt is expected here');
        const result = await clientBiatecClammPoolProvider.appClient.calculateLiquidityWithD({
          args: {
            x: BigInt(Math.round(t.x * SCALE)),
            y: BigInt(Math.round(t.y * SCALE)),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
            dSqrt,
          },
        });
        expect(result).toEqual(BigInt(t.L * SCALE));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('calculateAssetAWithdrawOnLPDeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetAWithdrawLpData;

      const { clientBiatecClammPoolProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        signer: deployer,
        assetA: assetAId,
        biatecFee: 0n,
        lpFee: 0n,
        p: 1n,
        p1: 1n,
        p2: 2n,
      });
      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const result = await clientBiatecPoolProvider.appClient.calculateAssetBWithdrawOnLpDeposit({
          args: {
            inAmount: BigInt(Math.round(t.lpDeposit * SCALE)),
            assetBBalance: BigInt(Math.round(t.x * SCALE)),
            liquidity: BigInt(Math.round(t.L * SCALE)),
          },
          extraFee: algokit.microAlgos(2000),
        });
        expect(result).toEqual(BigInt(Math.round(t.aWithdraw * SCALE)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('calculateAssetBWithdrawOnLPDeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetBWithdrawLpData;

      const { clientBiatecClammPoolProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        signer: deployer,
        assetA: assetAId,
        biatecFee: 0n,
        lpFee: 0n,
        p: 1n,
        p1: 1n,
        p2: 2n,
      });
      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const result = await clientBiatecPoolProvider.appClient.calculateAssetBWithdrawOnLpDeposit({
          args: {
            inAmount: BigInt(Math.round(t.lpDeposit * SCALE)),
            assetBBalance: BigInt(Math.round(t.y * SCALE)),
            liquidity: BigInt(Math.round(t.L * SCALE)),
          },
          extraFee: algokit.microAlgos(2000),
        });
        expect(result).toEqual(BigInt(Math.round(t.bWithdraw * SCALE)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('calculateAssetBDepositOnAssetADeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetBDepositData;

      const { clientBiatecClammPoolProvider } = await setupPool({
        algod,
        signer: deployer,
        assetA: assetAId,
        biatecFee: 0n,
        lpFee: 0n,
        p: 1n,
        p1: 1n,
        p2: 2n,
      });
      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const result = await clientBiatecClammPoolProvider.appClient.calculateAssetBDepositOnAssetADeposit({
          args: {
            inAmountA: BigInt(Math.round(t.aDeposit * SCALE)),
            inAmountB: BigInt(Math.round(t.bDeposit * SCALE)),
            assetABalance: BigInt(Math.round(t.x * SCALE)),
            assetBBalance: BigInt(Math.round(t.y * SCALE)),
          },
          extraFee: algokit.microAlgos(2000),
        });
        expect(result).toEqual(BigInt(Math.round(t.bDeposit * SCALE)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });


  test('calculateAssetADepositOnAssetBDeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetADepositData;

      const { clientBiatecClammPoolProvider } = await setupPool({
        algod,
        signer: deployer,
        assetA: assetAId,
        biatecFee: 0n,
        lpFee: 0n,
        p: 1n,
        p1: 1n,
        p2: 2n,
      });
      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const input = {
          inAmountA: BigInt(Math.round(t.aDeposit * SCALE)),
          inAmountB: BigInt(Math.round(t.bDeposit * SCALE)),
          assetABalance: BigInt(Math.round(t.x * SCALE)),
          assetBBalance: BigInt(Math.round(t.y * SCALE)),
        };

        const result = await clientBiatecClammPoolProvider.appClient.calculateAssetADepositOnAssetBDeposit({
          args: input,
          extraFee: algokit.microAlgos(2000),
        });
        expect(result).toEqual(BigInt(Math.round(t.aDepositOut * SCALE)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

});
