import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammAddLiquidityTxs from '../txs/clammAddLiquidityTxs';

interface IClammBootstrapSkInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  assetADeposit: bigint;
  assetBDeposit: bigint;
}
/**
 * Add the liqudity to the concentrated liquidity AMM
 *
 * @returns txid
 */
const clammAddLiquiditySender = async (input: IClammBootstrapSkInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammAddLiquidityTxs({
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
export default clammAddLiquiditySender;
