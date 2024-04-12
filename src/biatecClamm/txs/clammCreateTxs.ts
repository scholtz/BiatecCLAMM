import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammBootstrapTxsInput {
  params: SuggestedParams;
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
}
/**
 * This method creates list of transactions to be signed to add liquidity to the concentrated liquidity amm
 * @returns List of transactions to sign
 */
const clammCreateTxs = async (input: IClammBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const { clientBiatecClammPool, account } = input;

  const atc = new AtomicTransactionComposer();
  await clientBiatecClammPool.create.createApplication(
    {},
    {
      sender: account,
      updatable: true,
      sendParams: {
        fee: algokit.microAlgos(1000),
        atc,
      },
    }
  );
  return atc.buildGroup().map((tx) => tx.txn);
};
export default clammCreateTxs;
