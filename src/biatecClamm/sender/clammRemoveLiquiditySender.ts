import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammRemoveLiquidityTxs from '../txs/clammRemoveLiquidityTxs';

interface IClammRemoveLiquidityInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  lpToSend: bigint;
}
/**
 * User can remove the liqudity including fee rewards
 *
 * @returns txid
 */
const clammRemoveLiquiditySender = async (input: IClammRemoveLiquidityInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammRemoveLiquidityTxs({
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
export default clammRemoveLiquiditySender;
