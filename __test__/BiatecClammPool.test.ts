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
const LP_TOKEN_DECIMALS = 6; // BTC Like
const SCALE_LP = 10 ** LP_TOKEN_DECIMALS;

let assetAId: number = 0;
let assetBId: number = 0;
let deployer: algosdk.Account;
let deployerSigner: TransactionSignerAccount;
// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
const setupPool = async (
  algod: algosdk.Algodv2,
  signer: TransactionSignerAccount,
  p1: bigint,
  p2: bigint,
  p: bigint,
  biatecFee = 100_000_000n,
  lpFee = 100_000_000n
) => {
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
  const refBiatecIdentityProvider = await clientBiatecIdentityProvider.appClient.getAppReference();
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
    assetA: BigInt(assetAId),
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
  return clientBiatecClammPool;
};
describe('clamm', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { algod } = fixture.context;
    deployer = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(100_000_000) });

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
      const clientBiatecClammPool = await setupPool(
        algod,
        deployerSigner,
        BigInt(1 * SCALE),
        BigInt(2 * SCALE),
        BigInt(1.5 * SCALE),
        BigInt(SCALE / 10),
        BigInt(SCALE / 10)
      );
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P * SCALE),
          0n,
          0n
        );

        console.log(`result:  expecting ${t.P}`);
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P1 * SCALE),
          0n,
          0n
        );
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P1 * SCALE),
          0n,
          0n
        );

        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P1 * SCALE),
          0n,
          0n
        );
        // eslint-disable-next-line no-await-in-loop
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

      const clientBiatecClammPool = await setupPool(algod, deployerSigner, 1n, 2n, 2n, 0n, 0n);
      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        // eslint-disable-next-line no-await-in-loop
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

      const clientBiatecClammPool = await setupPool(algod, deployerSigner, 1n, 2n, 2n, 0n, 0n);
      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        // eslint-disable-next-line no-await-in-loop
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

      const clientBiatecClammPool = await setupPool(algod, deployerSigner, 1n, 2n, 2n, 0n, 0n);
      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        // eslint-disable-next-line no-await-in-loop
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

      // eslint-disable-next-line no-await-in-loop
      const clientBiatecClammPool = await setupPool(algod, deployerSigner, 1n, 2n, 2n, 0n, 0n);
      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const input = {
          inAmountA: BigInt(Math.round(t.aDeposit * SCALE)),
          inAmountB: BigInt(Math.round(t.bDeposit * SCALE)),
          assetABalance: BigInt(Math.round(t.x * SCALE)),
          assetBBalance: BigInt(Math.round(t.y * SCALE)),
        };
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P * SCALE),
          0n,
          0n
        );
        // eslint-disable-next-line no-await-in-loop
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);
        // eslint-disable-next-line no-await-in-loop
        const params = await algod.getTransactionParams().do();

        // opt in to the LP token

        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        await algod.sendRawTransaction(signedOptin.blob).do();
        // eslint-disable-next-line no-await-in-loop
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
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLP: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(liquidityInput, {
          sendParams: { ...params, fee: algokit.microAlgos(6000) },
        });
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P * SCALE),
          0n,
          0n
        );
        // eslint-disable-next-line no-await-in-loop
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        // eslint-disable-next-line no-await-in-loop
        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        await algod.sendRawTransaction(signedOptin.blob).do();
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyResult2 = await clientBiatecClammPool.addLiquidity(
          {
            txAssetADeposit: addLiquidityA2,
            txAssetBDeposit: addLiquidityB2,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P * SCALE),
          0n,
          0n
        );
        // eslint-disable-next-line no-await-in-loop
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        // opt in to the LP token

        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        await algod.sendRawTransaction(signedOptin.blob).do();
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const swapResult = await clientBiatecClammPool.swap(
          {
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P * SCALE),
          0n,
          0n
        );
        // eslint-disable-next-line no-await-in-loop
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        // opt in to the LP token

        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        await algod.sendRawTransaction(signedOptin.blob).do();
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const swapResult = await clientBiatecClammPool.swap(
          {
            minimumToReceive: 0,
            txSwap: addSwapB,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P * SCALE),
          0n,
          0n
        );
        // eslint-disable-next-line no-await-in-loop
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        // opt in to the LP token

        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        await algod.sendRawTransaction(signedOptin.blob).do();
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(7000) } }
        );
        // eslint-disable-next-line no-await-in-loop
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
          x: 0,
          y: 2.5,
          P: 1.5625,
          P1: 1,
          P2: 1.5625,
          lpTokensToReceive: 10,

          swapA: 2, // i will swap this asset to b asset
          swapB: 2.25, // this is how much asset b i should receive

          lpTokensToWithdraw: 3,
          retLRemove: 3,
        },
      ];

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        // eslint-disable-next-line no-await-in-loop
        const clientBiatecClammPool = await setupPool(
          algod,
          deployerSigner,
          BigInt(t.P1 * SCALE),
          BigInt(t.P2 * SCALE),
          BigInt(t.P * SCALE),
          100_000_000n,
          0n
        );
        // eslint-disable-next-line no-await-in-loop
        const ammRef = await clientBiatecClammPool.appClient.getAppReference();
        expect(ammRef.appId).toBeGreaterThan(0);

        // eslint-disable-next-line no-await-in-loop
        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        await algod.sendRawTransaction(signedOptin.blob).do();
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyResult = await clientBiatecClammPool.addLiquidity(
          {
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapA * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        // eslint-disable-next-line no-await-in-loop
        const swapResult = await clientBiatecClammPool.swap(
          {
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
        );
        // eslint-disable-next-line no-await-in-loop
        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          from: deployer.addr,
          suggestedParams: params,
          to: ammRef.appAddress,
        });
        // eslint-disable-next-line no-await-in-loop
        const liqudidtyRemoveResult = await clientBiatecClammPool.removeLiquidity(
          {
            txLPXfer: removeLiquidityLP,
            assetLP: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          { sendParams: { ...params, fee: algokit.microAlgos(7000) } }
        );
        // eslint-disable-next-line no-await-in-loop
        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e) {
      console.debug(e);
      throw e;
    }
  });
});
