import algosdk, { SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

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
  const purchaseAssetDepositTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    amount: 400000,
    from: account.addr,
    suggestedParams: params,
    to: clammRef.appAddress,
  });
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
        fee: algokit.microAlgos(4000),
      },
      boxes: [],
      assets: [Number(assetA), Number(assetB)],
      accounts: [],
    }
  );
  const atc = await compose.atc();
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammBootstrapTxs;
