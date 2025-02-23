import algosdk, { AtomicTransactionComposer, SuggestedParams } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolFactory } from '../../../contracts/clients/BiatecClammPoolClient';

interface IClammBootstrapTxsInput {
  params: SuggestedParams;
  biatecClammPoolFactory: BiatecClammPoolFactory;
  account: TransactionSignerAccount;
}
/**
 * This method creates list of transactions to be signed to add liquidity to the concentrated liquidity amm
 * @returns List of transactions to sign
 */
const clammCreateTxs = async (input: IClammBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const { biatecClammPoolFactory, account } = input;
  const tx = await biatecClammPoolFactory.createTransaction.create.createApplication({
    args: {},
    sender: account.addr,
    updatable: true,
  });
  return tx.transactions;
};
export default clammCreateTxs;
