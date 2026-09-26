# Protecting fee accrual when new LPs join

Date: 2025-10-26, revised 2026-09-26
Repository: BiatecCLAMM (projects/BiatecCLAMM)
Primary file: `contracts/BiatecClammPool.algo.ts`

## Background {#-background}

Once a pool collects swap fees, the on-chain state tracks them as additional liquidity (`LiquidityUsersFromFees`, `Lu`) without minting extra LP tokens. The original add-liquidity flow minted new LP tokens from the raw liquidity delta (`newLiquidity - oldLiquidity`). As a result, a newcomer could add liquidity and immediately remove it to harvest a pro-rata share of historic fees that should belong to incumbent LPs.

The regression surfaced in the pool test "new liquidity provider does not scoop pre-existing fees" where account C adds liquidity after a swap-fee scenario and removes it straight away. The expected behaviour is that the account receives exactly what it deposited (net zero profit).

## Accounting invariant {#-accounting-invariant}

Every unit of pool liquidity must be owned by somebody:

```
Liquidity == distributedLp + LiquidityUsersFromFees + LiquidityBiatecFromFees
```

- `distributedLp` (`D`) is the LP supply circulating outside the pool account, scaled to the base precision,
- `Lu` is fee liquidity owned pro rata by all LP token holders (paid out by `removeLiquidity`),
- `Lb` is fee liquidity owned by Biatec (paid out by `removeLiquidityAdmin`).

`swap` keeps the invariant because the whole liquidity increment is split between `Lu` and `Lb`.

## Fix summary {#-fix-summary}

Each circulating LP token is backed by `(D + Lu) / D` units of liquidity. A depositor who adds `delta` liquidity therefore receives

```
X = delta * D / (D + Lu)
```

LP tokens (floored to LP token decimals), and the fee-dilution share `delta - X` is booked into `Lu` (it is exactly 0 while the pool has not collected any fee). With `Lu' = Lu + delta - X`:

- newcomer claim on exit: `X * (D + Lu + delta) / (D + X) == delta` - exactly what was deposited, no historic fees,
- incumbents: `D * (D + Lu + delta) / (D + X) == D + Lu` - they keep all historic fees,
- invariant: `D + X + Lu' == D + Lu + delta` - no liquidity is left without an owner.

When the pool has no accrued fees the formula collapses to the original "mint the liquidity delta" behaviour.

### Why the quadratic variant was replaced {#-why-the-quadratic-variant-was-replaced}

Between 2025-10-26 and 2026-09-26 the contract minted `min(delta, root)` where `root` solved `X^2 + X(D + Lu - Q) - Q * D = 0` and `Q = depositA * newLiquidity / assetABalance` (or the asset B share when no asset A was deposited). Two problems:

1. `Q` is a single-sided estimate. For a deposit that is not in the pool's current ratio (which is allowed and moves the pool price) it is below the real liquidity added, so the depositor was minted fewer LP tokens than the liquidity they contributed.
2. The difference `delta - X` was not booked anywhere. It increased `Liquidity` but was owned neither by LP holders nor by Biatec, so it could never be withdrawn.

Mainnet pool `3720188642` (Gold/GoldDAO, range 128-256, LP fee 0.1%, Biatec share 20%) demonstrates this: three deposits, 238 swaps and a redemption of 100% of the LP tokens left `L = 57.3` (about 1.04 Gold and 61.6 GoldDAO) in the pool while Biatec's fee share was only `Lb = 0.045`. The complete history is replayed in `__test__/pool/mainnet-replay-3720188642.test.ts` from `__test__/test-data/mainnet-pool-3720188642.json`; with the corrected formula the redemption returns the whole position and only `Lb` remains.

### Further changes in 01-06-05 {#-further-changes}

- A deposit which does not reach one LP micro-unit (1e-6 LP) is rejected with `LP-ZERO-ERR`. Previously it was rounded up to one LP token, which let a depositor of 1 base unit redeem more than deposited (audit 2026-09-07, H-01).
- `reconcileLiquidity` (fee executor only) books liquidity that older pools left without an owner; see [Repairing live pools](./live-pool-reconciliation).
- `removeLiquidity` and `removeLiquidityAdmin` share one payout routine (`payOutLiquidity`); behaviour is unchanged.

## Rounding expectations {#-rounding-expectations}

- LP tokens are floored to 6 decimals; the sub-micro-LP remainder (< 1e-6 LP per deposit) stays in the pool as rounding in favour of the pool. It is deliberately not booked as fee income, so `liquidityUsersFromFees` stays 0 until the first swap; `reconcileLiquidity` can sweep accumulated rounding to the LP holders.
- `removeLiquidity` still floors the asset amounts sent out, so withdrawals may trail deposits by a few base units which remain in the pool.
- The Jest suite asserts that the newcomer's balance never increases and only tolerates a tiny deficit, and the mainnet replay asserts the invariant after every liquidity operation with a tolerance of one LP micro-unit per operation.

## Operational notes {#-operational-notes}

- Any contract change requires recomputing TEAL artifacts (`npm run compile-contract`) and regenerating clients (`npm run generate-client` or `npm run build`) before publishing packages.
- Off-chain helpers or simulations that estimate minted LP tokens must use `delta * D / (D + Lu)` to stay in sync with the chain.
- Pools deployed with `BIATEC-CLAMM-01-06-04` or earlier should be upgraded; liquidity already orphaned in such pools is not recovered automatically by the upgrade.
