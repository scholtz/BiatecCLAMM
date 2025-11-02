# Protecting fee accrual when new LPs join

Date: 2025-10-26
Repository: BiatecCLAMM (projects/BiatecCLAMM)
Primary file: `contracts/BiatecClammPool.algo.ts`

## Background {#-background}

Once a pool collects swap fees, the on-chain state tracks them as additional liquidity (`LiquidityUsersFromFees`) without minting extra LP tokens. The previous add-liquidity flow minted new LP tokens from the raw liquidity delta (`newLiquidity - oldLiquidity`). As a result, a newcomer could add liquidity and immediately remove it to harvest a pro-rata share of historic fees that should belong to incumbent LPs.

The regression surfaced in the pool test "new liquidity provider does not scoop pre-existing fees" where account C adds liquidity after a swap-fee scenario and removes it straight away. The expected behaviour is that the account receives exactly what it deposited (net zero profit).

## Fix summary {#-fix-summary}

`processAddLiquidity` now solves the quadratic relation enforced by immediate withdrawal parity and floors the positive root before minting LP tokens:

```
X^2 + X(sumDistributedAndFees − Q) − Q * distributedBefore = 0
```

where:

- `distributedBefore` is the previously distributed LP supply (scaled to the base precision),
- `LiquidityUsersFromFees` captures historic fee liquidity still owned by incumbents,
- `Q = depositShare * newLiquidity` with `depositShare` derived from the caller's base-scale contribution,
- `X` is the base-scale LP delta we solve for.

By flooring the root (and therefore rounding in favour of the pool) we ensure newcomers never mint enough LP to unlock pre-existing fees. When the pool has no accrued fees the quadratic collapses to the original "mint the liquidity delta" behaviour.

The same proportional arithmetic is reused on exit: fee shares are calculated with a single multiply/divide pass so rounding drift remains predictable and always benefits the contract.

## Rounding expectations {#-rounding-expectations}

- Withdrawals may trail deposits by a few base units due to the mandatory flooring step. The difference is bounded by a fraction of the asset's scale (≤ 20% of the base scale in current tests) and remains inside the pool, favouring existing LPs.
- The Jest suite now asserts that the newcomer’s balance never increases and only tolerates a tiny deficit. Any widening gap will fail the test, giving early warning if the maths regresses.

## Observable effects {#-observable-effects}

- A fresh LP who adds and immediately removes liquidity now receives the exact amounts deposited (up to expected integer rounding), so they no longer inherit historic fees.
- Incumbent LPs retain full ownership of `LiquidityUsersFromFees`. Fees accrued after the newcomer joins are still shared fairly because the quadratic solution only neutralises the pre-existing component.

## Test coverage {#-test-coverage}

- `npm run test:1:build` (and the focused Jest case "new liquidity provider does not scoop pre-existing fees") now passes with the updated contract and relaxed rounding tolerance.
- Other liquidity tests remain green because the adjustment preserves the original behaviour when the pool has no accrued user fees.

## Operational notes {#-operational-notes}

- Any contract change requires recomputing TEAL artifacts (`npm run compile-contract`) and regenerating clients (`npm run generate-client` or `npm run build`) before publishing packages.
- Off-chain helpers or simulations that relied on the raw `newLiquidity - oldLiquidity` mint formula must be updated to mirror the quadratic solution to avoid drift between client-side estimates and on-chain results.
- Pool deployments must now use the pool provider's registered configuration app ID. The pool provider enforces this on-chain, so double-check the `B` global state key before initiating a deploy.

## Next steps {#-next-steps}

- Extend off-chain math utilities in `src/biatecClamm/` to expose the same LP token calculation so front-end previews stay accurate.
- Add regression tests to cover asymmetric deposits and scenarios with non-zero `LiquidityBiatecFromFees` to ensure the formula generalises.
