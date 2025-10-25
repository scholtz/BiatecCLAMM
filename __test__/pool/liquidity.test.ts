/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import { convertToBigInt } from '../test-data/convertToBigInt';
import addLiquidityData from '../test-data/add-liquidity.json';
import addLiquiditySecondData from '../test-data/add-liquidity-second.json';
import removeLiquidityData from '../test-data/remove-liquidity.json';
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

describe('BiatecClammPool - liquidity', () => {
  test('addLiquidity1 - I can add liquidity to the pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = addLiquidityData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } =
          await setupPool({
            algod,
            signer: deployer,
            assetA: assetAId,
            biatecFee: 0n,
            lpFee: 0n,
            p: BigInt(t.P * SCALE),
            p1: BigInt(t.P1 * SCALE),
            p2: BigInt(t.P2 * SCALE),
          });

        const params = await algod.getTransactionParams().do();

        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId({ args: {} });
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
        const depositA = {
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        };
        const depositB = {
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        };
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(depositA);
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(depositB);
        const liquidityInput = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };

        // const tx = clammAddLiquiditySender({
        //   account: deployerSigner,
        //   algod: algod,
        //   appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        //   appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        //   assetLp: poolTokenId,
        //   assetA: assetAId,
        //   assetB: assetBId,
        //   assetADeposit: BigInt(Math.round(t.x * SCALE_A)),
        //   assetBDeposit: BigInt(Math.round(t.y * SCALE_B)),
        //   clientBiatecClammPool: clientBiatecClammPoolProvider.appClient
        // });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: liquidityInput,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('addLiquidity2 - I can add liquidity to the pool second step', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = addLiquiditySecondData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } =
          await setupPool({
            algod,
            signer: deployer,
            assetA: assetAId,
            biatecFee: 0n,
            lpFee: 0n,
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
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        /// /////////////////////////////////// STEP 2

        const addLiquidityA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x2 * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y2 * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA2,
            txAssetBDeposit: addLiquidityB2,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('removeLiquidity - I can add and remove liquidity from the pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = removeLiquidityData;

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } =
          await setupPool({
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
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
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
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

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
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

});
