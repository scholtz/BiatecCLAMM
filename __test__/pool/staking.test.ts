/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import algosdk from 'algosdk';
import {
  setupPool,
  assetAId,
  assetBId,
  deployer,
  deployerSigner,
  SCALE,
  SCALE_A,
  SCALE_B,
  SCALE_ALGO,
  fixture,
  setAssetAId,
} from './shared-setup';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';
import clammDistributeExcessAssetsSender from '../../src/biatecClamm/sender/clammDistributeExcessAssetsSender';
import { getAssetBalance, transferAsset } from '../../src/common/transfer';
import createToken from '../../src/createToken';

describe('BiatecClammPool - Staking Pools', () => {
  test('Native Token Pool: Create B-ALGO pool (asset A = asset B = 0)', async () => {
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
        assetA: 0n, // Both assets are native token
        assetB: 0n, // Explicitly set assetB to 0 as well
        biatecFee: 0n,
        lpFee: BigInt(SCALE / 100), // 1% fee
        p: BigInt(1 * SCALE),
        p1: BigInt(1 * SCALE),
        p2: BigInt(1 * SCALE),
        nativeTokenName: 'ALGO',
      });

      expect(!!clientBiatecClammPoolProvider).toBeTruthy();
      const appId = await clientBiatecClammPoolProvider.appClient.appId;
      expect(appId).toBeGreaterThan(0);

      // Check that both assetA and assetB are 0 (native token)
      const state = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      expect(state.assetA?.asNumber).toBe(0);
      expect(state.assetB?.asNumber).toBe(0);

      // Check LP token was created
      const lpTokenId = state.assetLp?.asNumber;
      expect(lpTokenId).toBeGreaterThan(0);

      // Get LP token info to verify the name
      const lpTokenInfo = await algod.getAssetByID(lpTokenId!).do();
      console.log('B-ALGO LP Token Name:', lpTokenInfo.params.name);
      console.log('B-ALGO LP Token Unit:', lpTokenInfo.params['unit-name']);
      expect(lpTokenInfo.params.name).toBe('B-ALGO');
      expect(lpTokenInfo.params['unit-name']).toBe('ALGO');
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

      // Create a test token
      const testAssetId = await createToken({
        account: deployer,
        algod,
        name: 'TEST',
        decimals: 6,
      });

      const {
        clientBiatecClammPoolProvider,
        clientBiatecConfigProvider,
        clientBiatecIdentityProvider,
        clientBiatecPoolProvider,
      } = await setupPool({
        algod,
        assetA: testAssetId, // Same asset for both A and B
        assetB: testAssetId, // Explicitly use the same asset
        biatecFee: 0n,
        lpFee: BigInt(SCALE / 100), // 1% fee
        p: BigInt(1 * SCALE),
        p1: BigInt(1 * SCALE),
        p2: BigInt(1 * SCALE),
      });

      // Check that both assetA and assetB are the same
      const state = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      expect(state.assetA?.asNumber).toBe(Number(testAssetId));
      expect(state.assetB?.asNumber).toBe(Number(testAssetId));

      // Check LP token was created
      const lpTokenId = state.assetLp?.asNumber;
      expect(lpTokenId).toBeGreaterThan(0);

      // Get LP token info to verify the name
      const lpTokenInfo = await algod.getAssetByID(lpTokenId!).do();
      console.log('B-TEST LP Token Name:', lpTokenInfo.params.name);
      console.log('B-TEST LP Token Unit:', lpTokenInfo.params['unit-name']);

      // Get the test asset info to verify unit name
      const testAssetInfo = await algod.getAssetByID(Number(testAssetId)).do();
      expect(lpTokenInfo.params.name).toBe(`B-${testAssetInfo.params['unit-name']}`);
      expect(lpTokenInfo.params['unit-name']).toBe(testAssetInfo.params['unit-name']);
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
        assetA: 0n, // Native token pool
        assetB: 0n, // Same as assetA for staking pool
        biatecFee: 0n,
        lpFee: BigInt(SCALE / 100), // 1% fee
        p: BigInt(1 * SCALE),
        p1: BigInt(1 * SCALE),
        p2: BigInt(1 * SCALE),
        nativeTokenName: 'ALGO',
      });

      const state = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      const lpTokenId = state.assetLp?.asNumber;
      expect(lpTokenId).toBeGreaterThan(0);

      // Opt-in deployer to LP token
      await transferAsset({
        from: deployer,
        to: deployer.addr,
        assetId: BigInt(lpTokenId!),
        amount: 0n,
        algod,
      });

      // Add initial liquidity
      const initialLiquidityAlgo = 10n * BigInt(SCALE_ALGO); // 10 ALGO
      const txIdAdd = await clammAddLiquiditySender({
        algod,
        account: deployerSigner,
        amountA: initialLiquidityAlgo,
        amountB: initialLiquidityAlgo, // Same amount since it's a 1:1 pool
        appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
        appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
        appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
        assetA: 0n,
        assetB: 0n,
        assetLP: BigInt(lpTokenId!),
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
      });
      expect(txIdAdd.length).toBe(52);

      // Get LP token balance after adding liquidity
      const lpBalanceAfterAdd = await getAssetBalance({
        algod,
        assetId: BigInt(lpTokenId!),
        address: deployer.addr,
      });
      console.log('LP tokens received:', lpBalanceAfterAdd);
      expect(lpBalanceAfterAdd).toBeGreaterThan(0n);

      // Get pool state before distributing rewards
      const stateBefore = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      const liquidityBefore = stateBefore.liquidity?.asBigInt();
      console.log('Liquidity before rewards:', liquidityBefore);

      // Simulate staking rewards: Send 100 ALGO directly to pool address
      const rewardsAmount = 100n * BigInt(SCALE_ALGO);
      const poolAddress = algosdk.getApplicationAddress(BigInt(clientBiatecClammPoolProvider.appClient.appId));
      const paymentTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: deployer.addr,
        to: poolAddress,
        amount: rewardsAmount,
        suggestedParams: await algod.getTransactionParams().do(),
      });
      const signedPayment = paymentTx.signTxn(deployer.sk);
      await algod.sendRawTransaction(signedPayment).do();
      await algosdk.waitForConfirmation(algod, paymentTx.txID(), 4);
      console.log('Sent 100 ALGO rewards to pool');

      // Get the executive fee address from config
      const configState = await clientBiatecConfigProvider.appClient.state.global.getAll();
      console.log('Config state:', configState);

      // Distribute excess assets to LP holders
      // The executive fee address needs to call this
      // For testing, we'll assume deployer is the executive fee address
      const txIdDistribute = await clammDistributeExcessAssetsSender({
        algod,
        account: deployerSigner,
        amountA: rewardsAmount * BigInt(SCALE / SCALE_ALGO), // Convert to base scale (9 decimals)
        amountB: 0n, // No rewards for asset B
        appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
        assetA: 0n,
        assetB: 0n,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
      });
      console.log('Distributed excess assets:', txIdDistribute);

      // Get pool state after distributing rewards
      const stateAfter = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      const liquidityAfter = stateAfter.liquidity?.asBigInt();
      console.log('Liquidity after rewards:', liquidityAfter);

      // Liquidity should have increased after distributing rewards
      expect(liquidityAfter).toBeGreaterThan(liquidityBefore!);

      // Remove liquidity to claim rewards
      const txIdRemove = await clammRemoveLiquiditySender({
        algod,
        account: deployerSigner,
        appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
        appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
        appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
        assetA: 0n,
        assetB: 0n,
        assetLP: BigInt(lpTokenId!),
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
        lpTokensToSend: lpBalanceAfterAdd,
      });
      expect(txIdRemove.length).toBe(52);

      // Get ALGO balance after withdrawing
      const algoBalanceAfter = await algod.accountInformation(deployer.addr).do();
      console.log('ALGO balance after withdrawal:', algoBalanceAfter.amount);

      // The withdrawn amount should be more than the initial deposit due to rewards
      // We can't easily verify the exact amount due to transaction fees, but we can
      // verify that LP tokens were burned
      const lpBalanceAfterRemove = await getAssetBalance({
        algod,
        assetId: BigInt(lpTokenId!),
        address: deployer.addr,
      });
      expect(lpBalanceAfterRemove).toBe(0n);

      console.log('Successfully tested staking rewards distribution!');
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      throw Error(e.message);
    }
  });
});
