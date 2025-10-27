import algosdk, { assignGroupID, AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import getBoxReferenceStats from '../../biatecPools/getBoxReferenceStats';
import getBoxReferenceAggregated from '../../biatecPools/getBoxReferenceAggregated';
import getBoxReferenceFullConfig from '../../biatecPools/getBoxReferenceFullConfig';
import getBoxReferencePool from '../../biatecPools/getBoxReferencePool';
import getBoxReferencePoolByConfig from '../../biatecPools/getBoxReferencePoolByConfig';
import getBoxReferenceIdentity from '../../biatecIdentity/getBoxReferenceIdentity';

interface IClammSwapTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  appBiatecPoolProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  minimumToReceive: bigint;
  fromAsset: bigint;
  fromAmount: bigint;
}
/**
 * This method creates list of transactions to be signed to swap asset a or asset b at the biatec concentrated liquidity amm
 * @returns List of transactions to sign
 */
const clammSwapTxs = async (input: IClammSwapTxsInput): Promise<algosdk.Transaction[]> => {
  const { params, clientBiatecClammPool, account, appBiatecConfigProvider, appBiatecIdentityProvider, appBiatecPoolProvider, assetA, assetB, minimumToReceive, fromAsset, fromAmount } = input;

  let txSwap: algosdk.Transaction;

  if (fromAsset === 0n) {
    txSwap = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: fromAmount,
      sender: account.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPool.appClient.appAddress,
    });
  } else {
    txSwap = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: fromAmount,
      assetIndex: Number(fromAsset),
      sender: account.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPool.appClient.appAddress,
    });
  }

  const boxPriceFeed = getBoxReferenceAggregated({
    appBiatecPoolProvider: input.appBiatecPoolProvider,
    assetA,
    assetB,
  });
  const boxIdentity = getBoxReferenceIdentity({
    appBiatecIdentity: input.appBiatecIdentityProvider,
    address: account.addr,
  });

  const boxPool = getBoxReferencePool({
    appBiatecPoolProvider: input.appBiatecPoolProvider,
    ammPool: clientBiatecClammPool.appId,
  });
  const tx = await clientBiatecClammPool.createTransaction.swap({
    args: {
      appBiatecConfigProvider,
      appBiatecIdentityProvider,
      appBiatecPoolProvider,
      assetA,
      assetB,
      txSwap,
      minimumToReceive,
    },

    sender: account.addr,
    staticFee: algokit.microAlgos(12000),
    boxReferences: [boxPriceFeed, boxIdentity, boxPool],
    assetReferences: [BigInt(assetA), BigInt(assetB)],
    accountReferences: [],
    appReferences: [appBiatecIdentityProvider, appBiatecConfigProvider, appBiatecPoolProvider],
  });
  const txsToGroupNoGroup = tx.transactions.map((tx: algosdk.Transaction) => {
    tx.group = undefined;
    return tx;
  });
  const txsToGroupNoGrouped = assignGroupID(txsToGroupNoGroup);
  return txsToGroupNoGrouped;
};
export default clammSwapTxs;
