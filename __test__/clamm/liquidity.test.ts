import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk from 'algosdk';
import liquidityData from './data/liquidity-basic.json';
import getBoxReferenceStats from '../../src/biatecPools/getBoxReferenceStats';
import { LP_TOKEN_DECIMALS, SCALE, SCALE_A, SCALE_B, SCALE_LP, fixture, initDeployer, setupPool } from './setup';

type LiquidityScenario = (typeof liquidityData.addLiquidity)[number];
type LiquiditySecondScenario = (typeof liquidityData.addLiquiditySecond)[number];
type SwapScenario = (typeof liquidityData.swapAtoB)[number];
type RemoveScenario = (typeof liquidityData.removeLiquidity)[number];

const toBigInt = (value: number | bigint) => (typeof value === 'bigint' ? value : BigInt(value));

describe('clamm liquidity flows', () => {
  beforeEach(fixture.newScope);
  beforeAll(async () => {
    await initDeployer();
  });

  const optInToAsset = async (
    algod: algosdk.Algodv2,
    account: algosdk.Account,
    assetId: number | bigint,
    params: algosdk.SuggestedParams
  ) => {
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: 0,
      assetIndex: Number(assetId),
      sender: account.addr,
      receiver: account.addr,
      suggestedParams: params,
    });
    const signedOptIn = algosdk.signTransaction(optInTxn, account.sk);
    await algod.sendRawTransaction(signedOptIn.blob).do();
    await algosdk.waitForConfirmation(algod, signedOptIn.txID, 4);
  };

  const makeDepositTxn = (
    sender: algosdk.Account,
    receiver: string,
    params: algosdk.SuggestedParams,
    amount: bigint,
    assetId: number | bigint
  ) =>
    algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount,
      assetIndex: Number(assetId),
      sender: sender.addr,
      receiver,
      suggestedParams: params,
    });

  test('addLiquidity issues expected LP tokens', async () => {
    for (const scenario of liquidityData.addLiquidity as LiquidityScenario[]) {
      const { algod } = fixture.context;
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        assetAId,
        assetBId,
        deployer,
      } = await setupPool({
        algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(Math.round(scenario.p * SCALE)),
        p1: BigInt(Math.round(scenario.p1 * SCALE)),
        p2: BigInt(Math.round(scenario.p2 * SCALE)),
      });

      const params = await algod.getTransactionParams().do();
      const poolTokenId = toBigInt(await clientBiatecClammPoolProvider.appClient.getLpTokenId());
      expect(poolTokenId > 0n).toBe(true);

      await optInToAsset(algod, deployer, poolTokenId, params);
      const poolAddress = String(clientBiatecClammPoolProvider.appClient.appAddress);

      const depositA = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.x * SCALE_A)),
        assetAId
      );
      const depositB = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.y * SCALE_B)),
        assetBId
      );

      const liquidityResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
        args: {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: depositA,
          txAssetBDeposit: depositB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        extraFee: algokit.microAlgos(9_000),
      });

      const returned = await liquidityResult.return;
      expect(returned?.valueOf()).toEqual(BigInt(Math.round(scenario.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));
    }
  });

  test('addLiquidity supports multiple rounds', async () => {
    for (const scenario of liquidityData.addLiquiditySecond as LiquiditySecondScenario[]) {
      const { algod } = fixture.context;
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        assetAId,
        assetBId,
        deployer,
      } = await setupPool({
        algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(Math.round(scenario.p * SCALE)),
        p1: BigInt(Math.round(scenario.p1 * SCALE)),
        p2: BigInt(Math.round(scenario.p2 * SCALE)),
      });

      const params = await algod.getTransactionParams().do();
      const poolTokenId = toBigInt(await clientBiatecClammPoolProvider.appClient.getLpTokenId());
      await optInToAsset(algod, deployer, poolTokenId, params);
      const poolAddress = String(clientBiatecClammPoolProvider.appClient.appAddress);

      const firstDepositA = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.x * SCALE_A)),
        assetAId
      );
      const firstDepositB = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.y * SCALE_B)),
        assetBId
      );

      const firstResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
        args: {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: firstDepositA,
          txAssetBDeposit: firstDepositB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        extraFee: algokit.microAlgos(9_000),
      });

      expect(await firstResult.return).toEqual(
        BigInt(Math.round(scenario.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS))
      );

      const secondDepositA = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.x2 * SCALE_A)),
        assetAId
      );
      const secondDepositB = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.y2 * SCALE_B)),
        assetBId
      );

      const secondResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
        args: {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: secondDepositA,
          txAssetBDeposit: secondDepositB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        extraFee: algokit.microAlgos(9_000),
      });

      expect(await secondResult.return).toEqual(
        BigInt(Math.round(scenario.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS))
      );
    }
  });

  test('swap from asset A to asset B matches expectations', async () => {
    for (const scenario of liquidityData.swapAtoB as SwapScenario[]) {
      const { algod } = fixture.context;
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        clientBiatecPoolProvider,
        assetAId,
        assetBId,
        deployer,
      } = await setupPool({
        algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(Math.round(scenario.p * SCALE)),
        p1: BigInt(Math.round(scenario.p1 * SCALE)),
        p2: BigInt(Math.round(scenario.p2 * SCALE)),
      });

      const params = await algod.getTransactionParams().do();
      const poolTokenId = toBigInt(await clientBiatecClammPoolProvider.appClient.getLpTokenId());
      await optInToAsset(algod, deployer, poolTokenId, params);
      const poolAddress = String(clientBiatecClammPoolProvider.appClient.appAddress);

      const depositA = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.x * SCALE_A)),
        assetAId
      );
      const depositB = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.y * SCALE_B)),
        assetBId
      );

      await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
        args: {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: depositA,
          txAssetBDeposit: depositB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        extraFee: algokit.microAlgos(9_000),
      });

      const swapDeposit = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.swapA * SCALE_A)),
        assetAId
      );

      const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
        args: {
          minimumToReceive: 0,
          txSwap: swapDeposit,
          assetA: assetAId,
          assetB: assetBId,
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
        },
        extraFee: algokit.microAlgos(9_000),
        boxReferences: getBoxReferenceStats({
          appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
          appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
          assetA: assetAId,
          assetB: assetBId,
          includingAssetBoxes: false,
        }),
        appReferences: [
          BigInt(clientBiatecConfigProvider.appClient.appId),
          BigInt(clientBiatecIdentityProvider.appClient.appId),
          BigInt(clientBiatecPoolProvider.appClient.appId),
        ],
        assetReferences: [toBigInt(assetAId), toBigInt(assetBId)],
      });

      expect(await swapResult.return).toEqual(BigInt(Math.round(scenario.swapB * SCALE_B)));
    }
  });

  test('swap from asset B to asset A matches expectations', async () => {
    for (const scenario of liquidityData.swapBtoA as SwapScenario[]) {
      const { algod } = fixture.context;
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        clientBiatecPoolProvider,
        assetAId,
        assetBId,
        deployer,
      } = await setupPool({
        algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(Math.round(scenario.p * SCALE)),
        p1: BigInt(Math.round(scenario.p1 * SCALE)),
        p2: BigInt(Math.round(scenario.p2 * SCALE)),
      });

      const params = await algod.getTransactionParams().do();
      const poolTokenId = toBigInt(await clientBiatecClammPoolProvider.appClient.getLpTokenId());
      await optInToAsset(algod, deployer, poolTokenId, params);
      const poolAddress = String(clientBiatecClammPoolProvider.appClient.appAddress);

      const depositA = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.x * SCALE_A)),
        assetAId
      );
      const depositB = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.y * SCALE_B)),
        assetBId
      );

      await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
        args: {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: depositA,
          txAssetBDeposit: depositB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        extraFee: algokit.microAlgos(9_000),
      });

      const swapDeposit = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.swapB * SCALE_B)),
        assetBId
      );

      const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
        args: {
          minimumToReceive: 0,
          txSwap: swapDeposit,
          assetA: assetAId,
          assetB: assetBId,
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
        },
        extraFee: algokit.microAlgos(9_000),
        boxReferences: getBoxReferenceStats({
          appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
          appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
          assetA: assetAId,
          assetB: assetBId,
          includingAssetBoxes: false,
        }),
        appReferences: [
          BigInt(clientBiatecConfigProvider.appClient.appId),
          BigInt(clientBiatecIdentityProvider.appClient.appId),
          BigInt(clientBiatecPoolProvider.appClient.appId),
        ],
        assetReferences: [toBigInt(assetAId), toBigInt(assetBId)],
      });

      expect(await swapResult.return).toEqual(BigInt(Math.round(scenario.swapA * SCALE_A)));
    }
  });

  test('removeLiquidity returns proportional LP share', async () => {
    for (const scenario of liquidityData.removeLiquidity as RemoveScenario[]) {
      const { algod } = fixture.context;
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        assetAId,
        assetBId,
        deployer,
      } = await setupPool({
        algod,
        assetA: 1n,
        biatecFee: 0n,
        lpFee: 0n,
        p: BigInt(Math.round(scenario.p * SCALE)),
        p1: BigInt(Math.round(scenario.p1 * SCALE)),
        p2: BigInt(Math.round(scenario.p2 * SCALE)),
      });

      const params = await algod.getTransactionParams().do();
      const poolTokenId = toBigInt(await clientBiatecClammPoolProvider.appClient.getLpTokenId());
      await optInToAsset(algod, deployer, poolTokenId, params);
      const poolAddress = String(clientBiatecClammPoolProvider.appClient.appAddress);

      const depositA = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.x * SCALE_A)),
        assetAId
      );
      const depositB = makeDepositTxn(
        deployer,
        poolAddress,
        params,
        BigInt(Math.round(scenario.y * SCALE_B)),
        assetBId
      );

      const liquidityResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
        args: {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: depositA,
          txAssetBDeposit: depositB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        extraFee: algokit.microAlgos(9_000),
      });

      expect(await liquidityResult.return).toEqual(
        BigInt(Math.round(scenario.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS))
      );

      const removeTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: BigInt(Math.round(scenario.lpTokensToWithdraw * SCALE_LP)),
        assetIndex: Number(poolTokenId),
        sender: deployer.addr,
        receiver: poolAddress,
        suggestedParams: params,
      });

      const removal = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
        args: {
          appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
          appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
          txLpXfer: removeTxn,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        extraFee: algokit.microAlgos(9_000),
      });

      expect(await removal.return).toEqual(BigInt(Math.round(scenario.expected * 10 ** LP_TOKEN_DECIMALS)));
    }
  });
});
