## Audit metadata

**AI Model**: gpt5-mini
**Provider**: github copilot
**Audit Date**: 2025-10-27
**Commit Hash**: b13ceec9ec91baed2d4060d62e4cc62c29455604
**Commit Date**: 2025-10-27T23:13:54+01:00

## Executive summary

This document is a focused security audit draft for the BiatecCLAMM repository (contracts and core providers). I performed a code review of the main smart contracts and pool-provider logic, verified important invariants, and inspected swap/liquidity math. The findings below are prioritized and actionable. This is a draft — I recommend running the suggested tests and fuzzers in the next iteration to convert findings into concrete, reproducible test cases.

High-level result:

- No obvious immediate critical backdoor that trivially allows theft of funds was found in the reviewed files. Access control is present in most privileged functions.
- Several medium- and low-severity issues were identified (math edge-cases, potential division-by-zero, overflow risk in complex expressions, a logic bug in recent-pools bookkeeping, and missing/fragile validations). These should be addressed before a production deployment.

## Scope and methodology

Files reviewed (primary):

- `contracts/BiatecClammPool.algo.ts` (main AMM logic, liquidity, swaps, fee accounting)
- `contracts/BiatecConfigProvider.algo.ts` (global config & admin addresses)
- `contracts/BiatecIdentityProvider.algo.ts` (user identity + fee multiplier)
- `contracts/BiatecPoolProvider.algo.ts` (pool deployment/registry, box handling)
- generated client artifacts (quick grep of `contracts/clients/*Client.ts`) to cross-check ABI and asserts

Work performed:

- Static code review of key functions (add/remove liquidity, processAddLiquidity, swap, distributeExcessAssets, verifyIdentity, registerPool and deploy flow)
- Traced arithmetic-heavy expressions and denominators for division-by-zero or unbounded growth
- Searched for access-control checks and admin-only paths
- Noted places where external app/global state is accessed without existence checks

Tools and repo metadata collected:

- Latest commit: b13ceec9ec91baed2d4060d62e4cc62c29455604 (2025-10-27T23:13:54+01:00)
- Approximate LOC counts (from quick workspace scan): contracts ~3702 lines, src ~3496 lines, tests ~6262 lines

## Findings

### [H-01] Denominator / division-by-zero risk in price / asset formulas

Severity: High
Component: `BiatecClammPool` (multiple functions: `calculateAssetBWithdrawOnAssetADeposit`, `calculateAssetAWithdrawOnAssetBDeposit`, `calculateLiquidityD`, etc.)

Description:
Several arithmetic formulas compute denominators built from variables (inAmount, liquidity, balances, and price-derived terms). For example `calculateAssetBWithdrawOnAssetADeposit` computes P345 = P3 + P4 + liquidity and then returns (P12 \* s) / P345. If P345 can be zero due to caller-supplied or state values, this will assert/throw.

Impact:

- A division-by-zero aborts the contract call and could be used to block legitimate flows in some corner conditions (availability/DoS for callers). In some cases a reverted call in a grouped transaction could cause unexpected failures of surrounding operations.

Recommendation:

1. Add explicit non-zero checks for any denominator before division and provide clearer error messages.
2. Add input validation that ensures liquidity and scale terms are initialized before formulas are invoked.
3. Add unit tests that call these functions with boundary values (zero liquidity, zero balances, tiny/liquid amounts) to ensure safe behavior.

Reference: `contracts/BiatecClammPool.algo.ts` — functions `calculateAssetBWithdrawOnAssetADeposit`, `calculateAssetAWithdrawOnAssetBDeposit` and their callers in `swap` and `processAddLiquidity`.

### [H-02] Complex expressions risk intermediate overflow or precision loss

Severity: High
Component: `BiatecClammPool`

Description:
The code performs large multiplications like x*x*priceMin, 4*x*y\*priceMinSqrt, or products of liquidity with price factors. Although many types are `uint256` and TEALScript supports large integers, intermediate results may exceed safe internal ranges depending on asset quantities and scales (especially if an attacker or test uses very large asset balances or artificially large decimals). Several comments and the grep output show runtime error messages like 'overflowed 256 bits' in generated client traces.

Impact:

- Arithmetic overflow will cause immediate transaction failure. In some grouped transaction flows this can cause unexpected reverts or denial of service for legitimate users.

Recommendation:

1. Add explicit bounds checks (assert inputs and state variables are <= project-defined limits) before heavy multiplications.
2. If possible, reorder operations to divide early when mathematically valid to reduce intermediate magnitude (use safe multiplication/division patterns).
3. Add unit and fuzz tests exercising extreme but plausible values (very large balances, maximum decimals configurations) to ensure no overflow.

Reference: `calculateLiquidityD`, `calculateLiquidityWithD` and related math in `BiatecClammPool.algo.ts` (look for D1/D2/D3 calculations).

### [H-03] Bug in recent pools bookkeeping in `BiatecPoolProvider.deployPool`

Severity: High (logic / correctness)
Component: `BiatecPoolProvider`

Description:
The `deployPool` function updates `recentPoolsIndex` and then sets one of `recentPools1`..`recentPools10` based on the index. However the code contains repeated branches that always assign to `recentPools1` for many branches (likely a copy/paste error). This means pools will not be stored to the intended slots and the 'recent pools' ring buffer will be incorrect.

Impact:

- Misreporting of recently deployed pools, leading to poor UX and potentially breaking any code that relies on these recent-pools slots for validation.

Recommendation:

1. Fix the branch logic so storeTo==3 assigns to `recentPools3`, storeTo==4 to `recentPools4`, etc.
2. Add unit tests for `deployPool` that verify the ring buffer behavior across >10 deployments.

Reference: `contracts/BiatecPoolProvider.algo.ts` — `deployPool` function near the `recentPoolsIndex` assignments.

### [M-01] Fragile reliance on external app global state existence

Severity: Medium
Component: `BiatecClammPool`, `BiatecPoolProvider`, `BiatecIdentityProvider`

Description:
The contracts frequently call into other apps (config, identity, pool provider) and read global state keys without defensive checks — for example accessing `appBiatecConfigProvider.globalState('p')` or `appBiatecConfigProvider.globalState('i')`. If the config app hasn't been fully bootstrapped or keys are missing, the call will revert (grep output from generated clients shows many "global state value does not exist" messages).

Impact:

- Calls will fail if dependent apps are misconfigured, which is expected during setup but can cause confusing errors for integrators.

Recommendation:

1. Where appropriate, add assert/checks with clearer error messages when required global keys are missing.
2. Provide onboarding/bootstrap helper scripts in `src/` which ensure apps are configured in the right order and show explicit precondition checks.

Reference: `verifyIdentity` in `BiatecClammPool.algo.ts` and multiple `assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'E_CONFIG')` calls.

### [M-02] LP minting quadratic and floor behaviour needs precise test coverage

Severity: Medium
Component: `processAddLiquidity` in `BiatecClammPool`

Description:
The algorithm solves a quadratic to compute minted LP (and floors the root). The repository README and internal docs expect rounding to favor the pool, and tests depend on small rounding tolerances. This logic is complex and likely to have edge-cases when fees (LiquidityUsersFromFees, LiquidityBiatecFromFees) are present and when distributedBefore is zero or tiny.

Impact:

- Incorrect rounding or edge-case handling could cause LP inflation/loss, small but material rounding deviations, or immediate test failures.

Recommendation:

1. Add exhaustive unit tests (parameterized) that compare the off-chain LP-minting helper against on-chain behavior for small and large inputs.
2. Document the precise rounding guarantees and tolerance (e.g., provide explicit invariant: newLiquidity >= oldLiquidity or delta <= allowance) and enforce them in tests.

Reference: `processAddLiquidity` quadratic solving block in `BiatecClammPool.algo.ts`.

### [M-03] Swap minimumToReceive/no-slippage path needs explicit invariants and tests

Severity: Medium
Component: `swap` in `BiatecClammPool`

Description:
The `swap` method computes fees, determines the output, enforces minimums and then updates balances. There are many places where intermediate rounding reduces the output by 1 unit (the code intentionally floors to prevent LP bleed). These behaviors need precise tests (unit and integration) to match off-chain builders and user expectations.

Recommendation:

1. Add focused tests: swaps at boundaries (minimumToReceive just at threshold), very small amounts, and rates near priceMin/priceMax.
2. Ensure off-chain transaction builders mirror the on-chain rounding expectations (repo policy mentions this — please keep client calculators in sync).

### [L-01] Unclear / inconsistent error messages

Severity: Low
Component: Multiple

Description:
There are many assert messages; some are terse (e.g., 'E_CONFIG', 'E_SENDER'), others verbose. Standardizing error codes/messages helps debugging.

Recommendation:

1. Use a consistent error code style and include contextual info where possible.
2. Document major error codes in a single place (README or docs/errors.md).

## Missing or recommended tests (priority)

1. Boundary arithmetic tests (High): zero liquidity, zero balances, extremely large balances (causing potential 256-bit overflow). Priority: High.
2. LP-mint quadratic tests (Medium): many combinations of distributedBefore, LiquidityUsersFromFees, contributionScaled to ensure minted supply math is sound.
3. deployPool ring-buffer tests (Low): >10 consecutive deploys to exercise `recentPools` behavior.
4. Cross-app missing global state tests (Medium): simulate calls where config app is missing expected keys to provide clearer errors.
5. Fuzz tests over swap inputs and asset decimals (High): randomize asset decimals and amounts to detect overflow and division issues.

## Recommendations (actionable)

1. Add precondition checks for denominators and assert with descriptive messages.
2. Harden math by bounding input/state values before expensive multiplies and prefer reordered arithmetic to divide early when safe.
3. Fix the recentPools branch bug in `deployPool`.
4. Add unit tests for the LP quadratic mint behavior and swap rounding edge-cases; add fuzzing for arithmetic-heavy code paths.
5. Standardize error messages and document the meaning of common error codes.
6. Provide an explicit "bootstrap checklist" in docs that enumerates required global-state keys in config and sequence of app bootstrapping. Add script helpers in `src/bin/` if not present.

## Next steps I can take (pick any)

1. Produce a PR that fixes the `recentPools` branch bug.
2. Add unit tests for denominator checks and the LP quadratic across a range of fixtures.
3. Add a small fuzzer harness (in `__test__/fuzz/`) that randomizes balances/decimals to look for overflow and denom-zero cases.

## Appendix: quick notes & reviewed locations

- `contracts/BiatecClammPool.algo.ts`: main review focus — swap, add/remove liquidity, processAddLiquidity, distributeExcessAssets, calculateLiquidityD/WithD.
- `contracts/BiatecPoolProvider.algo.ts`: deployPool recentPools bug, box loading logic for approval chunks.
- `contracts/BiatecConfigProvider.algo.ts`: admin addresses and global state keys — ensure correct sequencing of config.
- `contracts/BiatecIdentityProvider.algo.ts`: lookups provide defaults when box not present; verifyIdentity call expects appBiatecConfigProvider.globalState('i') to exist.
