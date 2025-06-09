/* eslint-disable no-await-in-loop */
import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, { Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import getPools from '../src/biatecClamm/getPools';
import clammCreateSender from '../src/biatecClamm/sender/clammCreateSender';
import { assetAId, assetBId, setupPool } from './BiatecClammPool.test';
import { clammAddLiquiditySender } from '../src';
import createToken from '../src/createToken';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

const SCALE = 1_000_000_000;
const ASSET_A_DECIMALS = 8; // BTC Lik
const SCALE_A = 10 ** ASSET_A_DECIMALS;
const ASSET_B_DECIMALS = 6; // BTC Like
const SCALE_B = 10 ** ASSET_B_DECIMALS;
const SCALE_ALGO = 10 ** 6;
const LP_TOKEN_DECIMALS = 6; // BTC Like
const SCALE_LP = 10 ** LP_TOKEN_DECIMALS;

let deployer: algosdk.Account;
let deployerSigner: TransactionSignerAccount;

// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any, func-names
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

describe('clamm', () => {
  beforeEach(fixture.newScope);

  beforeAll(async () => {
    await fixture.newScope();
    const { algod } = fixture.context;
    deployer = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(1_000_000_000) });

    deployerSigner = {
      addr: deployer.addr,
      // eslint-disable-next-line no-unused-vars
      signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
        return txnGroup.map((tx) => tx.signTxn(deployer.sk));
      },
    };
  });

  test('npm: clammCreateSender()', async () => {
    try {
      const { algod } = fixture.context;
      const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        signer: deployer,
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
      const deployerSigner = {
        addr: deployer.addr,
        // eslint-disable-next-line no-unused-vars
        signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
          return txnGroup.map((tx) => tx.signTxn(deployer.sk));
        },
      };
      const client = await clammCreateSender({
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
      expect(client.appId).toBeGreaterThan(0);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('npm: getPrice()', async () => {
    try {
      const { algod } = fixture.context;
      const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        signer: deployer,
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
      const deployerSigner = {
        addr: deployer.addr,
        // eslint-disable-next-line no-unused-vars
        signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
          return txnGroup.map((tx) => tx.signTxn(deployer.sk));
        },
      };
      const client = await clammCreateSender({
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
      expect(client.appId).toBeGreaterThan(0);

      const priceBox = await clientBiatecPoolProvider.appClient.getPrice({
        args: {
          appPoolId: appId,
          assetA: assetAId,
          assetB: assetBId,
        },
      });
      const priceBoxAggregated = await clientBiatecPoolProvider.appClient.getPrice({
        args: {
          appPoolId: 0n,
          assetA: assetAId,
          assetB: assetBId,
        },
      });
      expect(priceBox).toEqual(priceBoxAggregated);
      console.log('priceBox', priceBox);
      expect(priceBox).toEqual({
        assetA: assetAId,
        assetB: assetBId,
        verificationClass: 0n,
        latestPrice: 1500000000n,
        period1Duration: 60n,
        period1NowVolumeA: 0n,
        period1NowVolumeB: 0n,
        period1NowFeeA: 0n,
        period1NowFeeB: 0n,
        period1NowVwap: 0n,
        period1NowTime: 0n,
        period1PrevVolumeA: 0n,
        period1PrevVolumeB: 0n,
        period1PrevFeeA: 0n,
        period1PrevFeeB: 0n,
        period1PrevVwap: 0n,
        period1PrevTime: 0n,
        period2Duration: 86400n,
        period2NowVolumeA: 0n,
        period2NowVolumeB: 0n,
        period2NowFeeA: 0n,
        period2NowFeeB: 0n,
        period2NowVwap: 0n,
        period2NowTime: 0n,
        period2PrevVolumeA: 0n,
        period2PrevVolumeB: 0n,
        period2PrevFeeA: 0n,
        period2PrevFeeB: 0n,
        period2PrevVwap: 0n,
        period2PrevTime: 0n,
        period3Duration: 604800n,
        period3NowVolumeA: 0n,
        period3NowVolumeB: 0n,
        period3NowFeeA: 0n,
        period3NowFeeB: 0n,
        period3NowVwap: 0n,
        period3NowTime: 0n,
        period3PrevVolumeA: 0n,
        period3PrevVolumeB: 0n,
        period3PrevFeeA: 0n,
        period3PrevFeeB: 0n,
        period3PrevVwap: 0n,
        period3PrevTime: 0n,
        period4Duration: 31536000n,
        period4NowVolumeA: 0n,
        period4NowVolumeB: 0n,
        period4NowFeeA: 0n,
        period4NowFeeB: 0n,
        period4NowVwap: 0n,
        period4NowTime: 0n,
        period4PrevVolumeA: 0n,
        period4PrevVolumeB: 0n,
        period4PrevFeeA: 0n,
        period4PrevFeeB: 0n,
        period4PrevVwap: 0n,
        period4PrevTime: 0n,
      });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('npm: clammAddLiquiditySender()', async () => {
    try {
      const { algod } = fixture.context;
      const assetUSD = await createToken({ account: deployer, algod, name: 'USD', decimals: ASSET_A_DECIMALS });
      const assetEUR = await createToken({ account: deployer, algod, name: 'EUR', decimals: ASSET_B_DECIMALS });
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecPoolProvider,
        clientBiatecIdentityProvider,
      } = await setupPool({
        algod,
        signer: deployer,
        assetA: assetUSD,
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
      const client = await clammCreateSender({
        transactionSigner: deployerSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        assetA: assetUSD,
        assetB: assetEUR,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        currentPrice: BigInt(1.5 * SCALE),
        fee: BigInt(SCALE / 10),
        priceMin: BigInt(2 * SCALE),
        priceMax: BigInt(3 * SCALE),
        verificationClass: 0,
      });
      expect(client.appId).toBeGreaterThan(0);
      const assetLp = await client.state.global.assetLp();
      expect(assetLp).toBeDefined();
      expect(assetLp).toBeGreaterThan(0n);
      if (!assetLp) throw Error('LP token not defined');
      console.log('add liquidity to pool', {
        account: deployerSigner,
        assetA: assetUSD,
        assetB: assetEUR,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        algod: algod,
        clientBiatecClammPool: client,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        assetADeposit: BigInt(1 * SCALE_A),
        assetBDeposit: BigInt(1 * SCALE_B),
        assetLp: assetLp,
      });
      const liquidity = await clammAddLiquiditySender({
        account: deployerSigner,
        assetA: assetUSD,
        assetB: assetEUR,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        algod: algod,
        clientBiatecClammPool: client,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        assetADeposit: BigInt(1 * SCALE_A),
        assetBDeposit: BigInt(1 * SCALE_B),
        assetLp: assetLp,
      });
      expect(liquidity).toBeDefined();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('npm: getPools()', async () => {
    try {
      const { algod } = fixture.context;
      const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        signer: deployer,
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
        algod: algod,
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
