/* eslint-disable no-await-in-loop */
import { expect } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, { assignGroupID, makePaymentTxnWithSuggestedParamsFromObject, Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient, BiatecClammPoolFactory } from '../../contracts/clients/BiatecClammPoolClient';
import createToken from '../../src/createToken';
import {
  BiatecIdentityProviderClient,
  BiatecIdentityProviderFactory,
} from '../../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient, BiatecPoolProviderFactory } from '../../contracts/clients/BiatecPoolProviderClient';
import { FakePoolClient, FakePoolFactory } from '../../contracts/clients/FakePoolClient';
import {
  BiatecConfigProviderClient,
  BiatecConfigProviderFactory,
} from '../../contracts/clients/BiatecConfigProviderClient';
import clammBootstrapSender from '../../src/biatecClamm/sender/clammBootstrapSender';
import configBootstrapSender from '../../src/biatecConfig/sender/configBootstrapSender';
import getBoxReferenceStats from '../../src/biatecPools/getBoxReferenceStats';
import parseStatus from '../../src/biatecClamm/parseStatus';
import parseStats from '../../src/biatecPools/parseStats';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';
import clammCreateTxs from '../../src/biatecClamm/txs/clammCreateTxs';
import getPools from '../../src/biatecClamm/getPools';
import clammCreateSender from '../../src/biatecClamm/sender/clammCreateSender';

export const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

export const SCALE = 1_000_000_000;
export const ASSET_A_DECIMALS = 8; // BTC Lik
export const SCALE_A = 10 ** ASSET_A_DECIMALS;
export const ASSET_B_DECIMALS = 6; // BTC Like
export const SCALE_B = 10 ** ASSET_B_DECIMALS;
export const SCALE_ALGO = 10 ** 6;
export const LP_TOKEN_DECIMALS = 6; // BTC Like
export const SCALE_LP = 10 ** LP_TOKEN_DECIMALS;

export let assetAId: bigint = 1n;
export let assetBId: bigint = 2n;
export let deployer: algosdk.Account;
export let deployerSigner: TransactionSignerAccount;

// https://github.com/GoogleChromeLabs/jsbi/issues/30
// eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any, func-names
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export interface ISetup {
  algod: algosdk.Algodv2;
  signer?: algosdk.Account; // Optional - not actually used, deployer is created internally
  p1: bigint;
  p2: bigint;
  p: bigint;
  assetA: bigint;
  biatecFee: bigint;
  lpFee: bigint;
}
export const setupPool = async (input: ISetup) => {
  const { algod, p1, p2, p, assetA, biatecFee, lpFee } = input;
  const algorand = await AlgorandClient.fromEnvironment();
  await fixture.newScope();

  deployer = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(100_000_000) });

  deployerSigner = {
    addr: deployer.addr,
    // eslint-disable-next-line no-unused-vars
    signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
      return txnGroup.map((tx) => tx.signTxn(deployer.sk));
    },
  };

  const defaultSigner = async (txnGroup: Transaction[], indexesToSign: number[]) => {
    return txnGroup.map((tx) => tx.signTxn(deployer.sk));
  };
  if (assetA !== 0n) {
    assetAId = await createToken({ account: deployer, algod, name: 'EUR', decimals: ASSET_A_DECIMALS });
  } else {
    assetAId = 0n;
  }
  assetBId = await createToken({ account: deployer, algod, name: 'USD', decimals: ASSET_B_DECIMALS });

  const biatecClammPoolFactoryfactory = new BiatecClammPoolFactory({
    defaultSender: deployer.addr,
    defaultSigner: defaultSigner,

    algorand,
  });

  // const clientBiatecClammPoolProvider = await biatecClammPoolFactoryfactory.send.create
  //   .createApplication()
  //   .catch((e: Error) => {
  //     console.error(e);
  //     return undefined;
  //   });
  // expect(clientBiatecClammPoolProvider).not.toBeNull();
  // if (!clientBiatecClammPoolProvider) throw Error('clientBiatecConfigProvider is empty');

  const biatecIdentityProviderFactory = new BiatecIdentityProviderFactory({
    defaultSender: deployer.addr,
    defaultSigner: defaultSigner,
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
    defaultSigner: defaultSigner,
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
    defaultSigner: defaultSigner,
    algorand,
  });

  const clientBiatecConfigProvider = await biatecConfigProviderFactory.send.create
    .createApplication()
    .catch((e: Error) => {
      console.error(e);
      return undefined;
    });
  if (!clientBiatecConfigProvider) throw Error('clientBiatecConfigProvider is empty');

  expect(clientBiatecConfigProvider).not.toBeNull();

  expect(clientBiatecConfigProvider.appClient.appId).toBeGreaterThan(0);
  expect(clientBiatecIdentityProvider.appClient.appId).toBeGreaterThan(0);
  //expect(clientBiatecClammPoolProvider.appClient.appId).toBeGreaterThan(0);
  expect(clientBiatecPoolProvider.appClient.appId).toBeGreaterThan(0);

  const signerObj = {
    addr: deployer.addr,
    // eslint-disable-next-line no-unused-vars
    signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
      return txnGroup.map((tx) => tx.signTxn(deployer.sk));
    },
  };
  let txId = await configBootstrapSender({
    algod,
    clientBiatecConfigProvider: clientBiatecConfigProvider?.appClient,
    account: signerObj,
    appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
    appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
    biatecFee,
  });
  expect(txId.length).toBe(52);
  const { approvalProgram: clammPoolApprovalProgram } = await biatecClammPoolFactoryfactory.appFactory.compile({});

  const tx = makePaymentTxnWithSuggestedParamsFromObject({
    amount: 7000000,
    receiver: clientBiatecPoolProvider.appClient.appAddress,
    suggestedParams: await algod.getTransactionParams().do(),
    sender: signerObj.addr,
  }).signTxn(deployer.sk);
  await algod.sendRawTransaction(tx).do();

  await clientBiatecPoolProvider.appClient.send.bootstrap({
    args: {
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
    },
  });
  console.log(
    'apps PP,Identity,Config',
    clientBiatecPoolProvider.appClient.appId,
    clientBiatecIdentityProvider.appClient.appId,
    clientBiatecConfigProvider.appClient.appId
  );
  console.log('clammPoolApprovalProgram.length', clammPoolApprovalProgram.length);
  // if (clammPoolApprovalProgram.length > 0)
  //   throw Error(`clammPoolApprovalProgram.length ${clammPoolApprovalProgram.length}`);
  // 8129
  for (let i = 0; i < clammPoolApprovalProgram.length; i += 1024) {
    console.log('deploying clammPoolApprovalProgram', i, i + 1024, clammPoolApprovalProgram.length);
    if (i >= 0) {
      const tx = await clientBiatecPoolProvider.appClient.createTransaction.loadClammContractData({
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
      const txsToGroup = [
        ...(
          await clientBiatecPoolProvider.appClient.createTransaction.noop({
            args: { i: 1 },
            boxReferences: [
              new Uint8Array(Buffer.from('11', 'ascii')),
              new Uint8Array(Buffer.from('12', 'ascii')),
              new Uint8Array(Buffer.from('13', 'ascii')),
              new Uint8Array(Buffer.from('14', 'ascii')),
            ],
          })
        ).transactions,
        ...(
          await clientBiatecPoolProvider.appClient.createTransaction.noop({
            args: { i: 2 },
            boxReferences: [
              new Uint8Array(Buffer.from('21', 'ascii')),
              new Uint8Array(Buffer.from('22', 'ascii')),
              new Uint8Array(Buffer.from('23', 'ascii')),
              new Uint8Array(Buffer.from('24', 'ascii')),
            ],
          })
        ).transactions,
        // ...(
        //   await clientBiatecPoolProvider.appClient.createTransaction.noop({
        //     args: { i: 3 },
        //   })
        // ).transactions,
        ...tx.transactions,
      ];
      const txsToGroupNoGroup = txsToGroup.map((tx: algosdk.Transaction) => {
        tx.group = undefined;
        return tx;
      });
      const signed: Uint8Array[] = [];
      const txsToGroupNoGrouped = assignGroupID(txsToGroupNoGroup);
      txsToGroupNoGrouped.forEach((t) => signed.push(t.signTxn(deployer.sk)));
      const poolDeployTxNetwork = await algod.sendRawTransaction(signed).do();
      expect(poolDeployTxNetwork.txid.length).toBe(52);
    } else {
      await clientBiatecPoolProvider.appClient.send.loadClammContractData({
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
    }
  }

  // const poolDeployTx = await clientBiatecPoolProvider.appClient.createTransaction.deployPool({
  //   args: {
  //     fee: lpFee,
  //     assetA: BigInt(assetA),
  //     assetB: BigInt(assetBId),
  //     verificationClass: 0,
  //     appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
  //     priceMin: p1,
  //     priceMax: p2,
  //     currentPrice: p,
  //     appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
  //     txSeed: makePaymentTxnWithSuggestedParamsFromObject({
  //       amount: 400_000,
  //       receiver: clientBiatecPoolProvider.appClient.appAddress,
  //       sender: algosdk.encodeAddress(signerObj.addr.publicKey),
  //       suggestedParams: await algod.getTransactionParams().do(),
  //     }),
  //   },
  //   staticFee: AlgoAmount.MicroAlgos(10000),
  //   boxReferences: [
  //     new Uint8Array(Buffer.from('capb1', 'ascii')),
  //     new Uint8Array(Buffer.from('capb2', 'ascii')),
  //     new Uint8Array(Buffer.from('capb3', 'ascii')),
  //     new Uint8Array(Buffer.from('capb4', 'ascii')),
  //   ],
  //   assetReferences: [assetA, assetBId],
  //   appReferences: [clientBiatecPoolProvider.appClient.appId, clientBiatecConfigProvider.appClient.appId],
  // });
  // //expect(poolDeployTx.return).toBeGreaterThan(0n);
  // const boxRefA: BoxReference = {
  //   appId: clientBiatecPoolProvider.appClient.appId,
  //   name: new Uint8Array([...Buffer.from('a', 'ascii'), ...algosdk.encodeUint64(assetAId)]),
  // };
  // const boxRefB: BoxReference = {
  //   appId: clientBiatecPoolProvider.appClient.appId,
  //   name: new Uint8Array([...Buffer.from('b', 'ascii'), ...algosdk.encodeUint64(assetBId)]),
  // };
  // const txsToGroup = [
  //   ...(
  //     await clientBiatecPoolProvider.appClient.createTransaction.noop({
  //       args: { i: 1 },
  //       boxReferences: [
  //         boxRefA,
  //         boxRefB,
  //         new Uint8Array(Buffer.from('13', 'ascii')),
  //         new Uint8Array(Buffer.from('14', 'ascii')),
  //       ],
  //     })
  //   ).transactions,
  //   ...(
  //     await clientBiatecPoolProvider.appClient.createTransaction.noop({
  //       args: { i: 2 },
  //       boxReferences: [
  //         new Uint8Array(Buffer.from('21', 'ascii')),
  //         new Uint8Array(Buffer.from('22', 'ascii')),
  //         new Uint8Array(Buffer.from('23', 'ascii')),
  //         new Uint8Array(Buffer.from('24', 'ascii')),
  //       ],
  //     })
  //   ).transactions,
  //   ...poolDeployTx.transactions,
  // ];
  // const txsToGroupNoGroup = txsToGroup.map((tx: algosdk.Transaction) => {
  //   tx.group = undefined;
  //   return tx;
  // });
  console.log('fetching txs to clammCreateTxs', assetAId, assetBId);
  const txsClammCreateTxs = await clammCreateTxs({
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
  expect(txsClammCreateTxs.length).toBe(4);
  const txsClammCreateTxsSigned: Uint8Array[] = [];
  txsClammCreateTxs.forEach((t) => txsClammCreateTxsSigned.push(t.signTxn(deployer.sk)));
  const poolDeployTxNetwork = await algod.sendRawTransaction(txsClammCreateTxsSigned).do();

  expect(poolDeployTxNetwork.txid.length).toBe(52);
  const confirmation = await algosdk.waitForConfirmation(
    algorand.client.algod,
    txsClammCreateTxs[txsClammCreateTxs.length - 1].txID(),
    4
  );

  // const deployTx = await algorand.client.indexer.lookupTransactionByID(poolDeployTx.transactions[0].txID()).do();
  // if (!(deployTx.transaction.logs && deployTx.transaction.logs.length > 0)) throw new Error('Logs not found');
  if (!(confirmation.logs && confirmation.logs.length > 0)) {
    console.log('confirmation', txsClammCreateTxs[txsClammCreateTxs.length - 1].txID(), confirmation);
    throw new Error('Logs not found');
  }
  const lastLog = confirmation.logs[confirmation.logs.length - 1];
  expect(lastLog.length).toBe(12);
  const poolAppId = algosdk.decodeUint64(lastLog.subarray(4, 12));

  //console.log('Pool deployed', poolAppId);

  // txId = await clammBootstrapSender({
  //   fee: lpFee,
  //   assetA: BigInt(assetA),
  //   assetB: BigInt(assetBId),
  //   verificationClass: 0,
  //   appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
  //   priceMin: p1,
  //   priceMax: p2,
  //   currentPrice: p,
  //   account: signerObj,
  //   algod,
  //   appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
  //   clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
  // });

  const clientBiatecClammPoolProvider = {
    appClient: new BiatecClammPoolClient({
      algorand: algorand,
      defaultSender: deployer.addr,
      defaultSigner: defaultSigner,
      appId: BigInt(poolAppId),
    }),
  };

  await clientBiatecClammPoolProvider.appClient.send.bootstrapStep2({
    args: {},
    staticFee: AlgoAmount.MicroAlgo(2000),
  });

  // bootrap identity
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

// Re-export commonly used items for tests
export { algosdk, algokit, AlgorandClient, AlgoAmount, BoxReference };
export { 
  BiatecClammPoolClient, 
  BiatecClammPoolFactory,
  BiatecIdentityProviderClient,
  BiatecIdentityProviderFactory,
  BiatecPoolProviderClient,
  BiatecPoolProviderFactory,
  BiatecConfigProviderClient,
  BiatecConfigProviderFactory,
  FakePoolClient,
  FakePoolFactory
};
export {
  clammBootstrapSender,
  configBootstrapSender,
  getBoxReferenceStats,
  parseStatus,
  parseStats,
  clammAddLiquiditySender,
  clammCreateTxs,
  getPools,
  clammCreateSender,
  createToken,
  assignGroupID,
  makePaymentTxnWithSuggestedParamsFromObject
};
export type { Transaction, TransactionSignerAccount };
