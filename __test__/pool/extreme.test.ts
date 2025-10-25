/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import { convertToBigInt } from '../test-data/convertToBigInt';
import extremeSamePriceLowTopData from '../test-data/extreme-same-price-low-top-asasr.json';
import extremeSmallMinMaxPriceDiffData from '../test-data/extreme-small-min-max-price-diff.json';
import extremeExtremePriceMinData from '../test-data/extreme-extreme-price-min.json';
import extremeNoFeesEurusdData from '../test-data/extreme-no-fees-eurusd.json';
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

describe('BiatecClammPool - extreme', () => {
  test('Extreme-SamePriceLowTop - ASASR - I can handle the trade as an order book item', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(extremeSamePriceLowTopData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 500_000_000n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
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
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        expect(stats1).toStrictEqual(t.stats1);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed2).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
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
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed3).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        // expect(stats2).toBe(t.stats2);
        expect(stats2).toStrictEqual(t.stats2);
        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('Extreme-SmallMinMaxPriceDiff - ASASR 0.9999 - 1.0001, LP fee 1BPS, Biatec fee 10%', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(extremeSmallMinMaxPriceDiffData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000n, // 0.01%
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
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
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        // expect(stats1).toBe(t.stats1);
        expect(stats1).toStrictEqual(t.stats1);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS)));

        const distributed2 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed2).toEqual(BigInt(Math.round(Math.round(t.checkDistributed2 * SCALE))));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
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
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed3).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);
        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });


  test('Extreme-ExtremePrice-Min - ASASR 0.000000001 - 1, LP fee 1BPS, Biatec fee 10%', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(extremeExtremePriceMinData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000n, // 0.01%
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
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
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        expect(stats1).toStrictEqual(t.stats1);

        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed2).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
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
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed3).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);

        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('Extreme-No-Fees - ASASR EURUSD - 0.9 - 1.1, LP fee 0, Biatec fee 0%', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(extremeNoFeesEurusdData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n, // 0.01%
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });

        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        expect(addSwapA.assetTransfer?.amount).toEqual(10_000_000_000n); // 100 * 10^8

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
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
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        expect(stats1).toStrictEqual(t.stats1);

        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
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
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);

        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

});
