import algosdk, { AtomicTransactionComposer, SuggestedParams, assignGroupID } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import getBoxReferenceStats from '../../biatecPools/getBoxReferenceStats';

interface IClammBootstrapTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecPoolProvider: bigint;
  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
}
/**
 * Bootstrap the concentrated liquidity pool
 * This method creates list of transactions to be signed
 * @returns List of transactions to sign
 */
const clammBootstrapTxs = async (input: IClammBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const { params, clientBiatecClammPool, account, appBiatecPoolProvider, appBiatecConfigProvider, assetA, assetB } =
    input;

  // console.debug('boxes', boxes, Buffer.from(boxes[0].name).toString('hex'), Buffer.from(boxes[1].name).toString('hex'));
  const tx = await clientBiatecClammPool.createTransaction.bootstrapStep2({
    args: {},
    sender: account.addr,
    extraFee: algokit.microAlgos(5000),
    appReferences: [BigInt(appBiatecConfigProvider), BigInt(appBiatecPoolProvider)],
    assetReferences: [BigInt(assetA), BigInt(assetB)],
    accountReferences: [],
  });
  return tx.transactions;
};
export default clammBootstrapTxs;
