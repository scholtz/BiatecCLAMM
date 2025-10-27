import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammAddLiquidityTxs from '../txs/clammAddLiquidityTxs';
import { BiatecPoolProviderClient } from '../../../contracts/clients/BiatecPoolProviderClient';

interface IClammBootstrapSkInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  clientBiatecPoolProvider: BiatecPoolProviderClient;
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

  const state = await input.clientBiatecClammPool.appClient.state.global.getAll();

  let optinSender: boolean = true;
  const acocunt = await input.algod.accountInformation(input.account.addr.toString()).do();
  if (!acocunt.assets?.find((a) => a.assetId === input.assetLp)) {
    optinSender = true;
  }

  // console.log('state', state);
  const txs = await clammAddLiquidityTxs({
    ...input,
    params,
    min: state.priceMin,
    max: state.priceMax,
    fee: state.fee,
    verificationClass: state.verificationClass,
    optinSender,
  });
  const signed = await input.account.signer(
    txs,
    Array.from(Array(txs.length), (_, i) => i)
  );
  const { txid } = await input.algod.sendRawTransaction(signed).do();
  return txid;
};
export default clammAddLiquiditySender;
