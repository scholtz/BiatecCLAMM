import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import getBoxReferenceStats from '../../biatecPools/getBoxReferenceStats';

interface IClammSwapTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  appBiatecPoolProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  minimumToReceive: bigint;
  fromAsset: bigint;
  fromAmount: bigint;
}
/**
 * This method creates list of transactions to be signed to swap asset a or asset b at the biatec concentrated liquidity amm
 * @returns List of transactions to sign
 */
const clammSwapTxs = async (input: IClammSwapTxsInput): Promise<algosdk.Transaction[]> => {
  const {
    params,
    clientBiatecClammPool,
    account,
    appBiatecConfigProvider,
    appBiatecIdentityProvider,
    appBiatecPoolProvider,
    assetA,
    assetB,
    minimumToReceive,
    fromAsset,
    fromAmount,
  } = input;
  const atc = new AtomicTransactionComposer();

  const clammRef = await clientBiatecClammPool.appClient.getAppReference();
  let txSwap: algosdk.Transaction;

  if (fromAsset === 0n) {
    txSwap = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: fromAmount,
      from: account.addr,
      suggestedParams: params,
      to: clammRef.appAddress,
    });
  } else {
    txSwap = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: fromAmount,
      assetIndex: Number(fromAsset),
      from: account.addr,
      suggestedParams: params,
      to: clammRef.appAddress,
    });
  }
  const ammRef = await clientBiatecClammPool.appClient.getAppReference();
  const boxes = getBoxReferenceStats({
    appBiatecCLAMMPool: ammRef.appId,
    appBiatecPoolProvider,
    assetA,
    assetB,
    includingAssetBoxes: false,
  });

  await clientBiatecClammPool.swap(
    {
      appBiatecConfigProvider,
      appBiatecIdentityProvider,
      appBiatecPoolProvider,
      assetA,
      assetB,
      txSwap,
      minimumToReceive,
    },
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(12000),
        atc,
      },
      boxes,
      assets: [Number(assetA), Number(assetB)],
      accounts: [],
    }
  );
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammSwapTxs;
