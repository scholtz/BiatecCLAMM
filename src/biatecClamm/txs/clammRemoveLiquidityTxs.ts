import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammRemoveLiquidityTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLp: bigint;
  lpToSend: bigint;
}
/**
 * This method creates list of transactions to be signed to remove liquidity from the concentrated liquidity amm pool
 * @returns List of transactions to sign
 */
const clammRemoveLiquidityTxs = async (input: IClammRemoveLiquidityTxsInput): Promise<algosdk.Transaction[]> => {
  const {
    params,
    clientBiatecClammPool,
    account,
    appBiatecConfigProvider,
    appBiatecIdentityProvider,
    assetA,
    assetB,
    assetLp,
    lpToSend,
  } = input;
  const atc = new AtomicTransactionComposer();

  const clammRef = await clientBiatecClammPool.appClient.getAppReference();
  const txLpXfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    amount: lpToSend,
    assetIndex: Number(assetLp),
    from: account.addr,
    suggestedParams: params,
    to: clammRef.appAddress,
  });

  await clientBiatecClammPool.removeLiquidity(
    {
      appBiatecConfigProvider,
      appBiatecIdentityProvider,
      assetA,
      assetB,
      assetLp,
      txLpXfer,
    },
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(12000),
        atc,
      },
      apps: [Number(appBiatecConfigProvider), Number(appBiatecIdentityProvider)],
      assets: [Number(assetA), Number(assetB)],
      accounts: [],
    }
  );
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammRemoveLiquidityTxs;
