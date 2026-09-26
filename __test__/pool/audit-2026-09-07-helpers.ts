/* eslint-disable no-await-in-loop */
/**
 * Shared helpers for the tests derived from the "Missing Test Scenarios" table of
 * audits/2026-09-07-audit-report-ai-github-copilot.md.
 */
import { expect } from '@jest/globals';
import algosdk from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecClammPoolClient } from '../../contracts/clients/BiatecClammPoolClient';
import { fixture, algokit } from './shared-setup';

export const LP_SCALE = 1000n; // LP token has 6 decimals, base scale has 9 -> 1 LP micro-unit = 1000 base units

export const signerFor = (account: algosdk.Account): TransactionSignerAccount => ({
  addr: account.addr,
  // eslint-disable-next-line no-unused-vars
  signer: async (txnGroup: algosdk.Transaction[], _indexesToSign: number[]) => txnGroup.map((tx) => tx.signTxn(account.sk)),
});

/**
 * Runs `send`, expects it to be rejected and checks the error text against `pattern`.
 * Prints the full decoded error text when the pattern does not match so a wrong reason is never confused with the expected one.
 */
export const expectLogicError = async (send: () => Promise<unknown>, pattern: RegExp): Promise<string> => {
  let message = '';
  let rejected = false;
  try {
    await send();
  } catch (e: any) {
    rejected = true;
    message = String(e?.message ?? e);
  }
  if (!rejected) {
    throw new Error(`Expected rejection matching ${pattern} but the call succeeded`);
  }
  if (!pattern.test(message)) {
    throw new Error(`Rejected for an unexpected reason. Expected ${pattern}, got: ${message}`);
  }
  return message;
};

export interface PoolAccounting {
  L: bigint; // Liquidity
  Lu: bigint; // LiquidityUsersFromFees
  Lb: bigint; // LiquidityBiatecFromFees
  balA: bigint; // assetABalanceBaseScale
  balB: bigint; // assetBBalanceBaseScale
  assetLp: bigint;
  price: bigint;
  /** LP tokens circulating outside the pool, in base scale */
  D: bigint;
}

const TOTAL_SUPPLY = 18_000_000_000_000_000_000n; // TOTAL_SUPPLY of the LP token in BiatecClammPool.algo.ts

export const readPoolAccounting = async (algod: algosdk.Algodv2, client: BiatecClammPoolClient): Promise<PoolAccounting> => {
  const state = await client.state.global.getAll();
  const assetLp = BigInt(state.assetLp ?? 0n);
  const held = await algod.accountAssetInformation(client.appClient.appAddress, assetLp).do();
  const D = (TOTAL_SUPPLY - BigInt(held.assetHolding?.amount ?? 0n)) * LP_SCALE;
  return {
    L: BigInt(state.liquidity ?? 0n),
    Lu: BigInt(state.liquidityUsersFromFees ?? 0n),
    Lb: BigInt(state.liquidityBiatecFromFees ?? 0n),
    balA: BigInt(state.assetABalanceBaseScale ?? 0n),
    balB: BigInt(state.assetBBalanceBaseScale ?? 0n),
    assetLp,
    price: BigInt(state.currentPrice ?? 0n),
    D,
  };
};

/** Balance of an account in the asset's own decimals. Asset 0 is the native token. */
export const balanceOf = async (algod: algosdk.Algodv2, addr: algosdk.Address | string, asset: bigint): Promise<bigint> => {
  const address = typeof addr === 'string' ? addr : addr.toString();
  if (asset === 0n) {
    const info = await algod.accountInformation(address).do();
    return BigInt(info.amount);
  }
  try {
    const info = await algod.accountAssetInformation(address, asset).do();
    return BigInt(info.assetHolding?.amount ?? 0n);
  } catch {
    return 0n;
  }
};

/**
 * Aggregate backing of a pool: recorded liabilities per physical asset versus what the pool can actually spend.
 * Both accounting sides of a same-asset pool refer to one holding, so they are summed.
 * For the native token the spendable amount is the balance above the account's real minimum balance, which is the
 * true solvency limit (the contract's own guard reserves a fixed 1 ALGO instead).
 */
export const aggregateBacking = async (algod: algosdk.Algodv2, client: BiatecClammPoolClient, assetA: bigint, assetB: bigint, scaleA: bigint, scaleB: bigint) => {
  const acc = await readPoolAccounting(algod, client);
  const poolAddr = client.appClient.appAddress;
  const liabilitiesA = acc.balA / scaleA;
  const liabilitiesB = acc.balB / scaleB;
  const available = async (asset: bigint) => {
    if (asset === 0n) {
      const info = await algod.accountInformation(poolAddr).do();
      return BigInt(info.amount) - BigInt(info.minBalance);
    }
    return balanceOf(algod, poolAddr, asset);
  };
  if (assetA === assetB) {
    return [{ asset: assetA, liabilities: liabilitiesA + liabilitiesB, available: await available(assetA) }];
  }
  return [
    { asset: assetA, liabilities: liabilitiesA, available: await available(assetA) },
    { asset: assetB, liabilities: liabilitiesB, available: await available(assetB) },
  ];
};

