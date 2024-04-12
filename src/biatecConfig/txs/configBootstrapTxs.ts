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
  const atc = new AtomicTransactionComposer();

  await clientBiatecConfigProvider.bootstrap(
    {
      biatecFee,
      appBiatecIdentityProvider,
      appBiatecPoolProvider,
    },
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(4000),
        atc,
      },
      boxes: [],
      assets: [],
      accounts: [],
    }
  );
  return atc.buildGroup().map((tx) => tx.txn);
};
export default bootstrapTxs;
