/* eslint-disable no-param-reassign */
import algosdk from 'algosdk';
import { biatecRouter, authTransaction } from 'biatec-router';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';

interface ExecuteRouterSwapInput {
  algod: algosdk.Algodv2;
  /** Base URL of the Biatec Router API, e.g. https://router.api.biatec.io */
  routerApiBaseUrl: string;
  signer: TransactionSignerAccount;
  fromAsset: bigint;
  toAsset: bigint;
  /** Amount to swap, in base units of fromAsset */
  amount: bigint;
  /** Slippage tolerance in basis points (100 = 1%) applied to the quoted output to derive receiveMinimum */
  slippageBps: number;
}

interface ExecuteRouterSwapResult {
  txId: string;
  quotedOutputAmount: bigint;
  receiveMinimum: bigint;
}

const assertSafeAmount = (amount: bigint, label: string): number => {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} (${amount}) exceeds Number.MAX_SAFE_INTEGER - the Biatec Router API takes amounts as JSON numbers`);
  }
  return Number(amount);
};

/**
 * Swaps `amount` of fromAsset to toAsset via the Biatec Router (https://github.com/scholtz/BiatecRouter), which
 * aggregates routes across Pact.Fi, Tinyman and Biatec DEX. Mirrors the documented flow in BiatecRouter's npm
 * README: ARC-14 auth (realm 'BiatecRouter#ARC14', built in from `authTransaction`), a quote to derive a
 * receiveMinimum slippage floor (enforced on-chain by the router contract, not just client-side), then
 * `postApiV1RouterRouteTxs` for the signable transaction group.
 */
const executeRouterSwap = async ({ algod, routerApiBaseUrl, signer, fromAsset, toAsset, amount, slippageBps }: ExecuteRouterSwapInput): Promise<ExecuteRouterSwapResult> => {
  biatecRouter.OpenAPI.BASE = routerApiBaseUrl;

  const suggestedParams = await algod.getTransactionParams().do();
  const authTx = await authTransaction(signer.addr.toString(), suggestedParams);
  const [authSigned] = await signer.signer([authTx], [0]);
  biatecRouter.OpenAPI.HEADERS = { Authorization: `SigTx ${Buffer.from(authSigned).toString('base64')}` };

  const swapAmount = assertSafeAmount(amount, 'swap amount');
  const quotedOutputAmountRaw = await biatecRouter.RouterService.getApiV1RouterQuote(Number(fromAsset), Number(toAsset), swapAmount);
  const quotedOutputAmount = BigInt(Math.trunc(quotedOutputAmountRaw ?? 0));
  if (quotedOutputAmount === 0n) {
    throw new Error(`Biatec Router found no route from asset ${fromAsset} to asset ${toAsset} for amount ${amount}`);
  }
  const receiveMinimum = (quotedOutputAmount * BigInt(10_000 - slippageBps)) / 10_000n;

  const response = await biatecRouter.RouterService.postApiV1RouterRouteTxs({
    sender: signer.addr.toString(),
    fromAsset: Number(fromAsset),
    toAsset: Number(toAsset),
    swapAmount,
    receiveMinimum: assertSafeAmount(receiveMinimum, 'receiveMinimum'),
    routesCount: 1,
    maxHops: 3,
  });

  const route = response.routes?.[0];
  if (!route?.txsToSign || route.txsToSign.length === 0) {
    throw new Error(`Biatec Router returned no executable route from asset ${fromAsset} to asset ${toAsset}`);
  }

  const transactions = route.txsToSign.map((txBase64) => {
    let txBytes = new Uint8Array(Buffer.from(txBase64, 'base64'));
    // some router responses prefix the msgpack payload with the "TX" domain separator
    if (txBytes.length > 2 && txBytes[0] === 0x54 && txBytes[1] === 0x58) {
      txBytes = txBytes.slice(2);
    }
    return algosdk.decodeUnsignedTransaction(txBytes);
  });
  transactions.forEach((tx) => {
    tx.group = undefined;
  });
  const groupId = algosdk.computeGroupID(transactions);
  transactions.forEach((tx) => {
    tx.group = groupId;
  });

  const signed = await signer.signer(
    transactions,
    transactions.map((_tx, i) => i)
  );
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);

  return { txId: txid, quotedOutputAmount, receiveMinimum };
};
export default executeRouterSwap;
