import { describe, expect, test } from '@jest/globals';
import { setupPool, deployer, deployerSigner, assetAId, assetBId } from './shared-setup';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';

describe('Fresh audit 2026-09-07 reproductions', () => {
  test('minimum LP mint permits an eight-decimal deposit to redeem more asset A', async () => {
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
    await clammAddLiquiditySender({ ...common, clientBiatecPoolProvider: clientBiatecPoolProvider.appClient, assetADeposit: 1n, assetBDeposit: 0n });
    const lpAfter = await algod.accountAssetInformation(deployer.addr, assetLp).do();
    expect(lpAfter.assetHolding!.amount - lpBefore.assetHolding!.amount).toBe(1n);
    await clammRemoveLiquiditySender({ ...common, lpToSend: 1n });
    const after = await algod.accountAssetInformation(deployer.addr, assetAId).do();
    expect(after.assetHolding!.amount - before.assetHolding!.amount).toBe(49n);
  });
});
