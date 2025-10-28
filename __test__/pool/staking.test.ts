/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import { setupPool, deployer, deployerSigner, SCALE, SCALE_ALGO, fixture, setAssetAId, algosdk } from './shared-setup';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';
import clammDistributeExcessAssetsSender from '../../src/biatecClamm/sender/clammDistributeExcessAssetsSender';
import optInToAsset from '../../src/optInToAsset';
import createToken from '../../src/createToken';

describe('BiatecClammPool - Staking Pools', () => {
  test('Native Token Pool: Create B-ALGO pool (asset A = asset B = 0)', async () => {
    try {
      await setAssetAId(0n);
      const { algod } = fixture.context;
      const { clientBiatecClammPoolProvider } = await setupPool({
        algod,
        assetA: 0n,
        assetB: 0n,
        biatecFee: 0n,
        lpFee: BigInt(SCALE / 100),
        p: BigInt(SCALE),
        p1: BigInt(SCALE),
        p2: BigInt(SCALE),
        nativeTokenName: 'ALGO',
        useProvidedAssets: true,
      });

      const state = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      expect(BigInt(state.assetA ?? 0n)).toBe(0n);
      expect(BigInt(state.assetB ?? 0n)).toBe(0n);

      const lpTokenId = BigInt(state.assetLp ?? 0n);
      expect(lpTokenId).toBeGreaterThan(0n);

      const lpTokenInfo = await algod.getAssetByID(Number(lpTokenId)).do();
      // eslint-disable-next-line no-console
      const rawNameBuffer =
        typeof lpTokenInfo.params.nameB64 === 'string'
          ? Buffer.from(lpTokenInfo.params.nameB64, 'base64')
          : Buffer.from(lpTokenInfo.params.nameB64 ?? new Uint8Array());
      console.log('LP raw name bytes', rawNameBuffer.toString('hex'));
      // eslint-disable-next-line no-console
      console.log('LP name/unit', lpTokenInfo.params.name, lpTokenInfo.params.unitName);
      expect(lpTokenInfo.params.name).toBe('bALGO');
      expect(lpTokenInfo.params.unitName).toBe('ALGO');
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('Native Token Pool respects custom native token name casing', async () => {
    try {
      await setAssetAId(0n);
      const { algod } = fixture.context;
      const { clientBiatecClammPoolProvider } = await setupPool({
        algod,
        assetA: 0n,
        assetB: 0n,
        biatecFee: 0n,
        lpFee: BigInt(SCALE / 100),
        p: BigInt(SCALE),
        p1: BigInt(SCALE),
        p2: BigInt(SCALE),
        nativeTokenName: 'Algo',
        useProvidedAssets: true,
      });

      const state = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      const lpTokenId = BigInt(state.assetLp ?? 0n);
      expect(lpTokenId).toBeGreaterThan(0n);

      const lpTokenInfo = await algod.getAssetByID(Number(lpTokenId)).do();
      expect(lpTokenInfo.params.name).toBe('bAlgo');
      expect(lpTokenInfo.params.unitName).toBe('Algo');
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('Asset Pool: Create B-TOKEN pool (asset A = asset B, both non-zero)', async () => {
    try {
      await setAssetAId(1n);
      const { algod } = fixture.context;

      const testAssetId = await createToken({
        account: deployer,
        algod,
        name: 'TEST',
        decimals: 6,
      });

      const { clientBiatecClammPoolProvider } = await setupPool({
        algod,
        assetA: testAssetId,
        assetB: testAssetId,
        biatecFee: 0n,
        lpFee: BigInt(SCALE / 100),
        p: BigInt(SCALE),
        p1: BigInt(SCALE),
        p2: BigInt(SCALE),
        useProvidedAssets: true,
      });

      const state = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      expect(BigInt(state.assetA ?? 0n)).toBe(BigInt(testAssetId));
      expect(BigInt(state.assetB ?? 0n)).toBe(BigInt(testAssetId));

      const lpTokenId = BigInt(state.assetLp ?? 0n);
      expect(lpTokenId).toBeGreaterThan(0n);

      const lpTokenInfo = await algod.getAssetByID(Number(lpTokenId)).do();
      const testAssetInfo = await algod.getAssetByID(Number(testAssetId)).do();
      expect(lpTokenInfo.params.name).toBe(`b${testAssetInfo.params.unitName}`);
      expect(lpTokenInfo.params.unitName).toBe(testAssetInfo.params.unitName);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('Asset Pool: rejects mismatched price range for identical assets', async () => {
    try {
      await setAssetAId(1n);
      const { algod } = fixture.context;

      const testAssetId = await createToken({
        account: deployer,
        algod,
        name: 'TEST',
        decimals: 6,
      });

      await expect(
        setupPool({
          algod,
          assetA: testAssetId,
          assetB: testAssetId,
          biatecFee: 0n,
          lpFee: BigInt(SCALE / 100),
          p: BigInt(SCALE),
          p1: BigInt(SCALE),
          p2: BigInt(2 * SCALE),
          useProvidedAssets: true,
        })
      ).rejects.toThrow();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });

  test('Staking Rewards: Distribute excess ALGO to B-ALGO pool LPs', async () => {
    try {
      await setAssetAId(0n);
      const { algod } = fixture.context;
      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        clientBiatecPoolProvider,
      } = await setupPool({
        algod,
        assetA: 0n,
        assetB: 0n,
        biatecFee: 0n,
        lpFee: BigInt(SCALE / 100),
        p: BigInt(SCALE),
        p1: BigInt(SCALE),
        p2: BigInt(SCALE),
        nativeTokenName: 'ALGO',
        useProvidedAssets: true,
      });

      const state = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      const lpTokenId = BigInt(state.assetLp ?? 0n);
      expect(lpTokenId).toBeGreaterThan(0n);

      const ensureOptIn = async () => {
        const accountInfo = await algod.accountInformation(deployer.addr).do();
        const assets = (accountInfo.assets as Array<{ assetId: number }> | undefined) ?? [];
        const hasAsset = assets.some((holding) => holding.assetId === Number(lpTokenId));
        if (!hasAsset) {
          await optInToAsset({
            account: deployer,
            assetIndex: Number(lpTokenId),
            algod,
          });
        }
      };
      await ensureOptIn();

      const initialLiquidityAlgo = 10n * BigInt(SCALE_ALGO);
      const txIdAdd = await clammAddLiquiditySender({
        algod,
        account: deployerSigner,
        assetADeposit: initialLiquidityAlgo,
        assetBDeposit: initialLiquidityAlgo,
        appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
        appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        assetA: 0n,
        assetB: 0n,
        assetLp: lpTokenId,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
      });
      expect(txIdAdd.length).toBe(52);

      const getLpBalance = async () => {
        const response = await algod.accountAssetInformation(deployer.addr, Number(lpTokenId)).do();
        return BigInt(response.assetHolding?.amount ?? 0);
      };
      const lpBalanceAfterAdd = await getLpBalance();
      expect(lpBalanceAfterAdd).toBeGreaterThan(0n);

      const stateBefore = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      const liquidityBefore = BigInt(stateBefore.liquidity ?? 0n);

      const rewardsAmount = 100n * BigInt(SCALE_ALGO);
      const poolAddress = algosdk.getApplicationAddress(Number(clientBiatecClammPoolProvider.appClient.appId));
      const paymentTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: deployer.addr,
        receiver: poolAddress,
        amount: rewardsAmount,
        suggestedParams: await algod.getTransactionParams().do(),
      });
      const signedPayment = paymentTx.signTxn(deployer.sk);
      await algod.sendRawTransaction(signedPayment).do();
      await algosdk.waitForConfirmation(algod, paymentTx.txID(), 4);

      const txIdDistribute = await clammDistributeExcessAssetsSender({
        algod,
        account: deployerSigner,
        amountA: rewardsAmount * BigInt(SCALE / SCALE_ALGO),
        amountB: 0n,
        appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
        assetA: 0n,
        assetB: 0n,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
      });
      expect(txIdDistribute.length).toBe(52);

      const stateAfter = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      const liquidityAfter = BigInt(stateAfter.liquidity ?? 0n);
      expect(liquidityAfter).toBeGreaterThan(liquidityBefore);

      const txIdRemove = await clammRemoveLiquiditySender({
        algod,
        account: deployerSigner,
        appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
        appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
        assetA: 0n,
        assetB: 0n,
        assetLp: lpTokenId,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
        lpToSend: lpBalanceAfterAdd,
      });
      expect(txIdRemove.length).toBe(52);

      const lpBalanceAfterRemove = await getLpBalance();
      expect(lpBalanceAfterRemove).toBe(0n);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
});