export const expectAggregateBacked = async (algod: algosdk.Algodv2, client: BiatecClammPoolClient, assetA: bigint, assetB: bigint, scaleA: bigint, scaleB: bigint, label: string) => {
  const rows = await aggregateBacking(algod, client, assetA, assetB, scaleA, scaleB);
  rows.forEach((row) => {
    if (row.liabilities > row.available) {
      throw new Error(`${label}: asset ${row.asset} liabilities ${row.liabilities} exceed spendable holding ${row.available}`);
    }
  });
  return rows;
};

/** Accounting invariant of the pool: Liquidity == distributedLp + Lu + Lb, up to the sub-micro-LP flooring remainder. */
export const expectAccountingInvariant = (acc: PoolAccounting, maxUnowned: bigint, label: string) => {
  const owned = acc.D + acc.Lu + acc.Lb;
  if (acc.L < owned) {
    throw new Error(`${label}: liquidity ${acc.L} is below the owned claims ${owned} (D=${acc.D} Lu=${acc.Lu} Lb=${acc.Lb})`);
  }
  const unowned = acc.L - owned;
  expect(unowned).toBeLessThanOrEqual(maxUnowned);
  return unowned;
};

const sendAndWait = async (algod: algosdk.Algodv2, txn: algosdk.Transaction, sk: Uint8Array) => {
  await algod.sendRawTransaction(txn.signTxn(sk)).do();
  await algosdk.waitForConfirmation(algod, txn.txID(), 4);
};

/** Sends `amount` of `asset` (0 = native) from `from` to `to`. */
export const transfer = async (algod: algosdk.Algodv2, from: algosdk.Account, to: algosdk.Address | string, asset: bigint, amount: bigint, note?: string) => {
  const suggestedParams = await algod.getTransactionParams().do();
  const receiver = typeof to === 'string' ? to : to.toString();
  const noteBytes = note ? new TextEncoder().encode(note) : undefined;
  const txn =
    asset === 0n
      ? algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: from.addr, receiver, amount, suggestedParams, note: noteBytes })
      : algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: from.addr, receiver, amount, assetIndex: asset, suggestedParams, note: noteBytes });
  await sendAndWait(algod, txn, from.sk);
};

export const optIn = async (algod: algosdk.Algodv2, account: algosdk.Account, asset: bigint) => {
  if (asset === 0n) return;
  const suggestedParams = await algod.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: account.addr, receiver: account.addr, amount: 0n, assetIndex: asset, suggestedParams });
  await sendAndWait(algod, txn, account.sk);
};

/**
 * Creates a fresh account funded with `algoMicro` native tokens, opted into `assets` and holding `amount` of each,
 * transferred from `treasury` (the deployer in the shared setup owns the whole supply of the test assets).
 */
export const newFundedAccount = async (algod: algosdk.Algodv2, treasury: algosdk.Account, algoMicro: bigint, assets: Array<{ id: bigint; amount: bigint }>) => {
  const account = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(Number(algoMicro)) });
  for (const a of assets) {
    if (a.id !== 0n) {
      await optIn(algod, account, a.id);
      if (a.amount > 0n) await transfer(algod, treasury, account.addr, a.id, a.amount);
    }
  }
  return { account, signer: signerFor(account) };
};

export const now = () => BigInt(Math.floor(Date.now() / 1000));

/** Decodes a bytes global-state value as returned by the generated clients (string, Uint8Array or BinaryStateValue). */
export const decodeStateBytes = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof (value as any).asString === 'function') return (value as any).asString();
  return Buffer.from(value as Uint8Array).toString('utf8');
};

/** Identity record accepted by BiatecIdentityProvider.setInfo (engagementSetter only). */
export const identityInfo = (overrides: Partial<Record<string, unknown>> = {}) => ({
  feeMultiplier: 2_000_000_000n,
  feeMultiplierBase: 1_000_000_000n,
  verificationStatus: 1n,
  verificationClass: 0n,
  isCompany: false,
  personUuid: '00000000-0000-0000-0000-000000000000',
  legalEntityUuid: '00000000-0000-0000-0000-000000000000',
  biatecEngagementPoints: 0n,
  biatecEngagementRank: 0n,
  avmEngagementPoints: 0n,
  avmEngagementRank: 0n,
  tradingEngagementPoints: 0n,
  tradingEngagementRank: 0n,
  isLocked: false,
  kycExpiration: 0n,
  investorForExpiration: 0n,
  isProfessionalInvestor: false,
  ...overrides,
});
