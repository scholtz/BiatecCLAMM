import algosdk, { SuggestedParams } from 'algosdk';

// Realm used by the Biatec Trade Reporter API (AVM Trade Reporter / BiatecScan), matching the 'BiatecScan#ARC14'
// realm signed by BiatecDEX's src/service/authService.ts (which uses the 'arc14' npm package under the hood).
export const ARC14_REALM = 'BiatecScan#ARC14';

/**
 * Builds an ARC-14 (https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0014.md) Authorization header
 * value: a signed, zero-fee, self-payment transaction that is never submitted to the network - it only proves
 * control of the signing key to the API. The Biatec Trade Reporter API requires this header on its asset-stat
 * endpoint (confirmed: it returns HTTP 401 without it).
 */
const buildArc14AuthHeader = (account: algosdk.Account, suggestedParams: SuggestedParams): string => {
  const params: SuggestedParams = { ...suggestedParams, fee: 0n, minFee: 0n, flatFee: true };
  const tx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: account.addr,
    amount: 0,
    suggestedParams: params,
    note: new Uint8Array(Buffer.from(ARC14_REALM)),
  });
  const signed = tx.signTxn(account.sk);
  return `SigTx ${Buffer.from(signed).toString('base64')}`;
};
export default buildArc14AuthHeader;
