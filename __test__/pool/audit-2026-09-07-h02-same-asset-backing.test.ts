/* eslint-disable no-await-in-loop */
/**
 * Audit 2026-09-07, missing test scenario (High):
 * "Aggregate same-asset liabilities remain backed across all balance-changing methods"
 *
 * Acceptance criterion from H-02: after every successful balance-changing operation, total liabilities for each
 * physical asset must not exceed its spendable holding. In a same-asset (staking) pool both accounting sides
 * (assetABalanceBaseScale and assetBBalanceBaseScale) are claims on ONE physical holding, so they have to be summed.
 *
 * The defects documented here were fixed on 2026-09-26; these tests now guard the fixed behaviour.
 */
import { describe, expect, test } from '@jest/globals';
import { setupPool, deployer, deployerSigner, SCALE, fixture, algokit } from './shared-setup';
import createToken from '../../src/createToken';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';
import clammDistributeExcessAssetsSender from '../../src/biatecClamm/sender/clammDistributeExcessAssetsSender';
import clammWithdrawExcessAssetsSender from '../../src/biatecClamm/sender/clammWithdrawExcessAssetsSender';
import { aggregateBacking, balanceOf, expectAggregateBacked, newFundedAccount, optIn, readPoolAccounting, transfer } from './audit-2026-09-07-helpers';

const MICRO = 1_000_000n; // 6 decimals for ALGO and the test ASA
const TO_BASE = 1000n; // 6 decimals -> 9 decimals base scale

const stakingPool = async (asset: bigint) => {
  const ctx = await setupPool({
    assetA: asset,
    assetB: asset,
    biatecFee: 0n,
    lpFee: BigInt(SCALE / 100),
    p: BigInt(SCALE),
    p1: BigInt(SCALE),
    p2: BigInt(SCALE),
    useProvidedAssets: true,
  });
  const pool = ctx.clientBiatecClammPoolProvider.appClient;
  const { assetLp } = await readPoolAccounting(ctx.algod, pool);
  const ids = {
    appBiatecConfigProvider: BigInt(ctx.clientBiatecConfigProvider.appClient.appId),
    appBiatecIdentityProvider: BigInt(ctx.clientBiatecIdentityProvider.appClient.appId),
  };
  if (asset === 0n) {
    // keep the pool clear of the contract's fixed 1 ALGO native reserve so honest flows are not blocked by it
    await transfer(ctx.algod, deployer, pool.appAddress, 0n, 1n * MICRO);
  }
  const add = (account: typeof deployerSigner, a: bigint, b: bigint) =>
    clammAddLiquiditySender({
      algod: ctx.algod,
      account,
      ...ids,
      clientBiatecPoolProvider: ctx.clientBiatecPoolProvider.appClient,
      clientBiatecClammPool: pool,
      assetA: asset,
      assetB: asset,
      assetLp,
      assetADeposit: a,
      assetBDeposit: b,
    });
  const remove = (account: typeof deployerSigner, lpToSend: bigint) =>
    clammRemoveLiquiditySender({ algod: ctx.algod, account, ...ids, clientBiatecClammPool: pool, assetA: asset, assetB: asset, assetLp, lpToSend });
  const distribute = (amountA: bigint, amountB: bigint) =>
    clammDistributeExcessAssetsSender({
      algod: ctx.algod,
      account: deployerSigner,
      appBiatecConfigProvider: ids.appBiatecConfigProvider,
      assetA: asset,
      assetB: asset,
      amountA,
      amountB,
      clientBiatecClammPool: pool,
    });
  const withdrawExcess = (amountA: bigint, amountB: bigint) =>
    clammWithdrawExcessAssetsSender({
      algod: ctx.algod,
      account: deployerSigner,
      appBiatecConfigProvider: ids.appBiatecConfigProvider,
      assetA: asset,
      assetB: asset,
      amountA,
      amountB,
      clientBiatecClammPool: pool,
    });
  const backed = (label: string) => expectAggregateBacked(ctx.algod, pool, asset, asset, TO_BASE, TO_BASE, label);
  const backing = () => aggregateBacking(ctx.algod, pool, asset, asset, TO_BASE, TO_BASE);
  const donate = (amount: bigint) => transfer(ctx.algod, deployer, pool.appAddress, asset, amount);
  return { ...ctx, pool, assetLp, add, remove, distribute, withdrawExcess, backed, backing, donate };
};

/**
 * Runs an executive operation that must either be rejected or leave the aggregate backing intact.
 * Returns the backing rows when the operation went through.
 */
const expectRejectedOrBacked = async (op: () => Promise<unknown>, backing: () => ReturnType<typeof aggregateBacking>) => {
  let rejected = false;
  try {
    await op();
  } catch (e: any) {
    rejected = true;
    // eslint-disable-next-line no-console
    console.log('operation rejected:', String(e?.message ?? e).slice(0, 300));
  }
  if (rejected) return undefined;
  const rows = await backing();
  rows.forEach((row) => {
    // eslint-disable-next-line no-console
    console.log(`asset ${row.asset}: liabilities ${row.liabilities} vs spendable ${row.available}`);
    expect(row.liabilities).toBeLessThanOrEqual(row.available);
  });
  return rows;
};

