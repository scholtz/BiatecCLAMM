/* eslint-disable no-await-in-loop */
import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, { Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../contracts/clients/BiatecClammPoolClient';
import createToken from '../src/createToken';
import { BiatecIdentityProviderClient } from '../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient } from '../contracts/clients/BiatecPoolProviderClient';
import { BiatecConfigProviderClient } from '../contracts/clients/BiatecConfigProviderClient';
import clammBootstrapSender from '../src/biatecClamm/sender/clammBootstrapSender';
import configBootstrapSender from '../src/biatecConfig/sender/configBootstrapSender';
import getBoxReferenceStats from '../src/biatecPools/getBoxReferenceStats';
import parseStatus from '../src/biatecClamm/parseStatus';
import parseStats from '../src/biatecPools/parseStats';

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

let assetAId: number = 0;
let assetBId: number = 0;
let deployer: algosdk.Account;
let deployerSigner: TransactionSignerAccount;

// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any, func-names
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
interface ISetup {
  algod: algosdk.Algodv2;
  signer: TransactionSignerAccount;
  p1: bigint;
  p2: bigint;
  p: bigint;
  assetA: number;
  biatecFee: bigint;
  lpFee: bigint;
}
const setupPool = async (input: ISetup) => {
  const { algod, signer, p1, p2, p, assetA, biatecFee, lpFee } = input;
  const clientBiatecClammPool = new BiatecClammPoolClient(
    {
      sender: signer,
      resolveBy: 'id',
      id: 0,
    },
    algod
  );
  const clientBiatecIdentityProvider = new BiatecIdentityProviderClient(
    {
      sender: signer,
      resolveBy: 'id',
      id: 0,
    },
    algod
  );
  const clientBiatecPoolProvider = new BiatecPoolProviderClient(
    {
      sender: signer,
      resolveBy: 'id',
      id: 0,
    },
    algod
  );
  const clientBiatecConfigProvider = new BiatecConfigProviderClient(
    {
      sender: signer,
      resolveBy: 'id',
      id: 0,
    },
    algod
  );
  await clientBiatecConfigProvider.create.createApplication({});
  await clientBiatecIdentityProvider.create.createApplication({});
  await clientBiatecPoolProvider.create.createApplication({});
  await clientBiatecClammPool.create.createApplication({});

  const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
  expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
  const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
  expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
  const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
  const refBiatecClammPool = await clientBiatecClammPool.appClient.getAppReference();
  expect(refBiatecClammPool.appId).toBeGreaterThan(0);
  let txId = await configBootstrapSender({
    algod,
    clientBiatecConfigProvider,
    account: signer,
    appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
    appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
    biatecFee,
  });
  expect(txId.length).toBe(52);
  txId = await clammBootstrapSender({
    fee: lpFee,
    assetA: BigInt(assetA),
    assetB: BigInt(assetBId),
    verificationClass: 0,
    appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
    priceMin: p1,
    priceMax: p2,
    currentPrice: p,
    account: signer,
    algod,
    appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
    clientBiatecClammPool,
  });
  expect(txId.length).toBe(52);
  return { clientBiatecClammPool, clientBiatecIdentityProvider, clientBiatecPoolProvider, clientBiatecConfigProvider };
};
describe('clamm', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { algod } = fixture.context;
    deployer = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(1_000_000_000) });

    deployerSigner = {
      addr: deployer.addr,
      // eslint-disable-next-line no-unused-vars
      signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
        return txnGroup.map((tx) => tx.signTxn(deployer.sk));
      },
    };
    assetAId = await createToken({ account: deployer, algod, name: 'EUR', decimals: ASSET_A_DECIMALS });
    assetBId = await createToken({ account: deployer, algod, name: 'USD', decimals: ASSET_B_DECIMALS });
  });

  test('I can deploy the concentrated liqudity pool', async () => {
    try {
      const { algod } = fixture.context;
      const { clientBiatecClammPool } = await setupPool({
        algod,
        signer: deployerSigner,
        assetA: assetAId,
        biatecFee: BigInt(SCALE / 10),
        lpFee: BigInt(SCALE / 10),
        p: BigInt(1.5 * SCALE),
        p1: BigInt(1 * SCALE),
        p2: BigInt(2 * SCALE),
      });
      expect(!!clientBiatecClammPool).toBeTruthy();
      const ammRef = await clientBiatecClammPool.appClient.getAppReference();
      expect(ammRef.appId).toBeGreaterThan(0);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });

  test('calculatePrice returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        { x: 0.2, y: 0, P1: 1, P2: 1.5625, L: 1, P: 1 },
        { x: 0, y: 0.25, P1: 1, P2: 1.5625, L: 1, P: 1.5625 },
        { x: 2, y: 0, P1: 1, P2: 1.5625, L: 10, P: 1 },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPool } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const result = await clientBiatecClammPool.calculatePrice({
          assetAQuantity: BigInt(t.x * SCALE),
          assetBQuantity: BigInt(t.y * SCALE),
          liquidity: t.L * SCALE,
          priceMinSqrt: Math.sqrt(t.P1) * SCALE,
          priceMaxSqrt: Math.sqrt(t.P2) * SCALE,
        });
        expect(result?.return?.valueOf()).toEqual(BigInt(t.P * SCALE));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('calculateAssetBWithdrawOnAssetADeposit returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        {
          x: 0,
          y: 0.25,
          P1: 1,
          P2: 1.5625,
          P: 1.5625,
          L: 1,
          deposit: 0.2,
          expectedWithdrawResult: 0.25,
        },
        {
          x: 1,
          y: 1,
          P1: 1,
          P2: 1,
          P: 1,
          L: 1,
          deposit: 1,
          expectedWithdrawResult: 1,
        },
        { x: 1000, y: 1100, P1: 1.1, P2: 1.1, L: 1, deposit: 1000, expectedWithdrawResult: 1099.999999643 }, // eurusd = 1.1 x = eur, y=usd, x = 1000 eur, y = 1100 usd, deposit 1100 usd, withdraw 1000 eur
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPool } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const result = await clientBiatecClammPool.calculateAssetBWithdrawOnAssetADeposit({
          inAmount: BigInt(t.deposit * SCALE),
          assetABalance: BigInt(t.x * SCALE),
          assetBBalance: BigInt(t.y * SCALE),
          priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
          priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
          liqudity: BigInt(t.L * SCALE),
        });

        expect(result?.return?.valueOf()).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('calculateAssetAWithdrawOnAssetBDeposit returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        { x: 0.2, y: 0, P1: 1, P2: 1.5625, depositB: 0.25, expectedWithdrawResult: 0.2 },
        { x: 2, y: 2, P1: 1, P2: 1, depositB: 1, expectedWithdrawResult: 1 },
        { x: 2, y: 0, P1: 1, P2: 1, depositB: 2, expectedWithdrawResult: 2 },
        { x: 1000, y: 1100, P1: 1.1, P2: 1.1, depositB: 1100, expectedWithdrawResult: 1000.000000324 }, // eurusd = 1.1 x = eur, y=usd, x = 1000 eur, y = 1100 usd, deposit 1100 usd, withdraw 1000 eur
        { x: 4, y: 0, P1: 4, P2: 4, depositB: 4, expectedWithdrawResult: 1 },
        { x: 4, y: 0, P1: 0.25, P2: 0.25, depositB: 1, expectedWithdrawResult: 4 },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPool } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });
        if (t.P1 === t.P2) {
          const L = await clientBiatecClammPool.calculateLiquidityFlatPrice({
            x: BigInt(t.x * SCALE),
            y: BigInt(t.x * SCALE),
            price: BigInt(t.P1 * SCALE),
          });

          const l = L.return?.valueOf();
          expect(l).toBeGreaterThan(0);
          if (!l) throw Error('L is zero');
          const input = {
            inAmount: BigInt(t.depositB * SCALE),
            assetABalance: BigInt(t.x * SCALE),
            assetBBalance: BigInt(t.y * SCALE),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
            liqudity: l,
          };
          const result = await clientBiatecClammPool.calculateAssetAWithdrawOnAssetBDeposit(input);
          expect(result?.return?.valueOf()).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
        } else {
          const dSqrtRet = await clientBiatecClammPool.calculateLiquidityD({
            x: BigInt(t.x * SCALE),
            y: BigInt(t.x * SCALE),
            priceMin: BigInt(t.P1 * SCALE),
            priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
            priceMax: BigInt(t.P2 * SCALE),
            priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
          });
          const D_SQRT = dSqrtRet.return?.valueOf();
          if (!D_SQRT) throw Error('D_SQRT is expected here');
          const L = await clientBiatecClammPool.calculateLiquidityWithD({
            x: BigInt(t.x * SCALE),
            y: BigInt(t.x * SCALE),
            priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
            priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
            D_SQRT,
          });
          const l = L.return?.valueOf();
          expect(l).toBeGreaterThan(0);
          if (!l) throw Error('L is zero');
          const result = await clientBiatecClammPool.calculateAssetAWithdrawOnAssetBDeposit({
            inAmount: BigInt(t.depositB * SCALE),
            assetABalance: BigInt(t.x * SCALE),
            assetBBalance: BigInt(t.y * SCALE),
            priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
            priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
            liqudity: l,
          });
          expect(result?.return?.valueOf()).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('calculateLiquidity returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        { x: 0.1, y: 0.1, P: 1, P1: 0.9999, P2: 1.0001, D_SQRT: 0.2, L: 2000.039996799 },
        { x: 0.2, y: 0, P1: 1, P2: 1.5625, D_SQRT: 0.2, L: 1 },
        { x: 2, y: 0, P: 1, P1: 1, P2: 1.5625, D_SQRT: 2, L: 10 },
        { x: 0, y: 0.25, P: 1.5625, P1: 1, P2: 1.5625, D_SQRT: 0.2, L: 1 },
        { x: 0.00000001, y: 0, P: 1, P1: 1, P2: 1.5625, D_SQRT: 0, L: 0.000000025 },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPool } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const dSqrtRet = await clientBiatecClammPool.calculateLiquidityD({
          x: BigInt(t.x * SCALE),
          y: BigInt(t.y * SCALE),
          priceMin: BigInt(t.P1 * SCALE),
          priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
          priceMax: BigInt(t.P2 * SCALE),
          priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
        });
        const D_SQRT = dSqrtRet.return?.valueOf();
        expect(D_SQRT).toBe(BigInt(t.D_SQRT * SCALE));
        if (D_SQRT === undefined) throw Error('D_SQRT is expected here');
        const result = await clientBiatecClammPool.calculateLiquidityWithD({
          x: BigInt(Math.round(t.x * SCALE)),
          y: BigInt(Math.round(t.y * SCALE)),
          priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
          priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
          D_SQRT,
        });
        expect(result?.return?.valueOf()).toEqual(BigInt(t.L * SCALE));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('calculateAssetAWithdrawOnLPDeposit returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        { x: 0.25, L: 1, lpDeposit: 1 / 2, aWithdraw: 0.25 / 2 },
        { x: 2.5, L: 10, lpDeposit: 10 / 2, aWithdraw: 2.5 / 2 },
        { x: 2.5, L: 10, lpDeposit: 10 / 10, aWithdraw: 2.5 / 10 },
        { x: 2.5, L: 10, lpDeposit: 10, aWithdraw: 2.5 },
      ];

      const { clientBiatecClammPool } = await setupPool({
        algod,
        signer: deployerSigner,
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
        const result = await clientBiatecClammPool.calculateAssetBWithdrawOnLpDeposit(
          {
            inAmount: BigInt(Math.round(t.lpDeposit * SCALE)),
            assetBBalance: BigInt(Math.round(t.x * SCALE)),
            liqudity: BigInt(Math.round(t.L * SCALE)),
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(2000) },
          }
        );
        expect(result?.return?.valueOf()).toEqual(BigInt(Math.round(t.aWithdraw * SCALE)));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('calculateAssetBWithdrawOnLPDeposit returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        { y: 0.25, L: 1, lpDeposit: 1 / 2, bWithdraw: 0.25 / 2 },
        { y: 2.5, L: 10, lpDeposit: 10 / 2, bWithdraw: 2.5 / 2 },
        { y: 2.5, L: 10, lpDeposit: 10 / 10, bWithdraw: 2.5 / 10 },
        { y: 2.5, L: 10, lpDeposit: 10, bWithdraw: 2.5 },
      ];

      const { clientBiatecClammPool } = await setupPool({
        algod,
        signer: deployerSigner,
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
        const result = await clientBiatecClammPool.calculateAssetBWithdrawOnLpDeposit(
          {
            inAmount: BigInt(Math.round(t.lpDeposit * SCALE)),
            assetBBalance: BigInt(Math.round(t.y * SCALE)),
            liqudity: BigInt(Math.round(t.L * SCALE)),
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(2000) },
          }
        );
        expect(result?.return?.valueOf()).toEqual(BigInt(Math.round(t.bWithdraw * SCALE)));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('calculateAssetBDepositOnAssetADeposit returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        { x: 0.25, y: 0, aDeposit: 0.25, bDeposit: 0 },
        // { x: 0, y: 0.25, aDeposit: 1, bDeposit: 0 }, // should fail
        { x: 1, y: 1, aDeposit: 2, bDeposit: 2 },
        { x: 10, y: 10, aDeposit: 1, bDeposit: 1 },
        { x: 10, y: 1, aDeposit: 10, bDeposit: 1 },
        { x: 1, y: 10, aDeposit: 10, bDeposit: 100 },
      ];

      const { clientBiatecClammPool } = await setupPool({
        algod,
        signer: deployerSigner,
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
        const result = await clientBiatecClammPool.calculateAssetBDepositOnAssetADeposit(
          {
            inAmountA: BigInt(Math.round(t.aDeposit * SCALE)),
            inAmountB: BigInt(Math.round(t.bDeposit * SCALE)),
            assetABalance: BigInt(Math.round(t.x * SCALE)),
            assetBBalance: BigInt(Math.round(t.y * SCALE)),
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(2000) },
          }
        );
        expect(result?.return?.valueOf()).toEqual(BigInt(Math.round(t.bDeposit * SCALE)));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });

  test('calculateAssetADepositOnAssetBDeposit returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        { y: 0, x: 1, bDeposit: 3, aDeposit: 0.001, aDepositOut: 0.001 }, // > special case aDepositOut = aDeposit
        { y: 0.25, x: 0, bDeposit: 1, aDeposit: 0, aDepositOut: 0 },
        { y: 1, x: 1, bDeposit: 2, aDeposit: 2, aDepositOut: 2 },
        { y: 10, x: 10, bDeposit: 1, aDeposit: 1, aDepositOut: 1 },
        { y: 10, x: 1, bDeposit: 10, aDeposit: 1, aDepositOut: 1 },
        { y: 1, x: 10, bDeposit: 10, aDeposit: 100, aDepositOut: 100 },
      ];

      const { clientBiatecClammPool } = await setupPool({
        algod,
        signer: deployerSigner,
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

        const result = await clientBiatecClammPool.calculateAssetADepositOnAssetBDeposit(input, {
          sendParams: { ...params, fee: algokit.microAlgos(2000) },
        });
        expect(result?.return?.valueOf()).toEqual(BigInt(Math.round(t.aDepositOut * SCALE)));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('addLiquidity1 - I can add liquidity to the pool', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        { x: 2, y: 0, P: 1, P1: 1, P2: 1.5625, lpTokensToReceive: 10 },
        { x: 0, y: 0.25, P: 1.5625, P1: 1, P2: 1.5625, lpTokensToReceive: 1 },
        { x: 0.2, y: 0, P: 1, P1: 1, P2: 1.5625, lpTokensToReceive: 1 },
        { x: 0.00001, y: 0, P: 1, P1: 1, P2: 1.5625, lpTokensToReceive: 0.000025 },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPool, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();

        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const depositA = {
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        };
        const depositB = {
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        };
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(depositA);
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(depositB);
        const liquidityInput = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };

        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(liquidityInput, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('addLiquidity2 - I can add liquidity to the pool second step', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        { x: 0.2, y: 0, P: 1, P1: 1, P2: 1.5625, lpTokensToReceive: 1, x2: 2, y2: 0, lpTokensToReceive2: 10 },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPool, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        /// /////////////////////////////////// STEP 2

        const addLiquidityA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x2 * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y2 * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyResult2 = await clientBiatecClammPool.addLiquidity(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            txAssetADeposit: addLiquidityA2,
            txAssetBDeposit: addLiquidityB2,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('swapAtoB - I can add liquidity to the pool and swap from A token to B token', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [{ x: 0, y: 0.25, P: 1.5625, P1: 1, P2: 1.5625, L: 1, swapA: 0.2, swapB: 0.25 }];

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.L * 10 ** LP_TOKEN_DECIMALS)));

        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapA * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('swapBtoA - I can add liquidity to the pool and swap from B token to A token', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [{ x: 0.2, y: 0, P: 1, P1: 1, P2: 1.5625, L: 1, swapB: 0.25, swapA: 0.2 }];

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.L * 10 ** LP_TOKEN_DECIMALS)));

        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addSwapB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapB * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            minimumToReceive: 0,
            txSwap: addSwapB,
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapA * SCALE_A)));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('removeLiquidity - I can add and remove liquidity from the pool', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        { x: 2, y: 0, P: 1, P1: 1, P2: 1.5625, lpTokensToReceive: 10, lpTokensToWithdraw: 3, retLRemove: 3 },
        { x: 0, y: 0.25, P: 1.5625, P1: 1, P2: 1.5625, lpTokensToReceive: 1, lpTokensToWithdraw: 1, retLRemove: 1 },
        { x: 0.2, y: 0, P: 1, P1: 1, P2: 1.5625, lpTokensToReceive: 1, lpTokensToWithdraw: 0.5, retLRemove: 0.5 },
        {
          x: 0.00001,
          y: 0,
          P: 1,
          P1: 1,
          P2: 1.5625,
          lpTokensToReceive: 0.000025,
          lpTokensToWithdraw: 0.000025,
          retLRemove: 0.000025,
        },
      ];

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPool, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            appBiatecIdentityProvider: refBiatecIdentityProvider.appId,
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('LP fees 10%, Biatec fee - 0% - I can add, swap and remove liquidity from the pool', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 1.5625,
          P1: 1,
          P2: 1.5625,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 37134n,
            assetB: 37135n,
            poolToken: 37145n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          x: 0,
          y: 2.5,
          lpTokensToReceive: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
            realABalance: 0n,
            realBBalance: 2500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 10000000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 37183n,
            assetB: 37184n,
            poolToken: 37194n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          swapA: 2 / 0.8, // i will swap this asset to b asset // 0.8 = with fee multiplier
          swapB: 2.5, // this is how much asset b i should receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 2500000000n,
            assetBBalance: 0n,
            realABalance: 250000000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 12500000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 2500000000n,
            liqudityBiatecFromFees: 0n,
            assetA: 8895n,
            assetB: 8896n,
            poolToken: 8905n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          lpTokensToWithdraw: 3,
          retLRemove: 3.75,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 1750000000n,
            assetBBalance: 0n,
            realABalance: 175000000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 8750000000n,
            releasedLiqudity: 7000000000n,
            liqudityUsersFromFees: 1750000000n,
            liqudityBiatecFromFees: 0n,
            assetA: 8968n,
            assetB: 8969n,
            poolToken: 8978n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);

        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapA * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            appBiatecIdentityProvider: refBiatecIdentityProvider.appId,
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });

  test('LP fees 10%, Biatec fee - 50% - I can add, swap and remove liquidity from the pool', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 1.5625,
          P1: 1,
          P2: 1.5625,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 0n,
            poolToken: 0n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },

          x: 0,
          y: 2.5,
          lpTokensToReceive: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
            realABalance: 0n,
            realBBalance: 2500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 10000000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 8868n,
            assetB: 8869n,
            poolToken: 8878n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },

          swapA: 2 / 0.8, // i will swap this asset to b asset // 0.8 = with fee multiplier
          swapB: 2.5, // this is how much asset b i should receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 2500000000n,
            assetBBalance: 0n,
            realABalance: 250000000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 12500000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 1250000000n,
            liqudityBiatecFromFees: 1250000000n,
            assetA: 8895n,
            assetB: 8896n,
            poolToken: 8905n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },

          lpTokensToWithdraw: 3,
          retLRemove: 3.375,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 1825000000n,
            assetBBalance: 0n,
            realABalance: 182500000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 9125000000n,
            releasedLiqudity: 7000000000n,
            liqudityUsersFromFees: 875000000n,
            liqudityBiatecFromFees: 1250000000n,
            assetA: 8968n,
            assetB: 8969n,
            poolToken: 8978n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 500_000_000n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);

        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapA * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            appBiatecIdentityProvider: refBiatecIdentityProvider.appId,
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });

  test('ASASR - LP fees 10%, Biatec fee - 0% - I can add, swap, add, swap, and remove all liquidity from the pool', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 1.5625,
          P1: 1,
          P2: 1.5625,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 0n,
            poolToken: 0n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          add1A: 0,
          add1B: 2.5,
          lpTokensToReceive: 10,
          checkDistributed1: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
            realABalance: 0n,
            realBBalance: 2500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 10000000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 5680n,
            assetB: 5681n,
            poolToken: 5690n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          swap1A: 2 / 0.8, // i will swap this asset from A asset to B and this is what I deposit
          swap1B: 2.5, // this is how much asset B is in the pool and what i want to receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 2500000000n,
            assetBBalance: 0n,
            realABalance: 250000000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 12500000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 2500000000n,
            liqudityBiatecFromFees: 0n,
            assetA: 6122n,
            assetB: 6123n,
            poolToken: 6132n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          stats1: {
            isVerified: 0n,
            assetA: 51951n,
            assetB: 51952n,
            verificationClass: 0n,
            latestPrice: 1281250000n,
            period1Duration: 60n,
            period1NowVolumeA: 2000000000n,
            period1NowVolumeB: 2500000000n,
            period1NowFeeA: 500000000n,
            period1NowFeeB: 0n,
            period1NowVWAP: 1281250000n,
            period1NowTime: 1711233954n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 2000000000n,
            period2NowVolumeB: 2500000000n,
            period2NowFeeA: 500000000n,
            period2NowFeeB: 0n,
            period2NowVWAP: 1281250000n,
            period2NowTime: 1711233954n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 2000000000n,
            period3NowVolumeB: 2500000000n,
            period3NowFeeA: 500000000n,
            period3NowFeeB: 0n,
            period3NowVWAP: 1281250000n,
            period3NowTime: 1711233954n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 2000000000n,
            period4NowVolumeB: 2500000000n,
            period4NowFeeA: 500000000n,
            period4NowFeeB: 0n,
            period4NowVWAP: 1281250000n,
            period4NowTime: 1711233954n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 2000000000n,
            period5NowVolumeB: 2500000000n,
            period5NowFeeA: 500000000n,
            period5NowFeeB: 0n,
            period5NowVWAP: 1281250000n,
            period5NowTime: 1711233954n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 2000000000n,
            period6NowVolumeB: 2500000000n,
            period6NowFeeA: 500000000n,
            period6NowFeeB: 0n,
            period6NowVWAP: 1281250000n,
            period6NowTime: 1711233954n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          // in the pool is now A: 2.5 B: 0

          add2A: 7.5,
          add2B: 0,
          lpTokensToReceive2: 37.5,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 10000000000n,
            assetBBalance: 0n,
            realABalance: 1000000000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 50000000000n,
            releasedLiqudity: 47500000000n,
            liqudityUsersFromFees: 2500000000n,
            liqudityBiatecFromFees: 0n,
            assetA: 6248n,
            assetB: 6249n,
            poolToken: 6258n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          checkDistributed2: 47.5,

          swap2B: 12.5 / 0.8, // i will swap this asset from B asset to A and this is what I deposit
          swap2A: 10, // this is how much asset A i should receive

          checkStatus5: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 15625000000n,
            realABalance: 0n,
            realBBalance: 15625000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 62500000000n,
            releasedLiqudity: 47_500_000_000n,
            liqudityUsersFromFees: 15000000000n,
            liqudityBiatecFromFees: 0n,
            assetA: 6503n,
            assetB: 6504n,
            poolToken: 6513n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          stats2: {
            isVerified: 0n,
            assetA: 51996n,
            assetB: 51997n,
            verificationClass: 0n,
            latestPrice: 1281250000n,
            period1Duration: 60n,
            period1NowVolumeA: 12000000000n,
            period1NowVolumeB: 15000000000n,
            period1NowFeeA: 500000000n,
            period1NowFeeB: 3125000000n,
            period1NowVWAP: 1281250000n,
            period1NowTime: 1711233995n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 12000000000n,
            period2NowVolumeB: 15000000000n,
            period2NowFeeA: 500000000n,
            period2NowFeeB: 3125000000n,
            period2NowVWAP: 1281250000n,
            period2NowTime: 1711233995n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 12000000000n,
            period3NowVolumeB: 15000000000n,
            period3NowFeeA: 500000000n,
            period3NowFeeB: 3125000000n,
            period3NowVWAP: 1281250000n,
            period3NowTime: 1711233995n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 12000000000n,
            period4NowVolumeB: 15000000000n,
            period4NowFeeA: 500000000n,
            period4NowFeeB: 3125000000n,
            period4NowVWAP: 1281250000n,
            period4NowTime: 1711233995n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 12000000000n,
            period5NowVolumeB: 15000000000n,
            period5NowFeeA: 500000000n,
            period5NowFeeB: 3125000000n,
            period5NowVWAP: 1281250000n,
            period5NowTime: 1711233995n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 12000000000n,
            period6NowVolumeB: 15000000000n,
            period6NowFeeA: 500000000n,
            period6NowFeeB: 3125000000n,
            period6NowVWAP: 1281250000n,
            period6NowTime: 1711233995n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },
          checkDistributed3: 47.5,

          lpTokensToWithdraw: 47.5,
          retLRemove: 62.5,

          checkStatus6: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 5680n,
            assetB: 5681n,
            poolToken: 5690n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed1.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const tradingStats = await clientBiatecPoolProvider.getCurrentStatus({ appPoolId: ammRef.appId });
        const stats1 = parseStats(tradingStats.return);
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period5NowTime = stats1.period5NowTime;
        t.stats1.period6NowTime = stats1.period6NowTime;
        expect(stats1).toStrictEqual(t.stats1);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPool.addLiquidity(addLiquidity2Params, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed2.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult2 = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed3.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const tradingStats2 = await clientBiatecPoolProvider.getCurrentStatus({ appPoolId: ammRef.appId });
        const stats2 = parseStats(tradingStats2.return);
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period5NowTime = stats2.period5NowTime;
        t.stats2.period6NowTime = stats2.period6NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVWAP = stats2.period1NowVWAP;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVWAP = stats2.period1PrevVWAP;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);
        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            appBiatecIdentityProvider: refBiatecIdentityProvider.appId,
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });

  test('I can have algo vs asa in the pool', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 1.5625,
          P1: 1,
          P2: 1.5625,
          assetAId: 0,
          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 400000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 37658n,
            poolToken: 37668n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          x: 0,
          y: 2.5,
          lpTokensToReceive: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
            realABalance: 400000n,
            realBBalance: 2500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 10000000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 37677n,
            poolToken: 37687n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          swapA: 2 / 0.8, // i will swap this asset to b asset // 0.8 = with fee multiplier
          swapB: 2.5, // this is how much asset b i should receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 2500000000n,
            assetBBalance: 0n,
            realABalance: 2900000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 12500000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 2500000000n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 37705n,
            poolToken: 37715n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },

          lpTokensToWithdraw: 3,
          retLRemove: 3.75,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 1750000000n,
            assetBBalance: 0n,
            realABalance: 2150000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 8750000000n,
            releasedLiqudity: 7000000000n,
            liqudityUsersFromFees: 1750000000n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 37744n,
            poolToken: 37754n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 0n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: 0,
          biatecFee: 0n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: t.assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(t.assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        const addLiquidityA =
          t.assetAId === 0
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_ALGO)),
                from: deployer.addr,
                suggestedParams: params,
                to: ammRef.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_A)),
                assetIndex: t.assetAId,
                from: deployer.addr,
                suggestedParams: params,
                to: ammRef.appAddress,
              });

        const addLiquidityB =
          assetBId === 0
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_ALGO)),
                from: deployer.addr,
                suggestedParams: params,
                to: ammRef.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.y * SCALE_B)),
                assetIndex: assetBId,
                from: deployer.addr,
                suggestedParams: params,
                to: ammRef.appAddress,
              });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: t.assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: t.assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(t.assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const addSwapA =
          t.assetAId === 0
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.swapA * SCALE_ALGO)),
                from: deployer.addr,
                suggestedParams: params,
                to: ammRef.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.swapA * SCALE_A)),
                assetIndex: t.assetAId,
                from: deployer.addr,
                suggestedParams: params,
                to: ammRef.appAddress,
              });

        const swapResult = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: t.assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: t.assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(t.assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: t.assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(t.assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            appBiatecIdentityProvider: refBiatecIdentityProvider.appId,
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: t.assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: t.assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(t.assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('I can withdraw lp fees from biatec account', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 1.5625,
          P1: 1,
          P2: 1.5625,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 0n,
            poolToken: 0n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          add1A: 0,
          add1B: 2.5,
          lpTokensToReceive: 10,
          checkDistributed1: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
            realABalance: 0n,
            realBBalance: 2500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 10000000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 5680n,
            assetB: 5681n,
            poolToken: 5690n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          swap1A: 2 / 0.8, // i will swap this asset from A asset to B and this is what I deposit
          swap1B: 2.5, // this is how much asset B is in the pool and what i want to receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 2500000000n,
            assetBBalance: 0n,
            realABalance: 250000000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 12500000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 2250000000n,
            liqudityBiatecFromFees: 250000000n,
            assetA: 11498n,
            assetB: 11499n,
            poolToken: 11508n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          // in the pool is now A: 2.5 B: 0

          removeFromBiatecFees1: 200000000n,
          removeFromBiatecFees1Check: 200000n,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 2460000000n,
            assetBBalance: 0n,
            realABalance: 246000000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 12300000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 2250000000n,
            liqudityBiatecFromFees: 50000000n,
            assetA: 11607n,
            assetB: 11608n,
            poolToken: 11617n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          add2A: 7.54,
          add2B: 0,
          lpTokensToReceive2: 37.7,

          checkStatus5: {
            scale: 1000000000n,
            assetABalance: 10000000000n,
            assetBBalance: 0n,
            realABalance: 1000000000n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 50000000000n,
            releasedLiqudity: 47700000000n,
            liqudityUsersFromFees: 2250000000n,
            liqudityBiatecFromFees: 50000000n,
            assetA: 11695n,
            assetB: 11696n,
            poolToken: 11705n,
            price: 1000000000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          swap2B: 12.5 / 0.8, // i will swap this asset from B asset to A and this is what I deposit
          swap2A: 10, // this is how much asset A i should receive

          checkStatus6: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 15625000000n,
            realABalance: 0n,
            realBBalance: 15625000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 62500000000n,
            releasedLiqudity: 47700000000n,
            liqudityUsersFromFees: 13500000000n,
            liqudityBiatecFromFees: 1300000000n,
            assetA: 11744n,
            assetB: 11745n,
            poolToken: 11754n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          removeFromBiatecFees2: 0n,
          removeFromBiatecFees2Check: 1300000n,

          checkStatus7: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 15300000000n,
            realABalance: 0n,
            realBBalance: 15300000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 61200000000n,
            releasedLiqudity: 47700000000n,
            liqudityUsersFromFees: 13500000000n,
            liqudityBiatecFromFees: 0n,
            assetA: 12018n,
            assetB: 12019n,
            poolToken: 12028n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed1.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        // REMOVE LIQUIDITY FROM FEES FOR BIATEC

        const liqudidtyRemoveResult1 = await clientBiatecClammPool.removeLiquidityAdmin(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
            amount: t.removeFromBiatecFees1,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove1 = await liqudidtyRemoveResult1.return;
        expect(retLRemove1?.valueOf()).toEqual(BigInt(t.removeFromBiatecFees1Check));

        const status4 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPool.addLiquidity(addLiquidity2Params, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const status5 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult2 = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const status6 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);

        // REMOVE LIQUIDITY FROM FEES FOR BIATEC

        const liqudidtyRemoveResult2 = await clientBiatecClammPool.removeLiquidityAdmin(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
            amount: t.removeFromBiatecFees2,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove2 = await liqudidtyRemoveResult2.return;
        expect(retLRemove2?.valueOf()).toEqual(BigInt(t.removeFromBiatecFees2Check));

        const status7 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus7.poolToken = BigInt(poolTokenId);
        t.checkStatus7.assetA = BigInt(assetAId);
        t.checkStatus7.assetB = BigInt(assetBId);

        expect(status7).toEqual(t.checkStatus7);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('If someone deposits the asset a or asset b to the pool, we can distribute these assets to lp holders', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 1.5625,
          P1: 1,
          P2: 1.5625,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 0n,
            poolToken: 0n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          add1A: 0,
          add1B: 2.5,
          lpTokensToReceive: 10,
          checkDistributed1: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
            realABalance: 0n,
            realBBalance: 2500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 10000000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 5680n,
            assetB: 5681n,
            poolToken: 5690n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          depositA: 1,
          depositB: 1,
          performDepositA: 1000000000n,
          performDepositB: 1000000000n,
          distributeResult: 9880269745n,

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 1000000000n,
            assetBBalance: 3500000000n,
            realABalance: 100000000n,
            realBBalance: 3500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 19880269745n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 8892242770n,
            liqudityBiatecFromFees: 988026975n,
            assetA: 32620n,
            assetB: 32621n,
            poolToken: 32631n,
            price: 1383102891n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },
        },

        {
          P: 1.5625,
          P1: 1,
          P2: 1.5625,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 0n,
            poolToken: 0n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          add1A: 0,
          add1B: 2.5,
          lpTokensToReceive: 10,
          checkDistributed1: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
            realABalance: 0n,
            realBBalance: 2500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 10000000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 5680n,
            assetB: 5681n,
            poolToken: 5690n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          depositA: 0,
          depositB: 1,
          performDepositA: 0n,
          performDepositB: 1000000000n,
          distributeResult: 4000000000n,

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 3500000000n,
            realABalance: 0n,
            realBBalance: 3500000n,
            priceMinSqrt: 1000000000n,
            priceMaxSqrt: 1250000000n,
            currentLiqudity: 14000000000n,
            releasedLiqudity: 10000000000n,
            liqudityUsersFromFees: 3600000000n,
            liqudityBiatecFromFees: 400000000n,
            assetA: 13731n,
            assetB: 13732n,
            poolToken: 13770n,
            price: 1562500000n,
            fee: 100000000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPool, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed1.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const depositA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.depositA * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const depositASigned = depositA.signTxn(deployer.sk);
        const depositB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.depositB * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const depositBSigned = depositB.signTxn(deployer.sk);
        await algod.sendRawTransaction(depositASigned).do();
        await algod.sendRawTransaction(depositBSigned).do();

        // redistribute
        const distributeResult = await clientBiatecClammPool.distributeExcessAssets(
          {
            amountA: t.performDepositA,
            amountB: t.performDepositB,
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(3000) },
          }
        );
        const distributeResultRet = await distributeResult.return;
        expect(distributeResultRet?.valueOf()).toEqual(BigInt(t.distributeResult));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('I can make the pool protect algorand network', async () => {
    const { algod } = fixture.context;

    const { clientBiatecClammPool } = await setupPool({
      algod,
      signer: deployerSigner,
      assetA: assetAId,
      biatecFee: 100_000_000n,
      lpFee: 100_000_000n,
      p: 100_000_000n,
      p1: 100_000_000n,
      p2: 100_000_000n,
    });

    expect(clientBiatecClammPool.sendOnlineKeyRegistration).not.toBeNull();
  });
  test('Extreme-SamePriceLowTop - ASASR - I can handle the trade as an order book item', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 4,
          P1: 4,
          P2: 4,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 2000000000n,
            priceMaxSqrt: 2000000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 0n,
            assetB: 0n,
            poolToken: 0n,
            price: 4000000000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },

          add1A: 0,
          add1B: 8,
          lpTokensToReceive: 8,
          checkDistributed1: 8,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 8000000000n,
            realABalance: 0n,
            realBBalance: 8000000n,
            priceMinSqrt: 2000000000n,
            priceMaxSqrt: 2000000000n,
            currentLiqudity: 8000000000n,
            releasedLiqudity: 8000000000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 19855n,
            assetB: 19856n,
            poolToken: 19866n,
            price: 4000000000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },

          swap1A: 1, // i will swap this asset from A asset to B and this is what I deposit
          swap1B: 3.2, // this is how much asset B is in the pool and what i want to receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 1000000000n,
            assetBBalance: 4800000000n,
            realABalance: 100000000n,
            realBBalance: 4800000n,
            priceMinSqrt: 2000000000n,
            priceMaxSqrt: 2000000000n,
            currentLiqudity: 8800000000n,
            releasedLiqudity: 8000000000n,
            liqudityUsersFromFees: 400000000n,
            liqudityBiatecFromFees: 400000000n,
            assetA: 25290n,
            assetB: 25291n,
            poolToken: 26231n,
            price: 4000000000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },

          stats1: {
            isVerified: 0n,
            assetA: 50507n,
            assetB: 50508n,
            verificationClass: 0n,
            latestPrice: 4000000000n,
            period1Duration: 60n,
            period1NowVolumeA: 909090910n,
            period1NowVolumeB: 3200000000n,
            period1NowFeeA: 90909090n,
            period1NowFeeB: 0n,
            period1NowVWAP: 4000000000n,
            period1NowTime: 1711233777n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 909090910n,
            period2NowVolumeB: 3200000000n,
            period2NowFeeA: 90909090n,
            period2NowFeeB: 0n,
            period2NowVWAP: 4000000000n,
            period2NowTime: 1711233777n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 909090910n,
            period3NowVolumeB: 3200000000n,
            period3NowFeeA: 90909090n,
            period3NowFeeB: 0n,
            period3NowVWAP: 4000000000n,
            period3NowTime: 1711233777n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 909090910n,
            period4NowVolumeB: 3200000000n,
            period4NowFeeA: 90909090n,
            period4NowFeeB: 0n,
            period4NowVWAP: 4000000000n,
            period4NowTime: 1711233777n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 909090910n,
            period5NowVolumeB: 3200000000n,
            period5NowFeeA: 90909090n,
            period5NowFeeB: 0n,
            period5NowVWAP: 4000000000n,
            period5NowTime: 1711233777n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 909090910n,
            period6NowVolumeB: 3200000000n,
            period6NowFeeA: 90909090n,
            period6NowFeeB: 0n,
            period6NowVWAP: 4000000000n,
            period6NowTime: 1711233777n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          // in the pool is now A: 2.5 B: 0

          add2A: 7.5,
          add2B: 0,
          lpTokensToReceive2: 30, // 7.5*4

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 8500000000n,
            assetBBalance: 4800000000n,
            realABalance: 850000000n,
            realBBalance: 4800000n,
            priceMinSqrt: 2000000000n,
            priceMaxSqrt: 2000000000n,
            currentLiqudity: 38800000000n,
            releasedLiqudity: 38000000000n,
            liqudityUsersFromFees: 400000000n,
            liqudityBiatecFromFees: 400000000n,
            assetA: 26615n,
            assetB: 26616n,
            poolToken: 26626n,
            price: 4000000000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },

          checkDistributed2: 38,

          swap2B: 10, // 10*0.8 =8.. 2 = fee .. i will swap this asset from B asset to A and this is what I deposit
          swap2A: 2, // 10*0.8/4 this is how much asset A i should receive

          checkDistributed3: 38,

          checkStatus5: {
            scale: 1000000000n,
            assetABalance: 6500000000n,
            assetBBalance: 14800000000n,
            realABalance: 650000000n,
            realBBalance: 14800000n,
            priceMinSqrt: 2000000000n,
            priceMaxSqrt: 2000000000n,
            currentLiqudity: 40800000000n,
            releasedLiqudity: 38000000000n,
            liqudityUsersFromFees: 1400000000n,
            liqudityBiatecFromFees: 1400000000n,
            assetA: 26909n,
            assetB: 26910n,
            poolToken: 26920n,
            price: 4000000000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },

          stats2: {
            isVerified: 0n,
            assetA: 50552n,
            assetB: 50553n,
            verificationClass: 0n,
            latestPrice: 4000000000n,
            period1Duration: 60n,
            period1NowVolumeA: 2909090910n,
            period1NowVolumeB: 12474509804n,
            period1NowFeeA: 90909090n,
            period1NowFeeB: 725490196n,
            period1NowVWAP: 4000000000n,
            period1NowTime: 1711233811n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 2909090910n,
            period2NowVolumeB: 12474509804n,
            period2NowFeeA: 90909090n,
            period2NowFeeB: 725490196n,
            period2NowVWAP: 4000000000n,
            period2NowTime: 1711233811n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 2909090910n,
            period3NowVolumeB: 12474509804n,
            period3NowFeeA: 90909090n,
            period3NowFeeB: 725490196n,
            period3NowVWAP: 4000000000n,
            period3NowTime: 1711233811n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 2909090910n,
            period4NowVolumeB: 12474509804n,
            period4NowFeeA: 90909090n,
            period4NowFeeB: 725490196n,
            period4NowVWAP: 4000000000n,
            period4NowTime: 1711233811n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 2909090910n,
            period5NowVolumeB: 12474509804n,
            period5NowFeeA: 90909090n,
            period5NowFeeB: 725490196n,
            period5NowVWAP: 4000000000n,
            period5NowTime: 1711233811n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 2909090910n,
            period6NowVolumeB: 12474509804n,
            period6NowFeeA: 90909090n,
            period6NowFeeB: 725490196n,
            period6NowVWAP: 4000000000n,
            period6NowTime: 1711233811n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          lpTokensToWithdraw: 38,
          retLRemove: 39.4, // 38+1.4

          checkStatus6: {
            scale: 1000000000n,
            assetABalance: 223039216n,
            assetBBalance: 507843138n,
            realABalance: 22303922n,
            realBBalance: 507844n,
            priceMinSqrt: 2000000000n,
            priceMaxSqrt: 2000000000n,
            currentLiqudity: 1400000002n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 1400000000n, // 223039216n*4+507843138n=1400000002
            assetA: 27292n,
            assetB: 27293n,
            poolToken: 27303n,
            price: 4000000000n,
            fee: 100000000n,
            biatecFee: 500000000n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 500_000_000n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed1.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const tradingStats = await clientBiatecPoolProvider.getCurrentStatus({ appPoolId: ammRef.appId });
        const stats1 = parseStats(tradingStats.return);
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period5NowTime = stats1.period5NowTime;
        t.stats1.period6NowTime = stats1.period6NowTime;
        expect(stats1).toStrictEqual(t.stats1);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPool.addLiquidity(addLiquidity2Params, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed2.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult2 = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed3.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const tradingStats2 = await clientBiatecPoolProvider.getCurrentStatus({ appPoolId: ammRef.appId });
        const stats2 = parseStats(tradingStats2.return);
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period5NowTime = stats2.period5NowTime;
        t.stats2.period6NowTime = stats2.period6NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVWAP = stats2.period1NowVWAP;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVWAP = stats2.period1PrevVWAP;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        // expect(stats2).toBe(t.stats2);
        expect(stats2).toStrictEqual(t.stats2);
        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            appBiatecIdentityProvider: refBiatecIdentityProvider.appId,
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
  test('Extreme-SmallMinMaxPriceDiff - ASASR 0.9999 - 1.0001, LP fee 1BPS, Biatec fee 10%', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 1,
          P1: 0.9999,
          P2: 1.0001,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 999949998n,
            priceMaxSqrt: 1000049998n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 35188n,
            assetB: 35189n,
            poolToken: 35199n,
            price: 1000000000n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          add1A: 0.1,
          add1B: 0.1,
          lpTokensToReceive: 2000.039996,
          checkDistributed1: 2000.039996,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 100000000n,
            assetBBalance: 100000000n,
            realABalance: 10000000n,
            realBBalance: 100000n,
            priceMinSqrt: 999949998n,
            priceMaxSqrt: 1000049998n,
            currentLiqudity: 2000039996799n,
            releasedLiqudity: 2000039996000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 35278n,
            assetB: 35279n,
            poolToken: 35289n,
            price: 999999993n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          swap1A: 0.1, // i will swap this asset from A asset to B and this is what I deposit
          swap1B: 0.099974, // this is how much asset B is in the pool and what i want to receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 200000000n,
            assetBBalance: 26000n,
            realABalance: 20000000n,
            realBBalance: 26n,
            priceMinSqrt: 999949998n,
            priceMaxSqrt: 1000049998n,
            currentLiqudity: 2000250001250n,
            releasedLiqudity: 2000039996000n,
            liqudityUsersFromFees: 189004005n,
            liqudityBiatecFromFees: 21000446n,
            assetA: 35308n,
            assetB: 35309n,
            poolToken: 35319n,
            price: 999900023n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          stats1: {
            isVerified: 0n,
            assetA: 50311n,
            assetB: 50312n,
            verificationClass: 0n,
            latestPrice: 999950008n,
            period1Duration: 60n,
            period1NowVolumeA: 99979003n,
            period1NowVolumeB: 99974000n,
            period1NowFeeA: 20997n,
            period1NowFeeB: 0n,
            period1NowVWAP: 999950008n,
            period1NowTime: 1711233686n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 99979003n,
            period2NowVolumeB: 99974000n,
            period2NowFeeA: 20997n,
            period2NowFeeB: 0n,
            period2NowVWAP: 999950008n,
            period2NowTime: 1711233686n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 99979003n,
            period3NowVolumeB: 99974000n,
            period3NowFeeA: 20997n,
            period3NowFeeB: 0n,
            period3NowVWAP: 999950008n,
            period3NowTime: 1711233686n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 99979003n,
            period4NowVolumeB: 99974000n,
            period4NowFeeA: 20997n,
            period4NowFeeB: 0n,
            period4NowVWAP: 999950008n,
            period4NowTime: 1711233686n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 99979003n,
            period5NowVolumeB: 99974000n,
            period5NowFeeA: 20997n,
            period5NowFeeB: 0n,
            period5NowVWAP: 999950008n,
            period5NowTime: 1711233686n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 99979003n,
            period6NowVolumeB: 99974000n,
            period6NowFeeA: 20997n,
            period6NowFeeB: 0n,
            period6NowVWAP: 999950008n,
            period6NowTime: 1711233686n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          // in the pool is now A: 2.5 B: 0

          add2A: 10,
          add2B: 1,
          lpTokensToReceive2: 100012.501062,
          checkDistributed2: 102012.541058,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 10200000000n,
            assetBBalance: 1326000n,
            realABalance: 1020000000n,
            realBBalance: 1326n,
            priceMinSqrt: 999949998n,
            priceMaxSqrt: 1000049998n,
            currentLiqudity: 102012751063797n,
            releasedLiqudity: 102012541058000n,
            liqudityUsersFromFees: 189004005n,
            liqudityBiatecFromFees: 21000446n,
            assetA: 35554n,
            assetB: 35555n,
            poolToken: 35565n,
            price: 999900023n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          swap2B: 10, //  i will swap this asset from B asset to A and this is what I deposit
          swap2A: 9.99801972, //  this is how much asset A i should receive

          checkDistributed3: 102012.541058,

          checkStatus5: {
            scale: 1000000000n,
            assetABalance: 201980280n,
            assetBBalance: 10001326000n,
            realABalance: 20198028n,
            realBBalance: 10001326n,
            priceMinSqrt: 999949998n,
            priceMaxSqrt: 1000049998n,
            currentLiqudity: 102032751003795n,
            releasedLiqudity: 102012541058000n,
            liqudityUsersFromFees: 18188950003n,
            liqudityBiatecFromFees: 2020994446n,
            assetA: 35729n,
            assetB: 35730n,
            poolToken: 35740n,
            price: 1000096039n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          stats2: {
            isVerified: 0n,
            assetA: 50356n,
            assetB: 50357n,
            verificationClass: 0n,
            latestPrice: 999998031n,
            period1Duration: 60n,
            period1NowVolumeA: 10097998723n,
            period1NowVolumeB: 10098013592n,
            period1NowFeeA: 20997n,
            period1NowFeeB: 1960408n,
            period1NowVWAP: 999997555n,
            period1NowTime: 1711233717n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 10097998723n,
            period2NowVolumeB: 10098013592n,
            period2NowFeeA: 20997n,
            period2NowFeeB: 1960408n,
            period2NowVWAP: 999997555n,
            period2NowTime: 1711233717n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 10097998723n,
            period3NowVolumeB: 10098013592n,
            period3NowFeeA: 20997n,
            period3NowFeeB: 1960408n,
            period3NowVWAP: 999997555n,
            period3NowTime: 1711233717n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 10097998723n,
            period4NowVolumeB: 10098013592n,
            period4NowFeeA: 20997n,
            period4NowFeeB: 1960408n,
            period4NowVWAP: 999997555n,
            period4NowTime: 1711233717n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 10097998723n,
            period5NowVolumeB: 10098013592n,
            period5NowFeeA: 20997n,
            period5NowFeeB: 1960408n,
            period5NowVWAP: 999997791n,
            period5NowTime: 1711233717n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 10097998723n,
            period6NowVolumeB: 10098013592n,
            period6NowFeeA: 20997n,
            period6NowFeeB: 1960408n,
            period6NowVWAP: 999997791n,
            period6NowTime: 1711233717n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          lpTokensToWithdraw: 102012.541058,
          retLRemove: 102030.730008,

          checkStatus6: {
            scale: 1000000000n,
            assetABalance: 4001n,
            assetBBalance: 198100n,
            realABalance: 401n,
            realBBalance: 199n,
            priceMinSqrt: 999949998n,
            priceMaxSqrt: 1000049998n,
            currentLiqudity: 2010540474n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 2020994446n,
            assetA: 36183n,
            assetB: 36184n,
            poolToken: 36194n,
            price: 1000096039n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000n, // 0.01%
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));

        const distributed1 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed1.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const tradingStats = await clientBiatecPoolProvider.getCurrentStatus({ appPoolId: ammRef.appId });
        const stats1 = parseStats(tradingStats.return);
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period5NowTime = stats1.period5NowTime;
        t.stats1.period6NowTime = stats1.period6NowTime;
        // expect(stats1).toBe(t.stats1);
        expect(stats1).toStrictEqual(t.stats1);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPool.addLiquidity(addLiquidity2Params, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed2.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult2 = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed3.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const tradingStats2 = await clientBiatecPoolProvider.getCurrentStatus({ appPoolId: ammRef.appId });
        const stats2 = parseStats(tradingStats2.return);
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period5NowTime = stats2.period5NowTime;
        t.stats2.period6NowTime = stats2.period6NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVWAP = stats2.period1NowVWAP;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVWAP = stats2.period1PrevVWAP;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);
        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            appBiatecIdentityProvider: refBiatecIdentityProvider.appId,
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });

  test('Extreme-ExtremePrice-Min - ASASR 0.000000001 - 1, LP fee 1BPS, Biatec fee 10%', async () => {
    try {
      const { algod } = fixture.context;

      const testSet = [
        {
          P: 0.00001,
          P1: 0.000000001,
          P2: 1,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 39321n,
            assetB: 39322n,
            poolToken: 39332n,
            price: 10000n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          add1A: 0.00001,
          add1B: 0.1,
          lpTokensToReceive: 0.100013,
          checkDistributed1: 0.100013,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 10000n,
            assetBBalance: 100000000n,
            realABalance: 1000n,
            realBBalance: 100000n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 100013161n,
            releasedLiqudity: 100013000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 41665n,
            assetB: 41666n,
            poolToken: 41676n,
            price: 999800056n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          swap1A: 0.001, // i will swap this asset from A asset to B and this is what I deposit
          swap1B: 0.000988, // this is how much asset B is in the pool and what i want to receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 1010000n,
            assetBBalance: 99012000n,
            realABalance: 101000n,
            realBBalance: 99012n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 100015063n,
            releasedLiqudity: 100013000n,
            liqudityUsersFromFees: 1711n,
            liqudityBiatecFromFees: 191n,
            assetA: 41412n,
            assetB: 41413n,
            poolToken: 41423n,
            price: 980104927n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          stats1: {
            isVerified: 0n,
            assetA: 49540n,
            assetB: 49541n,
            verificationClass: 0n,
            latestPrice: 989952491n,
            period1Duration: 60n,
            period1NowVolumeA: 999981n,
            period1NowVolumeB: 988000n,
            period1NowFeeA: 19n,
            period1NowFeeB: 0n,
            period1NowVWAP: 989952491n,
            period1NowTime: 1711232892n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 999981n,
            period2NowVolumeB: 988000n,
            period2NowFeeA: 19n,
            period2NowFeeB: 0n,
            period2NowVWAP: 989952491n,
            period2NowTime: 1711232892n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 999981n,
            period3NowVolumeB: 988000n,
            period3NowFeeA: 19n,
            period3NowFeeB: 0n,
            period3NowVWAP: 989952491n,
            period3NowTime: 1711232892n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 999981n,
            period4NowVolumeB: 988000n,
            period4NowFeeA: 19n,
            period4NowFeeB: 0n,
            period4NowVWAP: 989952491n,
            period4NowTime: 1711232892n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 999981n,
            period5NowVolumeB: 988000n,
            period5NowFeeA: 19n,
            period5NowFeeB: 0n,
            period5NowVWAP: 989952491n,
            period5NowTime: 1711232892n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 999981n,
            period6NowVolumeB: 988000n,
            period6NowFeeA: 19n,
            period6NowFeeB: 0n,
            period6NowVWAP: 989952491n,
            period6NowTime: 1711232892n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          // in the pool is now A: 2.5 B: 0

          add2A: 1,
          add2B: 10000,
          lpTokensToReceive2: 99.024816,
          checkDistributed2: 99.124829,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 1001010000n,
            assetBBalance: 98130695000n,
            realABalance: 100101000n,
            realBBalance: 98130695n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 99124831908n,
            releasedLiqudity: 99124829000n,
            liqudityUsersFromFees: 1711n,
            liqudityBiatecFromFees: 191n,
            assetA: 39792n,
            assetB: 39793n,
            poolToken: 39803n,
            price: 980104927n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          swap2B: 0.5, //  i will swap this asset from B asset to A and this is what I deposit
          swap2A: 0.50746238, //  this is how much asset A i should receive

          checkDistributed3: 99.124829,

          checkStatus5: {
            scale: 1000000000n,
            assetABalance: 493547620n,
            assetBBalance: 98630695000n,
            realABalance: 49354762n,
            realBBalance: 98630695n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 99124931926n,
            releasedLiqudity: 99124829000n,
            liqudityUsersFromFees: 91727n,
            liqudityBiatecFromFees: 10193n,
            assetA: 40143n,
            assetB: 40144n,
            poolToken: 40154n,
            price: 990115789n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          stats2: {
            isVerified: 0n,
            assetA: 49820n,
            assetB: 49821n,
            verificationClass: 0n,
            latestPrice: 985110358n,
            period1Duration: 60n,
            period1NowVolumeA: 508462361n,
            period1NowVolumeB: 500888481n,
            period1NowFeeA: 19n,
            period1NowFeeB: 99519n,
            period1NowVWAP: 985119909n,
            period1NowTime: 1711233400n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 508462361n,
            period2NowVolumeB: 500888481n,
            period2NowFeeA: 19n,
            period2NowFeeB: 99519n,
            period2NowVWAP: 985119909n,
            period2NowTime: 1711233400n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 508462361n,
            period3NowVolumeB: 500888481n,
            period3NowFeeA: 19n,
            period3NowFeeB: 99519n,
            period3NowVWAP: 985119909n,
            period3NowTime: 1711233400n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 508462361n,
            period4NowVolumeB: 500888481n,
            period4NowFeeA: 19n,
            period4NowFeeB: 99519n,
            period4NowVWAP: 985119909n,
            period4NowTime: 1711233400n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 508462361n,
            period5NowVolumeB: 500888481n,
            period5NowFeeA: 19n,
            period5NowFeeB: 99519n,
            period5NowVWAP: 985115138n,
            period5NowTime: 1711233400n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 508462361n,
            period6NowVolumeB: 500888481n,
            period6NowFeeA: 19n,
            period6NowFeeB: 99519n,
            period6NowVWAP: 985115138n,
            period6NowTime: 1711233400n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          lpTokensToWithdraw: 99.124829,
          retLRemove: 99.12492,

          checkStatus6: {
            scale: 1000000000n,
            assetABalance: 56n,
            assetBBalance: 11144n,
            realABalance: 6n,
            realBBalance: 12n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 5572n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 10193n,
            assetA: 40468n,
            assetB: 40469n,
            poolToken: 40479n,
            price: 990115789n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },
        },

        {
          P: 0.00001,
          P1: 0.000000001,
          P2: 1,

          checkStatus1: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
            realABalance: 0n,
            realBBalance: 0n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 0n,
            releasedLiqudity: 0n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 39321n,
            assetB: 39322n,
            poolToken: 39332n,
            price: 10000n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          add1A: 10000,
          add1B: 1,
          lpTokensToReceive: 100.661877,
          checkDistributed1: 100.661877,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 10000000000000n,
            assetBBalance: 1000000000n,
            realABalance: 1000000000000n,
            realBBalance: 1000000n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 100661877577n,
            releasedLiqudity: 100661877000n,
            liqudityUsersFromFees: 0n,
            liqudityBiatecFromFees: 0n,
            assetA: 41879n,
            assetB: 41880n,
            poolToken: 41890n,
            price: 99318n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          swap1A: 0.1, // i will swap this asset from A asset to B and this is what I deposit
          swap1B: 0.000008, // this is how much asset B is in the pool and what i want to receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 10000100000000n,
            assetBBalance: 999992000n,
            realABalance: 1000010000000n,
            realBBalance: 999992n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 100661975138n,
            releasedLiqudity: 100661877000n,
            liqudityUsersFromFees: 87804n,
            liqudityBiatecFromFees: 9757n,
            assetA: 42038n,
            assetB: 42039n,
            poolToken: 42049n,
            price: 99316n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          stats1: {
            isVerified: 0n,
            assetA: 49892n,
            assetB: 49893n,
            verificationClass: 0n,
            latestPrice: 99317n,
            period1Duration: 60n,
            period1NowVolumeA: 90307962n,
            period1NowVolumeB: 8000n,
            period1NowFeeA: 9692038n,
            period1NowFeeB: 0n,
            period1NowVWAP: 99317n,
            period1NowTime: 1711233480n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 90307962n,
            period2NowVolumeB: 8000n,
            period2NowFeeA: 9692038n,
            period2NowFeeB: 0n,
            period2NowVWAP: 99317n,
            period2NowTime: 1711233480n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 90307962n,
            period3NowVolumeB: 8000n,
            period3NowFeeA: 9692038n,
            period3NowFeeB: 0n,
            period3NowVWAP: 99317n,
            period3NowTime: 1711233480n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 90307962n,
            period4NowVolumeB: 8000n,
            period4NowFeeA: 9692038n,
            period4NowFeeB: 0n,
            period4NowVWAP: 99317n,
            period4NowTime: 1711233480n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 90307962n,
            period5NowVolumeB: 8000n,
            period5NowFeeA: 9692038n,
            period5NowFeeB: 0n,
            period5NowVWAP: 99317n,
            period5NowTime: 1711233480n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 90307962n,
            period6NowVolumeB: 8000n,
            period6NowFeeA: 9692038n,
            period6NowFeeB: 0n,
            period6NowVWAP: 99317n,
            period6NowTime: 1711233480n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          // in the pool is now A: 2.5 B: 0

          add2A: 0.1,
          add2B: 0.001,
          lpTokensToReceive2: 0.000956,
          checkDistributed2: 100.662833,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 10000200000000n,
            assetBBalance: 1000001000n,
            realABalance: 1000020000000n,
            realBBalance: 1000001n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 100662931253n,
            releasedLiqudity: 100662833000n,
            liqudityUsersFromFees: 87804n,
            liqudityBiatecFromFees: 9757n,
            assetA: 42588n,
            assetB: 42589n,
            poolToken: 42599n,
            price: 99316n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          swap2B: 0.5, //  i will swap this asset from B asset to A and this is what I deposit
          swap2A: 3359.3736822, //  this is how much asset A i should receive

          checkDistributed3: 100.662833,

          checkStatus5: {
            scale: 1000000000n,
            assetABalance: 6640826317800n,
            assetBBalance: 1500001000n,
            realABalance: 664082631780n,
            realBBalance: 1500001n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 100666308528n,
            releasedLiqudity: 100662833000n,
            liqudityUsersFromFees: 3127351n,
            liqudityBiatecFromFees: 347485n,
            assetA: 42763n,
            assetB: 42764n,
            poolToken: 42774n,
            price: 222974n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },

          stats2: {
            isVerified: 0n,
            assetA: 50011n,
            assetB: 50012n,
            verificationClass: 0n,
            latestPrice: 161145n,
            period1Duration: 60n,
            period1NowVolumeA: 3359463990162n,
            period1NowVolumeB: 499957677n,
            period1NowFeeA: 9692038n,
            period1NowFeeB: 50323n,
            period1NowVWAP: 161144n,
            period1NowTime: 1711233525n,
            period1PrevVolumeA: 0n,
            period1PrevVolumeB: 0n,
            period1PrevFeeA: 0n,
            period1PrevFeeB: 0n,
            period1PrevVWAP: 0n,
            period1PrevTime: 0n,
            period2Duration: 3600n,
            period2NowVolumeA: 3359463990162n,
            period2NowVolumeB: 499957677n,
            period2NowFeeA: 9692038n,
            period2NowFeeB: 50323n,
            period2NowVWAP: 161144n,
            period2NowTime: 1711233525n,
            period2PrevVolumeA: 0n,
            period2PrevVolumeB: 0n,
            period2PrevFeeA: 0n,
            period2PrevFeeB: 0n,
            period2PrevVWAP: 0n,
            period2PrevTime: 0n,
            period3Duration: 86400n,
            period3NowVolumeA: 3359463990162n,
            period3NowVolumeB: 499957677n,
            period3NowFeeA: 9692038n,
            period3NowFeeB: 50323n,
            period3NowVWAP: 161144n,
            period3NowTime: 1711233525n,
            period3PrevVolumeA: 0n,
            period3PrevVolumeB: 0n,
            period3PrevFeeA: 0n,
            period3PrevFeeB: 0n,
            period3PrevVWAP: 0n,
            period3PrevTime: 0n,
            period4Duration: 604800n,
            period4NowVolumeA: 3359463990162n,
            period4NowVolumeB: 499957677n,
            period4NowFeeA: 9692038n,
            period4NowFeeB: 50323n,
            period4NowVWAP: 161144n,
            period4NowTime: 1711233525n,
            period4PrevVolumeA: 0n,
            period4PrevVolumeB: 0n,
            period4PrevFeeA: 0n,
            period4PrevFeeB: 0n,
            period4PrevVWAP: 0n,
            period4PrevTime: 0n,
            period5Duration: 2592000n,
            period5NowVolumeA: 3359463990162n,
            period5NowVolumeB: 499957677n,
            period5NowFeeA: 9692038n,
            period5NowFeeB: 50323n,
            period5NowVWAP: 161144n,
            period5NowTime: 1711233525n,
            period5PrevVolumeA: 0n,
            period5PrevVolumeB: 0n,
            period5PrevFeeA: 0n,
            period5PrevFeeB: 0n,
            period5PrevVWAP: 0n,
            period5PrevTime: 0n,
            period6Duration: 31536000n,
            period6NowVolumeA: 3359463990162n,
            period6NowVolumeB: 499957677n,
            period6NowFeeA: 9692038n,
            period6NowFeeB: 50323n,
            period6NowVWAP: 161144n,
            period6NowTime: 1711233525n,
            period6PrevVolumeA: 0n,
            period6PrevVolumeB: 0n,
            period6PrevFeeA: 0n,
            period6PrevFeeB: 0n,
            period6PrevVWAP: 0n,
            period6PrevTime: 0n,
          },

          lpTokensToWithdraw: 99.124829,
          retLRemove: 99.127908,

          checkStatus6: {
            scale: 1000000000n,
            assetABalance: 101486257827n,
            assetBBalance: 22923276n,
            realABalance: 10148625783n,
            realBBalance: 22924n,
            priceMinSqrt: 31622n,
            priceMaxSqrt: 1000000000n,
            currentLiqudity: 1538399991n,
            releasedLiqudity: 1538004000n,
            liqudityUsersFromFees: 47783n,
            liqudityBiatecFromFees: 347485n,
            assetA: 43089n,
            assetB: 43090n,
            poolToken: 43100n,
            price: 222974n,
            fee: 100000n,
            biatecFee: 100000000n,
            verificationClass: 0n,
          },
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPool,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployerSigner,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000n, // 0.01%
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const refBiatecConfigProvider = await clientBiatecConfigProvider.appClient.getAppReference();
        expect(refBiatecConfigProvider.appId).toBeGreaterThan(0);
        const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
        expect(refBiatecIdentityProvider.appId).toBeGreaterThan(0);
        const refBiatecPoolProvider = await clientBiatecPoolProvider.appClient.getAppReference();
        expect(refBiatecPoolProvider.appId).toBeGreaterThan(0);
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = (await clientBiatecClammPool.getLpTokenId({})).return as bigint;
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));

        const distributed1 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed1.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const tradingStats = await clientBiatecPoolProvider.getCurrentStatus({ appPoolId: ammRef.appId });
        const stats1 = parseStats(tradingStats.return);
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period5NowTime = stats1.period5NowTime;
        t.stats1.period6NowTime = stats1.period6NowTime;
        expect(stats1).toStrictEqual(t.stats1);

        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
          appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPool.addLiquidity(addLiquidity2Params, {
          sendParams: { ...params, fee: algokit.microAlgos(12000) },
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed2.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const swapResult2 = await clientBiatecClammPool.swap(
          {
            appBiatecConfigProvider: BigInt(refBiatecConfigProvider.appId),
            appBiatecIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
            appBiatecPoolProvider: BigInt(refBiatecPoolProvider.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(12000) },
            boxes: getBoxReferenceStats({
              appBiatecCLAMMPool: ammRef.appId,
              appBiatecPoolProvider: refBiatecPoolProvider.appId,
              assetA: assetAId,
              assetB: assetBId,
              includingAssetBoxes: false,
            }),
            apps: [
              Number(refBiatecConfigProvider.appId),
              Number(refBiatecIdentityProvider.appId),
              Number(refBiatecPoolProvider.appId),
            ],
            assets: [Number(assetAId), Number(assetBId)],
          }
        );

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed3.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const tradingStats2 = await clientBiatecPoolProvider.getCurrentStatus({ appPoolId: ammRef.appId });
        const stats2 = parseStats(tradingStats2.return);
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period5NowTime = stats2.period5NowTime;
        t.stats2.period6NowTime = stats2.period6NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVWAP = stats2.period1NowVWAP;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVWAP = stats2.period1PrevVWAP;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);

        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            appBiatecConfigProvider: refBiatecConfigProvider.appId,
            appBiatecIdentityProvider: refBiatecIdentityProvider.appId,
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(12000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = parseStatus(
          (
            await clientBiatecClammPool.status({
              assetA: assetAId,
              assetB: assetBId,
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw e;
    }
  });
});
