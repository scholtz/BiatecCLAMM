/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import { convertToBigInt } from '../test-data/convertToBigInt';
import {
  setupPool,
  assetAId,
  assetBId,
  deployer,
  SCALE,
  SCALE_A,
  SCALE_B,
  fixture,
  FakePoolFactory,
  AlgoAmount,
  setAssetAId,
} from './shared-setup';
import type { Transaction } from './shared-setup';

describe('BiatecClammPool - deployment', () => {
  test('I can deploy the concentrated liquidity pool', async () => {
    try {
      await setAssetAId(1n);
      const { algod } = fixture.context;
      const { clientBiatecClammPoolProvider } = await setupPool({
        algod,
        
        assetA: assetAId,
        biatecFee: BigInt(SCALE / 10),
        lpFee: BigInt(SCALE / 10),
        p: BigInt(1.5 * SCALE),
        p1: BigInt(1 * SCALE),
        p2: BigInt(2 * SCALE),
      });
      expect(!!clientBiatecClammPoolProvider).toBeTruthy();
      const appId = await clientBiatecClammPoolProvider.appClient.appId;
      expect(appId).toBeGreaterThan(0);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });


  test('CantMixPP: I can not register to pool provider amm pool not created by pool provider', async () => {
    try {
      await setAssetAId(1n);
      const { algod } = fixture.context;
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        clientBiatecPoolProvider,
      } = await setupPool({
        algod,
        
        assetA: assetAId,
        biatecFee: BigInt(SCALE / 10),
        lpFee: BigInt(SCALE / 10),
        p: BigInt(1.5 * SCALE),
        p1: BigInt(1 * SCALE),
        p2: BigInt(2 * SCALE),
      });
      expect(!!clientBiatecClammPoolProvider).toBeTruthy();
      const appId = await clientBiatecClammPoolProvider.appClient.appId;
      expect(appId).toBeGreaterThan(0);

      const defaultSigner = async (txnGroup: Transaction[], indexesToSign: number[]) => {
        return txnGroup.map((tx) => tx.signTxn(deployer.sk));
      };

      const fakePoolfactory = new FakePoolFactory({
        defaultSender: deployer.addr,
        defaultSigner: defaultSigner,
        algorand: clientBiatecClammPoolProvider.appClient.algorand,
      });
      const fakeClientProvider = await fakePoolfactory.send.create.createApplication({ args: {} });
      expect(fakeClientProvider.appClient.appId).toBeGreaterThan(0n);
      // await fakeClientProvider.appClient.send.bootstrapStep2({
      //   args: {
      //     appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      //     assetA: assetAId,
      //     assetB: assetBId,
      //     verificationClass: 0,
      //   },
      //   staticFee: AlgoAmount.MicroAlgo(2000),
      // });

      await expect(
        fakeClientProvider.appClient.send.bootstrapStep2({
          args: {
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            verificationClass: 0,
          },
          staticFee: AlgoAmount.MicroAlgo(2000),
        })
      ).rejects.toThrow();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });


});
