import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammSendOfflineKeyRegistrationTxs from '../txs/clammSendOfflineKeyRegistrationTxs';
import sendRawTransactionWithErrorDecoding from '../../common/sendRawTransactionWithErrorDecoding';

interface IClammRemoveLiquidityInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
}
/**
 * Biatec can execute the offline key registration
 *
 * @returns txid
 */
const clammSendOfflineKeyRegistrationSender = async (input: IClammRemoveLiquidityInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammSendOfflineKeyRegistrationTxs({
    ...input,
    params,
  });
  const signed = await input.account.signer(
    txs,
    Array.from(Array(txs.length), (_, i) => i)
  );
  return sendRawTransactionWithErrorDecoding(input.algod, signed, input.clientBiatecClammPool.appClient);
};
export default clammSendOfflineKeyRegistrationSender;
