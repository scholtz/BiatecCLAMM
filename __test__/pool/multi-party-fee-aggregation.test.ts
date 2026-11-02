/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/**
 * Comprehensive verification of multi-party liquidity aggregation and fee accounting across time.
 *
 * Proves on-chain that:
 * 1. When Party A deposits at t0, swaps accrue fees at t1, and Party B deposits at t2:
 *    - Party B's minted LP tokens are discounted by D / (D + Lu), and the difference is booked into Lu.
 *    - Party B cannot scoop any pre-existing fees earned by Party A during [t0, t1].
 *    - Party A retains 100% of their principal and 100% of pre-existing fees Lu(t1).
 * 2. When further swaps occur at t3 while both Party A and Party B are in the pool:
 *    - New fees are distributed strictly in proportion to each party's active liquidity at t2:
 *      (D_A + Lu(t1)) : deltaL_B.
 * 3. Withdrawal order independence:
 *    - Whether Party A withdraws before Party B or Party B withdraws before Party A, both receive
 *      identical payouts (within <= 2 asset base units of integer floor rounding) and Biatec's
 *      protocol fee share (Lb) is preserved intact.
 * 4. Three LPs (Alice, Bob, Charlie) joining across three distinct fee epochs with partial and full
 *    withdrawals maintain the conservation invariant L == D + Lu + Lb + roundingDust at every step.
 * 5. Staking / excess-asset reward distributions (distributeExcessAssets) across multiple LPs joining
 *    at different times protect incumbent rewards against dilution or scooping.
 * 6. Repeated rapid deposit/withdraw cycling by a second party cannot siphon fees or bleed the pool;
 *    every cycle rounds strictly in favour of the pool / incumbent LP.
 */
import { describe, expect, test } from '@jest/globals';
import type { Address } from 'algosdk';
import {
  setupPool,
  assetAId,
  assetBId,
  deployer,
  deployerSigner,
  SCALE,
  SCALE_A,
  SCALE_B,
  fixture,
  algosdk,
  algokit,
  setAssetAId,
  clammAddLiquiditySender,
  type TransactionSignerAccount,
} from './shared-setup';
import clammSwapSender from '../../src/biatecClamm/sender/clammSwapSender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';
import clammRemoveLiquidityAdminSender from '../../src/biatecClamm/sender/clammRemoveLiquidityAdminSender';
import clammDistributeExcessAssetsSender from '../../src/biatecClamm/sender/clammDistributeExcessAssetsSender';

const TOTAL_LP_SUPPLY = 18_000_000_000_000_000_000n;
const LP_SCALE = 1000n; // 9 base decimals - 6 LP decimals => 1 micro-LP = 1000 base units

