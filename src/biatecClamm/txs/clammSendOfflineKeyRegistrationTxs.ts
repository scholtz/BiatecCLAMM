import type { SuggestedParams, Transaction } from 'algosdk';
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
const clammSendOfflineKeyRegistrationTxs = async (input: IClammSendOnlineKeyRegistrationTxsInput): Promise<Transaction[]> => {
  if (input) {
    // Offline registration permanently disabled; argument acknowledged to satisfy lint
  }
  throw new Error('Offline key registration is disabled atm');
  // const { clientBiatecClammPool, account, appBiatecConfigProvider } = input;
  // const tx = await clientBiatecClammPool.createTransaction.sendOfflineKeyRegistration({
  //   args: {
  //     appBiatecConfigProvider,
  //   },
  //   sender: account.addr,
  //   staticFee: algokit.microAlgos(2000),
  //   appReferences: [BigInt(appBiatecConfigProvider)],
  //   accountReferences: [],
  // });
  // return tx.transactions;
};
export default clammSendOfflineKeyRegistrationTxs;
