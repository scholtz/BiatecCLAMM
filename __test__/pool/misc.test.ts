/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import { convertToBigInt } from '../test-data/convertToBigInt';
import algoVsAsaPoolData from '../test-data/algo-vs-asa-pool.json';
import {
  setupPool,
  assetAId,
  assetBId,
  deployer,
  SCALE,
  SCALE_A,
  SCALE_B,
  SCALE_ALGO,
  SCALE_LP,
  LP_TOKEN_DECIMALS,
  algosdk,
  algokit,
  getPools,
  clammCreateSender,
  getBoxReferenceStats,
} from './shared-setup';
import type { Transaction } from './shared-setup';

describe('BiatecClammPool - misc', () => {
  test('I can make the pool protect algorand network', async () => {
    const { clientBiatecClammPoolProvider } = await setupPool({
      assetA: 1n,
      biatecFee: 100_000_000n,
      lpFee: 100_000_000n,
      p: 100_000_000n,
      p1: 100_000_000n,
      p2: 100_000_000n,
    });

    expect(clientBiatecClammPoolProvider.appClient.send.sendOnlineKeyRegistration).not.toBeNull();
  });

  test('I can have algo vs asa in the pool', async () => {
    try {
      const testSet = convertToBigInt(algoVsAsaPoolData);

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
          algod,
        } = await setupPool({
          assetA: 0n,
          biatecFee: 0n,
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
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: t.assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(t.assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        const addLiquidityA =
          t.assetAId === 0
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_ALGO)),
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_A)),
                assetIndex: t.assetAId,
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              });

        const addLiquidityB =
          assetBId === 0n
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_ALGO)),
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.y * SCALE_B)),
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
          assetA: t.assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: t.assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(t.assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const addSwapA =
          t.assetAId === 0
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.swapA * SCALE_ALGO)),
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.swapA * SCALE_A)),
                assetIndex: t.assetAId,
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
            assetA: t.assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: t.assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(t.assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: t.assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(t.assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

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
            assetA: t.assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: t.assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(t.assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('npm method getPools() works', async () => {
    try {
      const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecPoolProvider, algod } =
        await setupPool({
          assetA: 1n,
          biatecFee: BigInt(SCALE / 10),
          lpFee: BigInt(SCALE / 10),
          p: BigInt(1.5 * SCALE),
          p1: BigInt(1 * SCALE),
          p2: BigInt(2 * SCALE),
        });
      expect(!!clientBiatecClammPoolProvider).toBeTruthy();
      const appId = await clientBiatecClammPoolProvider.appClient.appId;
      expect(appId).toBeGreaterThan(0);
      const deployerSigner = {
        addr: deployer.addr,
        // eslint-disable-next-line no-unused-vars
        signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
          return txnGroup.map((tx) => tx.signTxn(deployer.sk));
        },
      };
      await clammCreateSender({
        transactionSigner: deployerSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        assetA: assetAId,
        assetB: assetBId,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        currentPrice: BigInt(1.5 * SCALE),
        fee: BigInt(SCALE / 10),
        priceMin: BigInt(2 * SCALE),
        priceMax: BigInt(3 * SCALE),
        verificationClass: 0,
      });

      // for (let i = 0; i < 10; i++) {
      //   await fixture.context.generateAccount({ initialFunds: AlgoAmount.Algo(1) }); // generate new tx on chain, so that we move one block further
      // }

      const pools = await getPools({
        assetId: assetAId,
        algod,
        poolProviderAppId: clientBiatecPoolProvider.appClient.appId,
        fee: undefined,
        verificationClass: undefined,
      });

      expect(pools.length).toBe(2);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
});
