/**
 * Audit 2026-09-07, missing test scenario (Low):
 * "Non-default native names survive creation"
 *
 * L-02: the pool provider exposed setNativeTokenName, but BiatecClammPool.bootstrap hardcoded 'Algo' when it named
 * the LP token, ignoring that configuration entirely. The fix does not read the provider's configuration at all:
 * BiatecClammPool.bootstrap now derives the native token name purely from `globals.genesisHash` (see the GENESIS_*
 * constants next to it), so a provider misconfiguration can never make a pool mint a wrong native asset name. Every
 * chain not explicitly recognized - including every test/local network - falls back to 'Algo'.
 *
 * The defects documented here were fixed on 2026-09-26; these tests now guard the fixed behaviour.
 */
import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { setupPool, SCALE } from './shared-setup';
import { decodeStateBytes as decode } from './audit-2026-09-07-helpers';

const lpTokenParams = async (ctx: Awaited<ReturnType<typeof setupPool>>) => {
  const state = await ctx.clientBiatecClammPoolProvider.appClient.state.global.getAll();
  const lp = BigInt(state.assetLp ?? 0n);
  expect(lp).toBeGreaterThan(0n);
  const info = await ctx.algod.getAssetByID(lp).do();
  return { name: info.params?.name, unitName: info.params?.unitName };
};

// Genesis hashes as published at https://raw.githubusercontent.com/scholtz/AlgorandPublicData/refs/heads/main/genesis/genesis-list.json
// (fetched 2026-09-26), converted to hex the same way the contract's GENESIS_* constants are documented. Kept as a
// literal expectation, not fetched live, so this test never depends on network access or that URL staying reachable.
const GENESIS_HEX = {
  voiMainnet: 'af6d1f49023c8167bf90567388da2748f0972f0710987fe7c513af9e7b9e58e9',
  aramidMainnet: '3e0790549260c7f2d82897c8133edd6df34fb97983c89f8eec5c10e172fdb44f',
};

describe('Audit 2026-09-07 L-02 - non-default native token names survive pool creation', () => {
  test('a provider-configured native token name no longer influences the LP token name (regression guard)', async () => {
    // On this (local) network the genesis hash matches none of the recognized chains, so bootstrap must fall back to
    // 'Algo' regardless of what the provider is configured with. If this ever prints 'bVoi' again, the pool has
    // regressed to trusting BiatecPoolProvider's mutable, unauthenticated configuration for asset naming.
    const ctx = await setupPool({
      assetA: 0n,
      assetB: 0n,
      biatecFee: 0n,
      lpFee: BigInt(SCALE / 100),
      p: BigInt(SCALE),
      p1: BigInt(SCALE),
      p2: BigInt(SCALE),
      nativeTokenName: 'Voi',
      useProvidedAssets: true,
    });
    const providerState = await ctx.clientBiatecPoolProvider.appClient.state.global.getAll();
    expect(decode(providerState.nativeTokenName)).toBe('Voi'); // the provider still stores whatever it is told ...
    expect(await lpTokenParams(ctx)).toEqual({ name: 'bAlgo', unitName: 'Algo' }); // ... but the pool ignores it
  });

  test('an unrecognized chain names a native/ASA liquidity pool with the Algo fallback', async () => {
    const ctx = await setupPool({
      assetA: 0n,
      biatecFee: 0n,
      lpFee: BigInt(SCALE / 100),
      p: BigInt(SCALE),
      p1: BigInt(SCALE),
      p2: BigInt(2 * SCALE),
      nativeTokenName: 'Voi', // ignored by the pool; kept here to show the provider's setting has no effect
    });
    expect((await lpTokenParams(ctx)).name).toBe('B-Algo-USD');
  });

  test('the Voi and Aramid mainnet genesis hashes are embedded in the compiled approval program', () => {
    // Voi and Aramid mainnet cannot be reached from this local test network, so the per-chain branches are verified
    // at the bytecode level instead: the exact 32-byte genesis hash constants must appear in the compiled program.
    // A wrong hash here would silently misname every pool ever created on that chain.
    const approvalPath = join(__dirname, '../../contracts/artifacts/BiatecClammPool.approval.teal');
    const approval = readFileSync(approvalPath, 'utf8');
    expect(approval).toContain(`pushbytes 0x${GENESIS_HEX.voiMainnet}`);
    expect(approval).toContain(`pushbytes 0x${GENESIS_HEX.aramidMainnet}`);
  });
});
