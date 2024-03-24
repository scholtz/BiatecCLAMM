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
  const compose = clientBiatecClammPool.compose().sendOnlineKeyRegistration(
    {
      appBiatecConfigProvider,
      votePK: keyregParams.votePK,
      selectionPK: keyregParams.selectionPK,
      stateProofPK: keyregParams.stateProofPK,
      voteFirst: keyregParams.voteFirst,
      voteLast: keyregParams.voteLast,
      voteKeyDilution: keyregParams.voteKeyDilution,
    },
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(2000),
      },
      apps: [Number(appBiatecConfigProvider)],
      accounts: [],
    }
  );
  const atc = await compose.atc();
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammSendOnlineKeyRegistrationTxs;
