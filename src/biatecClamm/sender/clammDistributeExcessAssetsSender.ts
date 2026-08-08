import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammDistributeExcessAssetsTxs from '../txs/clammDistributeExcessAssetsTxs';
import sendRawTransactionWithErrorDecoding from '../../common/sendRawTransactionWithErrorDecoding';

interface IClammDistributeExcessAssetsInput {
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  amountA: bigint;
  amountB: bigint;
}
/**
 * Distributes excess assets to the pool owners
 *
 * @returns txid
 */
const clammDistributeExcessAssetsSender = async (input: IClammDistributeExcessAssetsInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await clammDistributeExcessAssetsTxs({
    ...input,
    params,
  });
  const signed = await input.account.signer(
    txs,
    Array.from(Array(txs.length), (_, i) => i)
  );
  return sendRawTransactionWithErrorDecoding(input.algod, signed, input.clientBiatecClammPool.appClient);
};
export default clammDistributeExcessAssetsSender;
