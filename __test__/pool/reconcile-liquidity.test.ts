/* eslint-disable no-console */
/**
 * reconcileLiquidity books liquidity which is owned by nobody:
 *   unowned = Liquidity - distributedLp - LiquidityUsersFromFees - LiquidityBiatecFromFees
 * to the LP holders (Lu) while LP tokens circulate, or to biatec (Lb) when no LP token circulates.
 *
 * With the fixed contract the only unowned liquidity that can arise is the sub-micro-LP flooring remainder of a
 * deposit (< 1000 base units), which is what these tests use to exercise both branches.
 */
import { describe, expect, test } from '@jest/globals';
import { setupPool, deployer, deployerSigner, assetAId, assetBId, fixture, algokit } from './shared-setup';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';
import clammRemoveLiquidityAdminSender from '../../src/biatecClamm/sender/clammRemoveLiquidityAdminSender';

const TOTAL_LP_SUPPLY = 18_000_000_000_000_000_000n;
const LP_SCALE = 1000n;

describe('BiatecClammPool - reconcileLiquidity', () => {
  test('books unowned liquidity to LP holders while LP circulates and to biatec when the pool has no LP holders', async () => {
    const { algod, clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
      assetA: 1n,
      biatecFee: 0n,
      lpFee: 0n,
      p: 1_000_000_000n,
      p1: 1_000_000_000n,
      p2: 1_000_000_000n,
    });
    const poolClient = clientBiatecClammPoolProvider.appClient;
    const poolAddress = poolClient.appAddress.toString();
    const assetLp = BigInt((await poolClient.state.global.getAll()).assetLp ?? 0n);
    expect(assetLp).toBeGreaterThan(0n);

    const holding = async (address: string, asset: bigint): Promise<bigint> => {
      try {
        const info = await algod.accountAssetInformation(address, asset).do();
        return BigInt(info.assetHolding?.amount ?? 0n);
      } catch {
        return 0n;
      }
    };
    const readState = async () => {
      const s = await poolClient.state.global.getAll();
      const lpInPool = await holding(poolAddress, assetLp);
      const L = BigInt(s.liquidity ?? 0n);
      const Lu = BigInt(s.liquidityUsersFromFees ?? 0n);
      const Lb = BigInt(s.liquidityBiatecFromFees ?? 0n);
      const D = (TOTAL_LP_SUPPLY - lpInPool) * LP_SCALE;
      return { L, Lu, Lb, D, unowned: L - D - Lu - Lb, ab: BigInt(s.assetABalanceBaseScale ?? 0n), bb: BigInt(s.assetBBalanceBaseScale ?? 0n) };
    };
    const common = {
      algod,
      account: deployerSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
    };
    const reconcileArgs = { appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId, assetA: assetAId, assetB: assetBId, assetLp };
    let callNo = 0;
    const reconcile = async () => {
      callNo += 1;
      // unique note: consecutive identical calls would otherwise share a transaction id
      const result = await poolClient.send.reconcileLiquidity({ args: reconcileArgs, sender: deployer.addr, signer: deployerSigner.signer, note: new Uint8Array(Buffer.from(`reconcile-${callNo}`)) });
      return BigInt(result.return ?? 0n);
    };

    // 1. in-ratio deposit: 1 A (8 decimals) + 1 B (6 decimals) -> 2 LP exactly, nothing unowned
    await clammAddLiquiditySender({ ...common, clientBiatecPoolProvider: clientBiatecPoolProvider.appClient, assetADeposit: 100_000_000n, assetBDeposit: 1_000_000n });
    const s1 = await readState();
    console.log('after deposit 1', s1);
    expect(s1.D).toBeGreaterThan(0n);
    expect(s1.Lu).toBe(0n);
    expect(s1.unowned).toBe(0n);
    expect(await reconcile()).toBe(0n); // consistent pool -> nothing to book, state untouched
    expect(await readState()).toEqual(s1);

    // 2. deposits which do not divide into whole LP micro-units leave flooring dust that nobody owns
    //    (120 base units of the 8-decimal asset = 1200 base-scale liquidity -> 1 micro-LP + 200 dust, etc.)
    for (const amount of [120n, 130n, 140n]) {
      // eslint-disable-next-line no-await-in-loop
      await clammAddLiquiditySender({ ...common, clientBiatecPoolProvider: clientBiatecPoolProvider.appClient, assetADeposit: amount, assetBDeposit: 0n });
    }
    const s2 = await readState();
    console.log('after dust deposits', s2);
    expect(s2.Lu).toBe(0n); // no swap happened -> still no fee income
    expect(s2.unowned).toBeGreaterThan(0n);
    expect(s2.unowned).toBeLessThan(3n * LP_SCALE);

    // 3. only the fee executor may reconcile
    const stranger = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(5_000_000) });
    await expect(
      poolClient.send.reconcileLiquidity({
        args: reconcileArgs,
        sender: stranger.addr,
        signer: async (txns: any[]) => txns.map((tx) => tx.signTxn(stranger.sk)),
      })
    ).rejects.toThrow(/ERR-EXEC-ONLY/);
    expect(await readState()).toEqual(s2);

    // 4. LP tokens circulate -> the unowned liquidity is credited to the LP holders (Lu)
    const credited = await reconcile();
    expect(credited).toBe(s2.unowned);
    const s3 = await readState();
    expect(s3.L).toBe(s2.L);
    expect(s3.D).toBe(s2.D);
    expect(s3.Lb).toBe(0n);
    expect(s3.Lu).toBe(s2.Lu + credited);
    expect(s3.unowned).toBe(0n);
    // idempotent
    expect(await reconcile()).toBe(0n);
    expect(await readState()).toEqual(s3);

    // 5. the LP holder redeems everything, including the reconciled liquidity
    const aBefore = await holding(deployer.addr.toString(), assetAId);
    const bBefore = await holding(deployer.addr.toString(), assetBId);
    const lpHeld = await holding(deployer.addr.toString(), assetLp);
    expect(lpHeld * LP_SCALE).toBe(s3.D);
    await clammRemoveLiquiditySender({ ...common, lpToSend: lpHeld });
    const aReceived = (await holding(deployer.addr.toString(), assetAId)) - aBefore;
    const bReceived = (await holding(deployer.addr.toString(), assetBId)) - bBefore;
    const s4 = await readState();
    console.log('after full redemption', s4, { aReceived, bReceived });
    expect(s4.D).toBe(0n);
    expect(s4.Lu).toBe(0n);
    // deposited 1 A + 390 base units of A and 1 B; only rounding below one asset unit per floor may stay behind
    expect(aReceived).toBeGreaterThanOrEqual(100_000_000n + 390n - 3n);
    expect(aReceived).toBeLessThanOrEqual(100_000_000n + 390n);
    expect(bReceived).toBeGreaterThanOrEqual(1_000_000n - 1n);
    expect(bReceived).toBeLessThanOrEqual(1_000_000n);
    // whatever is left is below one LP micro-unit and owned by nobody
    expect(s4.unowned).toBe(s4.L);
    expect(s4.L).toBeLessThan(LP_SCALE * 3n);

    // 6. no LP tokens circulate -> unowned liquidity goes to biatec and can be withdrawn by the fee executor
    const credited2 = await reconcile();
    expect(credited2).toBe(s4.unowned);
    const s5 = await readState();
    expect(s5.Lb).toBe(s4.Lb + credited2);
    expect(s5.Lu).toBe(0n);
    expect(s5.unowned).toBe(0n);
    if (s5.Lb > 0n) {
      await clammRemoveLiquidityAdminSender({
        algod,
        account: deployerSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        clientBiatecClammPool: poolClient,
        assetA: assetAId,
        assetB: assetBId,
        assetLp,
        amount: 0n,
      });
      const s6 = await readState();
      expect(s6.Lb).toBe(0n);
      expect(s6.unowned).toBe(s6.L);
      expect(s6.L).toBeLessThanOrEqual(s5.L);
    }
  });
});
