import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk from 'algosdk';
import { BiatecClammClient } from '../contracts/clients/BiatecCLAMMClient';
import createToken from '../src/createToken';
import { BiatecIdentityProviderClient } from '../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient } from '../contracts/clients/BiatecPoolProviderClient';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

const SCALE = 1_000_000_000;
const ASSET_A_DECIMALS = 8; // BTC Like
const SCALE_A = 10 ** ASSET_A_DECIMALS; // BTC Like
const ASSET_B_DECIMALS = 6; // BTC Like
const SCALE_B = 10 ** ASSET_B_DECIMALS; // USDC Like

let ammClient: BiatecClammClient;
let identityClient: BiatecIdentityProviderClient;
let poolClient: BiatecPoolProviderClient;
let assetAId: number = 0;
let assetBId: number = 0;
let deployer: algosdk.Account;
// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

describe('clamm', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { algod, testAccount } = fixture.context;
    deployer = testAccount;
    identityClient = new BiatecIdentityProviderClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: 0,
      },
      algod
    );
    poolClient = new BiatecPoolProviderClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: 0,
      },
      algod
    );
    ammClient = new BiatecClammClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: 0,
      },
      algod
    );
    await ammClient.appClient.fundAppAccount(algokit.microAlgos(100_000));

    assetAId = await createToken({ account: testAccount, algod, name: 'EUR', decimals: ASSET_A_DECIMALS });
    assetBId = await createToken({ account: testAccount, algod, name: 'USD', decimals: ASSET_B_DECIMALS });
  });

  test('I can deploy the concentrated liqudity pool', async () => {
    const { algod } = fixture.context;

    await ammClient.create.createApplication({});
    const ammRef = await ammClient.appClient.getAppReference();
    const identityRef = await identityClient.appClient.getAppReference();
    const poolRef = await poolClient.appClient.getAppReference();

    const params = await algod.getTransactionParams().do();
    const fundTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: 400_000,
      from: deployer.addr,
      suggestedParams: params,
      to: ammRef.appAddress,
    });
    const assetId = await ammClient.bootstrap(
      {
        txSeed: fundTx,
        feeB100000: 100000,
        assetA: assetAId,
        assetB: assetBId,
        verificationClass: 0,
        identityProvider: identityRef.appId,
        poolProvider: poolRef.appId,
        priceMaxA: 1.0 * SCALE,
        priceMaxB: 1.2 * SCALE,
        currentPrice: 1.1 * SCALE,
      },
      { sendParams: { ...params, fee: algokit.microAlgos(4000) } }
    );
    expect(assetId.return?.valueOf()).toBeGreaterThan(0);
  });

  test('getHypotheticPrice returns correct results', async () => {
    const { algod } = fixture.context;
    const testSet = [
      { x: 0.2, y: 0, P1: 1, P2: 1.5625, L: 1, P: BigInt(1 * SCALE) },
      { x: 0, y: 0.25, P1: 1, P2: 1.5625, L: 1, P: BigInt(1.5625 * SCALE) },
      { x: 2, y: 0, P1: 1, P2: 1.5625, L: 10, P: BigInt(1 * SCALE) },
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const t of testSet) {
      ammClient = new BiatecClammClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      identityClient = new BiatecIdentityProviderClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      poolClient = new BiatecPoolProviderClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      // eslint-disable-next-line no-await-in-loop
      await ammClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const ammRef = await ammClient.appClient.getAppReference();
      expect(ammRef.appId).toBeGreaterThan(0);
      // eslint-disable-next-line no-await-in-loop
      await identityClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const identityRef = await identityClient.appClient.getAppReference();
      expect(identityRef.appId).toBeGreaterThan(0);
      // eslint-disable-next-line no-await-in-loop
      await poolClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const poolRef = await poolClient.appClient.getAppReference();
      expect(poolRef.appId).toBeGreaterThan(0);

      console.log(`result:  expecting ${t.P}`);
      // eslint-disable-next-line no-await-in-loop
      const result = await ammClient.getHypotheticPrice({
        assetAQuantity: BigInt(t.x * SCALE_A),
        assetBQuantity: BigInt(t.y * SCALE_B),
        assetADecimals: ASSET_A_DECIMALS,
        assetBDecimals: ASSET_B_DECIMALS,
        liquidity: t.L * SCALE,
        priceMaxASqrt: Math.sqrt(t.P1) * SCALE,
        priceMaxBSqrt: Math.sqrt(t.P2) * SCALE,
      });
      console.log(
        `sent x${BigInt(t.x * SCALE_A)} y${BigInt(t.y * SCALE_B)} result: ${result?.return?.valueOf()} expecting ${t.P}`
      );
      expect(result?.return?.valueOf()).toEqual(t.P);
    }
  });
  test('calculateAssetBWithdrawOnAssetADeposit returns correct results', async () => {
    const { algod } = fixture.context;
    const testSet = [
      { x: 0, y: 0.25, P1: 1, P2: 1.5625, P: BigInt(1.5625 * SCALE), deposit: 0.2, expectedWithdrawResult: 0.25 },
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const t of testSet) {
      ammClient = new BiatecClammClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      identityClient = new BiatecIdentityProviderClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      poolClient = new BiatecPoolProviderClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      // eslint-disable-next-line no-await-in-loop
      await ammClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const ammRef = await ammClient.appClient.getAppReference();
      expect(ammRef.appId).toBeGreaterThan(0);
      // eslint-disable-next-line no-await-in-loop
      await identityClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const identityRef = await identityClient.appClient.getAppReference();
      expect(identityRef.appId).toBeGreaterThan(0);
      // eslint-disable-next-line no-await-in-loop
      await poolClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const poolRef = await poolClient.appClient.getAppReference();
      expect(poolRef.appId).toBeGreaterThan(0);

      // eslint-disable-next-line no-await-in-loop
      const params = await algod.getTransactionParams().do();
      const fundTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        amount: 400000,
        from: deployer.addr,
        suggestedParams: params,
        to: ammRef.appAddress,
      });
      console.log(`result:  expecting ${t.P}`);
      // eslint-disable-next-line no-await-in-loop
      const assetId = await ammClient.bootstrap(
        {
          txSeed: fundTx,
          feeB100000: 100000,
          assetA: assetAId,
          assetB: assetBId,
          verificationClass: 0,
          identityProvider: identityRef.appId,
          poolProvider: poolRef.appId,
          priceMaxA: t.P1 * SCALE,
          priceMaxB: t.P2 * SCALE,
          currentPrice: t.P1 * SCALE, // wrong price on purpose
        },
        {
          sendParams: { ...params, fee: algokit.microAlgos(4000) },
          apps: [Number(identityRef.appId), Number(poolRef.appId)],
        }
      );
      expect(assetId.return?.valueOf()).toBeGreaterThan(0);

      const txAssetADeposit = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: t.x * SCALE,
        assetIndex: assetAId,
        from: deployer.addr,
        suggestedParams: params,
        to: ammRef.appAddress,
      });
      const txAssetBDeposit = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: t.y * SCALE,
        assetIndex: assetBId,
        from: deployer.addr,
        suggestedParams: params,
        to: ammRef.appAddress,
      });
      // eslint-disable-next-line no-await-in-loop
      const poolTokenId = (await ammClient.getLpTokenId({})).return as bigint;

      // eslint-disable-next-line no-await-in-loop
      await ammClient.addLiquidity(
        {
          txAssetADeposit,
          txAssetBDeposit,
          poolAsset: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        { sendParams: { ...params, fee: algokit.microAlgos(4000) } }
      );
      // eslint-disable-next-line no-await-in-loop
      const result = await ammClient.calculateAssetBWithdrawOnAssetADeposit({
        inAmount: BigInt(t.deposit * SCALE_A),
        assetADecimals: ASSET_A_DECIMALS,
        assetBDecimals: ASSET_B_DECIMALS,
      });
      console.log(
        `sent x${BigInt(t.x * SCALE_A)} y${BigInt(t.y * SCALE_B)} deposit: ${t.deposit * SCALE_A} result: ${result?.return?.valueOf()} expecting ${t.P}`
      );
      expect(result?.return?.valueOf()).toEqual(BigInt(t.expectedWithdrawResult * SCALE_B));
    }
  });
  test('addLiquidity - I can add liquidity to the pool', async () => {
    const { algod } = fixture.context;

    const testSet = [
      { x: 0.00000001, y: 0, P: 1, P1: 1, P2: 1.5625, L: 25n },
      { x: 2, y: 0, P: 1, P1: 1, P2: 1.5625, L: 10_000_000_000n },
      { x: 0, y: 0.25, P: 1.5625, P1: 1, P2: 1.5625, L: 1_000_000_000n },
      { x: 0.2, y: 0, P: 1, P1: 1, P2: 1.5625, L: 1_000_000_000n },
    ];

    // eslint-disable-next-line no-restricted-syntax
    for (const t of testSet) {
      ammClient = new BiatecClammClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      identityClient = new BiatecIdentityProviderClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      poolClient = new BiatecPoolProviderClient(
        {
          sender: deployer,
          resolveBy: 'id',
          id: 0,
        },
        algod
      );
      // eslint-disable-next-line no-await-in-loop
      await ammClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const ammRef = await ammClient.appClient.getAppReference();
      expect(ammRef.appId).toBeGreaterThan(0);
      // eslint-disable-next-line no-await-in-loop
      await identityClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const identityRef = await identityClient.appClient.getAppReference();
      expect(identityRef.appId).toBeGreaterThan(0);
      // eslint-disable-next-line no-await-in-loop
      await poolClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const poolRef = await poolClient.appClient.getAppReference();
      expect(poolRef.appId).toBeGreaterThan(0);

      // eslint-disable-next-line no-await-in-loop
      const params = await algod.getTransactionParams().do();
      const fundTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        amount: 400000,
        from: deployer.addr,
        suggestedParams: params,
        to: ammRef.appAddress,
      });
      // eslint-disable-next-line no-await-in-loop
      const assetId = await ammClient.bootstrap(
        {
          txSeed: fundTx,
          feeB100000: 100000,
          assetA: assetAId,
          assetB: assetBId,
          verificationClass: 0,
          identityProvider: identityRef.appId,
          poolProvider: poolRef.appId,
          priceMaxA: t.P1 * SCALE,
          priceMaxB: t.P2 * SCALE,
          currentPrice: t.P * SCALE,
        },
        {
          sendParams: { ...params, fee: algokit.microAlgos(4000) },
          apps: [Number(identityRef.appId), Number(poolRef.appId)],
        }
      );
      expect(assetId.return?.valueOf()).toBeGreaterThan(0);

      const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: t.x * SCALE, // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
        assetIndex: assetAId,
        from: deployer.addr,
        suggestedParams: params,
        to: ammRef.appAddress,
      });
      const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: t.y * SCALE, // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
        assetIndex: assetBId,
        from: deployer.addr,
        suggestedParams: params,
        to: ammRef.appAddress,
      });
      // eslint-disable-next-line no-await-in-loop
      const poolTokenId = (await ammClient.getLpTokenId({})).return as bigint;

      const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: 0,
        assetIndex: Number(poolTokenId),
        from: deployer.addr,
        suggestedParams: params,
        to: ammRef.appAddress,
      });
      const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);
      // eslint-disable-next-line no-await-in-loop
      await algod.sendRawTransaction(signedOptin.blob).do();
      // eslint-disable-next-line no-await-in-loop
      await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
      // eslint-disable-next-line no-await-in-loop
      const liqudidtyResult = await ammClient.addLiquidity(
        {
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          poolAsset: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        },
        { sendParams: { ...params, fee: algokit.microAlgos(6000) } }
      );
      // eslint-disable-next-line no-await-in-loop
      const ret = await liqudidtyResult.return;
      expect(ret?.valueOf()).toEqual(t.L);
    }
  });
});
