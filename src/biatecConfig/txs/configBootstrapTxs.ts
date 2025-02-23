import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecConfigProviderClient } from '../../../contracts/clients/BiatecConfigProviderClient';

interface IConfigBootstrapTxsInput {
  params: SuggestedParams;
  clientBiatecConfigProvider: BiatecConfigProviderClient;
  account: TransactionSignerAccount;
  appBiatecIdentityProvider: bigint;
  appBiatecPoolProvider: bigint;
  biatecFee: bigint;
}
const bootstrapTxs = async (input: IConfigBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const { clientBiatecConfigProvider, account, appBiatecIdentityProvider, appBiatecPoolProvider, biatecFee } = input;
  const tx = await clientBiatecConfigProvider.createTransaction.bootstrap({
    args: {
      biatecFee,
      appBiatecIdentityProvider,
      appBiatecPoolProvider,
    },
    sender: account.addr,
    maxFee: algokit.microAlgos(4000),
    boxReferences: [],
    assetReferences: [],
    accountReferences: [],
  });
  return tx.transactions;
};
export default bootstrapTxs;
