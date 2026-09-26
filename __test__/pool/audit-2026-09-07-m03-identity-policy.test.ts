/**
 * Audit 2026-09-07, missing test scenario (Medium):
 * "Identity expiry, pause, and withdrawal policy are explicit and tested"
 *
 * Acceptance criterion from M-03: before/at/after-expiry behavior matches the approved policy for trading, deposits
 * and withdrawals. The contracts do not evaluate expiry on chain today; the last test pins that down explicitly so a
 * future policy decision has to change it consciously.
 */
import { describe, expect, test } from '@jest/globals';
import { setupPool, deployer, deployerSigner, assetAId, assetBId, SCALE } from './shared-setup';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';
import clammSwapSender from '../../src/biatecClamm/sender/clammSwapSender';
import { balanceOf, expectLogicError, identityInfo, now, readPoolAccounting, transfer } from './audit-2026-09-07-helpers';

const A = 10n ** 8n; // 1 EUR (8 decimals)
const B = 10n ** 6n; // 1 USD (6 decimals)

const build = async (verificationClass = 0) => {
  const ctx = await setupPool({
    assetA: 1n,
    biatecFee: 0n,
    lpFee: BigInt(SCALE / 100),
    p: BigInt(SCALE),
    p1: BigInt(SCALE),
    p2: BigInt(SCALE),
    verificationClass,
  });
  const pool = ctx.clientBiatecClammPoolProvider.appClient;
  const { assetLp } = await readPoolAccounting(ctx.algod, pool);
  const ids = {
    appBiatecConfigProvider: BigInt(ctx.clientBiatecConfigProvider.appClient.appId),
    appBiatecIdentityProvider: BigInt(ctx.clientBiatecIdentityProvider.appClient.appId),
    appBiatecPoolProvider: BigInt(ctx.clientBiatecPoolProvider.appClient.appId),
  };
  const add = (a: bigint, b: bigint) =>
    clammAddLiquiditySender({
      algod: ctx.algod,
      account: deployerSigner,
      appBiatecConfigProvider: ids.appBiatecConfigProvider,
      appBiatecIdentityProvider: ids.appBiatecIdentityProvider,
      clientBiatecPoolProvider: ctx.clientBiatecPoolProvider.appClient,
      clientBiatecClammPool: pool,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: a,
      assetBDeposit: b,
    });
  const remove = (lpToSend: bigint) =>
    clammRemoveLiquiditySender({
      algod: ctx.algod,
      account: deployerSigner,
      appBiatecConfigProvider: ids.appBiatecConfigProvider,
      appBiatecIdentityProvider: ids.appBiatecIdentityProvider,
      clientBiatecClammPool: pool,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend,
    });
  const swap = (fromAmount: bigint) =>
    clammSwapSender({
      algod: ctx.algod,
      account: deployerSigner,
      ...ids,
      clientBiatecClammPool: pool,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetAId,
      fromAmount,
      minimumToReceive: 0n,
    });
  const setIdentity = async (overrides: Parameters<typeof identityInfo>[0]) => {
    await ctx.clientBiatecIdentityProvider.appClient.send.setInfo({ args: { user: deployer.addr.toString(), info: identityInfo(overrides) } });
  };
  // identity boxes need minimum balance in the identity contract
  await transfer(ctx.algod, deployer, ctx.clientBiatecIdentityProvider.appClient.appAddress, 0n, 1_000_000n);
  const setPaused = (a: bigint) => ctx.clientBiatecConfigProvider.appClient.send.setPaused({ args: { a } });
  const lpHeld = () => balanceOf(ctx.algod, deployer.addr, assetLp);
  return { ...ctx, pool, assetLp, add, remove, swap, setIdentity, setPaused, lpHeld };
};

describe('Audit 2026-09-07 M-03 - identity expiry, pause and withdrawal policy', () => {
  test('pause blocks deposits, swaps and withdrawals; unpause restores all three', async () => {
    const p = await build();
    await p.add(10n * A, 10n * B);
    const lpBefore = await p.lpHeld();

    await p.setPaused(1n);
    await expectLogicError(() => p.add(A, B), /E_PAUSED/);
    await expectLogicError(() => p.swap(A / 100n), /E_PAUSED/);
    // note: the kill switch also freezes principal withdrawals
    await expectLogicError(() => p.remove(lpBefore / 2n), /E_PAUSED/);
    expect(await p.lpHeld()).toBe(lpBefore);

    await p.setPaused(0n);
    await p.add(A, B);
    await p.swap(A / 100n);
    await p.remove(lpBefore / 2n);
    expect(await p.lpHeld()).toBeGreaterThan(lpBefore / 2n);
  });

  test('a locked identity can neither deposit nor withdraw its principal until unlocked (current policy)', async () => {
    const p = await build();
    await p.add(10n * A, 10n * B);
    const lpBefore = await p.lpHeld();

    await p.setIdentity({ isLocked: true });
    await expectLogicError(() => p.add(A, B), /ERR-USER-LOCKED/);
    await expectLogicError(() => p.swap(A / 100n), /ERR-USER-LOCKED/);
    await expectLogicError(() => p.remove(lpBefore), /ERR-USER-LOCKED/);
    expect(await p.lpHeld()).toBe(lpBefore);

    await p.setIdentity({ isLocked: false });
    await p.remove(lpBefore);
    expect(await p.lpHeld()).toBe(0n);
  });

  test('a pool requiring verification class 1 rejects unverified users and accepts a verified one', async () => {
    const p = await build(1);
    // no identity record -> class 0
    await expectLogicError(() => p.add(10n * A, 10n * B), /ERR-LOW-VER/);
    expect(await p.lpHeld()).toBe(0n);

    await p.setIdentity({ verificationClass: 1n, kycExpiration: now() + 3600n });
    await p.add(10n * A, 10n * B);
    expect(await p.lpHeld()).toBeGreaterThan(0n);

    // downgrade after the fact: deposits and trades stop, the principal can still be withdrawn
    await p.setIdentity({ verificationClass: 0n });
    await expectLogicError(() => p.add(A, B), /ERR-LOW-VER/);
    await expectLogicError(() => p.swap(A / 100n), /ERR-LOW-VER/);
    await expectLogicError(async () => p.remove(await p.lpHeld()), /ERR-LOW-VER/);
  });

  test('identity expiry is NOT evaluated on chain: an expired KYC record keeps full access (documents the open M-03 policy)', async () => {
    const p = await build(1);
    const expired = 1n; // 1970-01-01T00:00:01Z
    await p.setIdentity({ verificationClass: 1n, kycExpiration: expired, investorForExpiration: expired });
    const user = await p.clientBiatecIdentityProvider.appClient.send.getUser({ args: { user: deployer.addr.toString(), v: 1 } });
    expect(BigInt(user.return?.kycExpiration ?? 0n)).toBeLessThan(now());

    // If the approved policy is that expiry ends eligibility automatically, these three calls must be rejected and
    // this test has to be inverted together with the contract change.
    await p.add(10n * A, 10n * B);
    await p.swap(A / 100n);
    await p.remove(await p.lpHeld());
    expect(await p.lpHeld()).toBe(0n);
  });
});
