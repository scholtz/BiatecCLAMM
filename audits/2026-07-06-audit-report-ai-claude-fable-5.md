# BiatecCLAMM Security Audit Report

## 1. Audit Metadata

**AI Model**: Claude Fable 5 (claude-fable-5)
**Provider**: Anthropic
**Audit Date**: 2026-07-06
**Commit Hash**: 2a0b2c22ebf3783e1f5bc51972a1eb96b1b5ac33
**Commit Date**: 2026-07-06 12:33:04 +02:00 (UTC+2)
**Repository**: biatec-concentrated-liquidity-amm
**Package Version**: 0.9.42
**License**: AGPL-3.0

### TEAL / Tooling Versions

| Component | Version |
| --- | --- |
| TEALScript | 0.107.2 |
| AVM compiler (algod) | 4.7.3 (commit `4d11e2e9+`) |
| algosdk | 3.6.x |
| algokit-utils | 9.2.x |

### Contract Bytecode Hashes

The following SHA256 hashes verify the exact bytecode audited. They are computed from the base64-decoded approval and clear programs in `contracts/artifacts/*.arc56.json` (via `npm run compute-bytecode-hashes`).

**BiatecClammPool.algo.ts**
- Approval Program SHA256: `d5af0104faa636835883acc9096d9908b4a1e2caa6fe8d662e62b141ec8b41b1`
- Clear Program SHA256: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecConfigProvider.algo.ts**
- Approval Program SHA256: `15bdcb6eb3d4369ce55525f4453c7642f4a2e72f041316124dec8b49c88e0872`
- Clear Program SHA256: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecIdentityProvider.algo.ts**
- Approval Program SHA256: `452993b634a286d3891e511322984774cc9a151e00a937b255815072487c3ec0`
- Clear Program SHA256: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecPoolProvider.algo.ts**
- Approval Program SHA256: `e5447dd51b3a66d53c78ecd9eef4337527ed69254ae78b7bf8fe39e729ab22c7`
- Clear Program SHA256: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**FakePool.algo.ts**
- Approval Program SHA256: `b303c1c803a3a56e7c04a6246861110f3ec38c7c28fabe1602d01a9b69feb1a7`
- Clear Program SHA256: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

> Note: All contracts share the same clear program hash because each ships an identical minimal clear-state program.

---

## 2. Executive Summary

BiatecCLAMM is a concentrated-liquidity AMM for Algorand written in TEALScript. The system comprises four production contracts — a pool contract (`BiatecClammPool`, ~1,760 lines), a configuration provider, an identity/KYC provider, and a pool-registry/price-feed provider — plus a `FakePool` helper used for registration bootstrapping. A TypeScript client library (`src/`, ~4,800 lines) builds and sends transaction groups, and a Jest suite (~7,300 lines across 18 files) exercises the on-chain logic.

This audit was performed fresh against the current source at the commit above, without reference to prior audit reports. The contracts were compiled and the **entire test suite was run and passes (18 suites / 91 tests, 0 failures)** against a running Algorand LocalNet, so the behavioral claims below are cross-checked against green tests rather than inferred from source alone.

**Overall assessment**: The codebase is mature and defensively written. Core invariants that most frequently cause loss in AMMs are actively guarded: denominators are asserted non-zero before division (`E_ZERO_DENOM`, `E_ZERO_LIQ`), rounding is deliberately biased toward the pool (`realSwap*Decimals - 1` corrections), liquidity is prevented from decreasing on fee-bearing operations (`setCurrentLiquidityNonDecreasing`), and after admin asset movements the contract re-verifies that recorded balances are still covered by real holdings (`ensurePoolBalancesWithinHoldings`). Access control on privileged methods is consistently enforced through the config provider's role addresses.

No **Critical** issue permitting unauthorized, unconditional loss of user funds or LP-token minting was confirmed. The most consequential findings are (1) the system's deliberate **centralization** — all four contracts are upgradeable by an updater multisig and several methods grant broad power to fee/executive addresses — and (2) a **swap design that donates unswappable over-payment to LPs**, which can cause severe loss for a caller who submits a swap with `minimumToReceive = 0`.

### Findings Summary

