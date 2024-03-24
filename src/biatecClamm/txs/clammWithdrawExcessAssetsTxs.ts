import algosdk, { SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammWithdrawExcessAssetsTxsInput {
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
 * Biatec can withdraw excess assets from the pool
 * This method creates list of transactions to be signed
 * @returns List of transactions to sign
 */
const clammWithdrawExcessAssetsTxs = async (
  input: IClammWithdrawExcessAssetsTxsInput
): Promise<algosdk.Transaction[]> => {
  const { clientBiatecClammPool, account, appBiatecConfigProvider, assetA, assetB, amountA, amountB } = input;

  const compose = clientBiatecClammPool.compose().withdrawExcessAssets(
    {
      appBiatecConfigProvider,
      assetA,
      assetB,
      amountA,
      amountB,
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
  const atc = await compose.atc();
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammWithdrawExcessAssetsTxs;
