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
  fee: bigint;
  verificationClass: number;
  priceMin: bigint;
  priceMax: bigint;
  currentPrice: bigint;
}
/**
 * Bootstrap the concentrated liquidity pool
 * This method creates list of transactions to be signed
 * @returns List of transactions to sign
 */
const clammBootstrapTxs = async (input: IClammBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const {
    params,
    clientBiatecClammPool,
    account,
    appBiatecPoolProvider,
    appBiatecConfigProvider,
    assetA,
    assetB,
    fee,
    verificationClass,
    priceMin,
    priceMax,
    currentPrice,
  } = input;

  const fillInPoolProviderMBR = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    amount: 666800,
    sender: account.addr,
    suggestedParams: params,
    receiver: algosdk.getApplicationAddress(appBiatecPoolProvider),
  });
  const purchaseAssetDepositTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    amount: 400000,
    sender: account.addr,
    suggestedParams: params,
    receiver: clientBiatecClammPool.appAddress,
  });
  const boxes = getBoxReferenceStats({
    appBiatecCLAMMPool: clientBiatecClammPool.appId,
    appBiatecPoolProvider,
    assetA,
    assetB,
    includingAssetBoxes: true,
  });
  // console.debug('boxes', boxes, Buffer.from(boxes[0].name).toString('hex'), Buffer.from(boxes[1].name).toString('hex'));
  const tx = await clientBiatecClammPool.createTransaction.bootstrap({
    args: {
      assetA,
      assetB,
      appBiatecPoolProvider,
      appBiatecConfigProvider,
      txSeed: purchaseAssetDepositTx,
      fee,
      verificationClass,
      priceMin,
      priceMax,
      currentPrice,
    },
    sender: account.addr,
    extraFee: algokit.microAlgos(5000),
    boxReferences: boxes,
    appReferences: [BigInt(appBiatecConfigProvider), BigInt(appBiatecPoolProvider)],
    assetReferences: [BigInt(assetA), BigInt(assetB)],
    accountReferences: [],
  });
  const txsToGroup = [fillInPoolProviderMBR];
  tx.transactions.map((tx) => txsToGroup.push(tx));
  const ret = txsToGroup.map((tx: algosdk.Transaction) => {
    tx.group = undefined;
    return tx;
  });
  return assignGroupID(ret);
};
export default clammBootstrapTxs;
