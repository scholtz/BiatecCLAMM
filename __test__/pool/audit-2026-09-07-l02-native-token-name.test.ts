/**
 * Audit 2026-09-07, missing test scenario (Low):
 * "Non-default native names survive creation"
 *
 * L-02: the pool provider exposes setNativeTokenName, but BiatecClammPool.bootstrap hardcodes 'Algo' when it names
 * the LP token. The existing "custom name" test used the default 'Algo' and therefore could not tell the two apart.
 *
 * The defects documented here were fixed on 2026-09-26; these tests now guard the fixed behaviour.
 */
import { describe, expect, test } from '@jest/globals';
import { setupPool, SCALE } from './shared-setup';
import { decodeStateBytes as decode } from './audit-2026-09-07-helpers';

const lpTokenParams = async (ctx: Awaited<ReturnType<typeof setupPool>>) => {
  const state = await ctx.clientBiatecClammPoolProvider.appClient.state.global.getAll();
  const lp = BigInt(state.assetLp ?? 0n);
  expect(lp).toBeGreaterThan(0n);
  const info = await ctx.algod.getAssetByID(lp).do();
  return { name: info.params?.name, unitName: info.params?.unitName };
};

describe('Audit 2026-09-07 L-02 - non-default native token names survive pool creation', () => {
  test('the pool provider stores a genuinely non-default native token name', async () => {
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
    const state = await ctx.clientBiatecPoolProvider.appClient.state.global.getAll();
    expect(decode(state.nativeTokenName)).toBe('Voi');
  });

  test('a native staking pool names its LP token after the configured native token', async () => {
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
    expect(await lpTokenParams(ctx)).toEqual({ name: 'bVoi', unitName: 'Voi' });
  });

  test('a native/ASA liquidity pool names its LP token after the configured native token', async () => {
    const ctx = await setupPool({
      assetA: 0n,
      biatecFee: 0n,
      lpFee: BigInt(SCALE / 100),
      p: BigInt(SCALE),
      p1: BigInt(SCALE),
      p2: BigInt(2 * SCALE),
      nativeTokenName: 'Voi',
    });
    expect((await lpTokenParams(ctx)).name).toBe('B-Voi-USD');
  });
});
