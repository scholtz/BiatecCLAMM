import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import * as algokit from '@algorandfoundation/algokit-utils';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import { expect } from '@jest/globals';
import algosdk, { assignGroupID, makePaymentTxnWithSuggestedParamsFromObject, Transaction } from 'algosdk';
import { BiatecClammPoolClient, BiatecClammPoolFactory } from '../../contracts/clients/BiatecClammPoolClient';
import {
  BiatecConfigProviderClient,
  BiatecConfigProviderFactory,
} from '../../contracts/clients/BiatecConfigProviderClient';
import {
  BiatecIdentityProviderClient,
  BiatecIdentityProviderFactory,
} from '../../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient, BiatecPoolProviderFactory } from '../../contracts/clients/BiatecPoolProviderClient';
import configBootstrapSender from '../../src/biatecConfig/sender/configBootstrapSender';
import clammCreateTxs from '../../src/biatecClamm/txs/clammCreateTxs';
import createToken from '../../src/createToken';

export const SCALE = 1_000_000_000;
export const ASSET_A_DECIMALS = 8;
export const ASSET_B_DECIMALS = 6;
export const SCALE_A = 10 ** ASSET_A_DECIMALS;
export const SCALE_B = 10 ** ASSET_B_DECIMALS;
export const SCALE_ALGO = 10 ** 6;
export const LP_TOKEN_DECIMALS = 6;
export const SCALE_LP = 10 ** LP_TOKEN_DECIMALS;

export const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

export let assetAId: bigint = 1n;
export let assetBId: bigint = 2n;
export let deployer: algosdk.Account;
export let deployerSigner: TransactionSignerAccount;

(BigInt.prototype as any).toJSON = function toJSON() {
  return this.toString();
};

export interface SetupPoolInput {
  algod: algosdk.Algodv2;
  p1: bigint;
  p2: bigint;
  p: bigint;
  assetA: bigint;
  biatecFee: bigint;
  lpFee: bigint;
}

export interface SetupPoolResult {
  clientBiatecClammPoolProvider: { appClient: BiatecClammPoolClient };
  clientBiatecIdentityProvider: { appClient: BiatecIdentityProviderClient };
  clientBiatecPoolProvider: { appClient: BiatecPoolProviderClient };
  clientBiatecConfigProvider: { appClient: BiatecConfigProviderClient };
  deployer: algosdk.Account;
  assetAId: bigint;
  assetBId: bigint;
}

export const initDeployer = async () => {
  await fixture.newScope();
  deployer = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(100_000_000) });
  deployerSigner = {
    addr: deployer.addr,
    signer: async (txnGroup: Transaction[], indexesToSign: number[]) => txnGroup.map((tx) => tx.signTxn(deployer.sk)),
  };
  assetAId = 1n;
  assetBId = 2n;
  return { deployer, deployerSigner };
};

