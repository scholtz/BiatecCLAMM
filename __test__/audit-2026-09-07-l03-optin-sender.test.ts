/**
 * Audit 2026-09-07, missing test scenario (Low):
 * "LP opt-in is omitted when a holding already exists"
 *
 * L-03: clammAddLiquiditySender initialises optinSender to true and only ever assigns true again, so every deposit
 * carries a redundant LP self-transfer for existing holders. This is a pure SDK unit test: the transaction builder and
 * the network call are mocked and only the opt-in decision is inspected.
 *
 * The test marked `test.failing` documents the defect. It passes while the defect exists and starts failing once it
 * is fixed - at that point switch it to a plain `test`.
 */
import { describe, expect, jest, test } from '@jest/globals';
import algosdk from 'algosdk';
import clammAddLiquiditySender from '../src/biatecClamm/sender/clammAddLiquiditySender';
import clammAddLiquidityTxs from '../src/biatecClamm/txs/clammAddLiquidityTxs';
import sendRawTransactionWithErrorDecoding from '../src/common/sendRawTransactionWithErrorDecoding';

jest.mock('../src/biatecClamm/txs/clammAddLiquidityTxs');
jest.mock('../src/common/sendRawTransactionWithErrorDecoding');

const mockedTxs = clammAddLiquidityTxs as unknown as jest.Mock;
const mockedSend = sendRawTransactionWithErrorDecoding as unknown as jest.Mock;

const LP_ASSET = 12n;

/** Runs the sender against an account whose holdings are `assets` and returns the opt-in decision passed to the builder. */
const optInDecision = async (assets: Array<{ assetId: bigint; amount: bigint; isFrozen: boolean }>) => {
  mockedTxs.mockReset();
  mockedSend.mockReset();
  mockedTxs.mockImplementation(async () => []);
  mockedSend.mockImplementation(async () => 'TXID');
  const algod = {
    getTransactionParams: () => ({ do: async () => ({}) }),
    accountInformation: () => ({ do: async () => ({ assets }) }),
  } as unknown as algosdk.Algodv2;
  const clientBiatecClammPool = {
    appClient: { state: { global: { getAll: async () => ({ priceMin: 1n, priceMax: 1n, fee: 0n, verificationClass: 0n }) } } },
  } as any;
  const account = { addr: algosdk.generateAccount().addr, signer: async () => [] as Uint8Array[] };
  await clammAddLiquiditySender({
    algod,
    account,
    clientBiatecClammPool,
    clientBiatecPoolProvider: {} as any,
    appBiatecConfigProvider: 1n,
    appBiatecIdentityProvider: 2n,
    assetA: 10n,
    assetB: 11n,
    assetLp: LP_ASSET,
    assetADeposit: 1n,
    assetBDeposit: 1n,
  });
  expect(mockedTxs).toHaveBeenCalledTimes(1);
  return (mockedTxs.mock.calls[0] as any[])[0].optinSender as boolean;
};

describe('Audit 2026-09-07 L-03 - add-liquidity sender only opts in when needed', () => {
  test('requests an LP opt-in when the sender has no holding of the LP asset', async () => {
    expect(await optInDecision([{ assetId: 99n, amount: 5n, isFrozen: false }])).toBe(true);
    expect(await optInDecision([])).toBe(true);
  });

  test.failing('skips the LP opt-in when the sender already holds the LP asset, even with a zero balance', async () => {
    expect(await optInDecision([{ assetId: LP_ASSET, amount: 0n, isFrozen: false }])).toBe(false);
    expect(await optInDecision([{ assetId: LP_ASSET, amount: 1_000n, isFrozen: false }])).toBe(false);
  });
});
