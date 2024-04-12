import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammSendOnlineKeyRegistrationTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
}
/**
 * Biatec can execute the offline key registration
 * This method creates list of transactions to be signed
 * @returns List of transactions to sign
 */
const clammSendOfflineKeyRegistrationTxs = async (
  input: IClammSendOnlineKeyRegistrationTxsInput
): Promise<algosdk.Transaction[]> => {
  const { clientBiatecClammPool, account, appBiatecConfigProvider } = input;
  const atc = new AtomicTransactionComposer();
  await clientBiatecClammPool.sendOfflineKeyRegistration(
    {
      appBiatecConfigProvider,
    },
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(2000),
        atc,
      },
      apps: [Number(appBiatecConfigProvider)],
      accounts: [],
    }
  );
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammSendOfflineKeyRegistrationTxs;
