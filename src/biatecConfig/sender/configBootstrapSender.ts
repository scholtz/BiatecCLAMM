import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecConfigProviderClient } from '../../../contracts/clients/BiatecConfigProviderClient';
import bootstrapTxs from '../txs/configBootstrapTxs';
import sendRawTransactionWithErrorDecoding from '../../common/sendRawTransactionWithErrorDecoding';

interface IConfigBootstrapSkInput {
  clientBiatecConfigProvider: BiatecConfigProviderClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecIdentityProvider: bigint;
  appBiatecPoolProvider: bigint;
  biatecFee: bigint;
}
/**
 * Setup the liqudity pool for concentrated liquidity AMM
 *
 * @returns txId
 */
const configBootstrapSender = async (input: IConfigBootstrapSkInput): Promise<string> => {
  const params = await input.algod.getTransactionParams().do();
  const txs = await bootstrapTxs({ ...input, params });
  const signed = await input.account.signer(
    txs,
    Array.from(Array(txs.length), (_, i) => i)
  );

  return sendRawTransactionWithErrorDecoding(input.algod, signed, input.clientBiatecConfigProvider.appClient);
};
export default configBootstrapSender;
