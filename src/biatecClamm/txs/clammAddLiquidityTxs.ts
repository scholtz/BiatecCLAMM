import algosdk, {
  assignGroupID,
  AtomicTransactionComposer,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  SuggestedParams,
} from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import { BiatecPoolProviderClient } from '../../../contracts/clients/BiatecPoolProviderClient';
import {
  getBoxReferenceFullConfig,
  getBoxReferenceAggregated,
  getBoxReferencePool,
  getBoxReferencePoolByConfig,
  getBoxReferenceIdentity,
} from '../../index';

interface IClammBootstrapTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  clientBiatecPoolProvider: BiatecPoolProviderClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  assetADeposit: bigint;
  assetBDeposit: bigint;

  fee: bigint;
  verificationClass: bigint;
  max: bigint;
  min: bigint;

  optinSender: boolean;
}
/**
 * This method creates list of transactions to be signed to add liquidity to the concentrated liquidity amm
 * @returns List of transactions to sign
 */
const clammAddLiquidityTxs = async (input: IClammBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const {
    params,
    clientBiatecClammPool,
    account,
    appBiatecConfigProvider,
    appBiatecIdentityProvider,
    assetA,
    assetB,
    assetLp,
    assetADeposit,
    assetBDeposit,
    optinSender,
  } = input;

  let txAssetADeposit: algosdk.Transaction;
  let txAssetBDeposit: algosdk.Transaction;
  if (assetA === 0n) {
    txAssetADeposit = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: assetADeposit,
      sender: account.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPool.appClient.appAddress,
    });
  } else {
    txAssetADeposit = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: assetADeposit,
      assetIndex: Number(assetA),
      sender: account.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPool.appClient.appAddress,
    });
  }

  if (assetB === 0n) {
    txAssetBDeposit = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: assetBDeposit,
      sender: account.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPool.appClient.appAddress,
    });
  } else {
    txAssetBDeposit = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: assetBDeposit,
      assetIndex: Number(assetB),
      sender: account.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPool.appClient.appAddress,
    });
  }

  const boxFC = getBoxReferenceFullConfig({
    ammPool: clientBiatecClammPool.appId,
    appBiatecPoolProvider: input.clientBiatecPoolProvider.appId,
    assetA: assetA,
    assetB: assetB,
    fee: input.fee,
    lpTokenId: assetLp,
    verificationClass: input.verificationClass,
    max: input.max,
    min: input.min,
  });

  const boxPriceFeed = getBoxReferenceAggregated({
    appBiatecPoolProvider: input.clientBiatecPoolProvider.appId,
    assetA: assetA,
    assetB: assetB,
  });
  const boxPool = getBoxReferencePool({
    appBiatecPoolProvider: input.clientBiatecPoolProvider.appId,
    ammPool: clientBiatecClammPool.appId,
  });
  const boxPoolByConfig = getBoxReferencePoolByConfig({
    appBiatecPoolProvider: input.clientBiatecPoolProvider.appId,
    assetA: assetA,
    assetB: assetB,
    fee: input.fee,
    verificationClass: input.verificationClass,
    max: input.max,
    min: input.min,
  });

  const boxIdentity = getBoxReferenceIdentity({
    appBiatecIdentity: input.appBiatecIdentityProvider,
    address: account.addr,
  });

  const tx = await clientBiatecClammPool.createTransaction.addLiquidity({
    args: {
      appBiatecConfigProvider,
      appBiatecIdentityProvider,
      txAssetADeposit,
      txAssetBDeposit,
      assetA,
      assetB,
      assetLp,
    },
    sender: account.addr,
    staticFee: algokit.microAlgos(6000),
    boxReferences: [boxPool, boxPoolByConfig],
    assetReferences: [BigInt(assetA), BigInt(assetB), BigInt(assetLp)],
    accountReferences: [],
    appReferences: [appBiatecConfigProvider, appBiatecIdentityProvider, input.clientBiatecPoolProvider.appId],
  });
  let txOptin: algosdk.Transaction | undefined = undefined;
  if (optinSender) {
    txOptin = makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: 0n,
      assetIndex: Number(assetLp),
      sender: account.addr,
      suggestedParams: params,
      receiver: account.addr,
    });
  }

  const txsToGroup = txOptin
    ? [
        txOptin,
        ...(
          await input.clientBiatecPoolProvider.createTransaction.noop({
            args: { i: 1 },
            boxReferences: [boxFC, boxPriceFeed, boxIdentity],
            assetReferences: [BigInt(assetA), BigInt(assetB)],
            sender: account.addr,
            appReferences: [appBiatecConfigProvider, appBiatecIdentityProvider, input.clientBiatecPoolProvider.appId],
          })
        ).transactions,
        ...tx.transactions,
      ]
    : [
        ...(
          await input.clientBiatecPoolProvider.createTransaction.noop({
            args: { i: 1 },
            boxReferences: [boxFC, boxPriceFeed, boxIdentity],
            assetReferences: [BigInt(assetA), BigInt(assetB)],
            sender: account.addr,
            appReferences: [appBiatecConfigProvider, appBiatecIdentityProvider, input.clientBiatecPoolProvider.appId],
          })
        ).transactions,
        ...tx.transactions,
      ];
  console.log(
    'txs',
    txsToGroup.map((tx) => tx.txID()),
    txsToGroup
  );
  const txsToGroupNoGroup = txsToGroup.map((tx: algosdk.Transaction) => {
    tx.group = undefined;
    return tx;
  });
  const txsToGroupNoGrouped = assignGroupID(txsToGroupNoGroup);

  return txsToGroupNoGrouped;
};
export default clammAddLiquidityTxs;
