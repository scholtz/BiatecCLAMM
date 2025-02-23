import algosdk, { SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import { ICustomOnlineKeyRegParams } from '../../interface/ICustomOnlineKeyRegParams';

interface IClammSendOnlineKeyRegistrationTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  keyregParams: ICustomOnlineKeyRegParams;
}
/**
 * Biatec can execute the online key registration to protect algorand network with algos deposited in the lp pool
 * This method creates list of transactions to be signed
 * @returns List of transactions to sign
 */
const clammSendOnlineKeyRegistrationTxs = async (
  input: IClammSendOnlineKeyRegistrationTxsInput
): Promise<algosdk.Transaction[]> => {
  const { clientBiatecClammPool, account, appBiatecConfigProvider, keyregParams } = input;
  // [Uint8Array, Uint8Array, Uint8Array, number | bigint, number | bigint, number | bigint]
  // [Uint8Array, Uint8Array, Uint8Array, number | bigint, number | bigint, number | bigint]
  const tx = await clientBiatecClammPool.createTransaction.sendOnlineKeyRegistration({
    args: {
      appBiatecConfigProvider,
      votePk: keyregParams.votePk,
      selectionPk: keyregParams.selectionPk,
      stateProofPk: keyregParams.stateProofPk,
      voteFirst: keyregParams.voteFirst,
      voteLast: keyregParams.voteLast,
      voteKeyDilution: keyregParams.voteKeyDilution,
    },
    sender: account.addr,
    staticFee: algokit.microAlgos(2000),
    appReferences: [BigInt(appBiatecConfigProvider)],
    accountReferences: [],
  });
  return tx.transactions;
};
export default clammSendOnlineKeyRegistrationTxs;
