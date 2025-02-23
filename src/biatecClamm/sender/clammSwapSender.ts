import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammSwapTxs from '../txs/clammSwapTxs';

interface IClammSwapInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  appBiatecPoolProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  minimumToReceive: bigint;
  fromAsset: bigint;
  fromAmount: bigint;
}
/**
 * Swap asset a or asset b at the biatec concentrated liquidity amm
 *
 * @returns txid
 */
const clammSwapSender = async (input: IClammSwapInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammSwapTxs({
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
export default clammSwapSender;
