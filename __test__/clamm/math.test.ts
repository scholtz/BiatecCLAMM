import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import * as algokit from '@algorandfoundation/algokit-utils';
import mathData from './data/math-tests.json';
import { SCALE, SCALE_A, SCALE_B, fixture, initDeployer, setupPool } from './setup';

describe('clamm math helpers', () => {
  beforeEach(fixture.newScope);
  beforeAll(async () => {
    await initDeployer();
  });

  test('calculatePrice returns correct results', async () => {
    for (const scenario of mathData.calculatePrice) {
      const { clientBiatecClammPoolProvider } = await setupPool({
        algod: fixture.context.algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(scenario.price * SCALE),
        p1: BigInt(scenario.p1 * SCALE),
        p2: BigInt(scenario.p2 * SCALE),
      });

      const result = await clientBiatecClammPoolProvider.appClient.calculatePrice({
        args: {
          assetAQuantity: BigInt(Math.round(scenario.x * SCALE)),
          assetBQuantity: BigInt(Math.round(scenario.y * SCALE)),
          liquidity: BigInt(Math.round(scenario.liquidity * SCALE)),
          priceMinSqrt: BigInt(Math.round(Math.sqrt(scenario.p1) * SCALE)),
          priceMaxSqrt: BigInt(Math.round(Math.sqrt(scenario.p2) * SCALE)),
        },
      });

      expect(result).toEqual(BigInt(Math.round(scenario.price * SCALE)));
    }
  });

  test('calculateAssetBWithdrawOnAssetADeposit returns correct results', async () => {
    for (const scenario of mathData.calculateAssetBWithdrawOnAssetADeposit) {
      const { clientBiatecClammPoolProvider } = await setupPool({
        algod: fixture.context.algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(scenario.p * SCALE),
        p1: BigInt(scenario.p1 * SCALE),
        p2: BigInt(scenario.p2 * SCALE),
      });

      const result = await clientBiatecClammPoolProvider.appClient.calculateAssetBWithdrawOnAssetADeposit({
        args: {
          inAmount: BigInt(Math.round(scenario.deposit * SCALE)),
          assetABalance: BigInt(Math.round(scenario.x * SCALE)),
          assetBBalance: BigInt(Math.round(scenario.y * SCALE)),
          priceMinSqrt: BigInt(Math.round(Math.sqrt(scenario.p1) * SCALE)),
          priceMaxSqrt: BigInt(Math.round(Math.sqrt(scenario.p2) * SCALE)),
          liquidity: BigInt(Math.round(scenario.liquidity * SCALE)),
        },
      });

      expect(result).toEqual(BigInt(Math.round(scenario.expected * SCALE)));
    }
  });

  test('calculateAssetAWithdrawOnAssetBDeposit returns correct results', async () => {
    for (const scenario of mathData.calculateAssetAWithdrawOnAssetBDeposit) {
      const { clientBiatecClammPoolProvider } = await setupPool({
        algod: fixture.context.algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(scenario.p1 * SCALE),
        p1: BigInt(scenario.p1 * SCALE),
        p2: BigInt(scenario.p2 * SCALE),
      });

      const priceSqrtMin = BigInt(Math.round(Math.sqrt(scenario.p1) * SCALE));
      const priceSqrtMax = BigInt(Math.round(Math.sqrt(scenario.p2) * SCALE));

      let liquidity: bigint;
      if (scenario.p1 === scenario.p2) {
        liquidity = await clientBiatecClammPoolProvider.appClient.calculateLiquidityFlatPrice({
          args: {
            x: BigInt(Math.round(scenario.x * SCALE)),
            y: BigInt(Math.round(scenario.x * SCALE)),
            price: BigInt(Math.round(scenario.p1 * SCALE)),
          },
        });
      } else {
        const dSqrt = await clientBiatecClammPoolProvider.appClient.calculateLiquidityD({
          args: {
            x: BigInt(Math.round(scenario.x * SCALE)),
            y: BigInt(Math.round(scenario.x * SCALE)),
            priceMin: BigInt(Math.round(scenario.p1 * SCALE)),
            priceMinSqrt: priceSqrtMin,
            priceMax: BigInt(Math.round(scenario.p2 * SCALE)),
            priceMaxSqrt: priceSqrtMax,
          },
        });
        if (!dSqrt) throw new Error('Expected non-zero dSqrt');
        liquidity = await clientBiatecClammPoolProvider.appClient.calculateLiquidityWithD({
          args: {
            x: BigInt(Math.round(scenario.x * SCALE)),
            y: BigInt(Math.round(scenario.x * SCALE)),
            priceMinSqrt: priceSqrtMin,
            priceMaxSqrt: priceSqrtMax,
            dSqrt,
          },
        });
      }

      const result = await clientBiatecClammPoolProvider.appClient.calculateAssetAWithdrawOnAssetBDeposit({
        args: {
          inAmount: BigInt(Math.round(scenario.deposit * SCALE)),
          assetABalance: BigInt(Math.round(scenario.x * SCALE)),
          assetBBalance: BigInt(Math.round(scenario.y * SCALE)),
          priceMinSqrt: priceSqrtMin,
          priceMaxSqrt: priceSqrtMax,
          liquidity,
        },
      });

      expect(result).toEqual(BigInt(Math.round(scenario.expected * SCALE)));
    }
  });

  test('calculateLiquidity returns correct results', async () => {
    for (const scenario of mathData.calculateLiquidity) {
      const { clientBiatecClammPoolProvider } = await setupPool({
        algod: fixture.context.algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(scenario.p1 * SCALE),
        p1: BigInt(scenario.p1 * SCALE),
        p2: BigInt(scenario.p2 * SCALE),
      });

      const dSqrt = await clientBiatecClammPoolProvider.appClient.calculateLiquidityD({
        args: {
          x: BigInt(Math.round(scenario.x * SCALE)),
          y: BigInt(Math.round(scenario.y * SCALE)),
          priceMin: BigInt(Math.round(scenario.p1 * SCALE)),
          priceMinSqrt: BigInt(Math.round(Math.sqrt(scenario.p1) * SCALE)),
          priceMax: BigInt(Math.round(scenario.p2 * SCALE)),
          priceMaxSqrt: BigInt(Math.round(Math.sqrt(scenario.p2) * SCALE)),
        },
      });

      expect(dSqrt).toBe(BigInt(Math.round(scenario.dSqrt * SCALE)));
      if (dSqrt === undefined) throw new Error('Expected dSqrt to be defined');

      const liquidity = await clientBiatecClammPoolProvider.appClient.calculateLiquidityWithD({
        args: {
          x: BigInt(Math.round(scenario.x * SCALE)),
          y: BigInt(Math.round(scenario.y * SCALE)),
          priceMinSqrt: BigInt(Math.round(Math.sqrt(scenario.p1) * SCALE)),
          priceMaxSqrt: BigInt(Math.round(Math.sqrt(scenario.p2) * SCALE)),
          dSqrt,
        },
      });

      expect(liquidity).toEqual(BigInt(Math.round(scenario.liquidity * SCALE)));
    }
  });

  test('calculateAssetAWithdrawOnLPDeposit returns correct results', async () => {
    const { clientBiatecClammPoolProvider, clientBiatecPoolProvider, clientBiatecConfigProvider } = await setupPool({
      algod: fixture.context.algod,
      assetA: 1n,
      biatecFee: 0n,
      lpFee: 0n,
      p: 1n,
      p1: 1n,
      p2: 2n,
    });

    for (const scenario of mathData.calculateAssetAWithdrawOnLpDeposit) {
      const result = await clientBiatecPoolProvider.appClient.calculateAssetBWithdrawOnLpDeposit({
        args: {
          inAmount: BigInt(Math.round(scenario.deposit * SCALE)),
          assetBBalance: BigInt(Math.round(scenario.balance * SCALE)),
          liquidity: BigInt(Math.round(scenario.liquidity * SCALE)),
        },
        extraFee: algokit.microAlgos(2_000),
      });
      expect(result).toEqual(BigInt(Math.round(scenario.expected * SCALE)));
    }
  });

  test('calculateAssetBWithdrawOnLPDeposit returns correct results', async () => {
    const { clientBiatecClammPoolProvider, clientBiatecPoolProvider } = await setupPool({
      algod: fixture.context.algod,
      assetA: 1n,
      biatecFee: 0n,
      lpFee: 0n,
      p: 1n,
      p1: 1n,
      p2: 2n,
    });

    for (const scenario of mathData.calculateAssetBWithdrawOnLpDeposit) {
      const result = await clientBiatecPoolProvider.appClient.calculateAssetBWithdrawOnLpDeposit({
        args: {
          inAmount: BigInt(Math.round(scenario.deposit * SCALE)),
          assetBBalance: BigInt(Math.round(scenario.balance * SCALE)),
          liquidity: BigInt(Math.round(scenario.liquidity * SCALE)),
        },
        extraFee: algokit.microAlgos(2_000),
      });
      expect(result).toEqual(BigInt(Math.round(scenario.expected * SCALE)));
    }
  });

  test('calculateAssetBDepositOnAssetADeposit returns correct results', async () => {
    const { clientBiatecClammPoolProvider } = await setupPool({
      algod: fixture.context.algod,
      assetA: 1n,
      biatecFee: 0n,
      lpFee: 0n,
      p: 1n,
      p1: 1n,
      p2: 2n,
    });

    for (const scenario of mathData.calculateAssetBDepositOnAssetADeposit) {
      const result = await clientBiatecClammPoolProvider.appClient.calculateAssetBDepositOnAssetADeposit({
        args: {
          inAmountA: BigInt(Math.round(scenario.depositA * SCALE)),
          inAmountB: BigInt(Math.round(scenario.depositB * SCALE)),
          assetABalance: BigInt(Math.round(scenario.x * SCALE)),
          assetBBalance: BigInt(Math.round(scenario.y * SCALE)),
        },
        extraFee: algokit.microAlgos(2_000),
      });
      expect(result).toEqual(BigInt(Math.round(scenario.depositB * SCALE)));
    }
  });

  test('calculateAssetADepositOnAssetBDeposit returns correct results', async () => {
    const { clientBiatecClammPoolProvider } = await setupPool({
      algod: fixture.context.algod,
      assetA: 1n,
      biatecFee: 0n,
      lpFee: 0n,
      p: 1n,
      p1: 1n,
      p2: 2n,
    });

    for (const scenario of mathData.calculateAssetADepositOnAssetBDeposit) {
      const result = await clientBiatecClammPoolProvider.appClient.calculateAssetADepositOnAssetBDeposit({
        args: {
          inAmountA: BigInt(Math.round(scenario.depositA * SCALE)),
          inAmountB: BigInt(Math.round(scenario.depositB * SCALE)),
          assetABalance: BigInt(Math.round(scenario.x * SCALE)),
          assetBBalance: BigInt(Math.round(scenario.y * SCALE)),
        },
        extraFee: algokit.microAlgos(2_000),
      });
      expect(result).toEqual(BigInt(Math.round(scenario.expected * SCALE)));
    }
  });
});
