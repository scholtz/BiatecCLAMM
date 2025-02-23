import algosdk, { Algodv2 } from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';

interface ICreateGoldTokenInput {
  account: algosdk.Account;
  name: string;
  algod: Algodv2;
  decimals: number;
}
const createToken = async (input: ICreateGoldTokenInput) => {
  const params = await input.algod.getTransactionParams().do();
  const goldTokenTx = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: input.account.addr,
    reserve: input.account.addr,
    decimals: input.decimals,
    defaultFrozen: false,
    total: 1_000_000_000_000_000_000n,
    assetName: input.name,
    manager: input.account.addr,
    unitName: input.name,
    suggestedParams: params,
  });

  const tx = await input.algod.sendRawTransaction(goldTokenTx.signTxn(input.account.sk)).do();
  const tx2 = await algokit.waitForConfirmation(tx.txid, 3, input.algod);
  if (!tx2.assetIndex) throw Error('Asset not created');
  const goldToken = tx2.assetIndex;
  return goldToken;
};
export default createToken;
