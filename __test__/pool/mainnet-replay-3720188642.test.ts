/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/**
 * Replay of the full mainnet history of pool app 3720188642 (Gold / GoldDAO, price range 128-256, LP fee 0.1%, Biatec fee 20%).
 *
 * The data in ../test-data/mainnet-pool-3720188642.json was downloaded from the mainnet indexer and contains every
 * addLiquidity / swap / removeLiquidity call with the exact amounts and the global state after each call.
 *
 * Observed on mainnet: after the only LP holder redeemed 100% of the LP tokens, the pool still held ~1.04 Gold and
 * ~61.6 GoldDAO with L = 57.3, although the fees collected for Biatec were only Lb = 0.045 liquidity units.
 *
 * This test replays the same sequence against a fresh pool on localnet and asserts the accounting invariant
 * L == distributedLp + Lu + Lb (all liquidity is owned by somebody) after every liquidity operation.
 */
import { describe, test, expect } from '@jest/globals';
import replay from '../test-data/mainnet-pool-3720188642.json';
import { setupPool, deployer, deployerSigner, fixture, algosdk, algokit, type TransactionSignerAccount } from './shared-setup';
import createToken from '../../src/createToken';
import clammAddLiquiditySender from '../../src/biatecClamm/sender/clammAddLiquiditySender';
import clammSwapSender from '../../src/biatecClamm/sender/clammSwapSender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';
import clammRemoveLiquidityAdminSender from '../../src/biatecClamm/sender/clammRemoveLiquidityAdminSender';

const LP_SCALE = 1000n; // LP token has 6 decimals, base scale has 9
const TOTAL_LP_SUPPLY = 18_000_000_000_000_000_000n;
// one LP micro-unit (1e-6 LP = 1000 base units) of rounding allowed per liquidity operation
const ORPHAN_TOLERANCE_PER_OP = 1000n;
// REPLAY_STRICT=0 only reproduces the mainnet history and reports the accounting without failing on the invariants
const STRICT = process.env.REPLAY_STRICT !== '0';

type PoolState = {
  L: bigint;
  Lu: bigint;
  Lb: bigint;
  ab: bigint;
  bb: bigint;
  price: bigint;
  lpInPool: bigint;
};

