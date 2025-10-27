import algosdk, { Algodv2 } from 'algosdk';

interface IDoAssetTransferInput {
  fromAccount: algosdk.Account;
  to: string;
  assetIndex: number;
  amount: number;
  algod: Algodv2;
}
const doAssetTransfer = async (input: IDoAssetTransferInput) => {
  const params = await input.algod.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: input.fromAccount.addr.toString(),
    receiver: input.to,
    amount: input.amount,
    assetIndex: input.assetIndex,
    suggestedParams: { ...params },
  });
  const signed = txn.signTxn(input.fromAccount.sk);
  return await input.algod.sendRawTransaction(signed).do();
};
export default doAssetTransfer;