| ID | Title | Severity | Status |
| --- | --- | --- | --- |
| H-01 | Full upgradeability and admin powers permit custody of user funds | High | Open (by design) |
| H-02 | Unbounded over-payment is donated to LPs when `minimumToReceive = 0` | High | Open |
| M-01 | `doAppCall` is a broad admin proxy; can move untracked ALGO and is a no-op when `payAmount = 0` | Medium | Open |
| M-02 | LP-token quadratic issuance math is complex and unverified against dilution/rounding | Medium | Open |
| M-03 | Identity `setInfo` lacks `feeMultiplier` upper bound and pause check → swap DoS for a user | Medium | Open |
| M-04 | Config provider `bootstrap`/setters allow swapping the identity provider (KYC-bypass trust) | Medium | Open (by design) |
| L-01 | `distributeExcessAssets` "amount == 1 means distribute everything" magic value | Low | Open |
| L-02 | `registerTrade` stat scaling can overflow uint64 for very large low-decimal swaps → DoS | Low | Open |
| L-03 | VWAP update has an unguarded divide-by-zero path (mitigated in practice) | Low | Open |
| L-04 | npm dependency vulnerabilities (17; 5 high), incl. runtime-reachable `parse-duration` ReDoS | Low | Open |
| L-05 | Large volume of commented-out dead code increases audit surface | Low | Open |
| I-01 | Full test suite passes (18 suites / 91 tests) on the audited commit | Informational | Resolved |
| I-02 | Struct field typos (`Liqudity`) in client types | Informational | Open |
| I-03 | Swap capping relies on integrators always setting slippage bounds | Informational | Open |

---

## 3. Scope and Methodology

### In Scope

- `contracts/BiatecClammPool.algo.ts` (main AMM logic)
- `contracts/BiatecConfigProvider.algo.ts` (configuration & roles)
- `contracts/BiatecIdentityProvider.algo.ts` (identity / KYC)
- `contracts/BiatecPoolProvider.algo.ts` (registry, price feed, deployment)
- `contracts/FakePool.algo.ts` (registration helper)
- `src/**` TypeScript client library (transaction builders, senders, parsers)
- `__test__/**` test suite (coverage assessment)
- `package.json` dependency posture

### Methodology

1. **Repository context gathering** — commit metadata, LOC counts, bytecode hashing.
2. **Static code review** — line-by-line reading of all five contracts, tracing execution paths, state mutations, arithmetic, access-control gates, and inner-transaction flows.
3. **Mathematical verification** — re-derivation of the concentrated-liquidity formulas (`calculateLiquidityD`, `calculateLiquidityWithD`, `calculatePrice`, swap output solvers) and rounding-direction analysis.
4. **Client-library review** — transaction-group construction, box/asset/app reference population, fee assignment.
5. **Test-coverage analysis** — enumeration of test files and scenarios; execution of the pure-TypeScript tick tests; inspection of the recorded Jest results.
6. **Dependency audit** — `npm audit`.

### Lines of Code

| Area | Lines |
| --- | --- |
| Contracts (`*.algo.ts`) | 3,621 |
| Client library (`src/**`) | 4,794 |
| Tests (`__test__/**`) | 7,262 |

### Verification Notes / Limitations

- **The full test suite was built and executed fresh against the audited commit and passes: `npm run test` → 18 suites, 91 tests, 0 failures (~99 s), against a running Algorand LocalNet (algokit sandbox).** This supersedes the older `jest-results.json` (2025-11-08) that had recorded 2 failures; both of those tests (native-token-name casing and `doAppCall` proxy) now pass on the current commit.
- The pure-TypeScript tick tests were additionally run in isolation and also pass (23/23).
- Findings are based on source review and formula re-derivation, cross-checked against the passing test suite. Where an exploit could not be concretely demonstrated, the finding is explicitly marked as unconfirmed and recommended for follow-up (formal verification / on-chain fuzzing). A passing test suite confirms intended behavior but does not by itself prove the absence of the economic/rounding edge cases flagged below.

---

## 4. Findings

### [H-01] Full upgradeability and broad admin powers place user funds under trusted-party custody

**Severity**: High (centralization / trust assumption; by design)
**Status**: Open
**Component**: All contracts
**Files**:
- `contracts/BiatecClammPool.algo.ts:140` (`updateApplication`)
- `contracts/BiatecConfigProvider.algo.ts:72` (`updateApplication`), `:96` (`setAddressUdpater`)
- `contracts/BiatecPoolProvider.algo.ts:269`, `contracts/BiatecIdentityProvider.algo.ts:228`

**Description**:
Every contract exposes `updateApplication(...)`, gated on the `addressUdpater` role read from the config provider (`globalState('u')`). The updater can replace the approval program of a live pool that already custodies user liquidity. In addition, `removeLiquidityAdmin`, `withdrawExcessAssets`, `distributeExcessAssets`, `doAppCall`, and the online/offline key-registration methods grant the `addressExecutiveFee` / `addressExecutive` roles significant control over pool assets and participation keys.