describe('Mainnet replay - pool 3720188642 (Gold/GoldDAO)', () => {
  test('replaying all mainnet transactions must not leave orphaned liquidity in the pool', async () => {
    // 1. create two 6-decimal assets like Gold (1241944285) and GoldDAO (1241945177)
    await fixture.newScope();
    const { algod } = fixture.context;
    const tokenCreator = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(50_000_000) });
    const gold = BigInt(await createToken({ account: tokenCreator, algod, name: 'Gold', decimals: replay.source.assetADecimals }));
    const goldDao = BigInt(await createToken({ account: tokenCreator, algod, name: 'GoldDAO', decimals: replay.source.assetBDecimals }));
    expect(gold).toBeLessThan(goldDao);

    // 2. deploy the pool with the mainnet configuration
    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
      assetA: gold,
      assetB: goldDao,
      useProvidedAssets: true,
      biatecFee: BigInt(replay.source.biatecFee),
      lpFee: BigInt(replay.source.lpFee),
      p1: BigInt(replay.source.priceMin),
      p2: BigInt(replay.source.priceMax),
      p: BigInt(replay.source.initialPrice),
    });
    const poolClient = clientBiatecClammPoolProvider.appClient;
    const poolAddress = poolClient.appAddress.toString();
    const initialState = await poolClient.state.global.getAll();
    const assetLp = BigInt(initialState.assetLp ?? 0n);
    expect(assetLp).toBeGreaterThan(0n);
    expect(BigInt(initialState.fee ?? 0n)).toBe(BigInt(replay.source.lpFee));

    // 3. one localnet account per mainnet actor, funded with the assets and registered in the identity provider
    //    with the fee multiplier / verification class recorded on mainnet for that address
    const actors: Record<string, { account: algosdk.Account; signer: TransactionSignerAccount }> = {};
    const identityPay = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: deployer.addr,
      amount: 2_000_000,
      receiver: clientBiatecIdentityProvider.appClient.appAddress,
      suggestedParams: await algod.getTransactionParams().do(),
    });
    await algod.sendRawTransaction(identityPay.signTxn(deployer.sk)).do();
    for (const [mainnetAddress, identity] of Object.entries(replay.source.identities)) {
      const account = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(20_000_000) });
      const signer: TransactionSignerAccount = {
        addr: account.addr,
        signer: async (txnGroup: algosdk.Transaction[]) => txnGroup.map((tx) => tx.signTxn(account.sk)),
      };
      actors[mainnetAddress] = { account, signer };
      const params = await algod.getTransactionParams().do();
      const optIns = [gold, goldDao, assetLp].map((assetIndex) =>
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ amount: 0, assetIndex, sender: account.addr, receiver: account.addr, suggestedParams: params })
      );
      const funding = [
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ amount: 100_000_000n, assetIndex: gold, sender: tokenCreator.addr, receiver: account.addr, suggestedParams: params }),
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ amount: 3_000_000_000n, assetIndex: goldDao, sender: tokenCreator.addr, receiver: account.addr, suggestedParams: params }),
      ];
      algosdk.assignGroupID([...optIns, ...funding]);
      const signed = [...optIns.map((t) => t.signTxn(account.sk)), ...funding.map((t) => t.signTxn(tokenCreator.sk))];
      const { txid } = await algod.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(algod, txid, 4);
      await clientBiatecIdentityProvider.appClient.send.setInfo({
        args: {
          user: account.addr.toString(),
          info: {
            feeMultiplier: BigInt(identity.feeMultiplier),
            feeMultiplierBase: BigInt(identity.base),
            verificationStatus: 0n,
            verificationClass: BigInt(identity.verificationClass),
            isCompany: false,
            personUuid: '00000000-0000-0000-0000-000000000000',
            legalEntityUuid: '00000000-0000-0000-0000-000000000000',
            biatecEngagementPoints: 0n,
            biatecEngagementRank: 0n,
            avmEngagementPoints: 0n,
            avmEngagementRank: 0n,
            tradingEngagementPoints: 0n,
            tradingEngagementRank: 0n,
            isLocked: identity.isLocked,
            kycExpiration: 0n,
            investorForExpiration: 0n,
            isProfessionalInvestor: false,
          },
        },
      });
      console.log(`mainnet ${mainnetAddress} -> localnet ${account.addr.toString()} feeMultiplier=${identity.feeMultiplier}/${identity.base} verificationClass=${identity.verificationClass}`);
    }
    const actorOf = (mainnetAddress: string) => {
      const actor = actors[mainnetAddress];
      if (!actor) throw new Error(`no identity recorded for ${mainnetAddress}`);
      return actor;
    };

    const holding = async (address: string, asset: bigint): Promise<bigint> => {
      try {
        const info = await algod.accountAssetInformation(address, asset).do();
        return BigInt(info.assetHolding?.amount ?? 0n);
      } catch {
        return 0n;
      }
    };
    const readState = async (): Promise<PoolState> => {
      const s = await poolClient.state.global.getAll();
      return {
        L: BigInt(s.liquidity ?? 0n),
        Lu: BigInt(s.liquidityUsersFromFees ?? 0n),
        Lb: BigInt(s.liquidityBiatecFromFees ?? 0n),
        ab: BigInt(s.assetABalanceBaseScale ?? 0n),
        bb: BigInt(s.assetBBalanceBaseScale ?? 0n),
        price: BigInt(s.currentPrice ?? 0n),
        lpInPool: await holding(poolAddress, assetLp),
      };
    };
    // liquidity that is owned neither by an LP token holder nor by the users / biatec fee accounts
    const orphanedLiquidity = (s: PoolState): bigint => s.L - s.Lu - s.Lb - (TOTAL_LP_SUPPLY - s.lpInPool) * LP_SCALE;

    const common = {
      algod,
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      clientBiatecClammPool: poolClient,
      assetA: gold,
      assetB: goldDao,
      assetLp,
    };

    const mainnetFinal = replay.source.finalOnChain;
    const mainnetOrphan = BigInt(mainnetFinal.L) - BigInt(mainnetFinal.Lu) - BigInt(mainnetFinal.Lb);
    console.log(`mainnet final state: L=${mainnetFinal.L} Lu=${mainnetFinal.Lu} Lb=${mainnetFinal.Lb} => liquidity owned by nobody: ${mainnetOrphan} (${Number(mainnetOrphan) / 1e9} L)`);

    let liquidityOps = 0;
    let removed = false;
    // Lu is compared to the mainnet trace up to a constant offset established at deposit time (0 with the current
    // contract, since flooring dust is not booked as fee income)
    let mainnetLu = 0n;
    let luOffset = 0n;
    let swapsBeforeRemoval = 0;
    let swapsMatchingMainnet = 0;
    let volumeAInBase = 0n;
    let volumeBInBase = 0n;
    const trailingSwaps: string[] = [];

    // 4. replay every mainnet operation in the original order
    for (const op of replay.ops) {
      if (op.method === 'addLiquidity') {
        const { account, signer } = actorOf(op.sender!);
        const lpBefore = await holding(account.addr.toString(), assetLp);
        await clammAddLiquiditySender({
          ...common,
          account: signer,
          clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
          assetADeposit: BigInt(op.assetADeposit!),
          assetBDeposit: BigInt(op.assetBDeposit!),
        });
        const lpAfter = await holding(account.addr.toString(), assetLp);
        const lpReceived = lpAfter - lpBefore;
        const s = await readState();
        liquidityOps += 1;
        console.log(
          `round ${op.round} addLiquidity A=${op.assetADeposit} B=${op.assetBDeposit}: LP received ${lpReceived} (mainnet ${op.lpTokensReceived}), L=${s.L} (mainnet ${op.stateAfter.L}), orphaned=${orphanedLiquidity(s)}`
        );
        // the pool balances and liquidity do not depend on how many LP tokens are minted - they must match mainnet exactly
        expect(s.L).toBe(BigInt(op.stateAfter.L!));
        expect(s.ab).toBe(BigInt(op.stateAfter.ab!));
        expect(s.bb).toBe(BigInt(op.stateAfter.bb!));
        expect(s.price).toBe(BigInt(op.stateAfter.price!));
        if (op.stateAfter.Lu !== undefined) mainnetLu = BigInt(op.stateAfter.Lu);
        luOffset = s.Lu - mainnetLu;
        if (STRICT) {
          // the depositor must never receive less than what the mainnet contract paid out
          expect(lpReceived).toBeGreaterThanOrEqual(BigInt(op.lpTokensReceived!));
          // every unit of liquidity must be owned by somebody
          expect(orphanedLiquidity(s)).toBeLessThanOrEqual(ORPHAN_TOLERANCE_PER_OP * BigInt(liquidityOps));
          expect(orphanedLiquidity(s)).toBeGreaterThanOrEqual(-ORPHAN_TOLERANCE_PER_OP * BigInt(liquidityOps));
        } else {
          expect(lpReceived).toBe(BigInt(op.lpTokensReceived!));
        }
      } else if (op.method === 'swap') {
        const fromAsset = op.fromAsset === 'A' ? gold : goldDao;
        const toAsset = op.fromAsset === 'A' ? goldDao : gold;
        const { account, signer } = actorOf(op.sender!);
        const before = await holding(account.addr.toString(), toAsset);
        let swapRejected = false;
        try {
          await clammSwapSender({
            ...common,
            account: signer,
            appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
            fromAsset,
            fromAmount: BigInt(op.amountIn!),
            minimumToReceive: 0n,
          });
        } catch (e: any) {
          if (!removed) throw e;
          swapRejected = true;
          trailingSwaps.push(`round ${op.round} swap ${op.amountIn} ${op.fromAsset} (fee x${Number(op.feeMultiplier) / 1e9}): rejected (${String(e?.message ?? e).slice(0, 80)})`);
        }
        if (!swapRejected) {
          const after = await holding(account.addr.toString(), toAsset);
          const received = after - before;
          const s = await readState();
          if (!removed) {
            swapsBeforeRemoval += 1;
            if (op.fromAsset === 'A') volumeAInBase += BigInt(op.amountIn!) * 1000n;
            else volumeBInBase += BigInt(op.amountIn!) * 1000n;
            if (received === BigInt(op.amountOut!)) swapsMatchingMainnet += 1;
            else console.log(`round ${op.round} swap ${op.amountIn} ${op.fromAsset} (fee x${Number(op.feeMultiplier) / 1e9}): received ${received}, mainnet ${op.amountOut}`);
            // swaps do not depend on LP token accounting - they must reproduce mainnet exactly
            mainnetLu = BigInt(op.stateAfter.Lu!);
            expect(received).toBe(BigInt(op.amountOut!));
            expect(s.L).toBe(BigInt(op.stateAfter.L!));
            expect(s.Lu - luOffset).toBe(mainnetLu);
            expect(s.Lb).toBe(BigInt(op.stateAfter.Lb!));
            expect(s.ab).toBe(BigInt(op.stateAfter.ab!));
            expect(s.bb).toBe(BigInt(op.stateAfter.bb!));
            expect(s.price).toBe(BigInt(op.stateAfter.price!));
          } else {
            // on mainnet these swaps traded against the orphaned liquidity; here only biatec fee liquidity is left
            trailingSwaps.push(`round ${op.round} swap ${op.amountIn} ${op.fromAsset} (fee x${Number(op.feeMultiplier) / 1e9}): received ${received} (mainnet ${op.amountOut})`);
          }
        }
      } else if (op.method === 'removeLiquidity') {
        const { account, signer } = actorOf(op.sender!);
        const aBefore = await holding(account.addr.toString(), gold);
        const bBefore = await holding(account.addr.toString(), goldDao);
        const lpHeld = await holding(account.addr.toString(), assetLp);
        const stateBefore = await readState();
        // on mainnet the LP holder redeemed all LP tokens (1267809602); redeem everything we received as well
        await clammRemoveLiquiditySender({ ...common, account: signer, lpToSend: lpHeld });
        const aReceived = (await holding(account.addr.toString(), gold)) - aBefore;
        const bReceived = (await holding(account.addr.toString(), goldDao)) - bBefore;
        const s = await readState();
        liquidityOps += 1;
        removed = true;
        console.log(`round ${op.round} removeLiquidity LP=${lpHeld} (mainnet ${op.lpTokensSent}): received A=${aReceived} B=${bReceived} (mainnet A=${op.assetAReceived} B=${op.assetBReceived})`);
        console.log(`  state before removal L=${stateBefore.L} Lu=${stateBefore.Lu} Lb=${stateBefore.Lb} ab=${stateBefore.ab} bb=${stateBefore.bb}`);
        console.log(
          `  state after removal  L=${s.L} Lu=${s.Lu} Lb=${s.Lb} ab=${s.ab} bb=${s.bb} (mainnet L=${op.stateAfter.L} Lu=${op.stateAfter.Lu} Lb=${op.stateAfter.Lb} ab=${op.stateAfter.ab} bb=${op.stateAfter.bb})`
        );
        expect(s.lpInPool).toBe(TOTAL_LP_SUPPLY); // all LP tokens are back in the pool
        if (!STRICT) {
          expect(aReceived).toBe(BigInt(op.assetAReceived!));
          expect(bReceived).toBe(BigInt(op.assetBReceived!));
          expect(s.L).toBe(BigInt(op.stateAfter.L!));
        } else {
          expect(aReceived).toBeGreaterThanOrEqual(BigInt(op.assetAReceived!));
          expect(bReceived).toBeGreaterThanOrEqual(BigInt(op.assetBReceived!));
          // only the biatec fee liquidity may remain
          expect(s.Lu).toBe(0n);
          expect(orphanedLiquidity(s)).toBeLessThanOrEqual(ORPHAN_TOLERANCE_PER_OP * BigInt(liquidityOps));
          expect(orphanedLiquidity(s)).toBeGreaterThanOrEqual(-ORPHAN_TOLERANCE_PER_OP * BigInt(liquidityOps));
          // the remaining pool balances must correspond to the biatec fee share only (Lb / L of the pre-removal pool)
          const tolerance = ORPHAN_TOLERANCE_PER_OP * BigInt(liquidityOps);
          expect(s.ab).toBeLessThanOrEqual((stateBefore.ab * (stateBefore.Lb + tolerance)) / stateBefore.L + 1000n);
          expect(s.bb).toBeLessThanOrEqual((stateBefore.bb * (stateBefore.Lb + tolerance)) / stateBefore.L + 1000n);
        }
      }
    }
    expect(removed).toBe(true);
    expect(swapsMatchingMainnet).toBe(swapsBeforeRemoval);
    console.log(`${swapsBeforeRemoval} swaps before removal reproduced mainnet outputs exactly; volume A=${volumeAInBase} B=${volumeBInBase} (base scale)`);
    trailingSwaps.forEach((line) => console.log(line));

    // 5. biatec (deployer is the fee executor in the test config) withdraws its fee share - afterwards the pool must be (almost) empty
    const stateBeforeAdmin = await readState();
    if (stateBeforeAdmin.Lb > 0n) {
      const adminParams = await algod.getTransactionParams().do();
      const adminOptIns = [gold, goldDao].map((assetIndex) =>
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ amount: 0, assetIndex, sender: deployer.addr, receiver: deployer.addr, suggestedParams: adminParams })
      );
      algosdk.assignGroupID(adminOptIns);
      const { txid: optInTxId } = await algod.sendRawTransaction(adminOptIns.map((t) => t.signTxn(deployer.sk))).do();
      await algosdk.waitForConfirmation(algod, optInTxId, 4);
      await clammRemoveLiquidityAdminSender({
        algod,
        account: deployerSigner,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        clientBiatecClammPool: poolClient,
        assetA: gold,
        assetB: goldDao,
        assetLp,
        amount: 0n,
      });
    }
    const finalState = await readState();
    const finalA = await holding(poolAddress, gold);
    const finalB = await holding(poolAddress, goldDao);
    console.log(`after biatec fee withdrawal: L=${finalState.L} Lu=${finalState.Lu} Lb=${finalState.Lb} ab=${finalState.ab} bb=${finalState.bb}; real balances A=${finalA} B=${finalB}`);
    console.log(`mainnet pool kept A=${mainnetFinal.assetABalance} B=${mainnetFinal.assetBBalance} with all LP tokens redeemed`);
    expect(finalState.Lb).toBe(0n);
    if (!STRICT) {
      console.log(`non-strict replay finished; orphaned liquidity left in the pool: ${orphanedLiquidity(finalState)}`);
    } else {
      // Everything left in the pool is either Lu (overpayment of the trailing swaps into the emptied pool, which is
      // credited to LP holders and therefore paid out to the next liquidity provider) or dust below one asset unit.
      expect(orphanedLiquidity(finalState)).toBeLessThanOrEqual(ORPHAN_TOLERANCE_PER_OP * BigInt(liquidityOps + 1));
      expect(orphanedLiquidity(finalState)).toBeGreaterThanOrEqual(-ORPHAN_TOLERANCE_PER_OP * BigInt(liquidityOps + 1));
      expect(finalState.L - finalState.Lu).toBeLessThan(10_000_000n);
      // the real holdings match the tracked balances (rounding dust of a few asset units at most)
      expect(finalA * 1000n - finalState.ab).toBeLessThan(10_000n);
      expect(finalB * 1000n - finalState.bb).toBeLessThan(10_000n);
      expect(finalA * 1000n).toBeGreaterThanOrEqual(finalState.ab);
      expect(finalB * 1000n).toBeGreaterThanOrEqual(finalState.bb);

      // 6. reconcileLiquidity (the repair method for pools deployed with the old formula) finds nothing to book on a
      //    pool run with the fixed contract, and is restricted to the fee executor
      const reconcileArgs = { appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId, assetA: gold, assetB: goldDao, assetLp };
      const reconciled = await poolClient.send.reconcileLiquidity({ args: reconcileArgs, sender: deployer.addr, signer: deployerSigner.signer });
      expect(BigInt(reconciled.return ?? 0n)).toBeLessThanOrEqual(ORPHAN_TOLERANCE_PER_OP * BigInt(liquidityOps + 1));
      const stranger = actorOf(Object.keys(replay.source.identities)[1]);
      await expect(poolClient.send.reconcileLiquidity({ args: reconcileArgs, sender: stranger.account.addr, signer: stranger.signer.signer })).rejects.toThrow(/ERR-EXEC-ONLY/);
    }
  }, 1_800_000);
});
