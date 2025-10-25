/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import { convertToBigInt } from '../test-data/convertToBigInt';
import swapAToBData from '../test-data/swap-a-to-b.json';
import swapBToAData from '../test-data/swap-b-to-a.json';
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

describe('BiatecClammPool - swaps', () => {
  test('swapAtoB - I can add liquidity to the pool and swap from A token to B token', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = swapAToBData;

      const params = await algod.getTransactionParams().do();
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
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

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
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.L * 10 ** LP_TOKEN_DECIMALS)));

        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapA * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
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
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('swapBtoA - I can add liquidity to the pool and swap from B token to A token', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = swapBToAData;

      const params = await algod.getTransactionParams().do();
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
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

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
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.L * 10 ** LP_TOKEN_DECIMALS)));

        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addSwapB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapB * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            minimumToReceive: 0,
            txSwap: addSwapB,
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
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
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapA * SCALE_A)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

});
