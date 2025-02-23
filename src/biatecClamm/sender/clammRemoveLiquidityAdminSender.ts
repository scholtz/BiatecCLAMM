import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammRemoveLiquidityAdminTxs from '../txs/clammRemoveLiquidityAdminTxs';

interface IClammRemoveLiquidityAdminInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  amount: bigint;
}
/**
 * Admin can remove the collected liquidity from fees
 *
 * @returns txid
 */
const clammRemoveLiquidityAdminSender = async (input: IClammRemoveLiquidityAdminInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammRemoveLiquidityAdminTxs({
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
export default clammRemoveLiquidityAdminSender;
