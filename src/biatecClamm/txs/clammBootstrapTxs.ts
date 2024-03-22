import algosdk, { SuggestedParams, assignGroupID } from 'algosdk';
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

  const clammRef = await clientBiatecClammPool.appClient.getAppReference();
  const fillInPoolProviderMBR = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    amount: 334300,
    from: account.addr,
    suggestedParams: params,
    to: algosdk.getApplicationAddress(appBiatecPoolProvider),
  });
  const purchaseAssetDepositTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    amount: 400000,
    from: account.addr,
    suggestedParams: params,
    to: clammRef.appAddress,
  });
  const ammRef = await clientBiatecClammPool.appClient.getAppReference();
  const boxes = getBoxReferenceStats({ appBiatecCLAMMPool: ammRef.appId, appBiatecPoolProvider, assetA, assetB });
  // console.debug('boxes', boxes, Buffer.from(boxes[0].name).toString('hex'), Buffer.from(boxes[1].name).toString('hex'));
  const compose = clientBiatecClammPool.compose().bootstrap(
    {
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
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(5000),
      },
      boxes,
      apps: [Number(appBiatecConfigProvider), Number(appBiatecPoolProvider)],
      assets: [Number(assetA), Number(assetB)],
      accounts: [],
    }
  );
  const atc = await compose.atc();
  const ret = [fillInPoolProviderMBR, ...atc.buildGroup().map((tx) => tx.txn)].map((tx: algosdk.Transaction) => {
    // eslint-disable-next-line no-param-reassign
    tx.group = undefined;
    return tx;
  });
  return assignGroupID(ret);
};
export default clammBootstrapTxs;