describe('BiatecClammPool - Multi-Party Fee & Liquidity Aggregation', () => {
  const createSignerAccount = (account: algosdk.Account): TransactionSignerAccount => ({
    addr: account.addr as unknown as Address,
    signer: async (txnGroup, indexesToSign) => indexesToSign.map((i) => txnGroup[i].signTxn(account.sk)),
  });

  const getAssetBalance = async (algod: algosdk.Algodv2, address: string, asset: bigint): Promise<bigint> => {
    if (asset === 0n) {
      const info = await algod.accountInformation(address).do();
      return BigInt(info.amount);
    }
    try {
      const info = await algod.accountAssetInformation(address, Number(asset)).do();
      const holding = (info as any)['asset-holding'] ?? info.assetHolding;
      return BigInt(holding?.amount ?? 0);
    } catch {
      return 0n;
    }
  };

  const optInAndFundAccount = async (algod: algosdk.Algodv2, account: algosdk.Account, assets: bigint[], amountA: bigint, amountB: bigint) => {
    const params = await algod.getTransactionParams().do();
    const txns: algosdk.Transaction[] = [];
    for (const assetId of assets) {
      if (assetId > 0n) {
        txns.push(
          algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            amount: 0,
            assetIndex: Number(assetId),
            sender: account.addr,
            receiver: account.addr,
            suggestedParams: params,
          })
        );
      }
    }
    if (amountA > 0n && assetAId > 0n) {
      txns.push(
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: amountA,
          assetIndex: Number(assetAId),
          sender: deployer.addr,
          receiver: account.addr,
          suggestedParams: params,
        })
      );
    }
    if (amountB > 0n && assetBId > 0n) {
      txns.push(
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: amountB,
          assetIndex: Number(assetBId),
          sender: deployer.addr,
          receiver: account.addr,
          suggestedParams: params,
        })
      );
    }
    if (txns.length > 0) {
      algosdk.assignGroupID(txns);
      const signed = txns.map((tx) => {
        const senderStr = tx.sender.toString();
        if (senderStr === deployer.addr.toString()) {
          return tx.signTxn(deployer.sk);
        }
        return tx.signTxn(account.sk);
      });
      const { txid } = await algod.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(algod, txid, 4);
    }
  };

  const readPoolAccounting = async (algod: algosdk.Algodv2, poolClient: any, assetLp: bigint) => {
    const gs = await poolClient.state.global.getAll();
    const poolAddr = poolClient.appAddress.toString();
    const lpInPool = await getAssetBalance(algod, poolAddr, assetLp);
    const L = BigInt(gs.liquidity ?? 0n);
    const Lu = BigInt(gs.liquidityUsersFromFees ?? 0n);
    const Lb = BigInt(gs.liquidityBiatecFromFees ?? 0n);
    const D = (TOTAL_LP_SUPPLY - lpInPool) * LP_SCALE;
    const unowned = L - D - Lu - Lb;
    const ab = BigInt(gs.assetABalanceBaseScale ?? 0n);
    const bb = BigInt(gs.assetBBalanceBaseScale ?? 0n);
    const scaleA = BigInt(gs.assetADecimalsScaleFromBase ?? 10n);
    const scaleB = BigInt(gs.assetBDecimalsScaleFromBase ?? 1000n);
    return { L, Lu, Lb, D, unowned, ab, bb, scaleA, scaleB };
  };

  test('1. Two LPs joining at different times across two swap epochs share fees strictly by active liquidity', async () => {
    await setAssetAId(1n);
    const { algod } = fixture.context;

    // Bounded price range [0.9, 1.1], current price 1.0, LP fee = 2%, Biatec fee = 0%
    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
      algod,
      assetA: assetAId,
      biatecFee: 0n,
      lpFee: 20_000_000n, // 2%
      p: BigInt(1.0 * SCALE),
      p1: BigInt(0.9 * SCALE),
      p2: BigInt(1.1 * SCALE),
    });

    const poolClient = clientBiatecClammPoolProvider.appClient;
    const assetLp = await poolClient.getLpTokenId();

    const alice = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const bob = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const trader = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const aliceSigner = createSignerAccount(alice);
    const bobSigner = createSignerAccount(bob);
    const traderSigner = createSignerAccount(trader);

    await optInAndFundAccount(algod, alice, [assetAId, assetBId, assetLp], BigInt(500 * SCALE_A), BigInt(500 * SCALE_B));
    await optInAndFundAccount(algod, bob, [assetAId, assetBId, assetLp], BigInt(500 * SCALE_A), BigInt(500 * SCALE_B));
    await optInAndFundAccount(algod, trader, [assetAId, assetBId], BigInt(500 * SCALE_A), BigInt(500 * SCALE_B));

    // --- Epoch 1 (t0): Alice deposits 100 EUR + 100 USD ---
    const aliceDepositA = BigInt(100 * SCALE_A);
    const aliceDepositB = BigInt(100 * SCALE_B);
    await clammAddLiquiditySender({
      algod,
      account: aliceSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: aliceDepositA,
      assetBDeposit: aliceDepositB,
    });

    const stateAfterAlice = await readPoolAccounting(algod, poolClient, assetLp);
    const lpAlice = (await getAssetBalance(algod, alice.addr.toString(), assetLp)) * LP_SCALE;
    expect(lpAlice).toBe(stateAfterAlice.D);
    expect(stateAfterAlice.Lu).toBe(0n);
    expect(stateAfterAlice.Lb).toBe(0n);
    expect(stateAfterAlice.unowned).toBeGreaterThanOrEqual(0n);
    expect(stateAfterAlice.unowned).toBeLessThan(LP_SCALE);

    // --- Epoch 2 (t1): Trader executes swaps while ONLY Alice is in the pool ---
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetAId,
      fromAmount: BigInt(20 * SCALE_A),
      minimumToReceive: 0n,
    });
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetBId,
      fromAmount: BigInt(20 * SCALE_B),
      minimumToReceive: 0n,
    });

    const stateAfterEpoch1Swaps = await readPoolAccounting(algod, poolClient, assetLp);
    const epoch1Fees = stateAfterEpoch1Swaps.Lu;
    expect(epoch1Fees).toBeGreaterThan(0n);
    // Alice's full entitlement at t1 is lpAlice + epoch1Fees
    const aliceEntitlementBeforeBob = lpAlice + epoch1Fees;

    // --- Epoch 3 (t2): Bob deposits proportional reserves (50% of current pool reserves) ---
    const bobDepositA = stateAfterEpoch1Swaps.ab / 2n / stateAfterEpoch1Swaps.scaleA;
    const bobDepositB = stateAfterEpoch1Swaps.bb / 2n / stateAfterEpoch1Swaps.scaleB;
    await clammAddLiquiditySender({
      algod,
      account: bobSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: bobDepositA,
      assetBDeposit: bobDepositB,
    });

    const stateAfterBob = await readPoolAccounting(algod, poolClient, assetLp);
    const deltaLBob = stateAfterBob.L - stateAfterEpoch1Swaps.L;
    const lpBob = (await getAssetBalance(algod, bob.addr.toString(), assetLp)) * LP_SCALE;

    // Verify Bob's LP minting follows X = floor(deltaL_B * D_A / (D_A + Lu_1)) floored to LP_SCALE
    const expectedBobLpBase = (deltaLBob * lpAlice) / (lpAlice + epoch1Fees);
    const expectedBobLpFloored = (expectedBobLpBase / LP_SCALE) * LP_SCALE;
    expect(lpBob).toBe(expectedBobLpFloored);
    expect(lpBob).toBeLessThan(deltaLBob); // discounted because existing LP tokens carry fee value

    // Verify Alice's liquidity entitlement immediately after Bob joins is >= her entitlement before Bob joined
    const aliceEntitlementAfterBob = lpAlice + (stateAfterBob.Lu * lpAlice) / stateAfterBob.D;
    const bobEntitlementAfterBob = lpBob + (stateAfterBob.Lu * lpBob) / stateAfterBob.D;
    expect(aliceEntitlementAfterBob).toBeGreaterThanOrEqual(aliceEntitlementBeforeBob);
    // Verify Bob's liquidity entitlement immediately after joining is <= the liquidity deltaLBob he contributed
    expect(bobEntitlementAfterBob).toBeLessThanOrEqual(deltaLBob);
    expect(deltaLBob - bobEntitlementAfterBob).toBeLessThan(2n * LP_SCALE);

    // --- Epoch 4 (t3): Trader executes further swaps while BOTH Alice and Bob are in the pool ---
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetAId,
      fromAmount: BigInt(30 * SCALE_A),
      minimumToReceive: 0n,
    });
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetBId,
      fromAmount: BigInt(30 * SCALE_B),
      minimumToReceive: 0n,
    });

    const stateAfterEpoch2Swaps = await readPoolAccounting(algod, poolClient, assetLp);
    const epoch2FeeIncrement = stateAfterEpoch2Swaps.Lu - stateAfterBob.Lu;
    expect(epoch2FeeIncrement).toBeGreaterThan(0n);

    // Verify Epoch 2 fee increment is split proportionally to active liquidity at t2: (lpAlice + epoch1Fees) vs deltaLBob
    const aliceFinalEntitlement = lpAlice + (stateAfterEpoch2Swaps.Lu * lpAlice) / stateAfterEpoch2Swaps.D;
    const bobFinalEntitlement = lpBob + (stateAfterEpoch2Swaps.Lu * lpBob) / stateAfterEpoch2Swaps.D;
    const aliceEpoch2Gain = aliceFinalEntitlement - aliceEntitlementAfterBob;
    const bobEpoch2Gain = bobFinalEntitlement - bobEntitlementAfterBob;
    const expectedAliceEpoch2Gain = (epoch2FeeIncrement * lpAlice) / stateAfterEpoch2Swaps.D;
    const expectedBobEpoch2Gain = (epoch2FeeIncrement * lpBob) / stateAfterEpoch2Swaps.D;
    expect(aliceEpoch2Gain).toBeGreaterThanOrEqual(expectedAliceEpoch2Gain - 1n);
    expect(aliceEpoch2Gain).toBeLessThanOrEqual(expectedAliceEpoch2Gain + 1n);
    expect(bobEpoch2Gain).toBeGreaterThanOrEqual(expectedBobEpoch2Gain - 1n);
    expect(bobEpoch2Gain).toBeLessThanOrEqual(expectedBobEpoch2Gain + 1n);

    // --- Epoch 5 (t4): Bob and Alice both withdraw 100% of their LP tokens ---
    await clammRemoveLiquiditySender({
      algod,
      account: bobSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend: lpBob / LP_SCALE,
    });
    await clammRemoveLiquiditySender({
      algod,
      account: aliceSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend: lpAlice / LP_SCALE,
    });

    const finalState = await readPoolAccounting(algod, poolClient, assetLp);
    expect(finalState.D).toBe(0n);
    expect(finalState.Lu).toBe(0n);
    // Only sub-micro-LP rounding dust (< 2 micro-LP) remains in the pool
    expect(finalState.L).toBeLessThan(2n * LP_SCALE);
  });

  test('2. Withdrawal order independence (Alice first vs Bob first) and Biatec protocol fee isolation', async () => {
    const runTwinScenario = async (withdrawOrder: 'ALICE_FIRST' | 'BOB_FIRST') => {
      await setAssetAId(1n);
      const { algod } = fixture.context;

      // LP fee = 5%, Biatec fee = 20% of LP fee
      const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        assetA: assetAId,
        biatecFee: 200_000_000n, // 20%
        lpFee: 50_000_000n, // 5%
        p: BigInt(1.25 * SCALE),
        p1: BigInt(1.0 * SCALE),
        p2: BigInt(1.5625 * SCALE),
      });

      const poolClient = clientBiatecClammPoolProvider.appClient;
      const assetLp = await poolClient.getLpTokenId();

      const alice = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
      const bob = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
      const trader = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
      const aliceSigner = createSignerAccount(alice);
      const bobSigner = createSignerAccount(bob);
      const traderSigner = createSignerAccount(trader);

      await optInAndFundAccount(algod, alice, [assetAId, assetBId, assetLp], BigInt(200 * SCALE_A), BigInt(200 * SCALE_B));
      await optInAndFundAccount(algod, bob, [assetAId, assetBId, assetLp], BigInt(200 * SCALE_A), BigInt(200 * SCALE_B));
      await optInAndFundAccount(algod, trader, [assetAId, assetBId], BigInt(200 * SCALE_A), BigInt(200 * SCALE_B));

      // Alice deposits 50 A + 50 B at t0
      await clammAddLiquiditySender({
        algod,
        account: aliceSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        clientBiatecClammPool: poolClient,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        assetA: assetAId,
        assetB: assetBId,
        assetLp,
        assetADeposit: BigInt(50 * SCALE_A),
        assetBDeposit: BigInt(50 * SCALE_B),
      });

      // Swaps at t1
      await clammSwapSender({
        algod,
        account: traderSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
        clientBiatecClammPool: poolClient,
        assetA: assetAId,
        assetB: assetBId,
        fromAsset: assetAId,
        fromAmount: BigInt(10 * SCALE_A),
        minimumToReceive: 0n,
      });

      const sAfterSwap1 = await readPoolAccounting(algod, poolClient, assetLp);
      expect(sAfterSwap1.Lu).toBeGreaterThan(0n);
      expect(sAfterSwap1.Lb).toBeGreaterThan(0n);

      // Bob deposits 25 A + 25 B at t2
      await clammAddLiquiditySender({
        algod,
        account: bobSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        clientBiatecClammPool: poolClient,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        assetA: assetAId,
        assetB: assetBId,
        assetLp,
        assetADeposit: BigInt(25 * SCALE_A),
        assetBDeposit: BigInt(25 * SCALE_B),
      });

      const sAfterBob = await readPoolAccounting(algod, poolClient, assetLp);
      // Biatec protocol fees Lb must not be altered when Bob adds liquidity
      expect(sAfterBob.Lb).toBe(sAfterSwap1.Lb);

      // Swaps at t3
      await clammSwapSender({
        algod,
        account: traderSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
        clientBiatecClammPool: poolClient,
        assetA: assetAId,
        assetB: assetBId,
        fromAsset: assetBId,
        fromAmount: BigInt(12 * SCALE_B),
        minimumToReceive: 0n,
      });

      const aliceLpHeld = await getAssetBalance(algod, alice.addr.toString(), assetLp);
      const bobLpHeld = await getAssetBalance(algod, bob.addr.toString(), assetLp);
      const aliceABefore = await getAssetBalance(algod, alice.addr.toString(), assetAId);
      const aliceBBefore = await getAssetBalance(algod, alice.addr.toString(), assetBId);
      const bobABefore = await getAssetBalance(algod, bob.addr.toString(), assetAId);
      const bobBBefore = await getAssetBalance(algod, bob.addr.toString(), assetBId);

      if (withdrawOrder === 'ALICE_FIRST') {
        await clammRemoveLiquiditySender({
          algod,
          account: aliceSigner,
          appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
          appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
          clientBiatecClammPool: poolClient,
          assetA: assetAId,
          assetB: assetBId,
          assetLp,
          lpToSend: aliceLpHeld,
        });
        await clammRemoveLiquiditySender({
          algod,
          account: bobSigner,
          appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
          appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
          clientBiatecClammPool: poolClient,
          assetA: assetAId,
          assetB: assetBId,
          assetLp,
          lpToSend: bobLpHeld,
        });
      } else {
        await clammRemoveLiquiditySender({
          algod,
          account: bobSigner,
          appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
          appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
          clientBiatecClammPool: poolClient,
          assetA: assetAId,
          assetB: assetBId,
          assetLp,
          lpToSend: bobLpHeld,
        });
        await clammRemoveLiquiditySender({
          algod,
          account: aliceSigner,
          appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
          appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
          clientBiatecClammPool: poolClient,
          assetA: assetAId,
          assetB: assetBId,
          assetLp,
          lpToSend: aliceLpHeld,
        });
      }

      const aliceWithdrawnA = (await getAssetBalance(algod, alice.addr.toString(), assetAId)) - aliceABefore;
      const aliceWithdrawnB = (await getAssetBalance(algod, alice.addr.toString(), assetBId)) - aliceBBefore;
      const bobWithdrawnA = (await getAssetBalance(algod, bob.addr.toString(), assetAId)) - bobABefore;
      const bobWithdrawnB = (await getAssetBalance(algod, bob.addr.toString(), assetBId)) - bobBBefore;

      // Biatec withdraws its protocol fee share Lb
      const adminABefore = await getAssetBalance(algod, deployer.addr.toString(), assetAId);
      const adminBBefore = await getAssetBalance(algod, deployer.addr.toString(), assetBId);
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
      const adminWithdrawnA = (await getAssetBalance(algod, deployer.addr.toString(), assetAId)) - adminABefore;
      const adminWithdrawnB = (await getAssetBalance(algod, deployer.addr.toString(), assetBId)) - adminBBefore;

      const sFinal = await readPoolAccounting(algod, poolClient, assetLp);
      expect(sFinal.D).toBe(0n);
      expect(sFinal.Lu).toBe(0n);
      expect(sFinal.Lb).toBe(0n);

      return {
        aliceWithdrawnA,
        aliceWithdrawnB,
        bobWithdrawnA,
        bobWithdrawnB,
        adminWithdrawnA,
        adminWithdrawnB,
      };
    };

    const resAliceFirst = await runTwinScenario('ALICE_FIRST');
    const resBobFirst = await runTwinScenario('BOB_FIRST');

    console.log('Withdrawal order comparison:', { resAliceFirst, resBobFirst });

    // Payouts to Alice, Bob, and Biatec must be order-independent (within <= 2 smallest asset units due to integer division)
    const diff = (a: bigint, b: bigint) => (a >= b ? a - b : b - a);
    expect(diff(resAliceFirst.aliceWithdrawnA, resBobFirst.aliceWithdrawnA)).toBeLessThanOrEqual(2n);
    expect(diff(resAliceFirst.aliceWithdrawnB, resBobFirst.aliceWithdrawnB)).toBeLessThanOrEqual(2n);
    expect(diff(resAliceFirst.bobWithdrawnA, resBobFirst.bobWithdrawnA)).toBeLessThanOrEqual(2n);
    expect(diff(resAliceFirst.bobWithdrawnB, resBobFirst.bobWithdrawnB)).toBeLessThanOrEqual(2n);
    expect(diff(resAliceFirst.adminWithdrawnA, resBobFirst.adminWithdrawnA)).toBeLessThanOrEqual(2n);
    expect(diff(resAliceFirst.adminWithdrawnB, resBobFirst.adminWithdrawnB)).toBeLessThanOrEqual(2n);
  });

  test('3. Three LPs (Alice, Bob, Charlie) joining at three different times with partial and full withdrawals', async () => {
    await setAssetAId(1n);
    const { algod } = fixture.context;

    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
      algod,
      assetA: assetAId,
      biatecFee: 100_000_000n, // 10% Biatec share
      lpFee: 30_000_000n, // 3% LP fee
      p: BigInt(1.0 * SCALE),
      p1: BigInt(0.8 * SCALE),
      p2: BigInt(1.25 * SCALE),
    });

    const poolClient = clientBiatecClammPoolProvider.appClient;
    const assetLp = await poolClient.getLpTokenId();

    const alice = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const bob = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const charlie = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const trader = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });

    const aliceSigner = createSignerAccount(alice);
    const bobSigner = createSignerAccount(bob);
    const charlieSigner = createSignerAccount(charlie);
    const traderSigner = createSignerAccount(trader);

    await optInAndFundAccount(algod, alice, [assetAId, assetBId, assetLp], BigInt(300 * SCALE_A), BigInt(300 * SCALE_B));
    await optInAndFundAccount(algod, bob, [assetAId, assetBId, assetLp], BigInt(300 * SCALE_A), BigInt(300 * SCALE_B));
    await optInAndFundAccount(algod, charlie, [assetAId, assetBId, assetLp], BigInt(300 * SCALE_A), BigInt(300 * SCALE_B));
    await optInAndFundAccount(algod, trader, [assetAId, assetBId], BigInt(500 * SCALE_A), BigInt(500 * SCALE_B));

    const assertConservationInvariant = async (stepLabel: string, maxDustOps: bigint) => {
      const s = await readPoolAccounting(algod, poolClient, assetLp);
      const absUnowned = s.unowned >= 0n ? s.unowned : -s.unowned;
      console.log(`[${stepLabel}] L=${s.L} D=${s.D} Lu=${s.Lu} Lb=${s.Lb} unowned=${s.unowned}`);
      expect(absUnowned).toBeLessThanOrEqual(maxDustOps * LP_SCALE);
      return s;
    };

    // Step 1: Alice joins at t0
    await clammAddLiquiditySender({
      algod,
      account: aliceSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: BigInt(100 * SCALE_A),
      assetBDeposit: BigInt(100 * SCALE_B),
    });
    await assertConservationInvariant('after Alice deposit', 1n);

    // Step 2: Epoch 1 swaps
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetAId,
      fromAmount: BigInt(15 * SCALE_A),
      minimumToReceive: 0n,
    });
    const sEpoch1 = await assertConservationInvariant('after Epoch 1 swap', 1n);

    // Step 3: Bob joins at t1
    await clammAddLiquiditySender({
      algod,
      account: bobSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: BigInt(60 * SCALE_A),
      assetBDeposit: BigInt(60 * SCALE_B),
    });
    const sAfterBob = await assertConservationInvariant('after Bob deposit', 2n);

    // Step 4: Epoch 2 swaps
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetBId,
      fromAmount: BigInt(25 * SCALE_B),
      minimumToReceive: 0n,
    });
    const sEpoch2 = await assertConservationInvariant('after Epoch 2 swap', 2n);

    // Step 5: Charlie joins at t2
    await clammAddLiquiditySender({
      algod,
      account: charlieSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: BigInt(40 * SCALE_A),
      assetBDeposit: BigInt(40 * SCALE_B),
    });
    const sAfterCharlie = await assertConservationInvariant('after Charlie deposit', 3n);
    const deltaLCharlie = sAfterCharlie.L - sEpoch2.L;
    const lpCharlie = (await getAssetBalance(algod, charlie.addr.toString(), assetLp)) * LP_SCALE;
    const charlieEntitlementImmediate = lpCharlie + (sAfterCharlie.Lu * lpCharlie) / sAfterCharlie.D;
    expect(charlieEntitlementImmediate).toBeLessThanOrEqual(deltaLCharlie);

    // Step 6: Alice withdraws 50% of her LP tokens at t3
    const aliceLpTotal = await getAssetBalance(algod, alice.addr.toString(), assetLp);
    const aliceHalfLp = aliceLpTotal / 2n;
    await clammRemoveLiquiditySender({
      algod,
      account: aliceSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend: aliceHalfLp,
    });
    await assertConservationInvariant('after Alice 50% withdrawal', 4n);

    // Step 7: Epoch 3 swaps (shared between Alice's remaining 50%, Bob, and Charlie)
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetAId,
      fromAmount: BigInt(20 * SCALE_A),
      minimumToReceive: 0n,
    });
    const sEpoch3 = await assertConservationInvariant('after Epoch 3 swap', 4n);
    expect(sEpoch3.Lb).toBeGreaterThan(sEpoch2.Lb);
    expect(sAfterBob.Lb).toBe(sEpoch1.Lb);

    // Step 8: Charlie, Bob, and Alice withdraw all remaining LP tokens
    const charlieLpRem = await getAssetBalance(algod, charlie.addr.toString(), assetLp);
    const bobLpRem = await getAssetBalance(algod, bob.addr.toString(), assetLp);
    const aliceLpRem = await getAssetBalance(algod, alice.addr.toString(), assetLp);

    await clammRemoveLiquiditySender({
      algod,
      account: charlieSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend: charlieLpRem,
    });
    await clammRemoveLiquiditySender({
      algod,
      account: bobSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend: bobLpRem,
    });
    await clammRemoveLiquiditySender({
      algod,
      account: aliceSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend: aliceLpRem,
    });

    const sAfterAllUsers = await assertConservationInvariant('after all users withdraw', 7n);
    expect(sAfterAllUsers.D).toBe(0n);
    expect(sAfterAllUsers.Lu).toBe(0n);
    expect(sAfterAllUsers.Lb).toBe(sEpoch3.Lb);
  });

  test('4. Staking / excess-asset reward distribution across multiple LPs joining at different times', async () => {
    await setAssetAId(1n);
    const { algod } = fixture.context;

    // Flat-price pool (priceMin === priceMax === 1.0), Biatec fee = 10%
    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
      algod,
      assetA: assetAId,
      biatecFee: 100_000_000n, // 10% Biatec share on distributed rewards
      lpFee: 0n,
      p: BigInt(SCALE),
      p1: BigInt(SCALE),
      p2: BigInt(SCALE),
    });

    const poolClient = clientBiatecClammPoolProvider.appClient;
    const poolAddr = poolClient.appAddress;
    const assetLp = await poolClient.getLpTokenId();

    const alice = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const bob = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const aliceSigner = createSignerAccount(alice);
    const bobSigner = createSignerAccount(bob);

    await optInAndFundAccount(algod, alice, [assetAId, assetBId, assetLp], BigInt(200 * SCALE_A), BigInt(200 * SCALE_B));
    await optInAndFundAccount(algod, bob, [assetAId, assetBId, assetLp], BigInt(200 * SCALE_A), BigInt(200 * SCALE_B));

    // Step 1: Alice stakes 100 A + 100 B at t0
    await clammAddLiquiditySender({
      algod,
      account: aliceSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: BigInt(100 * SCALE_A),
      assetBDeposit: BigInt(100 * SCALE_B),
    });

    // Step 2: External rewards (20 A + 20 B) arrive and are distributed via distributeExcessAssets at t1
    const params = await algod.getTransactionParams().do();
    const rewardTxA1 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(20 * SCALE_A),
      assetIndex: Number(assetAId),
      sender: deployer.addr,
      receiver: poolAddr,
      suggestedParams: params,
    });
    const rewardTxB1 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(20 * SCALE_B),
      assetIndex: Number(assetBId),
      sender: deployer.addr,
      receiver: poolAddr,
      suggestedParams: params,
    });
    algosdk.assignGroupID([rewardTxA1, rewardTxB1]);
    await algod.sendRawTransaction([rewardTxA1.signTxn(deployer.sk), rewardTxB1.signTxn(deployer.sk)]).do();
    await algosdk.waitForConfirmation(algod, rewardTxA1.txID(), 4);

    await clammDistributeExcessAssetsSender({
      algod,
      account: deployerSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      amountA: 1n, // distribute all excess A
      amountB: 1n, // distribute all excess B
    });

    const sAfterReward1 = await readPoolAccounting(algod, poolClient, assetLp);
    // 20 A + 20 B at price 1.0 = 40e9 liquidity; 90% = 36e9 to Lu, 10% = 4e9 to Lb
    expect(sAfterReward1.Lu).toBe(BigInt(36 * SCALE));
    expect(sAfterReward1.Lb).toBe(BigInt(4 * SCALE));

    // Step 3: Bob deposits 60 A + 60 B at t2 (after Reward 1)
    const bobABefore = await getAssetBalance(algod, bob.addr.toString(), assetAId);
    const bobBBefore = await getAssetBalance(algod, bob.addr.toString(), assetBId);
    await clammAddLiquiditySender({
      algod,
      account: bobSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: BigInt(60 * SCALE_A),
      assetBDeposit: BigInt(60 * SCALE_B),
    });

    // Step 4: Second reward (10 A + 10 B) arrives and is distributed while BOTH Alice and Bob are staked
    const params2 = await algod.getTransactionParams().do();
    const rewardTxA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(10 * SCALE_A),
      assetIndex: Number(assetAId),
      sender: deployer.addr,
      receiver: poolAddr,
      suggestedParams: params2,
    });
    const rewardTxB2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(10 * SCALE_B),
      assetIndex: Number(assetBId),
      sender: deployer.addr,
      receiver: poolAddr,
      suggestedParams: params2,
    });
    algosdk.assignGroupID([rewardTxA2, rewardTxB2]);
    await algod.sendRawTransaction([rewardTxA2.signTxn(deployer.sk), rewardTxB2.signTxn(deployer.sk)]).do();
    await algosdk.waitForConfirmation(algod, rewardTxA2.txID(), 4);

    await clammDistributeExcessAssetsSender({
      algod,
      account: deployerSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      amountA: BigInt(10 * SCALE),
      amountB: BigInt(10 * SCALE),
    });

    // Step 5: Both Bob and Alice unstake
    const bobLp = await getAssetBalance(algod, bob.addr.toString(), assetLp);
    const aliceLp = await getAssetBalance(algod, alice.addr.toString(), assetLp);

    await clammRemoveLiquiditySender({
      algod,
      account: bobSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend: bobLp,
    });
    await clammRemoveLiquiditySender({
      algod,
      account: aliceSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      lpToSend: aliceLp,
    });

    const bobNetGainA = (await getAssetBalance(algod, bob.addr.toString(), assetAId)) - bobABefore;
    const bobNetGainB = (await getAssetBalance(algod, bob.addr.toString(), assetBId)) - bobBBefore;

    // At t2, Alice's active user liquidity was 200 + 36 = 236 L; Bob added 120 L (total user liquidity = 356 L).
    // Reward 2 added 18 L to Lu (9 A + 9 B). Bob's share of Reward 2 is 120 / 356 * 9 = ~3.0337 A and ~3.0337 B.
    // Bob must NOT receive any of Reward 1 (which would have given him > 6 A and > 6 B).
    const expectedBobRewardA = (BigInt(9 * SCALE_A) * 120n) / 356n;
    const expectedBobRewardB = (BigInt(9 * SCALE_B) * 120n) / 356n;
    expect(bobNetGainA).toBeLessThanOrEqual(expectedBobRewardA + 2n);
    expect(bobNetGainA).toBeGreaterThanOrEqual(expectedBobRewardA - 100n);
    expect(bobNetGainB).toBeLessThanOrEqual(expectedBobRewardB + 2n);
    expect(bobNetGainB).toBeGreaterThanOrEqual(expectedBobRewardB - 10n);
  });

  test('5. Rapid deposit/withdraw cycling by a second party never siphons fees or bleeds the pool', async () => {
    await setAssetAId(1n);
    const { algod } = fixture.context;

    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
      algod,
      assetA: assetAId,
      biatecFee: 150_000_000n,
      lpFee: 50_000_000n,
      p: BigInt(1.0 * SCALE),
      p1: BigInt(0.9 * SCALE),
      p2: BigInt(1.1 * SCALE),
    });

    const poolClient = clientBiatecClammPoolProvider.appClient;
    const assetLp = await poolClient.getLpTokenId();

    const alice = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const cycler = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const trader = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const aliceSigner = createSignerAccount(alice);
    const cyclerSigner = createSignerAccount(cycler);
    const traderSigner = createSignerAccount(trader);

    await optInAndFundAccount(algod, alice, [assetAId, assetBId, assetLp], BigInt(200 * SCALE_A), BigInt(200 * SCALE_B));
    await optInAndFundAccount(algod, cycler, [assetAId, assetBId, assetLp], BigInt(200 * SCALE_A), BigInt(200 * SCALE_B));
    await optInAndFundAccount(algod, trader, [assetAId, assetBId], BigInt(200 * SCALE_A), BigInt(200 * SCALE_B));

    // Alice provides base liquidity
    await clammAddLiquiditySender({
      algod,
      account: aliceSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
      assetA: assetAId,
      assetB: assetBId,
      assetLp,
      assetADeposit: BigInt(100 * SCALE_A),
      assetBDeposit: BigInt(100 * SCALE_B),
    });

    // Trader swaps in both directions so substantial fees accrue in Lu and Lb
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetAId,
      fromAmount: BigInt(25 * SCALE_A),
      minimumToReceive: 0n,
    });
    await clammSwapSender({
      algod,
      account: traderSigner,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: assetAId,
      assetB: assetBId,
      fromAsset: assetBId,
      fromAmount: BigInt(25 * SCALE_B),
      minimumToReceive: 0n,
    });

    const stateBeforeCycling = await readPoolAccounting(algod, poolClient, assetLp);
    const poolAddr = poolClient.appAddress.toString();
    const poolRealABefore = await getAssetBalance(algod, poolAddr, assetAId);
    const poolRealBBefore = await getAssetBalance(algod, poolAddr, assetBId);
    const aliceLpBase = (await getAssetBalance(algod, alice.addr.toString(), assetLp)) * LP_SCALE;
    const aliceEntitlementBefore = aliceLpBase + stateBeforeCycling.Lu;

    // Cycler performs 5 consecutive addLiquidity + removeLiquidity cycles in-ratio
    for (let i = 0; i < 5; i += 1) {
      const sBefore = await readPoolAccounting(algod, poolClient, assetLp);
      const depA = sBefore.ab / 10n / sBefore.scaleA;
      const depB = sBefore.bb / 10n / sBefore.scaleB;

      const cyclerABefore = await getAssetBalance(algod, cycler.addr.toString(), assetAId);
      const cyclerBBefore = await getAssetBalance(algod, cycler.addr.toString(), assetBId);

      await clammAddLiquiditySender({
        algod,
        account: cyclerSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        clientBiatecClammPool: poolClient,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        assetA: assetAId,
        assetB: assetBId,
        assetLp,
        assetADeposit: depA,
        assetBDeposit: depB,
      });

      const cyclerLp = await getAssetBalance(algod, cycler.addr.toString(), assetLp);
      expect(cyclerLp).toBeGreaterThan(0n);

      await clammRemoveLiquiditySender({
        algod,
        account: cyclerSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        clientBiatecClammPool: poolClient,
        assetA: assetAId,
        assetB: assetBId,
        assetLp,
        lpToSend: cyclerLp,
      });

      const cyclerAAfter = await getAssetBalance(algod, cycler.addr.toString(), assetAId);
      const cyclerBAfter = await getAssetBalance(algod, cycler.addr.toString(), assetBId);

      // Cycler must never profit in either asset
      expect(cyclerAAfter).toBeLessThanOrEqual(cyclerABefore);
      expect(cyclerBAfter).toBeLessThanOrEqual(cyclerBBefore);
    }

    const stateAfterCycling = await readPoolAccounting(algod, poolClient, assetLp);
    const poolRealAAfter = await getAssetBalance(algod, poolAddr, assetAId);
    const poolRealBAfter = await getAssetBalance(algod, poolAddr, assetBId);
    const aliceEntitlementAfter = aliceLpBase + stateAfterCycling.Lu;
    // Alice's liquidity entitlement and the pool's physical asset holdings must be >= before cycling
    expect(aliceEntitlementAfter).toBeGreaterThanOrEqual(aliceEntitlementBefore);
    expect(poolRealAAfter).toBeGreaterThanOrEqual(poolRealABefore);
    expect(poolRealBAfter).toBeGreaterThanOrEqual(poolRealBBefore);
    expect(stateAfterCycling.Lb).toBe(stateBeforeCycling.Lb);
  });
});