describe('Audit 2026-09-07 H-02 - aggregate same-asset liabilities remain backed', () => {
  test('honest deposits, reward distribution, excess withdrawal and exits keep the aggregate backing (native staking pool)', async () => {
    const p = await stakingPool(0n);
    const { account: second, signer: secondSigner } = await newFundedAccount(p.algod, deployer, 60n * MICRO, []);

    await p.add(deployerSigner, 10n * MICRO, 10n * MICRO);
    await p.backed('after first deposit');
    await p.add(secondSigner, 5n * MICRO, 5n * MICRO);
    await p.backed('after second deposit');

    // staking reward received by the pool account and distributed explicitly
    await p.donate(3n * MICRO);
    await p.distribute(3n * MICRO * TO_BASE, 0n);
    await p.backed('after explicit reward distribution');

    // assets sent by mistake are returned by the fee executive
    await p.donate(2n * MICRO);
    await p.withdrawExcess(2n * MICRO, 0n);
    await p.backed('after excess withdrawal');

    const secondLp = await balanceOf(p.algod, second.addr, p.assetLp);
    await p.remove(secondSigner, secondLp / 2n);
    await p.backed('after partial exit');
    await p.remove(secondSigner, secondLp - secondLp / 2n);
    await p.backed('after full exit of the second provider');
    await p.remove(deployerSigner, await balanceOf(p.algod, deployer.addr, p.assetLp));
    const rows = await p.backed('after full exit of the first provider');
    // after everybody left only rounding dust may remain booked
    expect(rows[0].liabilities).toBeLessThan(10n);
  });

  test('distributeExcessAssets rejects a same-asset allocation that fits each side separately but not their sum (native)', async () => {
    const p = await stakingPool(0n);
    await p.add(deployerSigner, 10n * MICRO, 10n * MICRO);
    const [before] = await p.backing();
    // both sides record 10 ALGO, the account holds ~21.4 ALGO. Adding 10 ALGO to side A keeps side A (20) within the
    // holding and side B (10) within the holding, but the pool now owes 30 ALGO while holding 21.
    expect(before.liabilities).toBe(20n * MICRO);
    await expectRejectedOrBacked(() => p.distribute(10n * MICRO * TO_BASE, 0n), p.backing);
  });

  test('distributeExcessAssets rejects a same-asset allocation that fits each side separately but not their sum (ASA)', async () => {
    await fixture.newScope();
    const treasury = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(10_000_000) });
    const tokenId = BigInt(await createToken({ account: treasury, algod: fixture.context.algod, name: 'STK', decimals: 6 }));
    const p = await stakingPool(tokenId);
    // setupPool created a fresh deployer; give it some of the staking token
    await optIn(p.algod, deployer, tokenId);
    await transfer(p.algod, treasury, deployer.addr, tokenId, 100n * MICRO);
    await p.add(deployerSigner, 10n * MICRO, 10n * MICRO);
    const [before] = await p.backing();
    expect(before.liabilities).toBe(20n * MICRO);
    expect(before.available).toBe(20n * MICRO);
    await expectRejectedOrBacked(() => p.distribute(10n * MICRO * TO_BASE, 0n), p.backing);
  });

  test('withdrawExcessAssets rejects taking native funds that back the other accounting side', async () => {
    const p = await stakingPool(0n);
    await p.add(deployerSigner, 10n * MICRO, 10n * MICRO);
    await p.donate(5n * MICRO); // 5 ALGO of genuine excess
    // taking 10 ALGO leaves ~16 ALGO for 20 ALGO of claims; each side (10) still fits the holding on its own
    await expectRejectedOrBacked(() => p.withdrawExcess(10n * MICRO, 0n), p.backing);
  });

  test('the "distribute everything" sentinel (amountA = 1) books only the true excess of a same-asset pool', async () => {
    const p = await stakingPool(0n);
    const { account: second, signer: secondSigner } = await newFundedAccount(p.algod, deployer, 200n * MICRO, []);
    await p.add(deployerSigner, 20n * MICRO, 20n * MICRO);
    await p.add(secondSigner, 80n * MICRO, 80n * MICRO);
    await p.donate(10n * MICRO);
    // documented staking flow: amountA = 1 distributes the whole spendable balance as side A. In a same-asset pool
    // side B already claims 100 ALGO of that same balance; only the remaining ~11 ALGO may be booked as reward.
    let rejected = false;
    try {
      await p.distribute(1n, 0n);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(false);
    const [row] = await p.backing();
    // consequence when the aggregate check is missing: the first provider to leave over-collects (fair share is the
    // 40 ALGO principal plus 20% of the 10 ALGO reward = 42 ALGO) and the last one cannot redeem at all
    const before = await balanceOf(p.algod, deployer.addr, 0n);
    await p.remove(deployerSigner, await balanceOf(p.algod, deployer.addr, p.assetLp));
    const received = (await balanceOf(p.algod, deployer.addr, 0n)) - before;
    let secondExit = 'succeeded';
    try {
      await p.remove(secondSigner, await balanceOf(p.algod, second.addr, p.assetLp));
    } catch (e: any) {
      secondExit = `failed: ${String(e?.message ?? e).slice(0, 200)}`;
    }
    // eslint-disable-next-line no-console
    console.log(`sentinel distribution: liabilities ${row.liabilities} vs spendable ${row.available}; first exit received ${received} microAlgo (fair ~42000000); second exit ${secondExit}`);
    expect(row.liabilities).toBeLessThanOrEqual(row.available);
    expect(received).toBeLessThanOrEqual(43n * MICRO);
    expect(received).toBeGreaterThanOrEqual(41n * MICRO);
    expect(secondExit).toBe('succeeded');
  });
});