export const setupPool = async (input: SetupPoolInput): Promise<SetupPoolResult> => {
  const { algod, p1, p2, p, assetA, biatecFee, lpFee } = input;
  const algorand = await AlgorandClient.fromEnvironment();
  await fixture.newScope();

  deployer = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(100_000_000) });
  deployerSigner = {
    addr: deployer.addr,
    signer: async (txnGroup: Transaction[], indexesToSign: number[]) => txnGroup.map((tx) => tx.signTxn(deployer.sk)),
  };

  const defaultSigner = async (txnGroup: Transaction[], indexesToSign: number[]) =>
    txnGroup.map((tx) => tx.signTxn(deployer.sk));

  if (assetA !== 0n) {
    assetAId = await createToken({ account: deployer, algod, name: 'EUR', decimals: ASSET_A_DECIMALS });
  } else {
    assetAId = 0n;
  }
  assetBId = await createToken({ account: deployer, algod, name: 'USD', decimals: ASSET_B_DECIMALS });

  const biatecClammPoolFactoryfactory = new BiatecClammPoolFactory({
    defaultSender: deployer.addr,
    defaultSigner,
    algorand,
  });

  const biatecIdentityProviderFactory = new BiatecIdentityProviderFactory({
    defaultSender: deployer.addr,
    defaultSigner,
    algorand,
  });

  const clientBiatecIdentityProvider = await biatecIdentityProviderFactory.send.create
    .createApplication()
    .catch((e: Error) => {
      console.error(e);
      return undefined;
    });
  expect(clientBiatecIdentityProvider).not.toBeNull();
  if (!clientBiatecIdentityProvider) throw Error('clientBiatecIdentityProvider is empty');

  const biatecPoolProviderFactory = new BiatecPoolProviderFactory({
    defaultSender: deployer.addr,
    defaultSigner,
    algorand,
  });

  const clientBiatecPoolProvider = await biatecPoolProviderFactory.send.create.createApplication().catch((e: Error) => {
    console.error(e);
    return undefined;
  });
  expect(clientBiatecPoolProvider).not.toBeNull();
  if (!clientBiatecPoolProvider) throw Error('clientBiatecPoolProvider is empty');

  const biatecConfigProviderFactory = new BiatecConfigProviderFactory({
    defaultSender: deployer.addr,
    defaultSigner,
    algorand,
  });

  const clientBiatecConfigProvider = await biatecConfigProviderFactory.send.create
    .createApplication()
    .catch((e: Error) => {
      console.error(e);
      return undefined;
    });
  if (!clientBiatecConfigProvider) throw Error('clientBiatecConfigProvider is empty');
  expect(clientBiatecConfigProvider.appClient.appId).toBeGreaterThan(0);
  expect(clientBiatecIdentityProvider.appClient.appId).toBeGreaterThan(0);
  expect(clientBiatecPoolProvider.appClient.appId).toBeGreaterThan(0);

  const signerObj = {
    addr: deployer.addr,
    signer: async (txnGroup: Transaction[], indexesToSign: number[]) => txnGroup.map((tx) => tx.signTxn(deployer.sk)),
  };

  const txId = await configBootstrapSender({
    algod,
    clientBiatecConfigProvider: clientBiatecConfigProvider.appClient,
    account: signerObj,
    appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
    appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
    biatecFee,
  });
  expect(txId.length).toBe(52);

  const { approvalProgram: clammPoolApprovalProgram } = await biatecClammPoolFactoryfactory.appFactory.compile({});

  const seedPayment = makePaymentTxnWithSuggestedParamsFromObject({
    amount: 7_000_000,
    receiver: clientBiatecPoolProvider.appClient.appAddress,
    suggestedParams: await algod.getTransactionParams().do(),
    sender: signerObj.addr,
  }).signTxn(deployer.sk);
  await algod.sendRawTransaction(seedPayment).do();

  await clientBiatecPoolProvider.appClient.send.bootstrap({
    args: { appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId },
  });

  for (let i = 0; i < clammPoolApprovalProgram.length; i += 1024) {
    const chunkTx = await clientBiatecPoolProvider.appClient.createTransaction.loadClammContractData({
      args: {
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        approvalProgramSize: clammPoolApprovalProgram.length,
        data: clammPoolApprovalProgram.subarray(i, i + 1024),
        offset: i,
      },
      appReferences: [clientBiatecConfigProvider.appClient.appId],
      boxReferences: [
        new Uint8Array(Buffer.from('capb1', 'ascii')),
        new Uint8Array(Buffer.from('capb2', 'ascii')),
        new Uint8Array(Buffer.from('capb3', 'ascii')),
        new Uint8Array(Buffer.from('capb4', 'ascii')),
      ],
    });

    const noop1 = await clientBiatecPoolProvider.appClient.createTransaction.noop({
      args: { i: 1 },
      boxReferences: [
        new Uint8Array(Buffer.from('11', 'ascii')),
        new Uint8Array(Buffer.from('12', 'ascii')),
        new Uint8Array(Buffer.from('13', 'ascii')),
        new Uint8Array(Buffer.from('14', 'ascii')),
      ],
    });
    const noop2 = await clientBiatecPoolProvider.appClient.createTransaction.noop({
      args: { i: 2 },
      boxReferences: [
        new Uint8Array(Buffer.from('21', 'ascii')),
        new Uint8Array(Buffer.from('22', 'ascii')),
        new Uint8Array(Buffer.from('23', 'ascii')),
        new Uint8Array(Buffer.from('24', 'ascii')),
      ],
    });

    const txsToGroup = [...noop1.transactions, ...noop2.transactions, ...chunkTx.transactions].map((tx) => {
      tx.group = undefined;
      return tx;
    });

    const groupedTxns = assignGroupID(txsToGroup);
    const signed = groupedTxns.map((tx) => tx.signTxn(deployer.sk));
    const poolDeployTxNetwork = await algod.sendRawTransaction(signed).do();
    expect(poolDeployTxNetwork.txid.length).toBe(52);
  }

  const creationGroup = await clammCreateTxs({
    sender: deployer.addr.toString(),
    appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
    assetA: assetAId,
    assetB: assetBId,
    clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
    currentPrice: p,
    fee: lpFee,
    params: await algod.getTransactionParams().do(),
    priceMax: p2,
    priceMin: p1,
    verificationClass: 0,
  });
  expect(creationGroup.length).toBe(4);
  const signedGroup = creationGroup.map((tx: algosdk.Transaction) => tx.signTxn(deployer.sk));
  const deployResult = await algod.sendRawTransaction(signedGroup).do();
  expect(deployResult.txid.length).toBe(52);

  const confirmation = await algosdk.waitForConfirmation(
    algorand.client.algod,
    creationGroup[creationGroup.length - 1].txID(),
    4
  );
  if (!(confirmation.logs && confirmation.logs.length > 0)) {
    throw new Error('Logs not found');
  }
  const lastLog = confirmation.logs[confirmation.logs.length - 1];
  expect(lastLog.length).toBe(12);
  const poolAppId = algosdk.decodeUint64(lastLog.subarray(4, 12));

  const clientBiatecClammPoolProvider = {
    appClient: new BiatecClammPoolClient({
      algorand,
      defaultSender: deployer.addr,
      defaultSigner,
      appId: BigInt(poolAppId),
    }),
  };

  await clientBiatecClammPoolProvider.appClient.send.bootstrapStep2({
    args: {},
    staticFee: AlgoAmount.MicroAlgo(2_000),
  });

  await clientBiatecIdentityProvider.appClient.send.bootstrap({
    args: {
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      engagementSetter: deployer.addr.toString(),
      governor: deployer.addr.toString(),
      verificationSetter: deployer.addr.toString(),
    },
  });

  expect(txId.length).toBe(52);

  return {
    clientBiatecClammPoolProvider,
    clientBiatecIdentityProvider,
    clientBiatecPoolProvider,
    clientBiatecConfigProvider,
    deployer,
    assetAId,
    assetBId,
  };
};
