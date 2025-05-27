import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';
import clammBootstrapTxs from '../txs/clammBootstrapTxs';

interface IClammBootstrapSkInput {
  clientBiatecClammPool: BiatecClammPoolClient;

  appBiatecPoolProvider: bigint;
  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  fee: bigint;
  verificationClass: number;
}
/**
 * Setup the liqudity pool for concentrated liquidity AMM
 *
 * @returns txId
 */
const clammBootstrapSender = async (input: IClammBootstrapSkInput): Promise<string> => {
  const bootstrapResult = await input.clientBiatecClammPool.send.bootstrapStep2({
    args: {},
    assetReferences: [BigInt(input.assetA), BigInt(input.assetB)],
  });
  return bootstrapResult.txIds[0];
};
export default clammBootstrapSender;
