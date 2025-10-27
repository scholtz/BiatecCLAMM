import algosdk, { Algodv2 } from 'algosdk';
import doAssetTransfer from './doAssetTransfer';

interface IOptInToAssetInput {
  account: algosdk.Account;
  assetIndex: number;
  algod: Algodv2;
}
const optInToAsset = (input: IOptInToAssetInput) => {
  return doAssetTransfer({
    fromAccount: input.account,
    to: input.account.addr.toString(),
    assetIndex: input.assetIndex,
    amount: 0,
    algod: input.algod,
  });
};
export default optInToAsset;
