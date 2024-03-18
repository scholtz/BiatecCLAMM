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

type AmmStatus = {
  scale: bigint;
  assetABalance: bigint;
  assetBBalance: bigint;
  priceMinSqrt: bigint;
  priceMaxSqrt: bigint;
  currentLiqudity: bigint;
  releasedLiqudity: bigint;
  liqudityUsersFromFees: bigint;
  liqudityBiatecFromFees: bigint;
  assetA: bigint;
  assetB: bigint;
  poolToken: bigint;
  price: bigint;
  fee: bigint;
  biatecFee: bigint;
  verificationClass: bigint;
};
const return2status = (input: (bigint | number)[] | null | undefined): AmmStatus => {
  if (!input)
    return {
      scale: 0n,
      assetABalance: 0n,
      assetBBalance: 0n,
      priceMinSqrt: 0n,
      priceMaxSqrt: 0n,
      currentLiqudity: 0n,
      releasedLiqudity: 0n,
      liqudityUsersFromFees: 0n,
      liqudityBiatecFromFees: 0n,
      assetA: 0n,
      assetB: 0n,
      poolToken: 0n,
      price: 0n,
      fee: 0n,
      biatecFee: 0n,
      verificationClass: 0n,
    };
  return {
    scale: BigInt(input[0]),
    assetABalance: BigInt(input[1]),
    assetBBalance: BigInt(input[2]),
    priceMinSqrt: BigInt(input[3]),
    priceMaxSqrt: BigInt(input[4]),
    currentLiqudity: BigInt(input[5]),
    releasedLiqudity: BigInt(input[6]),
    liqudityUsersFromFees: BigInt(input[7]),
    liqudityBiatecFromFees: BigInt(input[8]),
    assetA: BigInt(input[9]),
    assetB: BigInt(input[10]),
    poolToken: BigInt(input[11]),
    price: BigInt(input[12]),
    fee: BigInt(input[13]),
    biatecFee: BigInt(input[14]),
    verificationClass: BigInt(input[15]),
  };
};

// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any
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
  console.log('setup liqudity pool', {
    p1,
    p2,
    p,
    biatecFee,
    lpFee,
  });
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
    appIdentityProvider: BigInt(refBiatecIdentityProvider.appId),
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
      console.debug(e);
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

        console.log(`result:  expecting ${t.P}`);

        const result = await clientBiatecClammPool.calculatePrice({
          assetAQuantity: BigInt(t.x * SCALE),
          assetBQuantity: BigInt(t.y * SCALE),
          liquidity: t.L * SCALE,
          priceMinSqrt: Math.sqrt(t.P1) * SCALE,
          priceMaxSqrt: Math.sqrt(t.P2) * SCALE,
        });
        console.log(
          `sent x${BigInt(t.x * SCALE)} y${BigInt(t.y * SCALE)} result: ${result?.return?.valueOf()} expecting ${t.P}`
        );
        expect(result?.return?.valueOf()).toEqual(BigInt(t.P * SCALE));
      }
    } catch (e) {
      console.debug(e);
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
          P: BigInt(1.5625 * SCALE),
          L: 1,
          deposit: 0.2,
          expectedWithdrawResult: 0.25,
        },
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
          priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
          priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
          liqudity: BigInt(t.L * SCALE),
        });
        console.log(
          `sent x${BigInt(t.x * SCALE)} y${BigInt(t.y * SCALE)} deposit: ${t.deposit * SCALE} result: ${result?.return?.valueOf()} expecting ${t.P}`
        );
        expect(result?.return?.valueOf()).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
      }
    } catch (e) {
      console.debug(e);
      throw e;
    }
  });
  test('calculateAssetAWithdrawOnAssetBDeposit returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [{ x: 0.2, y: 0, P1: 1, P2: 1.5625, L: 1, deposit: 0.25, expectedWithdrawResult: 0.2 }];

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

        const result = await clientBiatecClammPool.calculateAssetAWithdrawOnAssetBDeposit({
          inAmount: BigInt(t.deposit * SCALE),
          assetABalance: BigInt(t.x * SCALE),
          assetBBalance: BigInt(t.y * SCALE),
          priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
          priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
          liqudity: BigInt(t.L * SCALE),
        });
        console.log(
          `sent x${BigInt(t.x * SCALE)} y${BigInt(t.y * SCALE)} deposit: ${t.deposit * SCALE} result: ${result?.return?.valueOf()} expecting ${t.expectedWithdrawResult * SCALE}`
        );
        expect(result?.return?.valueOf()).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
      }
    } catch (e) {
      console.debug(e);
      throw e;
    }
  });
  test('calculateLiquidity returns correct results', async () => {
    try {
      const { algod } = fixture.context;
      const testSet = [
        { x: 0.2, y: 0, P1: 1, P2: 1.5625, L: 1 },
        { x: 2, y: 0, P: 1, P1: 1, P2: 1.5625, L: 10 },
        { x: 0, y: 0.25, P: 1.5625, P1: 1, P2: 1.5625, L: 1 },
        { x: 0.00000001, y: 0, P: 1, P1: 1, P2: 1.5625, L: 0.000000025 },
      ];

      const params = await algod.getTransactionParams().do();
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

        const result = await clientBiatecClammPool.calculateLiquidity(
          {
            x: BigInt(t.x * SCALE),
            y: BigInt(t.y * SCALE),
            priceMin: BigInt(t.P1 * SCALE),
            priceMax: BigInt(t.P2 * SCALE),
            priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
            priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
          },
          {
            sendParams: { ...params, fee: algokit.microAlgos(2000) },
          }
        );
        console.log(
          `sent x${BigInt(t.x * SCALE)} y${BigInt(t.y * SCALE)} priceMin: ${t.P1 * SCALE} priceMax: ${t.P2 * SCALE} result: ${result?.return?.valueOf()} expecting ${t.L * SCALE}`
        );
        expect(result?.return?.valueOf()).toEqual(BigInt(t.L * SCALE));
      }
    } catch (e) {
      console.debug(e);
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
      console.debug(e);
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
      console.debug(e);
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
      console.debug(e);
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
        console.log(
          `inAmountA: ${t.aDeposit}, inAmountB: ${t.bDeposit},assetABalance:${t.x},assetBBalance:${t.y} =? aDepositOut: ${t.aDepositOut}`,
          input
        );
        expect(result?.return?.valueOf()).toEqual(BigInt(Math.round(t.aDepositOut * SCALE)));
      }
    } catch (e) {
      console.debug(e);
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
          sendParams: { ...params, fee: algokit.microAlgos(6000) },
        });

        const ret = await liqudidtyResult.return;
        console.log(`add liquidity`, liquidityInput, depositA, depositB);
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e) {
      console.debug(e);
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
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
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
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e) {
      console.debug(e);
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
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
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
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));
      }
    } catch (e) {
      console.debug(e);
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
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
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
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapA * SCALE_A)));
      }
    } catch (e) {
      console.debug(e);
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
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
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
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(7000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e) {
      console.debug(e);
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

          x: 0,
          y: 2.5,
          lpTokensToReceive: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
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
            biatecFee: 0n,
            verificationClass: 0n,
          },

          swapA: 2 / 0.8, // i will swap this asset to b asset // 0.8 = with fee multiplier
          swapB: 2.5, // this is how much asset b i should receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 2500000000n,
            assetBBalance: 0n,
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
        const { clientBiatecClammPool, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
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

        const status1 = return2status(
          (
            await clientBiatecClammPool.status({
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
        console.log('addLiquidityParams', addLiquidityParams);
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(6000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = return2status(
          (
            await clientBiatecClammPool.status({
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
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = return2status(
          (
            await clientBiatecClammPool.status({
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
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(7000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = return2status(
          (
            await clientBiatecClammPool.status({
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
      console.debug(e);
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
        const { clientBiatecClammPool, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
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

        const status1 = return2status(
          (
            await clientBiatecClammPool.status({
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
        console.log('addLiquidityParams', addLiquidityParams);
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(6000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = return2status(
          (
            await clientBiatecClammPool.status({
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
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = return2status(
          (
            await clientBiatecClammPool.status({
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
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(7000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = return2status(
          (
            await clientBiatecClammPool.status({
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
      console.debug(e);
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

          // in the pool is now A: 2.5 B: 0

          add2A: 7.5,
          add2B: 0,
          lpTokensToReceive2: 37.5,

          checkStatus4: {
            scale: 1000000000n,
            assetABalance: 10000000000n,
            assetBBalance: 0n,
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

          checkDistributed3: 47.5,

          lpTokensToWithdraw: 47.5,
          retLRemove: 62.5,

          checkStatus6: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 0n,
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
        const { clientBiatecClammPool, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
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

        const status1 = return2status(
          (
            await clientBiatecClammPool.status({
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        console.log('status1', status1);
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
        console.log('addLiquidityParams', addLiquidityParams);
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(6000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed1.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = return2status(
          (
            await clientBiatecClammPool.status({
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
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = return2status(
          (
            await clientBiatecClammPool.status({
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);
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
        console.log('addLiquidity2Params', addLiquidity2Params);
        const liqudidtyResult2 = await clientBiatecClammPool.addLiquidity(addLiquidity2Params, {
          sendParams: { ...params, fee: algokit.microAlgos(6000) },
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed2.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = return2status(
          (
            await clientBiatecClammPool.status({
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
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPool.calculateDistributedLiquidity({
          assetLP: poolTokenId,
          currentDeposit: 0,
        });
        expect(distributed3.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = return2status(
          (
            await clientBiatecClammPool.status({
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);
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
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(7000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = return2status(
          (
            await clientBiatecClammPool.status({
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
      console.debug(e);
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

          x: 0,
          y: 2.5,
          lpTokensToReceive: 10,

          checkStatus2: {
            scale: 1000000000n,
            assetABalance: 0n,
            assetBBalance: 2500000000n,
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
            biatecFee: 0n,
            verificationClass: 0n,
          },

          swapA: 2 / 0.8, // i will swap this asset to b asset // 0.8 = with fee multiplier
          swapB: 2.5, // this is how much asset b i should receive

          checkStatus3: {
            scale: 1000000000n,
            assetABalance: 2500000000n,
            assetBBalance: 0n,
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
        const { clientBiatecClammPool, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
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

        const status1 = return2status(
          (
            await clientBiatecClammPool.status({
              appBiatecConfigProvider: refBiatecConfigProvider.appId,
              assetLP: poolTokenId,
            })
          ).return
        );
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(t.assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        console.log('status1', status1);
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
        console.log('addLiquidityParams', addLiquidityParams);
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(addLiquidityParams, {
          sendParams: { ...params, fee: algokit.microAlgos(6000) },
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = return2status(
          (
            await clientBiatecClammPool.status({
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
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: t.assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = return2status(
          (
            await clientBiatecClammPool.status({
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
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: t.assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(7000) } }
        );

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = return2status(
          (
            await clientBiatecClammPool.status({
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
      console.debug(e);
      throw e;
    }
  });
});
