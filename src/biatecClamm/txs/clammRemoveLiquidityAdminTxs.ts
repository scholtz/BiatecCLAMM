import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammRemoveLiquidityAdminTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  amount: bigint;
}
/**
 * Biatec can remove the collected liquidity from fees
 * This method creates list of transactions to be signed
 * @returns List of transactions to sign
 */
const clammRemoveLiquidityAdminTxs = async (input: IClammRemoveLiquidityAdminTxsInput): Promise<algosdk.Transaction[]> => {
  const { clientBiatecClammPool, account, appBiatecConfigProvider, assetA, assetB, assetLp, amount } = input;

  const tx = await clientBiatecClammPool.createTransaction.removeLiquidityAdmin({
    args: {
      appBiatecConfigProvider,
      assetA,
      assetB,
      assetLp,
      amount,
    },
    sender: account.addr,
    staticFee: algokit.microAlgos(12000),
    appReferences: [BigInt(appBiatecConfigProvider)],
    assetReferences: [BigInt(assetA), BigInt(assetB)],
    accountReferences: [],
  });
  return tx.transactions;
};
export default clammRemoveLiquidityAdminTxs;
