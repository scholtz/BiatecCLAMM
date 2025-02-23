import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammWithdrawExcessAssetsTxs from '../txs/clammWithdrawExcessAssetsTxs';

interface IClammRemoveLiquidityInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  amountA: bigint;
  amountB: bigint;
}
/**
 * Biatec can withdraw excess assets from the pool
 *
 * @returns txid
 */
const clammWithdrawExcessAssetsSender = async (input: IClammRemoveLiquidityInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammWithdrawExcessAssetsTxs({
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
export default clammWithdrawExcessAssetsSender;
