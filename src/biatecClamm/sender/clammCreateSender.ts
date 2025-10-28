import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import clammCreateTxs from '../txs/clammCreateTxs';
import { BiatecPoolProviderClient } from '../../../contracts/clients/BiatecPoolProviderClient';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammBootstrapSkInput {
  transactionSigner: TransactionSignerAccount;
  clientBiatecPoolProvider: BiatecPoolProviderClient;
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
const clammCreateSender = async (input: IClammBootstrapSkInput): Promise<BiatecClammPoolClient> => {
  const params = await input.clientBiatecPoolProvider.algorand.client.algod.getTransactionParams().do();
  const txs = await clammCreateTxs({
    appBiatecConfigProvider: input.appBiatecConfigProvider,
    assetA: input.assetA,
    assetB: input.assetB,
    clientBiatecPoolProvider: input.clientBiatecPoolProvider,
    currentPrice: input.currentPrice,
    fee: input.fee,
    priceMax: input.priceMax,
    priceMin: input.priceMin,
    sender: input.transactionSigner.addr.toString(),
    verificationClass: input.verificationClass,
    params,
  });
  const signed = await input.transactionSigner.signer(
    txs,
    txs.map((_, i) => i)
  );
  const { txid } = await input.clientBiatecPoolProvider.algorand.client.algod.sendRawTransaction(signed).do();
  const lastTxId = txs[txs.length - 1].txID();

  console.debug('lastTxId', lastTxId);
  const confirmation = await algosdk.waitForConfirmation(input.clientBiatecPoolProvider.algorand.client.algod, lastTxId, 4);
  if (!(confirmation.logs && confirmation.logs.length > 0)) {
    throw new Error(`Logs not found for${lastTxId}`);
  }
  const lastLog = confirmation.logs[confirmation.logs.length - 1];
  if (lastLog.length != 12) {
    throw new Error('Failed to parse the return value');
  }
  const poolAppId = BigInt(algosdk.decodeUint64(lastLog.subarray(4, 12)));

  console.debug('poolAppId', poolAppId);
  const newClient = new BiatecClammPoolClient({
    algorand: input.clientBiatecPoolProvider.algorand,
    appId: poolAppId,
    defaultSender: input.transactionSigner.addr,
    defaultSigner: input.transactionSigner.signer,
  });

  await newClient.send.bootstrapStep2({
    args: {},
    staticFee: AlgoAmount.MicroAlgo(2000),
    sender: input.transactionSigner.addr.toString(),
    signer: input.transactionSigner.signer,
  });

  // console.log('Pool deployed', newClient);

  return newClient;
};
export default clammCreateSender;
