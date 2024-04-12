import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammBootstrapTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  assetADeposit: bigint;
  assetBDeposit: bigint;
}
/**
 * This method creates list of transactions to be signed to add liquidity to the concentrated liquidity amm
 * @returns List of transactions to sign
 */
const clammAddLiquidityTxs = async (input: IClammBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const {
    params,
    clientBiatecClammPool,
    account,
    appBiatecConfigProvider,
    appBiatecIdentityProvider,
    assetA,
    assetB,
    assetLp,
    assetADeposit,
    assetBDeposit,
  } = input;

  const clammRef = await clientBiatecClammPool.appClient.getAppReference();
  let txAssetADeposit: algosdk.Transaction;
  let txAssetBDeposit: algosdk.Transaction;
  if (assetA === 0n) {
    txAssetADeposit = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: assetADeposit,
      from: account.addr,
      suggestedParams: params,
      to: clammRef.appAddress,
    });
  } else {
    txAssetADeposit = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: assetADeposit,
      assetIndex: Number(assetA),
      from: account.addr,
      suggestedParams: params,
      to: clammRef.appAddress,
    });
  }

  if (assetB === 0n) {
    txAssetBDeposit = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: assetBDeposit,
      from: account.addr,
      suggestedParams: params,
      to: clammRef.appAddress,
    });
  } else {
    txAssetBDeposit = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: assetBDeposit,
      assetIndex: Number(assetB),
      from: account.addr,
      suggestedParams: params,
      to: clammRef.appAddress,
    });
  }
  const atc = new AtomicTransactionComposer();

  await clientBiatecClammPool.addLiquidity(
    {
      appBiatecConfigProvider,
      appBiatecIdentityProvider,
      txAssetADeposit,
      txAssetBDeposit,
      assetA,
      assetB,
      assetLp,
    },
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(4000),
        atc,
      },
      boxes: [],
      assets: [Number(assetA), Number(assetB)],
      accounts: [],
    }
  );
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammAddLiquidityTxs;
