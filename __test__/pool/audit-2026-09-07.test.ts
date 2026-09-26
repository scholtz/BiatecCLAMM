import { describe, expect, test } from '@jest/globals';
import { setupPool, deployer, deployerSigner, assetAId, assetBId } from './shared-setup';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';

describe('Fresh audit 2026-09-07 reproductions', () => {
  // H-01: a deposit smaller than one LP micro-unit used to be rounded UP to one LP token. In an 8-decimal pool a
  // deposit of 1 base unit of asset A then redeemed 49 units. Such deposits are now rejected (LP-ZERO-ERR) and a
  // deposit which reaches one LP micro-unit never redeems more than it deposited.
  test('minimum LP mint no longer lets an eight-decimal deposit redeem more asset A', async () => {
    const { algod, clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
      assetA: 1n,
      biatecFee: 0n,
      lpFee: 0n,
      p: 1_000_000_000n,
      p1: 1_000_000_000n,
      p2: 1_000_000_000n,
    });
    const state = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
    const assetLp = BigInt(state.assetLp ?? 0n);
    const common = {
      algod,
      account: deployerSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
    };
    await clammAddLiquiditySender({ ...common, clientBiatecPoolProvider: clientBiatecPoolProvider.appClient, assetADeposit: 100_000_000n, assetBDeposit: 1_000_000n });
    const before = await algod.accountAssetInformation(deployer.addr, assetAId).do();
    const lpBefore = await algod.accountAssetInformation(deployer.addr, assetLp).do();

    // 1 base unit of the 8-decimal asset A is worth less than one LP micro-unit -> rejected
    await expect(clammAddLiquiditySender({ ...common, clientBiatecPoolProvider: clientBiatecPoolProvider.appClient, assetADeposit: 1n, assetBDeposit: 0n })).rejects.toThrow(/LP-ZERO-ERR/);
    const lpAfterRejected = await algod.accountAssetInformation(deployer.addr, assetLp).do();
    expect(lpAfterRejected.assetHolding!.amount).toBe(lpBefore.assetHolding!.amount);

    // in this flat 1:1 pool 1 base-scale unit of asset A adds 1 unit of liquidity, so 120 units of the 8-decimal asset A
    // (1200 base-scale units) add 1.2 LP micro-units: exactly one LP micro-unit is minted, the remainder stays with the LP holders
    await clammAddLiquiditySender({ ...common, clientBiatecPoolProvider: clientBiatecPoolProvider.appClient, assetADeposit: 120n, assetBDeposit: 0n });
    const lpAfter = await algod.accountAssetInformation(deployer.addr, assetLp).do();
    const minted = lpAfter.assetHolding!.amount - lpBefore.assetHolding!.amount;
    expect(minted).toBe(1n);
    await clammRemoveLiquiditySender({ ...common, lpToSend: minted });
    const after = await algod.accountAssetInformation(deployer.addr, assetAId).do();
    // the depositor must never get back more than deposited
    expect(after.assetHolding!.amount - before.assetHolding!.amount).toBeLessThanOrEqual(0n);
    // one LP micro-unit redeems ~50 units of A and ~5 units of B; the 20 units of rounding remainder stay with the pool
    expect(after.assetHolding!.amount - before.assetHolding!.amount).toBeGreaterThanOrEqual(-120n);
  });
});
