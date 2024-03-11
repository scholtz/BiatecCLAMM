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
const ASSET_B_DECIMALS = 6; // BTC Like

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
    const { algod } = fixture.context;
    deployer = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(100_000_000) });
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
    ammClient = new BiatecClammClient(
      {
        sender: deployer,
        resolveBy: 'id',
        id: 0,
      },
      algod
    );
    await ammClient.appClient.fundAppAccount(algokit.microAlgos(200_000));

    assetAId = await createToken({ account: deployer, algod, name: 'EUR', decimals: ASSET_A_DECIMALS });
    assetBId = await createToken({ account: deployer, algod, name: 'USD', decimals: ASSET_B_DECIMALS });
  });

  test('I can deploy the concentrated liqudity pool', async () => {
    const { algod } = fixture.context;

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
        priceMin: BigInt(1.0 * SCALE),
        priceMax: 1.2 * SCALE,
        currentPrice: 1.1 * SCALE,
      },
      { sendParams: { ...params, fee: algokit.microAlgos(4000) } }
    );
    expect(assetId.return?.valueOf()).toBeGreaterThan(0);
  });

  test('calculatePrice returns correct results', async () => {
    const { algod } = fixture.context;
    const testSet = [
      { x: 0.2, y: 0, P1: 1, P2: 1.5625, L: 1, P: 1 },
      { x: 0, y: 0.25, P1: 1, P2: 1.5625, L: 1, P: 1.5625 },
      { x: 2, y: 0, P1: 1, P2: 1.5625, L: 10, P: 1 },
    ];

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
    await identityClient.create.createApplication({});
    const identityRef = await identityClient.appClient.getAppReference();
    expect(identityRef.appId).toBeGreaterThan(0);
    await poolClient.create.createApplication({});
    const poolRef = await poolClient.appClient.getAppReference();
    expect(poolRef.appId).toBeGreaterThan(0);

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
      // eslint-disable-next-line no-await-in-loop
      await ammClient.create.createApplication({});
      // eslint-disable-next-line no-await-in-loop
      const ammRef = await ammClient.appClient.getAppReference();
      expect(ammRef.appId).toBeGreaterThan(0);

      console.log(`result:  expecting ${t.P}`);
      // eslint-disable-next-line no-await-in-loop
      const result = await ammClient.calculatePrice({
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
  });
  test('calculateAssetBWithdrawOnAssetADeposit returns correct results', async () => {
    const { algod } = fixture.context;
    const testSet = [
      { x: 0, y: 0.25, P1: 1, P2: 1.5625, P: BigInt(1.5625 * SCALE), L: 1, deposit: 0.2, expectedWithdrawResult: 0.25 },
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
      const result = await ammClient.calculateAssetBWithdrawOnAssetADeposit({
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
  });
  test('calculateAssetAWithdrawOnAssetBDeposit returns correct results', async () => {
    const { algod } = fixture.context;
    const testSet = [{ x: 0.2, y: 0, P1: 1, P2: 1.5625, L: 1, deposit: 0.25, expectedWithdrawResult: 0.2 }];

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
      const result = await ammClient.calculateAssetAWithdrawOnAssetBDeposit({
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
  });
  test('calculateLiquidity returns correct results', async () => {
    const { algod } = fixture.context;
    const testSet = [{ x: 0.2, y: 0, P1: 1, P2: 1.5625, L: 1 }];

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
    await identityClient.create.createApplication({});
    const identityRef = await identityClient.appClient.getAppReference();
    expect(identityRef.appId).toBeGreaterThan(0);
    await poolClient.create.createApplication({});
    const poolRef = await poolClient.appClient.getAppReference();
    expect(poolRef.appId).toBeGreaterThan(0);
    // eslint-disable-next-line no-restricted-syntax
    for (const t of testSet) {
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
      const result = await ammClient.calculateLiquidity({
        x: BigInt(t.x * SCALE),
        y: BigInt(t.y * SCALE),
        priceMin: BigInt(t.P1 * SCALE),
        priceMax: BigInt(t.P2 * SCALE),
        priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
        priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
      });
      console.log(
        `sent x${BigInt(t.x * SCALE)} y${BigInt(t.y * SCALE)} priceMin: ${t.P1 * SCALE} priceMax: ${t.P2 * SCALE} result: ${result?.return?.valueOf()} expecting ${t.L * SCALE}`
      );
      expect(result?.return?.valueOf()).toEqual(BigInt(t.L * SCALE));
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
          priceMin: t.P1 * SCALE,
          priceMax: t.P2 * SCALE,
          currentPrice: t.P * SCALE,
        },
        {
          sendParams: { ...params, fee: algokit.microAlgos(4000) },
          apps: [Number(identityRef.appId), Number(poolRef.appId)],
        }
      );
      expect(assetId.return?.valueOf()).toBeGreaterThan(0);

      // opt in to the LP token

      // eslint-disable-next-line no-await-in-loop
      const poolTokenId = (await ammClient.getLpTokenId({})).return as bigint;
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
      const liqudidtyResult = await ammClient.addLiquidity(
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
      expect(ret?.valueOf()).toEqual(t.L);
    }
  });
  test('swapAtoB - I can add liquidity to the pool and swap from A token to B token', async () => {
    const { algod } = fixture.context;

    const testSet = [{ x: 0, y: 0.25, P: 1.5625, P1: 1, P2: 1.5625, L: 1_000_000_000n, swapA: 0.2, swapB: 0.25 }];

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
          priceMin: t.P1 * SCALE,
          priceMax: t.P2 * SCALE,
          currentPrice: t.P * SCALE,
        },
        {
          sendParams: { ...params, fee: algokit.microAlgos(4000) },
          apps: [Number(identityRef.appId), Number(poolRef.appId)],
        }
      );
      expect(assetId.return?.valueOf()).toBeGreaterThan(0);

      // opt in to the LP token

      // eslint-disable-next-line no-await-in-loop
      const poolTokenId = (await ammClient.getLpTokenId({})).return as bigint;
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
      const liqudidtyResult = await ammClient.addLiquidity(
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
      expect(ret?.valueOf()).toEqual(t.L);

      // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
      const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: t.swapA * SCALE, // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
        assetIndex: assetAId,
        from: deployer.addr,
        suggestedParams: params,
        to: ammRef.appAddress,
      });
      // eslint-disable-next-line no-await-in-loop
      const swapResult = await ammClient.swap(
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
      expect(retSwap?.valueOf()).toEqual(t.swapB * SCALE);
    }
  });
});
