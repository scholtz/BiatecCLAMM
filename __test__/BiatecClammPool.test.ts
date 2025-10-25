/* eslint-disable no-await-in-loop */
import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, { assignGroupID, makePaymentTxnWithSuggestedParamsFromObject, Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient, BiatecClammPoolFactory } from '../contracts/clients/BiatecClammPoolClient';
import createToken from '../src/createToken';
import {
  BiatecIdentityProviderClient,
  BiatecIdentityProviderFactory,
} from '../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient, BiatecPoolProviderFactory } from '../contracts/clients/BiatecPoolProviderClient';
import { FakePoolClient, FakePoolFactory } from '../contracts/clients/FakePoolClient';
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
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';
import clammCreateTxs from '../src/biatecClamm/txs/clammCreateTxs';
import getPools from '../src/biatecClamm/getPools';
import clammCreateSender from '../src/biatecClamm/sender/clammCreateSender';
import calculatePriceData from './test-data/calculate-price.json';
import calculateAssetBWithdrawData from './test-data/calculate-asset-b-withdraw-on-asset-a-deposit.json';
import calculateAssetAWithdrawData from './test-data/calculate-asset-a-withdraw-on-asset-b-deposit.json';
import calculateLiquidityData from './test-data/calculate-liquidity.json';
import calculateAssetAWithdrawLpData from './test-data/calculate-asset-a-withdraw-on-lp-deposit.json';
import calculateAssetBWithdrawLpData from './test-data/calculate-asset-b-withdraw-on-lp-deposit.json';
import calculateAssetBDepositData from './test-data/calculate-asset-b-deposit-on-asset-a-deposit.json';
import calculateAssetADepositData from './test-data/calculate-asset-a-deposit-on-asset-b-deposit.json';
import addLiquidityData from './test-data/add-liquidity.json';
import addLiquiditySecondData from './test-data/add-liquidity-second.json';
import swapAToBData from './test-data/swap-a-to-b.json';
import swapBToAData from './test-data/swap-b-to-a.json';
import removeLiquidityData from './test-data/remove-liquidity.json';
import lpFees10BiatecFee0Data from './test-data/lp-fees-10-biatec-fee-0.json';
import lpFees10BiatecFee50Data from './test-data/lp-fees-10-biatec-fee-50.json';
import asasrLpFees10BiatecFee0Data from './test-data/asasr-lp-fees-10-biatec-fee-0.json';
import withdrawLpFeesData from './test-data/withdraw-lp-fees-from-biatec-account.json';
import distributeAssetsData from './test-data/distribute-assets-to-lp-holders.json';
import extremeSamePriceLowTopData from './test-data/extreme-same-price-low-top-asasr.json';
import extremeSmallMinMaxPriceDiffData from './test-data/extreme-small-min-max-price-diff.json';
import extremeExtremePriceMinData from './test-data/extreme-extreme-price-min.json';
import extremeNoFeesEurusdData from './test-data/extreme-no-fees-eurusd.json';
import algoVsAsaPoolData from './test-data/algo-vs-asa-pool.json';
import { convertToBigInt } from './test-data/convertToBigInt';

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

