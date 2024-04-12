import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammCreateTxs from '../txs/clammCreateTxs';

interface IClammBootstrapSkInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;
}
/**
 * Add the liqudity to the concentrated liquidity AMM
 *
 * @returns txId
 */
const clammCreateSender = async (input: IClammBootstrapSkInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammCreateTxs({
    ...input,
    params,
  });
  const signed = await input.account.signer(
    txs,
    Array.from(Array(txs.length), (_, i) => i)
  );
  const { txId } = await input.algod.sendRawTransaction(signed).do();

  return txId;
};
export default clammCreateSender;
