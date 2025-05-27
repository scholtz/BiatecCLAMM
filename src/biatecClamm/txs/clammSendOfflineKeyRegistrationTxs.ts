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