export let assetAId: bigint = 1n;
export let assetBId: bigint = 2n;
let deployer: algosdk.Account;
let deployerSigner: TransactionSignerAccount;

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
describe('clamm', () => {
  beforeEach(fixture.newScope);

  beforeAll(async () => {
    await fixture.newScope();
    const { algod } = fixture.context;
    deployer = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(100_000_000) });

    deployerSigner = {
      addr: deployer.addr,
      // eslint-disable-next-line no-unused-vars
      signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
        return txnGroup.map((tx) => tx.signTxn(deployer.sk));
      },
    };
    assetAId = 1n;
    assetBId = 2n;
  });

  test('I can deploy the concentrated liquidity pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const { clientBiatecClammPoolProvider } = await setupPool({
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
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('CantMixPP: I can not register to pool provider amm pool not created by pool provider', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        clientBiatecPoolProvider,
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
      expect(!!clientBiatecClammPoolProvider).toBeTruthy();
      const appId = await clientBiatecClammPoolProvider.appClient.appId;
      expect(appId).toBeGreaterThan(0);

      const defaultSigner = async (txnGroup: Transaction[], indexesToSign: number[]) => {
        return txnGroup.map((tx) => tx.signTxn(deployer.sk));
      };

      const fakePoolfactory = new FakePoolFactory({
        defaultSender: deployer.addr,
        defaultSigner: defaultSigner,
        algorand: clientBiatecClammPoolProvider.appClient.algorand,
      });
      const fakeClientProvider = await fakePoolfactory.send.create.createApplication({ args: {} });
      expect(fakeClientProvider.appClient.appId).toBeGreaterThan(0n);
      // await fakeClientProvider.appClient.send.bootstrapStep2({
      //   args: {
      //     appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      //     assetA: assetAId,
      //     assetB: assetBId,
      //     verificationClass: 0,
      //   },
      //   staticFee: AlgoAmount.MicroAlgo(2000),
      // });

      await expect(
        fakeClientProvider.appClient.send.bootstrapStep2({
          args: {
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            verificationClass: 0,
          },
          staticFee: AlgoAmount.MicroAlgo(2000),
        })
      ).rejects.toThrow();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('calculatePrice returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculatePriceData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const result = await clientBiatecClammPoolProvider.appClient.calculatePrice({
          args: {
            assetAQuantity: BigInt(t.x * SCALE),
            assetBQuantity: BigInt(t.y * SCALE),
            liquidity: t.L * SCALE,
            priceMinSqrt: Math.sqrt(t.P1) * SCALE,
            priceMaxSqrt: Math.sqrt(t.P2) * SCALE,
          },
        });
        expect(result).toEqual(BigInt(t.P * SCALE));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('calculateAssetBWithdrawOnAssetADeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetBWithdrawData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const result = await clientBiatecClammPoolProvider.appClient.calculateAssetBWithdrawOnAssetADeposit({
          args: {
            inAmount: BigInt(t.deposit * SCALE),
            assetABalance: BigInt(t.x * SCALE),
            assetBBalance: BigInt(t.y * SCALE),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
            liquidity: BigInt(t.L * SCALE),
          },
        });

        expect(result).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('calculateAssetAWithdrawOnAssetBDeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetAWithdrawData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });
        if (t.P1 === t.P2) {
          const l = await clientBiatecClammPoolProvider.appClient.calculateLiquidityFlatPrice({
            args: {
              x: BigInt(t.x * SCALE),
              y: BigInt(t.x * SCALE),
              price: BigInt(t.P1 * SCALE),
            },
          });
          expect(l).toBeGreaterThan(0);
          if (!l) throw Error('L is zero');
          const input = {
            inAmount: BigInt(t.depositB * SCALE),
            assetABalance: BigInt(t.x * SCALE),
            assetBBalance: BigInt(t.y * SCALE),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
            liquidity: l,
          };
          const result = await clientBiatecClammPoolProvider.appClient.calculateAssetAWithdrawOnAssetBDeposit({
            args: input,
          });
          expect(result).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
        } else {
          const dSqrt = await clientBiatecClammPoolProvider.appClient.calculateLiquidityD({
            args: {
              x: BigInt(t.x * SCALE),
              y: BigInt(t.x * SCALE),
              priceMin: BigInt(t.P1 * SCALE),
              priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
              priceMax: BigInt(t.P2 * SCALE),
              priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
            },
          });
          if (!dSqrt) throw Error('dSqrt is expected here');
          const l = await clientBiatecClammPoolProvider.appClient.calculateLiquidityWithD({
            args: {
              x: BigInt(t.x * SCALE),
              y: BigInt(t.x * SCALE),
              priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
              priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
              dSqrt,
            },
          });
          expect(l).toBeGreaterThan(0);
          if (!l) throw Error('L is zero');
          const result = await clientBiatecClammPoolProvider.appClient.calculateAssetAWithdrawOnAssetBDeposit({
            args: {
              inAmount: BigInt(t.depositB * SCALE),
              assetABalance: BigInt(t.x * SCALE),
              assetBBalance: BigInt(t.y * SCALE),
              priceMinSqrt: BigInt(Math.sqrt(t.P1) * SCALE),
              priceMaxSqrt: BigInt(Math.sqrt(t.P2) * SCALE),
              liquidity: l,
            },
          });
          expect(result).toEqual(BigInt(t.expectedWithdrawResult * SCALE));
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('calculateLiquidity returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateLiquidityData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P1 * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const dSqrt = await clientBiatecClammPoolProvider.appClient.calculateLiquidityD({
          args: {
            x: BigInt(t.x * SCALE),
            y: BigInt(t.y * SCALE),
            priceMin: BigInt(t.P1 * SCALE),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMax: BigInt(t.P2 * SCALE),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
          },
        });
        expect(dSqrt).toBe(BigInt(t.dSqrt * SCALE));
        if (dSqrt === undefined) throw Error('dSqrt is expected here');
        const result = await clientBiatecClammPoolProvider.appClient.calculateLiquidityWithD({
          args: {
            x: BigInt(Math.round(t.x * SCALE)),
            y: BigInt(Math.round(t.y * SCALE)),
            priceMinSqrt: BigInt(Math.round(Math.sqrt(t.P1) * SCALE)),
            priceMaxSqrt: BigInt(Math.round(Math.sqrt(t.P2) * SCALE)),
            dSqrt,
          },
        });
        expect(result).toEqual(BigInt(t.L * SCALE));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('calculateAssetAWithdrawOnLPDeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetAWithdrawLpData;

      const { clientBiatecClammPoolProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        signer: deployer,
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
        const result = await clientBiatecPoolProvider.appClient.calculateAssetBWithdrawOnLpDeposit({
          args: {
            inAmount: BigInt(Math.round(t.lpDeposit * SCALE)),
            assetBBalance: BigInt(Math.round(t.x * SCALE)),
            liquidity: BigInt(Math.round(t.L * SCALE)),
          },
          extraFee: algokit.microAlgos(2000),
        });
        expect(result).toEqual(BigInt(Math.round(t.aWithdraw * SCALE)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('calculateAssetBWithdrawOnLPDeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetBWithdrawLpData;

      const { clientBiatecClammPoolProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        signer: deployer,
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
        const result = await clientBiatecPoolProvider.appClient.calculateAssetBWithdrawOnLpDeposit({
          args: {
            inAmount: BigInt(Math.round(t.lpDeposit * SCALE)),
            assetBBalance: BigInt(Math.round(t.y * SCALE)),
            liquidity: BigInt(Math.round(t.L * SCALE)),
          },
          extraFee: algokit.microAlgos(2000),
        });
        expect(result).toEqual(BigInt(Math.round(t.bWithdraw * SCALE)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('calculateAssetBDepositOnAssetADeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetBDepositData;

      const { clientBiatecClammPoolProvider } = await setupPool({
        algod,
        signer: deployer,
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
        const result = await clientBiatecClammPoolProvider.appClient.calculateAssetBDepositOnAssetADeposit({
          args: {
            inAmountA: BigInt(Math.round(t.aDeposit * SCALE)),
            inAmountB: BigInt(Math.round(t.bDeposit * SCALE)),
            assetABalance: BigInt(Math.round(t.x * SCALE)),
            assetBBalance: BigInt(Math.round(t.y * SCALE)),
          },
          extraFee: algokit.microAlgos(2000),
        });
        expect(result).toEqual(BigInt(Math.round(t.bDeposit * SCALE)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('calculateAssetADepositOnAssetBDeposit returns correct results', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;
      const testSet = calculateAssetADepositData;

      const { clientBiatecClammPoolProvider } = await setupPool({
        algod,
        signer: deployer,
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

        const result = await clientBiatecClammPoolProvider.appClient.calculateAssetADepositOnAssetBDeposit({
          args: input,
          extraFee: algokit.microAlgos(2000),
        });
        expect(result).toEqual(BigInt(Math.round(t.aDepositOut * SCALE)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('addLiquidity1 - I can add liquidity to the pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = addLiquidityData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } =
          await setupPool({
            algod,
            signer: deployer,
            assetA: assetAId,
            biatecFee: 0n,
            lpFee: 0n,
            p: BigInt(t.P * SCALE),
            p1: BigInt(t.P1 * SCALE),
            p2: BigInt(t.P2 * SCALE),
          });

        const params = await algod.getTransactionParams().do();

        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId({ args: {} });
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const depositA = {
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        };
        const depositB = {
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        };
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(depositA);
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(depositB);
        const liquidityInput = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };

        // const tx = clammAddLiquiditySender({
        //   account: deployerSigner,
        //   algod: algod,
        //   appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        //   appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        //   assetLp: poolTokenId,
        //   assetA: assetAId,
        //   assetB: assetBId,
        //   assetADeposit: BigInt(Math.round(t.x * SCALE_A)),
        //   assetBDeposit: BigInt(Math.round(t.y * SCALE_B)),
        //   clientBiatecClammPool: clientBiatecClammPoolProvider.appClient
        // });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: liquidityInput,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('addLiquidity2 - I can add liquidity to the pool second step', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = addLiquiditySecondData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } =
          await setupPool({
            algod,
            signer: deployer,
            assetA: assetAId,
            biatecFee: 0n,
            lpFee: 0n,
            p: BigInt(t.P * SCALE),
            p1: BigInt(t.P1 * SCALE),
            p2: BigInt(t.P2 * SCALE),
          });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        /// /////////////////////////////////// STEP 2

        const addLiquidityA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x2 * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y2 * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA2,
            txAssetBDeposit: addLiquidityB2,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('swapAtoB - I can add liquidity to the pool and swap from A token to B token', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = swapAToBData;

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.L * 10 ** LP_TOKEN_DECIMALS)));

        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapA * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('swapBtoA - I can add liquidity to the pool and swap from B token to A token', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = swapBToAData;

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.L * 10 ** LP_TOKEN_DECIMALS)));

        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addSwapB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapB * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            minimumToReceive: 0,
            txSwap: addSwapB,
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapA * SCALE_A)));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('removeLiquidity - I can add and remove liquidity from the pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = removeLiquidityData;

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } =
          await setupPool({
            algod,
            signer: deployer,
            assetA: assetAId,
            biatecFee: 0n,
            lpFee: 0n,
            p: BigInt(t.P * SCALE),
            p1: BigInt(t.P1 * SCALE),
            p2: BigInt(t.P2 * SCALE),
          });

        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('LP fees 10%, Biatec fee - 0% - I can add, swap and remove liquidity from the pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(lpFees10BiatecFee0Data);

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });

        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);

        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapA * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('LP fees 10%, Biatec fee - 50% - I can add, swap and remove liquidity from the pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(lpFees10BiatecFee50Data);

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 500_000_000n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);

        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swapA * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('ASASR - LP fees 10%, Biatec fee - 0% - I can add, swap, add, swap, and remove all liquidity from the pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(asasrLpFees10BiatecFee0Data);

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });
        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const token = await algod.getAssetByID(poolTokenId).do();
        expect(token.params.name).toEqual('B-EUR-USD');
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.send.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1.return?.valueOf()).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        expect(stats1).toStrictEqual(t.stats1);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed2).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed3).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);
        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('I can withdraw lp fees from biatec account', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(withdrawLpFeesData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        // REMOVE LIQUIDITY FROM FEES FOR BIATEC

        const liqudidtyRemoveResult1 = await clientBiatecClammPoolProvider.appClient.send.removeLiquidityAdmin({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
            amount: t.removeFromBiatecFees1,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove1 = await liqudidtyRemoveResult1.return;
        expect(retLRemove1?.valueOf()).toEqual(BigInt(t.removeFromBiatecFees1Check));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);

        // REMOVE LIQUIDITY FROM FEES FOR BIATEC

        const liqudidtyRemoveResult2 = await clientBiatecClammPoolProvider.appClient.send.removeLiquidityAdmin({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
            amount: t.removeFromBiatecFees2,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove2 = await liqudidtyRemoveResult2.return;
        expect(retLRemove2?.valueOf()).toEqual(BigInt(t.removeFromBiatecFees2Check));

        const status7 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus7.poolToken = BigInt(poolTokenId);
        t.checkStatus7.assetA = BigInt(assetAId);
        t.checkStatus7.assetB = BigInt(assetBId);

        expect(status7).toEqual(t.checkStatus7);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('If someone deposits the asset a or asset b to the pool, we can distribute these assets to lp holders', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(distributeAssetsData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } =
          await setupPool({
            algod,
            signer: deployer,
            assetA: assetAId,
            biatecFee: 100_000_000n,
            lpFee: 100_000_000n,
            p: BigInt(t.P * SCALE),
            p1: BigInt(t.P1 * SCALE),
            p2: BigInt(t.P2 * SCALE),
          });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const depositA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.depositA * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const depositASigned = depositA.signTxn(deployer.sk);
        const depositB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.depositB * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const depositBSigned = depositB.signTxn(deployer.sk);
        await algod.sendRawTransaction(depositASigned).do();
        await algod.sendRawTransaction(depositBSigned).do();

        // redistribute
        const distributeResult = await clientBiatecClammPoolProvider.appClient.send.distributeExcessAssets({
          args: {
            amountA: t.performDepositA,
            amountB: t.performDepositB,
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
          },
          extraFee: algokit.microAlgos(3000),
        });
        const distributeResultRet = await distributeResult.return;
        expect(distributeResultRet?.valueOf()).toEqual(BigInt(t.distributeResult));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('I can make the pool protect algorand network', async () => {
    assetAId = 1n;
    const { algod } = fixture.context;

    const { clientBiatecClammPoolProvider } = await setupPool({
      algod,
      signer: deployer,
      assetA: assetAId,
      biatecFee: 100_000_000n,
      lpFee: 100_000_000n,
      p: 100_000_000n,
      p1: 100_000_000n,
      p2: 100_000_000n,
    });

    expect(clientBiatecClammPoolProvider.appClient.send.sendOnlineKeyRegistration).not.toBeNull();
  });
  test('Extreme-SamePriceLowTop - ASASR - I can handle the trade as an order book item', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(extremeSamePriceLowTopData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 500_000_000n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        expect(stats1).toStrictEqual(t.stats1);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed2).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed3).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        // expect(stats2).toBe(t.stats2);
        expect(stats2).toStrictEqual(t.stats2);
        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('Extreme-SmallMinMaxPriceDiff - ASASR 0.9999 - 1.0001, LP fee 1BPS, Biatec fee 10%', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(extremeSmallMinMaxPriceDiffData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000n, // 0.01%
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        // expect(stats1).toBe(t.stats1);
        expect(stats1).toStrictEqual(t.stats1);
        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS)));

        const distributed2 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed2).toEqual(BigInt(Math.round(Math.round(t.checkDistributed2 * SCALE))));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed3).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);
        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('Extreme-ExtremePrice-Min - ASASR 0.000000001 - 1, LP fee 1BPS, Biatec fee 10%', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(extremeExtremePriceMinData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 100_000_000n,
          lpFee: 100_000n, // 0.01%
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        expect(stats1).toStrictEqual(t.stats1);

        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));

        const distributed2 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed2).toEqual(BigInt(Math.round(t.checkDistributed2 * SCALE)));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const distributed3 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed3).toEqual(BigInt(Math.round(t.checkDistributed3 * SCALE)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);

        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('Extreme-No-Fees - ASASR EURUSD - 0.9 - 1.1, LP fee 0, Biatec fee 0%', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(extremeNoFeesEurusdData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n, // 0.01%
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        /// /////// ADD LIQUIDITY 1
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add1B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(Math.round(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS)));

        const distributed1 = await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0,
          },
        });
        expect(distributed1).toEqual(BigInt(Math.round(t.checkDistributed1 * SCALE)));
        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });

        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);
        /// /////// SWAP 1

        const addSwapA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap1A * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        expect(addSwapA.assetTransfer?.amount).toEqual(10_000_000_000n); // 100 * 10^8

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swap1B * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const stats1 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats1.assetA = BigInt(assetAId);
        t.stats1.assetB = BigInt(assetBId);
        t.stats1.period1NowTime = stats1.period1NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period2NowTime = stats1.period2NowTime;
        t.stats1.period3NowTime = stats1.period3NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        t.stats1.period4NowTime = stats1.period4NowTime;
        expect(stats1).toStrictEqual(t.stats1);

        /// /////// ADD LIQUDITY 2

        const addLiquidity2A = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2A * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2B = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.add2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidity2Params = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidity2A,
          txAssetBDeposit: addLiquidity2B,
          assetLp: poolTokenId,
          assetA: assetAId,
          assetB: assetBId,
        };
        await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidity2Params,
          extraFee: algokit.microAlgos(9000),
        });

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
        /// /////// SWAP 2

        const addSwapA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.swap2B * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const swapResult2 = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA2,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(assetAId), BigInt(assetBId)],
        });

        const retSwap2 = await swapResult2.return;
        expect(retSwap2?.valueOf()).toEqual(BigInt(Math.round(t.swap2A * SCALE_A)));

        const status5 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus5.poolToken = BigInt(poolTokenId);
        t.checkStatus5.assetA = BigInt(assetAId);
        t.checkStatus5.assetB = BigInt(assetBId);

        expect(status5).toEqual(t.checkStatus5);

        const stats2 = await clientBiatecPoolProvider.appClient.getCurrentStatus({
          args: {
            appPoolId: clientBiatecClammPoolProvider.appClient.appId,
          },
        });
        t.stats2.assetA = BigInt(assetAId);
        t.stats2.assetB = BigInt(assetBId);
        t.stats2.period1NowTime = stats2.period1NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period2NowTime = stats2.period2NowTime;
        t.stats2.period3NowTime = stats2.period3NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period4NowTime = stats2.period4NowTime;
        t.stats2.period1NowFeeA = stats2.period1NowFeeA;
        t.stats2.period1NowFeeB = stats2.period1NowFeeB;
        t.stats2.period1NowVwap = stats2.period1NowVwap;
        t.stats2.period1NowVolumeA = stats2.period1NowVolumeA;
        t.stats2.period1NowVolumeB = stats2.period1NowVolumeB;
        t.stats2.period1PrevFeeA = stats2.period1PrevFeeA;
        t.stats2.period1PrevFeeB = stats2.period1PrevFeeB;
        t.stats2.period1PrevVwap = stats2.period1PrevVwap;
        t.stats2.period1PrevVolumeA = stats2.period1PrevVolumeA;
        t.stats2.period1PrevVolumeB = stats2.period1PrevVolumeB;
        t.stats2.period1PrevTime = stats2.period1PrevTime;
        expect(stats2).toStrictEqual(t.stats2);

        /// /////// REMOVE LIQUIDITY

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status6 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus6.poolToken = BigInt(poolTokenId);
        t.checkStatus6.assetA = BigInt(assetAId);
        t.checkStatus6.assetB = BigInt(assetBId);

        expect(status6).toEqual(t.checkStatus6);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
  test('I can have algo vs asa in the pool', async () => {
    try {
      assetAId = 1n;
      const { algod } = fixture.context;

      const testSet = convertToBigInt(algoVsAsaPoolData);

      

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const {
          clientBiatecClammPoolProvider,
          clientBiatecConfigProvider,
          clientBiatecIdentityProvider,
          clientBiatecPoolProvider,
        } = await setupPool({
          algod,
          signer: deployer,
          assetA: 0n,
          biatecFee: 0n,
          lpFee: 100_000_000n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);

        const status1 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: t.assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus1.poolToken = BigInt(poolTokenId);
        t.checkStatus1.assetA = BigInt(t.assetAId);
        t.checkStatus1.assetB = BigInt(assetBId);

        expect(status1).toEqual(t.checkStatus1);
        const addLiquidityA =
          t.assetAId === 0
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_ALGO)),
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_A)),
                assetIndex: t.assetAId,
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              });

        const addLiquidityB =
          assetBId === 0n
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.x * SCALE_ALGO)),
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.y * SCALE_B)),
                assetIndex: assetBId,
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              });
        const addLiquidityParams = {
          appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
          appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
          txAssetADeposit: addLiquidityA,
          txAssetBDeposit: addLiquidityB,
          assetLp: poolTokenId,
          assetA: t.assetAId,
          assetB: assetBId,
        };
        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: addLiquidityParams,
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const status2 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: t.assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus2.poolToken = BigInt(poolTokenId);
        t.checkStatus2.assetA = BigInt(t.assetAId);
        t.checkStatus2.assetB = BigInt(assetBId);

        expect(status2).toEqual(t.checkStatus2);

        const addSwapA =
          t.assetAId === 0
            ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.swapA * SCALE_ALGO)),
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              })
            : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                amount: BigInt(Math.round(t.swapA * SCALE_A)),
                assetIndex: t.assetAId,
                sender: deployer.addr,
                suggestedParams: params,
                receiver: clientBiatecClammPoolProvider.appClient.appAddress,
              });

        const swapResult = await clientBiatecClammPoolProvider.appClient.send.swap({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
            minimumToReceive: 0,
            txSwap: addSwapA,
            assetA: t.assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
          boxReferences: getBoxReferenceStats({
            appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            assetA: t.assetAId,
            assetB: assetBId,
            includingAssetBoxes: false,
          }),
          appReferences: [
            BigInt(clientBiatecConfigProvider.appClient.appId),
            BigInt(clientBiatecIdentityProvider.appClient.appId),
            BigInt(clientBiatecPoolProvider.appClient.appId),
          ],
          assetReferences: [BigInt(t.assetAId), BigInt(assetBId)],
        });

        const retSwap = await swapResult.return;
        expect(retSwap?.valueOf()).toEqual(BigInt(Math.round(t.swapB * SCALE_B)));

        const status3 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: t.assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus3.poolToken = BigInt(poolTokenId);
        t.checkStatus3.assetA = BigInt(t.assetAId);
        t.checkStatus3.assetB = BigInt(assetBId);

        expect(status3).toEqual(t.checkStatus3);

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: t.assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));

        const status4 = await clientBiatecClammPoolProvider.appClient.status({
          args: {
            assetA: t.assetAId,
            assetB: assetBId,
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            assetLp: poolTokenId,
          },
        });
        t.checkStatus4.poolToken = BigInt(poolTokenId);
        t.checkStatus4.assetA = BigInt(t.assetAId);
        t.checkStatus4.assetB = BigInt(assetBId);

        expect(status4).toEqual(t.checkStatus4);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('npm method getPools() works', async () => {
    try {
      assetAId = 1n;
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
