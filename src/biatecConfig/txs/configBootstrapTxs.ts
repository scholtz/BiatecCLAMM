import algosdk, { SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecConfigProviderClient } from '../../../contracts/clients/BiatecConfigProviderClient';

interface IConfigBootstrapTxsInput {
  params: SuggestedParams;
  clientBiatecConfigProvider: BiatecConfigProviderClient;
  account: TransactionSignerAccount;
  appIdentityProvider: bigint;
  biatecFee: bigint;
}
const bootstrapTxs = async (input: IConfigBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const { clientBiatecConfigProvider, account, appIdentityProvider, biatecFee } = input;

  const compose = clientBiatecConfigProvider.compose().bootstrap(
    {
      biatecFee,
      appIdentityProvider,
    },
    {
      sender: account,
      sendParams: {
        fee: algokit.microAlgos(4000),
      },
      boxes: [],
      assets: [],
      accounts: [],
    }
  );
  const atc = await compose.atc();
  return atc.buildGroup().map((tx) => tx.txn);
};
export default bootstrapTxs;