Because a pool holds real user deposits and LP accounting in contract state, a compromised or malicious `addressUdpater` multisig can upgrade a pool to arbitrary logic and seize all assets. This is an intentional design choice (the updater is described as a "top secret multisig"), but it is the single largest risk to depositor funds and must be disclosed as such.

**Impact**:
- Complete loss of all pooled funds if the updater key is compromised.
- Users cannot rely on immutable contract behavior; the trust model is custodial.

**Recommendation**:
1. Document the trust model prominently in user-facing material (who holds the updater/executive keys, multisig threshold, key-management practices).
2. Consider a timelock on `updateApplication` so depositors can exit before an upgrade takes effect.
3. Consider making `addressUdpater` a governance/timelock contract rather than a plain multisig.
4. Publish the on-chain addresses of all role accounts and their multisig configuration.

---

### [H-02] Unbounded over-payment is silently donated to LPs when `minimumToReceive = 0`

**Severity**: High
**Status**: Open
**Component**: BiatecClammPool — `swap`
**File**: `contracts/BiatecClammPool.algo.ts:958-963` and `:1005-1010`

**Description**:
When a swap's computed output exceeds the pool's available balance of the output asset, the contract caps the output to what is available but still credits the **entire** deposited input to the pool:

```ts
if (toSwap > this.assetBBalanceBaseScale.value) {
  // in case of small overpay, send only what is available
  // profit from the overpay goes to the LPs
  toSwap = this.assetBBalanceBaseScale.value;
}
```

The `minimumToReceive` check is only enforced when it is strictly positive (`:973`, `:1020`):

```ts
if (minimumToReceive > 0) {
  assert(toSwapBDecimals >= minimumToReceive, 'Minimum to receive is not met');
}
```

Thus a caller who passes `minimumToReceive = 0` receives only the residual pool balance while the full input is retained by the pool. The `overpay.test.ts` scenario confirms this: sending `poolBalanceB * 100 * 1000` units of A yields only `poolBalanceB` of B, and the test asserts `spentA === swapAmountA` (100% of the input consumed). For a thin or nearly-drained pool this is effectively total loss of the caller's over-payment.

The comment frames the leftover as "small overpay," but nothing in the code bounds the ratio between input and the maximum swappable amount, so the loss is unbounded.

**Impact**:
- A user or an integrator that submits `minimumToReceive = 0` (a common default) can lose an arbitrarily large fraction of their input to LPs.
- Amplifies the effect of front-running / sandwiching: an attacker who drains asset B just before the victim's `minimumToReceive = 0` swap captures the victim's full input.

**Proof of Concept** (from `__test__/pool/overpay.test.ts`, which **passes** in the current suite): drain-and-overpay results in `receivedB === poolBalanceB` and `spentA === swapAmountA` with `minimumToReceive: 0`. The passing test confirms this donation-to-LP behavior is the current, intended behavior — which is precisely why it is a hazard for callers that omit a slippage bound.

**Recommendation**:
1. Refund the unswappable portion of the input to the caller instead of donating it to LPs, or
2. Reject swaps whose output is capped (i.e., require `toSwap <= availableBalance`) so callers cannot accidentally over-pay, or
3. At minimum, require `minimumToReceive > 0` for all swaps and force every client builder (`clammSwapTxs.ts`) to compute a non-zero bound from a quote.
4. Document loudly that `minimumToReceive = 0` disables all slippage protection.

---

### [M-01] `doAppCall` is a broad admin proxy that can move untracked ALGO and is a silent no-op when `payAmount = 0`

**Severity**: Medium
**Status**: Open
**Component**: BiatecClammPool — `doAppCall`
**File**: `contracts/BiatecClammPool.algo.ts:1284-1356`

**Description**:
`doAppCall` lets `addressExecutiveFee` submit an inner payment plus an arbitrary application call from the pool account (intended for xGov voting). Two concerns:

1. **Untracked-ALGO movement.** After the call it invokes `ensurePoolBalancesWithinHoldings(assetA, assetB)`, which only checks the *native ALGO* balance when ALGO is one of the pool's two tracked assets (`ensureAssetBalanceMatchesState` guards native only when `assetId === 0`, `:372-381`). For an ASA/ASA pool, the pool's ALGO (funded for MBR and inner-txn fees) is **not** covered by any invariant, so `appCallParams.payAmount` could move ALGO out of the pool up to the network-enforced minimum balance. This is gated to the trusted `addressExecutiveFee`, so it is a centralization/trust exposure rather than an open exploit, but it widens the executive role's reach beyond fee collection.

