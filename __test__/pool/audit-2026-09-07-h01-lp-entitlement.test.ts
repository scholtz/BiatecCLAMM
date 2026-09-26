/* eslint-disable no-await-in-loop */
/**
 * Audit 2026-09-07, missing test scenario (High):
 * "LP denomination conversion never exceeds conservative entitlement"
 *
 * Acceptance criterion from H-01: newly issued claims must not exceed the conservatively calculated entitlement,
 * including below-unit boundaries and pre-existing fee balances.
 */
import { describe, expect, test } from '@jest/globals';
import { setupPool, deployer, deployerSigner, assetAId, assetBId, SCALE } from './shared-setup';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';
import clammDistributeExcessAssetsSender from '../../src/biatecClamm/sender/clammDistributeExcessAssetsSender';
import { LP_SCALE, balanceOf, expectAccountingInvariant, expectLogicError, newFundedAccount, readPoolAccounting, transfer } from './audit-2026-09-07-helpers';

const A_TO_BASE = 10n; // asset A (EUR) has 8 decimals, base scale has 9
const B_TO_BASE = 1000n; // asset B (USD) has 6 decimals
const ROUNDING_ALLOWANCE = A_TO_BASE * B_TO_BASE + A_TO_BASE + B_TO_BASE; // getLiquidityRoundingAllowance() of the contract
// value of a deposit / withdrawal in base scale; the pools below are flat 1:1 so L = xBase + yBase
const valueBase = (a: bigint, b: bigint) => a * A_TO_BASE + b * B_TO_BASE;

const flatPool = () =>
  setupPool({
    assetA: 1n,
    biatecFee: 0n,
    lpFee: BigInt(SCALE / 100),
    p: BigInt(SCALE),
    p1: BigInt(SCALE),
    p2: BigInt(SCALE),
  });

