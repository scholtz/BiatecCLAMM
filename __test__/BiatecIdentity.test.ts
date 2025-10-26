/* eslint-disable no-await-in-loop */
import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, { makePaymentTxnWithSuggestedParamsFromObject, Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient, BiatecClammPoolFactory } from '../contracts/clients/BiatecClammPoolClient';
import createToken from '../src/createToken';
import {
  BiatecIdentityProviderClient,
  BiatecIdentityProviderFactory,
} from '../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient, BiatecPoolProviderFactory } from '../contracts/clients/BiatecPoolProviderClient';
import {
  BiatecConfigProviderClient,
  BiatecConfigProviderFactory,
} from '../contracts/clients/BiatecConfigProviderClient';
import clammBootstrapSender from '../src/biatecClamm/sender/clammBootstrapSender';
import configBootstrapSender from '../src/biatecConfig/sender/configBootstrapSender';
import getBoxReferenceStats from '../src/biatecPools/getBoxReferenceStats';
import parseStatus from '../src/biatecClamm/parseStatus';
import parseStats from '../src/biatecPools/parseStats';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import clammAddLiquiditySender from '../src/biatecClamm/sender/clammAddLiquiditySender';
import { setupPool } from './pool/shared-setup';

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

let assetAId: bigint = BigInt(0);
let assetBId: bigint = BigInt(0);
let deployer: algosdk.Account;

// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any, func-names
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
interface ISetup {
  algod: algosdk.Algodv2;
  signer: algosdk.Account;
  p1: bigint;
  p2: bigint;
  p: bigint;
  assetA: bigint;
  biatecFee: bigint;
  lpFee: bigint;
}

describe('BiatecIdentity', () => {
  beforeEach(fixture.newScope);

  beforeAll(async () => {
    await fixture.newScope();
  });

  test('I can preregister', async () => {
    const { algod } = fixture.context;
    const {
      clientBiatecIdentityProvider,
      deployer: deployerFromSetup,
      assetAId: a,
      assetBId: b,
    } = await setupPool({
      algod,
      signer: deployer,
      assetA: assetAId,
      biatecFee: BigInt(SCALE / 10),
      lpFee: BigInt(SCALE / 10),
      p: BigInt(1.5 * SCALE),
      p1: BigInt(1 * SCALE),
      p2: BigInt(2 * SCALE),
    });
    deployer = deployerFromSetup;
    assetAId = a;
    assetBId = b;
    const payTx = makePaymentTxnWithSuggestedParamsFromObject({
      sender: deployer.addr,
      amount: 1_000_000,
      receiver: clientBiatecIdentityProvider.appClient.appAddress,
      suggestedParams: await algod.getTransactionParams().do(),
    });
    const signed = await payTx.signTxn(deployer.sk);
    await algod.sendRawTransaction(signed).do();

    const txId = await clientBiatecIdentityProvider.appClient.send.selfRegistration({
      args: {
        user: algosdk.encodeAddress(deployer.addr.publicKey),
        info: {
          feeMultiplier: 2_000_000_000n,
          feeMultiplierBase: 1_000_000_000n,
          verificationStatus: 1n,
          verificationClass: 0n,
          isCompany: false,
          personUuid: '00000000-0000-0000-0000-000000000000',
          legalEntityUuid: '00000000-0000-0000-0000-000000000000',
          biatecEngagementPoints: 0n,
          biatecEngagementRank: 0n,
          avmEngagementPoints: 0n,
          avmEngagementRank: 0n,
          tradingEngagementPoints: 0n,
          tradingEngagementRank: 0n,
          isLocked: false,
          kycExpiration: 0n,
          investorForExpiration: 0n,
          isProfessionalInvestor: false,
        },
      },
    });
    expect(txId).not.toBeNull();
  });

  test('I can setInfo', async () => {
    const { algod } = fixture.context;
    const {
      clientBiatecIdentityProvider,
      deployer: deployerFromSetup,
      assetAId: a,
      assetBId: b,
    } = await setupPool({
      algod,
      signer: deployer,
      assetA: assetAId,
      biatecFee: BigInt(SCALE / 10),
      lpFee: BigInt(SCALE / 10),
      p: BigInt(1.5 * SCALE),
      p1: BigInt(1 * SCALE),
      p2: BigInt(2 * SCALE),
    });
    deployer = deployerFromSetup;
    assetAId = a;
    assetBId = b;
    const payTx = makePaymentTxnWithSuggestedParamsFromObject({
      sender: deployer.addr,
      amount: 1_000_000,
      receiver: clientBiatecIdentityProvider.appClient.appAddress,
      suggestedParams: await algod.getTransactionParams().do(),
    });
    const signed = await payTx.signTxn(deployer.sk);
    await algod.sendRawTransaction(signed).do();

    const txId = await clientBiatecIdentityProvider.appClient.send.setInfo({
      args: {
        user: algosdk.encodeAddress(deployer.addr.publicKey),
        info: {
          feeMultiplier: 2_000_000_000n,
          feeMultiplierBase: 1_000_000_000n,
          verificationStatus: 1n,
          verificationClass: 2n,
          isCompany: true,
          personUuid: '00000000-0000-0000-0000-000000000000',
          legalEntityUuid: '00000000-0000-0000-0000-000000000000',
          biatecEngagementPoints: 3n,
          biatecEngagementRank: 4n,
          avmEngagementPoints: 5n,
          avmEngagementRank: 6n,
          tradingEngagementPoints: 7n,
          tradingEngagementRank: 8n,
          isLocked: true,
          kycExpiration: 9n,
          investorForExpiration: 10n,
          isProfessionalInvestor: true,
        },
      },
    });
    expect(txId).not.toBeNull();

    const returnValue = await clientBiatecIdentityProvider.appClient.send.getUser({
      args: {
        user: algosdk.encodeAddress(deployer.addr.publicKey),
        v: 1,
      },
    });
    expect(returnValue.return?.legalEntityUuid).toBe('00000000-0000-0000-0000-000000000000');
  });
});
