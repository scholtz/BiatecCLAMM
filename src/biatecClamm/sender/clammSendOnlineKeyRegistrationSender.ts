import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammSendOnlineKeyRegistrationTxs from '../txs/clammSendOnlineKeyRegistrationTxs';
import { ICustomOnlineKeyRegParams } from '../../interface/ICustomOnlineKeyRegParams';

interface IClammRemoveLiquidityInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  keyregParams: ICustomOnlineKeyRegParams;
}
/**
 * Biatec can execute the online key registration to protect algorand network with algos deposited in the lp pool
 *
 * @returns txid
 */
const clammSendOnlineKeyRegistrationSender = async (input: IClammRemoveLiquidityInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammSendOnlineKeyRegistrationTxs({
    ...input,
    params,
  });
  const signed = await input.account.signer(
    txs,
    Array.from(Array(txs.length), (_, i) => i)
  );
  const { txid } = await input.algod.sendRawTransaction(signed).do();
  return txid;
};
export default clammSendOnlineKeyRegistrationSender;
