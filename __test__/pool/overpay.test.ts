import { describe, test, expect } from '@jest/globals';
import { setupPool, assetAId, assetBId, deployer, SCALE, SCALE_A, SCALE_B, fixture, algosdk, algokit, getBoxReferenceStats, LP_TOKEN_DECIMALS, setAssetAId } from './shared-setup';

describe('BiatecClammPool - Overpay', () => {
  test('Overpay: Swap excess A for limited B results in LP profit', async () => {
    await setAssetAId(1n);
    const { algod } = fixture.context;
    const params = await algod.getTransactionParams().do();

    // Setup pool with wide range
    // P = 1. Range [0.01, 100].
    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
      algod,
      assetA: assetAId,
      biatecFee: 0n,
      lpFee: 0n,
      p: BigInt(1 * SCALE),
      p1: BigInt(0.01 * SCALE),
      p2: BigInt(100 * SCALE),
    });

    const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();

    // Opt in to LP token
    const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: 0,
      assetIndex: Number(poolTokenId),
      sender: deployer.addr,
      suggestedParams: params,
      receiver: deployer.addr,
    });
    await algod.sendRawTransaction(algosdk.signTransaction(optinToTheLPToken, deployer.sk).blob).do();
    await algosdk.waitForConfirmation(algod, optinToTheLPToken.txID(), 4);

    // Add Liquidity
    // We want roughly 100 A and 100 B to be balanced at P=1.
    // 100 A = 100 * 10^8 = 10^10
    // 100 B = 100 * 10^6 = 10^8
    const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(100 * SCALE_A),
      assetIndex: assetAId,
      sender: deployer.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPoolProvider.appClient.appAddress,
    });
    const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(100 * SCALE_B),
      assetIndex: assetBId,
      sender: deployer.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPoolProvider.appClient.appAddress,
    });

    await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
      args: {
        appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
        appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
        txAssetADeposit: addLiquidityA,
        txAssetBDeposit: addLiquidityB,
        assetLp: poolTokenId,
        assetA: assetAId,
        assetB: assetBId,
      },
      extraFee: algokit.microAlgos(9000),
    });

    // Check pool balances
    const poolAccountInfo = await algod.accountInformation(clientBiatecClammPoolProvider.appClient.appAddress).do();
    const poolAssets = poolAccountInfo.assets || [];
    console.log('Pool Assets:', poolAssets);
    // Handle both camelCase and kebab-case, and bigint vs number
    const poolAssetB = poolAssets.find((a: any) => {
      const id = a['asset-id'] !== undefined ? a['asset-id'] : a.assetId;
      return BigInt(id) === assetBId;
    });
    const poolBalanceB = BigInt(poolAssetB?.amount || 0n);

    console.log(`Pool Balance B: ${poolBalanceB}`);
    expect(poolBalanceB).toBeGreaterThan(0n);

    // Now we want to swap A -> B.
    // We want to try to buy 1.1 * poolBalanceB.
    // We'll send a large amount of A to ensure we drain B and overpay.
    // Estimate cost: 1 B ~ 1 A (value wise).
    // poolBalanceB is in units of B.
    // We need equivalent value in A.
    // 1 unit of B (10^-6) = 1 unit of A (10^-8) * 100?
    // No, 1 full B = 1 full A.
    // 10^6 raw B = 10^8 raw A.
    // So 1 raw B = 100 raw A.
    // So cost in raw A = poolBalanceB * 100.
    // We send 1000x that to be sure we are overpaying significantly and draining the pool.

    const swapAmountA = poolBalanceB * 100n * 1000n;

    // Record deployer balance before swap
    const deployerInfoBefore = await algod.accountInformation(deployer.addr).do();
    const deployerAssetsBefore = deployerInfoBefore.assets || [];
    const deployerBalanceBBefore = BigInt(
      deployerAssetsBefore.find((a: any) => {
        const id = a['asset-id'] !== undefined ? a['asset-id'] : a.assetId;
        return BigInt(id) === assetBId;
      })?.amount || 0n
    );
    const deployerBalanceABefore = BigInt(
      deployerAssetsBefore.find((a: any) => {
        const id = a['asset-id'] !== undefined ? a['asset-id'] : a.assetId;
        return BigInt(id) === assetAId;
      })?.amount || 0n
    );

    const swapTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: swapAmountA,
      assetIndex: assetAId,
      sender: deployer.addr,
      suggestedParams: params,
      receiver: clientBiatecClammPoolProvider.appClient.appAddress,
    });

    await clientBiatecClammPoolProvider.appClient.send.swap({
      args: {
        minimumToReceive: 0, // Accept whatever we get
        txSwap: swapTx,
        assetA: assetAId,
        assetB: assetBId,
        appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
        appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
        appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appClient.appId),
      },
      extraFee: algokit.microAlgos(9000),
      boxReferences: getBoxReferenceStats({
        appBiatecCLAMMPool: clientBiatecClammPoolProvider.appClient.appId,
        appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
        assetA: assetAId,
        assetB: assetBId,
        includingAssetBoxes: false,
      }),
      appReferences: [BigInt(clientBiatecConfigProvider.appClient.appId), BigInt(clientBiatecIdentityProvider.appClient.appId), BigInt(clientBiatecPoolProvider.appClient.appId)],
      assetReferences: [BigInt(assetAId), BigInt(assetBId)],
    });

    // Check balances after swap
    const deployerInfoAfter = await algod.accountInformation(deployer.addr).do();
    const deployerAssetsAfter = deployerInfoAfter.assets || [];
    const deployerBalanceBAfter = BigInt(
      deployerAssetsAfter.find((a: any) => {
        const id = a['asset-id'] !== undefined ? a['asset-id'] : a.assetId;
        return BigInt(id) === assetBId;
      })?.amount || 0n
    );
    const deployerBalanceAAfter = BigInt(
      deployerAssetsAfter.find((a: any) => {
        const id = a['asset-id'] !== undefined ? a['asset-id'] : a.assetId;
        return BigInt(id) === assetAId;
      })?.amount || 0n
    );

    const receivedB = deployerBalanceBAfter - deployerBalanceBBefore;
    const spentA = deployerBalanceABefore - deployerBalanceAAfter;

    console.log(`Received B: ${receivedB}`);
    console.log(`Spent A: ${spentA}`);
    console.log(`Swap Amount A: ${swapAmountA}`);

    // Expectation 1: We received all available B
    expect(receivedB).toBe(poolBalanceB);

    // Expectation 2: We spent ALL the A we sent (Overpay)
    expect(spentA).toBe(swapAmountA);

    // Expectation 3: Pool now has 0 B
    const poolAccountInfoAfter = await algod.accountInformation(clientBiatecClammPoolProvider.appClient.appAddress).do();
    const poolAssetsAfter = poolAccountInfoAfter.assets || [];
    const poolBalanceBAfter = BigInt(
      poolAssetsAfter.find((a: any) => {
        const id = a['asset-id'] !== undefined ? a['asset-id'] : a.assetId;
        return BigInt(id) === assetBId;
      })?.amount || 0n
    );
    expect(poolBalanceBAfter).toBe(0n);
  });
});
