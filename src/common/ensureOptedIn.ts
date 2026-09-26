import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';

/**
 * Opts `signer` into `assetId` if it is not already opted in. No-op for the native asset (id 0).
 * Required before an account can receive an ASA via axfer - e.g. before removeLiquidityAdmin pays out fee
 * assets, or before a router swap deposits the output asset.
 */
const ensureOptedIn = async (algod: algosdk.Algodv2, signer: TransactionSignerAccount, assetId: bigint): Promise<void> => {
  if (assetId === 0n) return;
  try {
    await algod.accountAssetInformation(signer.addr, Number(assetId)).do();
    return; // already opted in
  } catch {
    // not opted in yet, fall through and opt in below
  }
  const suggestedParams = await algod.getTransactionParams().do();
  const tx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: signer.addr,
    receiver: signer.addr,
    amount: 0,
    assetIndex: assetId,
    suggestedParams,
  });
  const [signed] = await signer.signer([tx], [0]);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
};
export default ensureOptedIn;
