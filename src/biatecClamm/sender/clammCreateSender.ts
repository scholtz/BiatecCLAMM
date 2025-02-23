import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient, BiatecClammPoolFactory } from '../../../contracts/clients/BiatecClammPoolClient';
import clammCreateTxs from '../txs/clammCreateTxs';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';

interface IClammBootstrapSkInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;
  algorand: AlgorandClient;
}
/**
 * Add the liqudity to the concentrated liquidity AMM
 *
 * @returns txid
 */
const clammCreateSender = async (input: IClammBootstrapSkInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const factory = new BiatecClammPoolFactory({
    algorand: input.algorand,
  });
  const txs = await clammCreateTxs({
    account: input.account,
    biatecClammPoolFactory: factory,
    params,
  });
  const signed = await input.account.signer(
    txs,
    Array.from(Array(txs.length), (_, i) => i)
  );
  const { txid } = await input.algod.sendRawTransaction(signed).do();

  return txid;
};
export default clammCreateSender;
