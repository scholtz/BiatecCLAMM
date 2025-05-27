import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import clammCreateTxs from '../txs/clammCreateTxs';
import { BiatecPoolProviderClient } from '../../../contracts/clients/BiatecPoolProviderClient';

interface IClammBootstrapSkInput {
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;
  clientBiatecPoolProvider: BiatecPoolProviderClient;
  sender: string;

  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  fee: bigint;
  verificationClass: number;
  priceMin: bigint;
  priceMax: bigint;
  currentPrice: bigint;
}
/**
 * Add the liqudity to the concentrated liquidity AMM
 *
 * @returns txid
 */
const clammCreateSender = async (input: IClammBootstrapSkInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammCreateTxs({
    appBiatecConfigProvider: input.appBiatecConfigProvider,
    assetA: input.assetA,
    assetB: input.assetB,
    clientBiatecPoolProvider: input.clientBiatecPoolProvider,
    currentPrice: input.currentPrice,
    fee: input.fee,
    priceMax: input.priceMax,
    priceMin: input.priceMin,
    sender: input.sender,
    verificationClass: input.verificationClass,
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