describe('Audit 2026-09-07 H-01 - LP denomination conversion never exceeds conservative entitlement', () => {
  test('odd-sized deposits on top of existing fee liquidity never redeem more value than deposited', async () => {
    const { algod, clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await flatPool();
    const pool = clientBiatecClammPoolProvider.appClient;
    const { assetLp } = await readPoolAccounting(algod, pool);
    const common = {
      algod,
      appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
      appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
      clientBiatecClammPool: pool,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
    };
    const add = (account: typeof deployerSigner, a: bigint, b: bigint) =>
      clammAddLiquiditySender({ ...common, clientBiatecPoolProvider: clientBiatecPoolProvider.appClient, account, assetADeposit: a, assetBDeposit: b });
    const remove = (account: typeof deployerSigner, lpToSend: bigint) => clammRemoveLiquiditySender({ ...common, account, lpToSend });

    // incumbent liquidity provider
    const incumbentA = 100n * 10n ** 8n;
    const incumbentB = 100n * 10n ** 6n;
    await add(deployerSigner, incumbentA, incumbentB);

    // fee income booked as users' fee liquidity (Lu > 0): donate 10 USD and distribute it explicitly
    const rewardB = 10n * 10n ** 6n;
    await transfer(algod, deployer, pool.appAddress, assetBId, rewardB);
    await clammDistributeExcessAssetsSender({
      algod,
      account: deployerSigner,
      amountA: 0n,
      amountB: rewardB * B_TO_BASE,
      appBiatecConfigProvider: common.appBiatecConfigProvider,
      assetA: assetAId,
      assetB: assetBId,
      clientBiatecClammPool: pool,
    });
    const afterReward = await readPoolAccounting(algod, pool);
    expect(afterReward.Lu).toBeGreaterThan(0n);
    expectAccountingInvariant(afterReward, ROUNDING_ALLOWANCE, 'after reward');

    const { account: newcomer, signer: newcomerSigner } = await newFundedAccount(algod, deployer, 50_000_000n, [
      { id: assetAId, amount: 10n ** 9n },
      { id: assetBId, amount: 10n ** 8n },
    ]);

    // sizes chosen so that the base-scaled liquidity delta is not a multiple of one LP micro-unit
    const deposits: Array<[bigint, bigint]> = [
      [123_457n, 1_234n],
      [99_999n, 0n],
      [0n, 777n],
      [1_000_001n, 999n],
      [150n, 0n],
    ];
    let operations = 1n;
    for (const [a, b] of deposits) {
      const inBase = valueBase(a, b);
      const aBefore = await balanceOf(algod, newcomer.addr, assetAId);
      const bBefore = await balanceOf(algod, newcomer.addr, assetBId);
      const lpBefore = await balanceOf(algod, newcomer.addr, assetLp);

      await add(newcomerSigner, a, b);
      operations += 1n;
      const minted = (await balanceOf(algod, newcomer.addr, assetLp)) - lpBefore;
      expect(minted).toBeGreaterThan(0n);
      // conservative floor: the minted claim (in base scale) never exceeds the deposited liquidity
      expect(minted * LP_SCALE).toBeLessThanOrEqual(inBase);
      expectAccountingInvariant(await readPoolAccounting(algod, pool), operations * ROUNDING_ALLOWANCE, `after deposit ${a}/${b}`);

      await remove(newcomerSigner, minted);
      operations += 1n;
      const netA = (await balanceOf(algod, newcomer.addr, assetAId)) - aBefore;
      const netB = (await balanceOf(algod, newcomer.addr, assetBId)) - bBefore;
      const netBase = valueBase(netA, netB);
      // a round trip must never pay out more than was deposited ...
      expect(netBase).toBeLessThanOrEqual(0n);
      // ... and the depositor loses at most the flooring remainders (sub-micro-LP mint + per-asset payout flooring)
      expect(-netBase).toBeLessThanOrEqual(3n * LP_SCALE + A_TO_BASE);
      expectAccountingInvariant(await readPoolAccounting(algod, pool), operations * ROUNDING_ALLOWANCE, `after withdrawal ${a}/${b}`);
    }

    // the incumbent must still be able to take out everything it put in plus the whole reward
    const before = await readPoolAccounting(algod, pool);
    const unowned = before.L - (before.D + before.Lu + before.Lb);
    const incumbentLp = await balanceOf(algod, deployer.addr, assetLp);
    const aBefore = await balanceOf(algod, deployer.addr, assetAId);
    const bBefore = await balanceOf(algod, deployer.addr, assetBId);
    await remove(deployerSigner, incumbentLp);
    const received = valueBase((await balanceOf(algod, deployer.addr, assetAId)) - aBefore, (await balanceOf(algod, deployer.addr, assetBId)) - bBefore);
    const contributed = valueBase(incumbentA, incumbentB + rewardB);
    expect(received).toBeGreaterThanOrEqual(contributed - unowned - ROUNDING_ALLOWANCE - LP_SCALE);
    expect(received).toBeLessThanOrEqual(contributed + (before.L - before.D - before.Lu - before.Lb) + ROUNDING_ALLOWANCE);
  });

  test('deposits below one LP micro-unit are rejected atomically, also when fee liquidity already exists', async () => {
    const { algod, clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await flatPool();
    const pool = clientBiatecClammPoolProvider.appClient;
    const { assetLp } = await readPoolAccounting(algod, pool);
    const common = {
      algod,
      appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
      appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
      clientBiatecClammPool: pool,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
    };
    await clammAddLiquiditySender({ ...common, account: deployerSigner, assetADeposit: 100n * 10n ** 8n, assetBDeposit: 100n * 10n ** 6n });
    // Lu > 0 lowers the LP entitlement per unit of liquidity: X = delta * D / (D + Lu)
    const rewardB = 10n * 10n ** 6n;
    await transfer(algod, deployer, pool.appAddress, assetBId, rewardB);
    await clammDistributeExcessAssetsSender({
      algod,
      account: deployerSigner,
      amountA: 0n,
      amountB: rewardB * B_TO_BASE,
      appBiatecConfigProvider: common.appBiatecConfigProvider,
      assetA: assetAId,
      assetB: assetBId,
      clientBiatecClammPool: pool,
    });
    const { account: newcomer, signer } = await newFundedAccount(algod, deployer, 50_000_000n, [
      { id: assetAId, amount: 10n ** 6n },
      { id: assetBId, amount: 10n ** 6n },
    ]);
    const snapshot = async () => ({
      a: await balanceOf(algod, newcomer.addr, assetAId),
      b: await balanceOf(algod, newcomer.addr, assetBId),
      lp: await balanceOf(algod, newcomer.addr, assetLp),
      pool: await readPoolAccounting(algod, pool),
    });

    // 1 unit of the 8-decimal asset = 10 base units < 1000 base units of one LP micro-unit
    const s0 = await snapshot();
    await expectLogicError(() => clammAddLiquiditySender({ ...common, account: signer, assetADeposit: 1n, assetBDeposit: 0n }), /LP-ZERO-ERR/);
    // exactly 1000 base units would mint one LP micro-unit in an empty-fee pool, but with Lu > 0 the entitlement is
    // 1000 * D / (D + Lu) < 1000 -> still below one LP micro-unit -> rejected
    await expectLogicError(() => clammAddLiquiditySender({ ...common, account: signer, assetADeposit: 100n, assetBDeposit: 0n }), /LP-ZERO-ERR/);
    const s1 = await snapshot();
    // rejection rolled back both holdings and accounting
    expect(s1.a).toBe(s0.a);
    expect(s1.b).toBe(s0.b);
    expect(s1.lp).toBe(s0.lp);
    expect(s1.pool).toEqual(s0.pool);

    // 110 units = 1100 base units -> 1100 * D / (D + Lu) ~ 1047 -> exactly one LP micro-unit
    await clammAddLiquiditySender({ ...common, account: signer, assetADeposit: 110n, assetBDeposit: 0n });
    const s2 = await snapshot();
    expect(s2.lp - s1.lp).toBe(1n);
    await clammRemoveLiquiditySender({ ...common, account: signer, lpToSend: 1n });
    const s3 = await snapshot();
    expect(valueBase(s3.a - s1.a, s3.b - s1.b)).toBeLessThanOrEqual(0n);
  });
});
