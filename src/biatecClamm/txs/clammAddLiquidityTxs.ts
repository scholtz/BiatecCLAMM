import algosdk, { assignGroupID, AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammBootstrapTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  assetADeposit: bigint;
  assetBDeposit: bigint;
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
    staticFee: algokit.microAlgos(4000),
    boxReferences: [],
    assetReferences: [BigInt(assetA), BigInt(assetB)],
    accountReferences: [],
    appReferences: [appBiatecConfigProvider, appBiatecIdentityProvider],
  });
  const txsToGroupNoGroup = tx.transactions.map((tx: algosdk.Transaction) => {
    tx.group = undefined;
    return tx;
  });
  const txsToGroupNoGrouped = assignGroupID(txsToGroupNoGroup);
  return txsToGroupNoGrouped;
};
export default clammAddLiquidityTxs;
