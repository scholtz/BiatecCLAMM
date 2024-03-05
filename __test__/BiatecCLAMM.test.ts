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

describe('Biatecclamm', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { algod, testAccount } = fixture.context;
    deployer = testAccount;
    console.log('deployer', deployer);

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

    assetAId = await createToken({ account: testAccount, algod, name: 'EUR' });
    assetBId = await createToken({ account: testAccount, algod, name: 'USD' });
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
  test('I can add liquidity to the pool', async () => {
    const { algod } = fixture.context;

    ammClient = new BiatecClammClient(
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
        priceMaxA: 1.0 * SCALE,
        priceMaxB: 1.5625 * SCALE,
        currentPrice: 1.5625 * SCALE,
      },
      { sendParams: { ...params, fee: algokit.microAlgos(4000) } }
    );
    expect(assetId.return?.valueOf()).toBeGreaterThan(0);

    // const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    //   amount: 1 * 1_000_000_000, // price <1,1.5625> p = 1 => Max USD 0 EUR
    //   assetIndex: assetAId,
    //   from: deployer.addr,
    //   suggestedParams: params,
    //   to: ammRef.appAddress,
    // });
    // const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    //   amount: 0 * 1_000_000_000, // price <1,1.5625> p = 1 => Max USD 0 EUR
    //   assetIndex: assetBId,
    //   from: deployer.addr,
    //   suggestedParams: params,
    //   to: ammRef.appAddress,
    // });

    const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: 0 * 1_000_000_000, // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
      assetIndex: assetAId,
      from: deployer.addr,
      suggestedParams: params,
      to: ammRef.appAddress,
    });
    const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: 0.8 * 1_000_000_000, // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
      assetIndex: assetBId,
      from: deployer.addr,
      suggestedParams: params,
      to: ammRef.appAddress,
    });
    const poolTokenId = (await ammClient.getLpTokenId({})).return as bigint;

    const liqudidtyResult = await ammClient.addLiquidity(
      {
        txAssetADeposit: addLiquidityA,
        txAssetBDeposit: addLiquidityB,
        poolAsset: poolTokenId,
        assetA: assetAId,
        assetB: assetBId,
      },
      { sendParams: { ...params, fee: algokit.microAlgos(4000) } }
    );
    console.log(liqudidtyResult.return?.valueOf());
    expect(liqudidtyResult.return?.valueOf()).toBeGreaterThan(0);
  });
});
