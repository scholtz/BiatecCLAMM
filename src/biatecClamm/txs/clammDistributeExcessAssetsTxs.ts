import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammDistributeExcessAssetsTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  amountA: bigint;
  amountB: bigint;
}
/**
 * Distributes excess assets to the pool owners
 * This method creates list of transactions to be signed
 * @returns List of transactions to sign
 */
const clammDistributeExcessAssetsTxs = async (input: IClammDistributeExcessAssetsTxsInput): Promise<algosdk.Transaction[]> => {
  const { clientBiatecClammPool, account, appBiatecConfigProvider, assetA, assetB, amountA, amountB } = input;
  const tx = await clientBiatecClammPool.createTransaction.distributeExcessAssets({
    args: {
      appBiatecConfigProvider,
      assetA,
      assetB,
      amountA,
      amountB,
    },
    sender: account.addr,
    staticFee: algokit.microAlgos(12000),
    appReferences: [BigInt(appBiatecConfigProvider)],
    assetReferences: [BigInt(assetA), BigInt(assetB)],
    accountReferences: [],
  });
  return tx.transactions;
};
export default clammDistributeExcessAssetsTxs;