2. **Silent no-op / limited arg surface.** Both executed branches require `appCallParams.payAmount > 0`; if `payAmount === 0` neither branch runs and the method does nothing but the trailing balance check. Application args are hardcoded to `[appArgs[0], appArgs[1]]` (exactly two), so pure app calls and calls needing other arg counts are impossible. The passing test `doAppCall › executive fee account can proxy arbitrary app calls` only exercises the `payAmount > 0` path (and deliberately seeds 1 ALGO of excess into the pool before the call so the payment does not dip into pool-critical ALGO — indirect confirmation of concern #1); the `payAmount === 0` no-op path is untested.

**Impact**:
- Executive role can drain a pool's non-tracked ALGO reserve (trust exposure).
- Legitimate xGov flows requiring `payAmount = 0` or a different arg count silently fail, potentially locking intended governance actions.

**Recommendation**:
1. Add an explicit branch (or `assert`) for `payAmount === 0` so the intended behavior is defined rather than silently skipped.
2. Track and bound the pool's ALGO usage, or require the executive to top up MBR so the payment cannot dip into pool-critical ALGO.
3. Constrain the callable target/method set for `doAppCall` (e.g., allowlist the xGov app id) to limit the executive role's blast radius.

---

### [M-02] LP-token quadratic issuance math is complex and not verified against dilution / rounding abuse

**Severity**: Medium (unconfirmed — recommend formal verification)
**Status**: Open
**Component**: BiatecClammPool — `processAddLiquidity`
**File**: `contracts/BiatecClammPool.algo.ts:631-672`

**Description**:
LP issuance solves a quadratic (`X^2 + X(sumDistributedAndFees - contributionScaled) - contributionScaled*distributedBefore = 0`) to apportion new LP tokens against already-distributed LP plus accrued fee-liquidity. The routine mixes 256-bit multiplications, a `sqrt`, a branch on `contributionScaled >= sumDistributedAndFees`, and a floor with a `< lpDeltaBase` clamp, and it estimates the caller's contribution using "whichever side contributed funds" (`:639-643`). Several properties are hard to establish by inspection:

- Whether the single-sided `contributionScaled` estimate is always ≤ the true proportional share for all price positions (otherwise a depositor could be over-credited relative to existing LPs).
- Whether the floor/clamp guarantees existing LPs are never diluted by rounding across many small deposits.
- First-depositor behavior: when `distributedBefore == 0` the quadratic is skipped and `lpDeltaBase = liquidityDelta`; the `lpTokensToSend === 0 → 1` floor (`:667-668`) mitigates zero-mint, but interaction with donated assets / `distributeExcessAssets` inflation of `L` was not exhaustively modeled.

No concrete exploit was constructed; this is flagged because the code path is the most consequential for LP-supply integrity and warrants rigorous verification.

**Impact** (if a bias exists): gradual dilution of honest LPs or over-issuance to a crafted deposit sequence.

**Recommendation**:
1. Add property-based / fuzz tests asserting: (a) total LP never exceeds `TOTAL_SUPPLY`; (b) sum of redeemable value across all LP holders ≤ pool holdings after any deposit sequence; (c) a deposit followed by immediate withdrawal never returns more than deposited (net of fees).
2. Formally verify the quadratic solution and the single-sided contribution estimate against the invariant `value_out ≤ value_in`.
3. Add an explicit first-deposit minimum-liquidity lock (burn a small amount of initial LP) as defense-in-depth against first-depositor share manipulation.

---

### [M-03] Identity `setInfo` lacks a `feeMultiplier` upper bound and a pause check → per-user swap DoS

**Severity**: Medium
**Status**: Open
**Component**: BiatecIdentityProvider — `setInfo`
**File**: `contracts/BiatecIdentityProvider.algo.ts:281-286`; consumed at `contracts/BiatecClammPool.algo.ts:923`

**Description**:
`setInfo` (callable by `engagementSetter`) validates `feeMultiplierBase === SCALE` and `verificationClass <= 4` but does **not** bound `feeMultiplier`. In `swap`, the effective multiplier is:

```ts
const feesMultiplier = (s - ((this.fee.value as uint256) * (user.feeMultiplier as uint256)) / (user.base as uint256)) as uint256;
```

If `feeMultiplier` is set large enough that `fee * feeMultiplier / base > SCALE`, the `uint256` subtraction underflows and the AVM aborts, making **every swap by that user revert**. Because `fee` is capped at 10% (`SCALE/10`), this requires `feeMultiplier / base > 10`, which `setInfo` currently permits. `setInfo` and `selfRegistration` also omit the `paused` (kill-switch) check present on other state-changing methods.

**Impact**:
- A misconfiguration (or a compromised `engagementSetter`) can silently disable trading for targeted users.
- Kill switch does not cover identity mutations, so identity state can change while the system is "suspended."

**Recommendation**:
1. Enforce an explicit upper bound on `feeMultiplier` in `setInfo` (e.g., `feeMultiplier <= 10 * SCALE`) so the swap multiplier can never underflow.
2. Add the `paused === 0` assertion to `setInfo` and `selfRegistration` for consistency with the kill-switch model.
3. In `swap`, clamp `feesMultiplier` to `[0, s]` defensively instead of relying on upstream bounds.

---

### [M-04] Config provider can repoint the identity provider, enabling KYC-policy changes for live pools

**Severity**: Medium (centralization / trust; by design)
**Status**: Open
**Component**: BiatecConfigProvider — `bootstrap`, `setBiatecIdentity`
**File**: `contracts/BiatecConfigProvider.algo.ts:83-89`, `:146-149`

**Description**:
`bootstrap` has no one-time guard and, together with `setBiatecIdentity`, lets the updater change the `appBiatecIdentityProvider` (`'i'`) that every pool consults for verification and locking. Pools bind identity checks to whatever the config currently advertises (`verifyIdentity`, `BiatecClammPool.algo.ts:850-853`). Repointing to a permissive identity app would relax or bypass KYC/lock enforcement for all pools at once, and could reset lock status used to freeze suspicious accounts.

**Impact**:
- The KYC/compliance guarantee is only as strong as the updater's control of the config provider.
- Locked-account protections can be neutralized by swapping the identity backend.

**Recommendation**:
1. Add a one-time bootstrap guard (`assert(!this.appBiatecPoolProvider.exists)` or an explicit `bootstrapped` flag) to prevent silent re-bootstrap.
2. Gate identity-provider changes behind a timelock and/or emit an event so integrators can react.
3. Document that identity policy is mutable by the updater.

---

### [L-01] `distributeExcessAssets` uses a magic value `1` to mean "distribute the entire balance"

**Severity**: Low
**Status**: Open
**Component**: BiatecClammPool — `distributeExcessAssets`
**File**: `contracts/BiatecClammPool.algo.ts:1149-1164`

**Description**:
`amountA === 1` (and `amountB === 1`) is overloaded to mean "distribute the whole available balance," whereas `amountA === 2` is treated literally as two base units. This off-by-context semantics is easy to trigger accidentally and is only discoverable from the doc comment.

**Recommendation**: Replace the magic value with an explicit boolean parameter (`distributeAllA: boolean`) or a dedicated method, and assert the intended units.

---

### [L-02] `registerTrade` stat scaling can overflow uint64 for very large low-decimal swaps

**Severity**: Low
**Status**: Open
**Component**: BiatecClammPool — `swap` → `registerTrade`
**File**: `contracts/BiatecClammPool.algo.ts:1081-1082`

**Description**:
Stats are reported as `amountForStatsInAssetDecimals * assetDecimalScale2Scale`. For a 0-decimal asset the scale is `10^9`, so an amount above ~1.8e10 units overflows `uint64` and aborts the swap. This bounds the maximum single-swap size for low-decimal assets and manifests as a DoS rather than a fund-safety issue.

**Recommendation**: Compute stat volumes in `uint256`, or cap/clamp the reported figure, so extreme-but-valid swaps are not rejected.

---

### [L-03] VWAP update in the pool provider has an unguarded divide-by-zero path

**Severity**: Low
**Status**: Open
**Component**: BiatecPoolProvider — `updatePriceBoxInfo` / `updatePriceBoxAggregated`
**File**: `contracts/BiatecPoolProvider.algo.ts:657`, `:689`, `:721`, `:752` (and aggregated equivalents)

**Description**:
`period*NowVWAP = (volumeB*VWAP + amountB*price) / (volumeB + amountB)`. The denominator is `nowVolumeB + netAmountB`. Immediately after a period rollover `nowVolumeB == 0`, so the denominator equals `netAmountB = amountB - feeAmountB`. There is no assertion that `netAmountB > 0`; only `amountB > 0` is asserted (`:621`). In the current pipeline `feeAmountB` is a small fraction of `amountB` (fee ≤ 10%), so `netAmountB > 0` holds and no division by zero occurs — but the safety depends on caller-supplied values rather than a local invariant.

**Recommendation**: Assert `netAmountA >= 0 && netAmountB >= 0` and guard the VWAP denominator (`if (denom == 0) skip`) so a future change to fee accounting cannot introduce a swap-reverting divide-by-zero.

---

### [L-04] npm dependency vulnerabilities (17 total; 5 high), including a runtime-reachable ReDoS

**Severity**: Low
**Status**: Open
**Component**: Tooling / client dependencies
**Evidence**: `npm audit` — 1 low, 11 moderate, 5 high.

**Description**:
`npm audit` reports high-severity advisories in `parse-duration` (ReDoS), `serialize-javascript`, `undici`, and `esbuild`. Most reach the tree only through dev/docs tooling (`@docusaurus/*`, `webpack-dev-server`, `esbuild`). However **`ipfs-http-client` is a production dependency** and pulls in the vulnerable `parse-duration` (GHSA-hcrg-fc28-fcg5, ReDoS). IPFS is used only by token-creation/asset-metadata scripts, not by the on-chain contracts or the core swap/liquidity client path, so exposure is limited to processes that invoke the IPFS client. The published npm package ships only `dist`, further limiting downstream exposure.

**Recommendation**:
1. Run `npm audit fix`; for `parse-duration`/`ipfs-http-client`, evaluate upgrading or removing the IPFS dependency from the runtime path (move metadata publishing to a separate tool/package).
2. Move Docusaurus and other docs/build-only tooling to a separate workspace so their advisories don't appear in the library's dependency tree.
3. Add `npm audit` (with an allowlist) to CI.

---

### [L-05] Large volume of commented-out dead code in contracts

**Severity**: Low
**Status**: Open
**Component**: BiatecClammPool, BiatecPoolProvider
**Files**: e.g. `BiatecClammPool.algo.ts:462-611`, `:1092-1112`; `BiatecPoolProvider.algo.ts:79-110`, `:570-598`, `:755-1024`

**Description**:
Substantial blocks of commented-out logic (old add-liquidity balancing, disabled `period5`/`period6` stats, disabled balance-check asserts, `SHORTENED_APP` remarks) remain in the sources. This inflates the audit surface, obscures the active control flow, and risks a future editor re-enabling stale logic.

**Recommendation**: Remove dead code (git history preserves it). Where a disabled assertion encoded a real invariant (e.g., the commented balance-check asserts at `:1092-1112`), decide deliberately whether to restore it.

---

### [I-01] Full test suite passes on the audited commit

**Severity**: Informational
**Status**: Resolved
**Evidence**: `npm run test` executed fresh against commit `2a0b2c22…` on a running LocalNet:

```
Test Suites: 18 passed, 18 total
Tests:       91 passed, 91 total
Time:        99.187 s
```

The stale `jest-results.json` (2025-11-08) had recorded 2 failures — `Staking Pools › Native Token Pool respects custom native token name casing` and `doAppCall › executive fee account can proxy arbitrary app calls`. Both now **pass** on the current commit, so the earlier record is superseded. Note that the `doAppCall` test only covers the `payAmount > 0` path; the gaps described in M-01 (native-ALGO movement, `payAmount = 0` no-op) remain untested regardless of the suite being green — see the Missing Test Scenarios in §5.

---

### [I-02] Struct field typos in client types (`Liqudity`)

**Severity**: Informational
**File**: `src/biatecClamm/parseStatus.ts:9-11`, etc.

The client `AmmStatus` type spells liquidity fields `currentLiqudity`, `releasedLiqudity`, `liqudityUsersFromFees`, `liqudityBiatecFromFees`. Functionally harmless (positional decoding is correct) but a consumer-facing naming defect. Align field names with the contract (`currentLiquidity`, …).

---

### [I-03] Swap capping relies on integrators always setting slippage bounds

**Severity**: Informational (see H-02)

The contract intentionally treats `minimumToReceive = 0` as "no protection." Any front-end or bot that forwards a user-supplied or defaulted zero disables slippage protection. Treat non-zero `minimumToReceive` as mandatory in all official client builders and examples.

---

## 5. Missing Test Scenarios

### Missing Test: Swap over-payment loss with `minimumToReceive = 0` vs. non-zero
**Description**: Assert exact caller loss when output is capped, and that a non-zero `minimumToReceive` reverts instead of over-paying.
**Risk if Untested**: H-02 regressions ship silently.
**Test Steps**: Drain asset B; swap large A with `minimumToReceive = 0` (expect capped receive, full spend) and again with a realistic `minimumToReceive` (expect revert).
**Priority**: High

### Missing Test: LP issuance invariants under randomized deposit/withdraw sequences
**Description**: Property test that value-out ≤ value-in and total LP ≤ `TOTAL_SUPPLY` across many operations, including single-sided deposits at range extremes.
**Risk if Untested**: Undetected dilution/over-issuance (M-02).
**Priority**: High

### Missing Test: `feeMultiplier` upper-bound / swap-multiplier underflow
**Description**: Set a user `feeMultiplier` high enough to underflow `feesMultiplier` and assert the outcome (should be a bounded, defined behavior, not an opaque revert).
**Risk if Untested**: M-03 per-user DoS.
**Priority**: Medium

### Missing Test: `doAppCall` with `payAmount = 0` and with ASA/ASA pools
**Description**: Define and assert behavior when `payAmount = 0`; verify ALGO reserve cannot be moved below operational needs in an ASA/ASA pool.
**Risk if Untested**: M-01.
**Priority**: Medium

### Missing Test: VWAP period-rollover with fee-heavy first trade
**Description**: Force a period rollover, then a trade where `netAmountB` is minimal, asserting no divide-by-zero.
**Risk if Untested**: L-03.
**Priority**: Low

---

## 6. Documentation Gaps

### Documentation Gap: Trust / centralization model
**Missing Information**: Which addresses hold `addressUdpater`, `addressExecutive`, `addressExecutiveFee`, multisig thresholds, upgrade/timelock policy.
**User Impact**: Depositors cannot assess custody risk (H-01, M-04).
**Location**: `README.md`, user-facing docs.
**Priority**: High

### Documentation Gap: Slippage semantics of `minimumToReceive = 0`
**Missing Information**: That zero disables slippage protection and over-payment is forfeited to LPs.
**User Impact**: Fund loss (H-02).
**Location**: Swap API docs, `clammSwapTxs`/`clammSwapSender` JSDoc.
**Priority**: High

### Documentation Gap: `distributeExcessAssets` magic value `1`
**Missing Information**: Prominent warning that `1` means "distribute all," not "one unit."
**Location**: Method JSDoc + operator runbooks.
**Priority**: Medium

---

## 7. Security Best Practices Assessment

| Area | Status | Notes |
| --- | --- | --- |
| Division-by-zero guards | ✅ | `E_ZERO_DENOM`, `E_ZERO_LIQ`, `E_ZERO_LIQ` asserts before divisions. |
| Rounding favors pool | ✅ | `realSwap*Decimals - 1` corrections; `LiquidityRoundingAllowance` bound. |
| Overflow safety | ⚠️ | `uint256` used for core math; stat scaling in `uint64` can overflow (L-02). |
| Access control | ✅ | Role checks via config provider on all privileged methods. |
| Reentrancy | ✅ | Inner calls are to trusted contracts; no callback into mutating entrypoints. |
| Asset-in/opt-in handling | ✅ | Contract opts into assets at bootstrap; native vs ASA handled. |
| Kill switch coverage | ⚠️ | Present on swap/liquidity, but not on identity `setInfo`/`selfRegistration` (M-03). |
| Slippage protection | ⚠️ | Optional; disabled at `minimumToReceive = 0` (H-02). |
| Upgradeability | ⚠️ | Full upgrade power in updater multisig (H-01). |
| Balance-vs-state reconciliation | ✅ | `ensurePoolBalancesWithinHoldings` after admin movements (native-ALGO gap noted in M-01). |
| Dependency hygiene | ⚠️ | 17 npm advisories; one runtime-reachable (L-04). |

---

## 8. Risk Assessment

**Contract-logic risk**: Low-to-Moderate. The AMM math is defensively coded with pool-favoring rounding and non-decreasing-liquidity guards; no confirmed loss-of-funds bug was found in the swap/liquidity paths. The two areas needing the most follow-up are the LP-issuance quadratic (M-02, unverified) and the over-payment donation behavior (H-02, confirmed by test).

**Operational / trust risk**: High. The system is custodial in effect: the updater multisig can upgrade live pools and executive roles wield broad asset/proxy powers. Depositor safety is contingent on key management and process, not on immutable code.

**Dependency risk**: Low. Advisories are concentrated in build/docs tooling; the one runtime-reachable case (`parse-duration` via `ipfs-http-client`) is off the core AMM path.

**Overall**: The on-chain code quality is good. The dominant residual risks are governance/centralization (H-01, M-04) and the slippage/over-payment UX hazard (H-02), both of which are addressable through code hardening plus clear disclosure.

---

## 9. Recommendations (Prioritized)

1. **(H-02)** Refund unswappable input or reject capped-output swaps; make `minimumToReceive > 0` mandatory in official clients. *(High, moderate effort)*
2. **(H-01, M-04)** Introduce a timelock on `updateApplication` and identity-provider changes; publish the trust model and role addresses. *(High, moderate effort)*
3. **(M-02)** Add property/fuzz tests and formal verification of LP issuance; add first-deposit minimum-liquidity lock. *(High value, higher effort)*
4. **(M-03)** Bound `feeMultiplier` in `setInfo`; clamp `feesMultiplier` in `swap`; add pause checks to identity mutations. *(Medium, low effort)*
5. **(M-01)** Define `doAppCall` behavior for `payAmount = 0`; allowlist targets; protect the pool's ALGO reserve. *(Medium, low effort)*
6. **(L-01..L-05)** Replace the `1`-means-all magic value; widen stat math to `uint256`; guard the VWAP denominator; run `npm audit fix` and split docs tooling; delete dead code. *(Low, low effort)*
7. **(I-01)** Full suite currently passes (91/91). Wire it into CI so this remains true, and add the missing scenarios from §5. *(Informational, low effort)*

---

## 10. Testing Recommendations

- Add the five missing scenarios in §5, prioritizing H-02 and M-02 coverage.
- Introduce property-based testing (e.g., fast-check) for the liquidity/swap invariants: `value_out ≤ value_in`, `L` non-decreasing on fee-bearing ops, `Σ LP ≤ TOTAL_SUPPLY`.
- Add extreme-value tests for low-decimal (0–2 decimals) assets to exercise the `uint64` stat-scaling boundary (L-02).
- Wire `npm run test` and `npm audit` into CI with a required-pass gate; publish coverage.

---

## 11. Compliance and Standards

- **ARC-4 / ARC-56**: Contracts expose ABI methods and ship ARC-56 artifacts; bytecode hashes reproduce from the artifacts (verified).
- **Algorand guidelines**: Inner-transaction fees are set explicitly (`fee: 0` on inner txns, caller pays via `staticFee`); opt-ins performed at bootstrap; box references populated by client builders.
- **KYC/identity**: Verification-class gating is enforced per pool via the identity provider; enforcement strength depends on the mutable config binding (M-04).
- **Licensing**: AGPL-3.0, consistent across `package.json` and repository.

---

## 12. Appendix

### A. Contracts Reviewed

| Contract | Lines | Role |
| --- | --- | --- |
| BiatecClammPool.algo.ts | 1,758 | Concentrated-liquidity pool (swap, liquidity, fees, admin) |
| BiatecConfigProvider.algo.ts | 232 | Roles, fees, kill switch, app registry |
| BiatecIdentityProvider.algo.ts | 441 | Identity / KYC / fee multiplier |
| BiatecPoolProvider.algo.ts | 1,175 | Pool registry, price feed / VWAP, deployment |
| FakePool.algo.ts | 15 | Registration helper |

### B. Key Invariants Observed in Code

- `Liquidity` is non-decreasing on swaps and fee distributions (`setCurrentLiquidityNonDecreasing`, bounded rounding drop via `getLiquidityRoundingAllowance`).
- Swap output rounding subtracts one base unit when not evenly divisible, biasing residue to the pool (`:967-969`, `:1014-1016`).
- After admin asset movement, recorded base-scale balances must remain ≤ real holdings (`ensurePoolBalancesWithinHoldings`).
- LP mint floors to 1 when a positive delta would otherwise round to 0 (`:667-668`); `LP-ZERO-ERR` prevents zero-mint.
- Pool registration requires the caller pool to have been created through `deployPool` (recent-pools allowlist, `:479-492`) and `registerTrade` requires `appPoolId === callerApplicationID`.

### C. Commands Executed

```
git log -1 --format="%H %cI"          # 2a0b2c22... 2026-07-06T12:33:04+02:00
npm run compute-bytecode-hashes       # bytecode SHA256 (see §1)
npm audit                             # 17 vulns (1 low, 11 moderate, 5 high)
docker ps                             # algokit LocalNet (algod/indexer/conduit/postgres) up
npm run test                          # build + full suite: 18 suites / 91 tests passed, 0 failed (~99 s)
npx jest __test__/Ticks.test.ts       # 23 passed / 23 (pure-TS subset)
```

### D. Severity Definitions

- **Critical** — Direct loss of user funds; permanent lock; unauthorized LP minting; full access-control bypass.
- **High** — Loss under specific conditions; significant economic manipulation; partial control bypass.
- **Medium** — Loss under unlikely conditions; economic inefficiency; degraded functionality; trust-critical mutability.
- **Low** — Code quality, inefficiency, minor UX, non-critical gaps.
- **Informational** — Style, optimization, best-practice notes.

### E. Disclaimer

This audit is a best-effort review by an AI model of the source at the stated commit, cross-checked against a full, passing test run (18 suites / 91 tests) on an Algorand LocalNet. It is not a guarantee of security. A green test suite demonstrates intended behavior for the covered scenarios but does not prove the absence of the economic, rounding, and governance risks flagged herein; findings marked "unconfirmed" require follow-up (formal verification / on-chain fuzzing). An independent professional audit and a public bug-bounty are recommended before mainnet reliance.

---

**End of Report**
