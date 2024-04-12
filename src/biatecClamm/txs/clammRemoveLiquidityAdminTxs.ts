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
const clammRemoveLiquidityAdminTxs = async (
  input: IClammRemoveLiquidityAdminTxsInput
): Promise<algosdk.Transaction[]> => {
  const { clientBiatecClammPool, account, appBiatecConfigProvider, assetA, assetB, assetLp, amount } = input;
  const atc = new AtomicTransactionComposer();

  await clientBiatecClammPool.removeLiquidityAdmin(
    {
      appBiatecConfigProvider,
      assetA,
      assetB,
      assetLp,
      amount,
    },
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(12000),
      },
      apps: [Number(appBiatecConfigProvider)],
      assets: [Number(assetA), Number(assetB)],
      accounts: [],
    }
  );
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammRemoveLiquidityAdminTxs;
