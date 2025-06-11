import algosdk, { assignGroupID, AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import {
  getBoxReferenceFullConfig,
  getBoxReferenceAggregated,
  getBoxReferencePool,
  getBoxReferencePoolByConfig,
  getBoxReferenceIdentity,
} from '../../index';
interface IClammRemoveLiquidityTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  lpToSend: bigint;
}
/**
 * This method creates list of transactions to be signed to remove liquidity from the concentrated liquidity amm pool
 * @returns List of transactions to sign
 */
const clammRemoveLiquidityTxs = async (input: IClammRemoveLiquidityTxsInput): Promise<algosdk.Transaction[]> => {
  const {
    params,
    clientBiatecClammPool,
    account,
    appBiatecConfigProvider,
    appBiatecIdentityProvider,
    assetA,
    assetB,
    assetLp,
    lpToSend,
  } = input;

  const boxIdentity = getBoxReferenceIdentity({
    appBiatecIdentity: input.appBiatecIdentityProvider,
    address: account.addr,
  });

  const txLpXfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    amount: lpToSend,
    assetIndex: Number(assetLp),
    sender: account.addr,
    suggestedParams: params,
    receiver: clientBiatecClammPool.appClient.appAddress,
  });

  const tx = await clientBiatecClammPool.createTransaction.removeLiquidity({
    args: {
      appBiatecConfigProvider,
      appBiatecIdentityProvider,
      assetA,
      assetB,
      assetLp,
      txLpXfer,
    },
    sender: account.addr,
    staticFee: algokit.microAlgos(12000),
    appReferences: [BigInt(appBiatecConfigProvider), BigInt(appBiatecIdentityProvider)],
    assetReferences: [BigInt(assetA), BigInt(assetB)],
    accountReferences: [],
    boxReferences: [boxIdentity],
  });
  const txsToGroupNoGroup = tx.transactions.map((tx: algosdk.Transaction) => {
    tx.group = undefined;
    return tx;
  });
  const txsToGroupNoGrouped = assignGroupID(txsToGroupNoGroup);
  return txsToGroupNoGrouped;
};
export default clammRemoveLiquidityTxs;
