# Repairing live pools after the LP-minting fix

Date: 2026-09-26
Contract version with the fix: `BIATEC-CLAMM-01-06-05`
Related: [Liquidity Fee Protection](./liquidity-fee-protection)

## What is wrong in the live pools {#-what-is-wrong}

Pools running `BIATEC-CLAMM-01-06-04` and earlier minted fewer LP tokens than the liquidity a deposit added and did not
book the difference anywhere. That liquidity is still in the pools, tracked in `Liquidity`, `assetABalanceBaseScale`
and `assetBBalanceBaseScale`, but it is owned by nobody:

```
unowned = Liquidity - distributedLp - LiquidityUsersFromFees - LiquidityBiatecFromFees
```

`distributedLp` is `(18e18 - LP tokens held by the pool) * 1000`. Nobody can withdraw `unowned`: `removeLiquidity` pays
out `distributedLp + Lu`, `removeLiquidityAdmin` pays out `Lb`.

Survey of mainnet (pool provider `3074197785`, 46 pools, 2026-09-26, `scripts/survey-orphaned-liquidity.ts`):

| Pool | Assets | Version | unowned (base units) | share of L | LP tokens outstanding |
|---|---|---|---|---|---|
| 3720188642 | Gold / GoldDAO | 01-06-04 | 57,256,214,042 (57.26 L ≈ 1.04 Gold + 61.6 GoldDAO) | 99.9% | none |
| 3720804577 | Gold / ALGO | 01-06-04 | 9,536,681,071 (9.54 L) | 2.12% | yes |
| 3136517663 | 452399768 / ALGO | 01-06-03 | 1,402,037,905,848 (1402 L) | 0.01% | yes |
| 3132508926 | GoldDAO / USDC | 01-06-03 | 169,578,005 (0.17 L) | 0.04% | yes |
| 3355130627, 3720188812, 3720628473, 3720188475 | various | – | 82 … 573 (dust, < 1e-6 L) | 100% (empty pools) | none |
| all other pools | – | – | between -2,238 and +2,675 (rounding only) | 0.00% | – |

Negative values are rounding in favour of the LPs and need no action.

## How the fix repairs them {#-how-the-fix-repairs-them}

`BIATEC-CLAMM-01-06-05` adds `reconcileLiquidity(appBiatecConfigProvider, assetA, assetB, assetLp)`, callable only by
`addressExecutiveFee`. It computes `unowned` and

- credits it to `LiquidityUsersFromFees` when LP tokens are in circulation, so the current LP holders receive it pro
  rata with their next `removeLiquidity` (no transfers needed), or
- credits it to `LiquidityBiatecFromFees` when no LP token is in circulation, so Biatec can withdraw it with
  `removeLiquidityAdmin` and return it to the affected liquidity provider off-chain.

It is idempotent: on a consistent pool it returns 0 and changes nothing.

## Steps {#-steps}

1. **Ship the contract.** Merge this change, run `npm test` (all suites must pass, including
   `__test__/pool/mainnet-replay-3720188642.test.ts`), bump the package version and publish the npm package
   (`npm run build-package && npm run publish-package`) so integrators get the regenerated client with
   `reconcileLiquidity`.
2. **Load the new pool bytecode into the pool provider** (`upgrade-clamm-template.sh`) so newly created pools start
   with `01-06-05`. Recompute the bytecode hashes (`npm run compute-bytecode-hashes`) and update the audit index.
3. **Pause the service** (`BiatecConfigProvider` global `s = 1`) for the duration of steps 4–6. This prevents deposits
   and withdrawals between the upgrade and the reconciliation, which would change who receives the credited liquidity.
   Swaps are paused as well; announce the maintenance window.
4. **Upgrade every existing pool** to `01-06-05` with `upgrade-clamm-pools.sh` (`src/bin/upgrade-all-pools.ts`,
   signed by the `addressUdpater` multisig). Verify with the survey script that every pool reports `scver =
   BIATEC-CLAMM-01-06-05`.
5. **Reconcile every pool.** Run the survey again and call `reconcileLiquidity` from `addressExecutiveFee` on every
   pool with `unowned > 0` (calling it on all pools is safe). With the generated client:

   ```ts
   await clientBiatecClammPool.send.reconcileLiquidity({
     args: { appBiatecConfigProvider, assetA, assetB, assetLp },
     appReferences: [appBiatecConfigProvider],
     assetReferences: [assetA, assetB, assetLp].filter((a) => a > 0n),
   });
   ```

   Expected effect per pool:
   - `3720804577`, `3136517663`, `3132508926`: `Lu` increases by the unowned amount; the current LP holders get it
     automatically when they withdraw. Nothing else to do.
   - `3720188642` and the four dust pools: `Lb` increases by the unowned amount (no LP tokens outstanding).
6. **Return the Gold/GoldDAO position.** On `3720188642` call `removeLiquidityAdmin(amount = 0)` from
   `addressExecutiveFee`; it pays out the whole `Lb` (about 1.04 Gold and 61.6 GoldDAO). Biatec's genuine fee share is
   the `Lb` recorded *before* reconciliation (45,326,961 of 57,307,353,500 = 0.08%); send the rest to the liquidity
   provider `6WKNXOXAVK5NEGPLMJ5MT6QA4EC2W2MAEW5FOWMD6URHTWPVB4BGIUCR2A`, who redeemed 100% of the LP tokens in round
   65393080. For reference, the replay with the fixed contract shows the redemption should have paid 0.946874 Gold and
   76.638355 GoldDAO more than it did; the pool composition has since shifted through 7 swaps against the unowned
   liquidity, so the value is now held as 1.044 Gold + 61.6 GoldDAO. The dust pools hold less than one asset unit and
   can be left as they are.
7. **Unpause** (`s = 0`), run the survey a final time and archive the CSV next to the audit report. Every pool must
   show `unowned` within a few thousand base units (rounding) of zero.
8. **Keep it that way.** Run `scripts/survey-orphaned-liquidity.ts` periodically (or in CI against mainnet) and alert
   when any pool reports `unowned` above 1,000,000 base units (0.001 L).

## Notes for operators {#-notes-for-operators}

- The upgrade transaction of a pool executes the *old* approval program, so the reconciliation cannot be folded into
  `updateApplication`; it must be a separate call after the upgrade.
- Deposits smaller than one LP micro-unit (1e-6 LP) are now rejected with `LP-ZERO-ERR` instead of being rounded up to
  one LP token (audit 2026-09-07 finding H-01). Front-ends should quote the minimum deposit accordingly.
- The LP amount minted for a deposit is `delta * D / (D + Lu)`; off-chain previews that still use the old quadratic
  will show slightly different numbers.
