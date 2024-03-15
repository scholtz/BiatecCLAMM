import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammBootstrapTxs from '../txs/clammBootstrapTxs';

interface IClammBootstrapSkInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecPoolProvider: bigint;
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
 * Setup the liqudity pool for concentrated liquidity AMM
 *
 * @returns txId
 */
const clammBootstrapSender = async (input: IClammBootstrapSkInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammBootstrapTxs({ ...input, params });
  const signed = await input.account.signer(
    txs,
    Array.from(Array(txs.length), (_, i) => i)
  );
  const { txId } = await input.algod.sendRawTransaction(signed).do();
  return txId;
};
export default clammBootstrapSender;
