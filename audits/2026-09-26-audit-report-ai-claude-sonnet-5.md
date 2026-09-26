# Security Audit Report: BiatecCLAMM

## Audit Metadata

- **Audit Date**: 2026-09-26
- **Audit Type**: AI Model (independent, fresh review)
- **Repository**: BiatecCLAMM
- **Git Commit Hash**: `0c611095c04103f80d8c3d23ed03a4762e9620f3`
- **Git Commit Date**: 2026-09-26T14:23:39+02:00
- **Branch/Tag**: `main` (local branch 6 commits ahead of `origin/main`; working tree clean at audit start)
- **Auditor Information**:
  - **AI Model**: Claude Sonnet 5 (model id: `claude-sonnet-5`)
  - **Provider**: Anthropic
- **Audit Duration**: Single continuous session (~2 hours wall clock, including a fresh `npm run build`, `npm run compute-bytecode-hashes`, and a full `npm run test` run against LocalNet)
- **Audit Scope**: `contracts/*.algo.ts` (all four production contracts + `FakePool.algo.ts` test helper), `src/biatecClamm/txs`, `src/biatecClamm/sender`, `src/common`, `src/boxes`, `src/biatecConfig`, `src/biatecIdentity`, `src/biatecPools`, full `__test__/` suite, and top-level documentation (`README.md`, `docs/`, `AUDIT_FIXES_SUMMARY.md`, `IMPLEMENTATION_SUMMARY.md`).

### Independence Note

This is a fresh, independent audit. Prior audit reports in `audits/` were not opened or used as discovery material; findings below were derived solely from reading the current source at the commit above, executing the build/test commands listed, and static reasoning about the code. `AUDIT_FIXES_SUMMARY.md` was skimmed only for repository-history context (to understand what "audit 2026-09-07" code comments refer to), not as a source of new findings.

### Contract Bytecode Hashes

Generated fresh via `npm run build && npx ts-node scripts/compute-bytecode-hashes.ts` (the `compute-bytecode-hashes` npm script invokes `ts-node`, which is not installed as a global/binary in this environment — `npx ts-node` was used as the equivalent invocation of the same script; no script content was modified). TEALScript compiler version installed: `@algorandfoundation/tealscript@0.107.2` (per `package.json`; `npm ls tealscript` reported no top-level resolution under that alias, but `@algorandfoundation/tealscript` is the actual devDependency used by `compile-contract`). Build succeeded with no compiler errors and all five contracts produced ARC-56 artifacts; `compute-bytecode-hashes` produced a hash pair for every contract (no missing/malformed artifacts reported).

Note: the script's own output format prefixes each hex digest with an extra leading byte pair (65 hex characters instead of the usual 64 for a SHA-256 digest) — this is the script's own formatting artifact, reproduced verbatim below exactly as printed by `scripts/compute-bytecode-hashes.ts`, not edited or truncated by this audit.

**BiatecClammPool.algo.ts**:

- **Approval Program SHA256**: `fa8882645569b87fe222a8f4688e61813d5661c31baebc62a8a48bce13ec2bda`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecConfigProvider.algo.ts**:

- **Approval Program SHA256**: `15bdcb6eb3d4369ce55525f4453c7642f4a2e72f041316124dec8b49c88e0872`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecIdentityProvider.algo.ts**:

- **Approval Program SHA256**: `349f9a336ce345098b9fc6f768fa2a5ee7d45e1917419bb9880973218d3c5b72`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecPoolProvider.algo.ts**:

- **Approval Program SHA256**: `de7c5805c1cfefd1dea0f11f9f56191a7b7c795d396917085b941c844c126f11`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**FakePool.algo.ts**:

- **Approval Program SHA256**: `b303c1c803a3a56e7c04a6246861110f3ec38c7c28fabe1602d01a9b69feb1a7`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

All five clear-state programs hash identically (`01ba4719...`), which is expected: TEALScript's default clear-state program is a fixed trivial `#pragma version ...; int 1` (or equivalent) unless a contract overrides it, and none of these contracts do. These hashes fingerprint the specific compiled bytecode of this build; they do not by themselves prove that this exact bytecode is what is deployed on any live network, nor that the compiled TEAL is a faithful translation of the TypeScript source beyond what TEALScript's own compiler correctness guarantees (not independently re-verified here).

---

## Executive Summary

BiatecCLAMM is a concentrated-liquidity AMM for Algorand built with TEALScript, split across four cooperating contracts (`BiatecClammPool`, `BiatecConfigProvider`, `BiatecIdentityProvider`, `BiatecPoolProvider`) plus a TypeScript client SDK. The codebase shows clear evidence of iterative hardening: numerous code comments explicitly reference and guard against issues raised in prior audits (e.g. "audit 2026-09-07 H-01", "H-02", "L-01", "L-02", "M-02"), and a dedicated `__test__/pool/audit-2026-09-07-*.test.ts` suite exists specifically to pin down the fixed behavior for those prior findings.

The fresh build succeeded cleanly, bytecode hashes were generated for all five contracts, and the full test suite (`npm run test`, i.e. `npm run build && jest`) passed completely: **28 test suites, 131 tests, all passing**, in ~112.6 seconds against the running LocalNet. No test-harness or contract-defect failures were observed in this run.

This independent review's most significant new finding is **[H-01]**: the `BiatecPoolProvider.deployPool` → `registerPool` registration flow uses a fixed 10-slot round-robin "recently created pools" ring buffer as its anti-spoofing check, and registration happens in a transaction separate from deployment. Because `deployPool` is permissionless and cheap, any actor (or simply organic traffic) issuing 10 `deployPool` calls after a target pool's deployment but before its registration completes can permanently evict that pool from the ring, permanently blocking its registration and therefore permanently blocking its ability to ever execute a `swap()` (which unconditionally depends on the pool being registered). Deposited liquidity remains withdrawable via `removeLiquidity` (which does not depend on registration), so this is a permanent **swap-functionality denial-of-service**, not an inescapable fund lock — but it can brick a newly deployed pool's core trading function with no recovery path other than redeployment. This audit independently confirmed the mechanism by direct code reading, including a commented-out line at `deployPool:427` (`// this.registerPool(...)`) that is direct evidence the atomic, same-group registration design existed and was deliberately removed, which is what opens this race window.

Beyond H-01, this review did not find any Critical severity issues, and confirms, via independent static reading, that the core invariants highlighted by prior audits and now covered by regression tests — non-decreasing liquidity accounting, LP-token entitlement capped by conservative pro-rata share, same-asset (staking) pool backing across both accounting sides, and `doAppCall`'s exact-shape execution — are implemented as described. It also surfaces a number of **new Medium/Low/Informational** observations not obviously covered by the existing audit-fix trail, concentrated in several areas: (1) pause-matrix ("kill switch") coverage gaps on a small number of mutating methods across `BiatecClammPool`, `BiatecIdentityProvider`, and `BiatecPoolProvider`; (2) a vestigial/unused `verificationSetter` role in `BiatecIdentityProvider` that suggests the separation-of-duties design is incompletely wired up, concentrating verification-class and lock/unlock power entirely in `engagementSetter`; (3) a shared, unsegmented aggregated price/volume box in `BiatecPoolProvider` that a permissionless, low-quality pool could pollute if any integrator treats it as a trusted oracle; (4) a real (non-security) functional bug in the TypeScript SDK's `clammAddLiquiditySender` that forces an unnecessary extra opt-in transaction on every add-liquidity call for users already opted into the LP token. The KYC/investor "expiration" fields (`kycExpiration`, `investorForExpiration`) are stored but never evaluated on-chain — this is already disclosed and deliberately pinned down as an open policy question by the project's own `audit-2026-09-07-m03-identity-policy.test.ts`, and this audit concurs it is a live gap, not a fixed one.

No unauthorized fund-drain, LP-supply-inflation, or full access-control-bypass path was identified. All privileged mutating functions reviewed require an on-chain caller-identity check against an address stored in `BiatecConfigProvider`'s (or the pool's own) global state, and every cross-contract global-state read observed first validates the caller-supplied `AppID` against the contract's own recorded configuration reference before trusting any value read from it — the pattern that prevents "spoofed config app" attacks. `registerPool`'s own anti-spoofing authentication (rejecting an app that never went through `deployPool`) was independently confirmed sound; H-01 is about that control's *availability*, not a defeat of its authentication logic.

**Findings summary**: 0 Critical, 1 High, 8 Medium, 11 Low, 17 Informational (exact items and IDs are enumerated in the Findings section below).

---

## Scope and Methodology

### Audit Scope

**Smart Contracts Reviewed** (full read, line-by-line):

- [x] `contracts/BiatecClammPool.algo.ts` (1,813 lines) — read in full directly by the lead reviewer (two overlapping passes: lines 1–980 and 950–1813) and independently re-reviewed for lines 950–1813 (swap/fee/math/admin functions) by a dedicated sub-review.
- [x] `contracts/BiatecConfigProvider.algo.ts` (232 lines) — read in full directly by the lead reviewer and by a dedicated sub-review.
- [x] `contracts/BiatecIdentityProvider.algo.ts` (450 lines) — read in full directly by the lead reviewer and by a dedicated sub-review.
- [x] `contracts/BiatecPoolProvider.algo.ts` (1,191 lines) — read in full by a dedicated sub-review (pool registry, box storage, deployment orchestration); the most consequential finding (H-01, the `deployPool`/`registerPool` registration race) was independently re-verified by the lead reviewer through direct reading of `contracts/BiatecPoolProvider.algo.ts:360-454, 459-507` and cross-referenced against `contracts/BiatecClammPool.algo.ts:304-315, 1137-1153`.
- [x] `contracts/FakePool.algo.ts` (15 lines) — read in full; confirmed to be a deliberate test-only malicious-pool simulator used by `BiatecPoolProvider` registration-authenticity tests, not a production contract.

**Source Code Reviewed**:

- [x] TypeScript transaction builders (`src/biatecClamm/txs/`) — 10 files
- [x] Sender functions (`src/biatecClamm/sender/`) — 10 files
- [x] Common utilities (`src/common/`) — 2 files
- [x] Box management (`src/boxes/`, plus `src/biatecPools/getBoxReference*`, `src/biatecIdentity/getBoxReferenceIdentity.ts`)
- [x] Other modules: `src/biatecConfig/` (sender + txs), spot-checked `src/bin/*.ts` for secret-handling patterns, `src/ticks/*` skimmed (pure client-side math utilities, no chain interaction, out of primary security scope)

**Documentation Reviewed**:

- [x] `README.md`
- [ ] `docs/staking-pools.md` — **file does not exist** (see Documentation Gaps)
- [ ] `docs/liquidity-fee-protection.md` — **file does not exist**
- [ ] `docs/liquidity-rounding.md` — **file does not exist**
- [ ] `docs/basic-use-cases.md` — **file does not exist**
- [x] `IMPLEMENTATION_SUMMARY.md`
- [x] `.github/copilot-instructions.md` (present, not separately reproduced here)
- [x] `AUDIT_FIXES_SUMMARY.md` (context only, per Independence Note)
- [x] `docs/publishing.md` (the only file that actually exists in `docs/`)

**Test Coverage Reviewed**:

- [x] All 28 test files in `__test__/` (structure and representative content reviewed; full suite executed)
- [x] Fresh full-suite execution result (see below)
- [x] Edge-case handling spot-checked via `extreme.test.ts`, `overpay.test.ts`, `fees.test.ts`, `staking.test.ts`, `mainnet-replay-3720188642.test.ts`

### Methodology

1. **Repository/tooling setup**: recorded exact commit hash/date via `git log -1 --format="%H %cI"`; confirmed LocalNet containers (`algokit_sandbox_algod`, `_indexer`, `_conduit`, `_postgres`) were already `Up` via `docker ps`; ran `git status` to confirm a clean working tree before starting.
2. **Fresh build**: `npm run build` (→ `tealscript contracts/*.algo.ts contracts/artifacts` then `algokit generate client ...`), which succeeded for all five contracts with no errors.
3. **Bytecode hashing**: `npx ts-node scripts/compute-bytecode-hashes.ts` run immediately after the fresh build (see note above about `ts-node` not being on `PATH` directly).
4. **Full test suite**: `npm run test` (→ `npm run build && jest`) executed fresh, in the background, with a 10-minute timeout, against the already-running LocalNet. The run was monitored to completion; the final summary line was captured directly from the process log, not from any pre-existing `jest-results.json` (a stale `jest-results.json` exists in the repo root from a prior run and was **not** used for this report).
5. **Manual static code review**: performed directly by the lead reviewer for `BiatecClammPool.algo.ts` (both halves), `BiatecConfigProvider.algo.ts`, and `BiatecIdentityProvider.algo.ts`, following the Security Checklist and Code Review Deep Dive Areas in `audits/AI-AUDIT-INSTRUCTIONS.md`. In parallel, four independent sub-reviews were run against non-overlapping-by-design (with deliberate overlap on `BiatecClammPool` for cross-check) portions of the codebase: (a) `BiatecClammPool.algo.ts` lines ~950–1813 (swap/fee/math), (b) `BiatecConfigProvider.algo.ts` + `BiatecIdentityProvider.algo.ts` in full, (c) `BiatecPoolProvider.algo.ts` in full, (d) the TypeScript client library (`src/biatecClamm/txs`, `src/biatecClamm/sender`, `src/common`, `src/boxes`, `src/biatecConfig`, `src/biatecIdentity`, `src/biatecPools`). All sub-review findings were checked against the actual source by the lead reviewer before inclusion below; none were accepted without independent confirmation of the cited file/line.
6. **Mathematical verification**: the concentrated-liquidity formulas in `calculateLiquidityD`/`calculateLiquidityWithD`/`calculatePrice`/`calculateAssetBWithdrawOnAssetADeposit`/`calculateAssetAWithdrawOnAssetBDeposit` were traced against their in-code algebraic derivation comments; the derivations are internally consistent with the stated invariant `(x + L/√P₂)(y + L·√P₁) = L²`, distinct from the naive `L = √(xy)` constant-product formula (per the instructions' warning not to assume the latter applies here). No independent from-scratch re-derivation of the quadratic root formula was performed beyond checking the algebra in the comments matches the code.
7. **Test coverage / documentation gap analysis**: performed by reading test file headers/structure and cross-referencing `README.md`'s documentation links against the actual contents of `docs/`.

No fuzzing, symbolic execution, or third-party static-analysis tooling (e.g. Slither-equivalent for TEAL) was used — this was a manual/LLM-assisted static read plus fresh dynamic test execution against LocalNet, consistent with the instructions' prohibition on executing exploit reproductions. No isolated defensive-invariant fixtures beyond the existing test suite were newly written or executed.

---

## Findings

Severity definitions follow `audits/AI-AUDIT-INSTRUCTIONS.md` (Critical = direct fund loss/permanent lock/unauthorized LP minting/full access-control bypass; High = indirect loss under specific conditions/significant economic manipulation/partial access-control bypass; Medium = loss under unlikely conditions/economic inefficiency/documentation mismatch; Low = code quality/minor UX/gas; Informational = style/optimization/education).

### Critical Severity Issues

None identified.

### High Severity Issues

#### [H-01] Permanent swap-capability lock via `recentPoolsN` ring-buffer eviction between `deployPool` and pool registration

**Severity**: High
**Status**: Open
**Confidence**: Static evidence (sub-review finding, independently re-confirmed by the lead reviewer by direct reading of the cited lines)
**Location**: `contracts/BiatecPoolProvider.algo.ts:360-454` (`deployPool`), `:427` (commented-out `// this.registerPool(...)`, direct evidence registration was deliberately decoupled from deployment), `:429-452` (10-slot `recentPoolsN` round-robin ring), `:459-507` (`registerPool`'s ring-membership check, `assert(false, 'App not in recently created apps')`); cross-referenced against `contracts/BiatecClammPool.algo.ts:304-315` (`bootstrapStep2`, which calls `registerPool` and is confirmed to be a separate transaction from `deployPool` per `src/biatecClamm/txs/clammBootstrapTxs.ts`) and `contracts/BiatecClammPool.algo.ts:1137-1153` (`swap()`'s unconditional, non-optional inner call to `registerTrade`, which requires the pool's box in `BiatecPoolProvider.pools` to already exist).

**Invariant**: A pool created through the canonical `deployPool` → `bootstrap` → `bootstrapStep2` → `registerPool` flow should always be able to complete registration and subsequently swap, since it followed the only sanctioned deployment path.

**Evidence**: `deployPool` (permissionless, requiring only a ≥5,000,000-microAlgo seed payment, `:373`) creates the pool app and records its `appId` into one of exactly 10 `recentPoolsN` global-state slots via a round-robin index (`:429-452`). Actual registry insertion (`pools`, `poolsByConfig`, `fullConfigs`, `poolsAggregated` boxes) happens later, in `registerPool`, which is invoked by the newly created pool's own `bootstrapStep2()` method as a **separate transaction/group** from `deployPool` (confirmed via the TypeScript SDK's `clammBootstrapTxs.ts`, which builds `bootstrapStep2` as its own call, and via `BiatecClammPool.algo.ts:304-315`, which has no coupling back into the same atomic group as `bootstrap`). `registerPool` accepts the caller only if its `appId` still matches one of the 10 `recentPoolsN` slots (`:494-506`); otherwise it hard-reverts with `'App not in recently created apps'`. Because the ring holds only 10 entries and `deployPool` is permissionless and cheap to call repeatedly, any actor (or simply organic pool-creation traffic) that invokes `deployPool` 10 times after a target pool's `deployPool` call but before that target's `bootstrapStep2` lands will evict the target's `appId` from every slot. Once evicted, there is no path to re-insert the same `appId` — only `deployPool` writes to the ring, and `deployPool` always creates a brand-new application — so the target pool's `bootstrapStep2`/`registerPool` call fails **permanently**. `BiatecClammPool.swap()` unconditionally issues an inner `sendMethodCall` to `registerTrade` on the pool provider (`BiatecClammPool.algo.ts:1137-1153`, no optionality, no try/catch equivalent in TEALScript/AVM), and `registerTrade` reads `this.pools(appPoolId.id).value` (`BiatecPoolProvider.algo.ts` around `updatePriceBoxInfo`), which reverts if that box was never created. Consequently, a pool whose registration was blocked this way can **never execute a swap again**.

Independently confirmed important nuance not fully captured by severity-maximal framing: `addLiquidity` and `removeLiquidity` in `BiatecClammPool.algo.ts` do **not** call into `BiatecPoolProvider` at all (confirmed by direct reading of both methods, lines 440-629 and 764-794) — they operate purely on the pool's own state. This means liquidity already deposited into an evicted, unregistered pool **remains withdrawable** via `removeLiquidity`; the permanent effect is specifically loss of swap functionality for that pool instance, not an inescapable fund lock. The line `// this.registerPool(AppID.fromUint64(appId), assetA, assetB, verificationClass);` still present (commented out) at `deployPool:427` is direct evidence that atomic, same-group registration was a design that existed and was deliberately removed, which is what introduces this race window.

**Prerequisites and Impact**: No privileged role is required — any account can call `deployPool` (subject to the ≥5 Algo seed payment per call, i.e. ≈54.5 Algo total to fill and hold all 10 slots against one target). Impact: the targeted pool's swap function becomes permanently unusable, forcing LPs to withdraw and any integrators to redeploy a fresh pool; this is a functionality-denial/griefing vector against a specific new pool (most acutely a high-value or high-visibility pool at/near its launch), not a path to steal already-deposited funds. It can also occur unintentionally under organic high pool-creation volume without any adversarial intent, since the ring is small and shared across all pool creators.

**Recommendation**: Close the atomicity gap rather than relying on out-of-band, racy registration. Either (a) have `deployPool` itself invoke the newly created pool's `bootstrapStep2` (and thus `registerPool`) within the same atomic transaction group/inner-call chain, eliminating the window entirely, or (b) replace the fixed 10-slot ring with a box keyed by `appId` (with a reasonable expiry) so an unbounded number of pending-registration pools can coexist without evicting each other, or (c) increase the ring size substantially and treat it as a mitigation rather than a fix, while also emitting a way to detect/reclaim a bricked pool.

**Defensive Acceptance Criteria**: A regression test should confirm that after `deployPool` followed immediately (same group or otherwise, per whichever fix is chosen) by the corresponding pool's `bootstrapStep2`, ten unrelated `deployPool` calls from other accounts in between cannot cause the target's subsequent `registerPool`/first `swap` call to fail. If fix (a) is chosen, the two-step `bootstrap`/`bootstrapStep2` external-call pattern itself should be revisited for continued necessity.

**Limitations**: Not executed live; this is a traced static-logic finding across two contracts and the off-chain TypeScript deployment flow, not a runtime-confirmed exploit. The exact economic cost (~54.5 Algo per targeted griefing attempt, from `verifyPayTxn(txSeed, {amount: {greaterThanEqualTo: 5_000_000}})` at `BiatecPoolProvider.algo.ts:373`, times 10) is derived from reading the constant in the source, not from an on-chain measurement of actual gas/fee totals.

---

### Medium Severity Issues

#### [M-01] KYC/investor "expiration" fields are stored but never evaluated on-chain

**Severity**: Medium
**Status**: Open (policy clarification) — already disclosed by the project's own test suite
**Confidence**: Static evidence, corroborated by an existing project test (`__test__/pool/audit-2026-09-07-m03-identity-policy.test.ts:137`, named `'identity expiry is NOT evaluated on chain: an expired KYC record keeps full access (documents the open M-03 policy)'`)
**Location**: `contracts/BiatecIdentityProvider.algo.ts:12-13, 136-140` (field definitions); `contracts/BiatecClammPool.algo.ts:909-943` (`verifyIdentity`, the sole on-chain consumer of identity data) — no reference to `kycExpiration`/`investorForExpiration` exists anywhere in `BiatecClammPool.algo.ts`.

**Invariant**: A user whose KYC or investor-form verification has expired should not retain the trading/liquidity privileges associated with that verification, if that is the intended compliance policy.

**Evidence**: `IdentityInfo`/`UserInfoV1` carry `kycExpiration: uint64` and `investorForExpiration: uint64` (unix seconds), populated by `setInfo` (identity provider, gated by `engagementSetter`) and returned by `getUser`/`getUserShort`. `BiatecClammPool.verifyIdentity()` calls `getUserShort` and checks only `user.isLocked` and `user.verificationClass` bounds (lines 926-937); it never reads or compares `kycExpiration`/`investorForExpiration` against `globals.latestTimestamp` or any other clock. This was independently confirmed by direct reading of `verifyIdentity` and corroborated by the project's own test, which asserts that trade/deposit/withdrawal calls succeed even when `kycExpiration`/`investorForExpiration` are set to `1` (1970-01-01T00:00:01Z, i.e. already expired at any real-world block time).

**Prerequisites and Impact**: No special privilege is required to be affected — this is a description of current behavior for all users, not an attacker-triggered defect. Impact is a **compliance/policy gap**, not a fund-safety issue: an account whose KYC or investor status has lapsed retains full trading/deposit/withdrawal capability at its last-assigned `verificationClass` until an operator manually intervenes (e.g. via `setInfo` to change `verificationClass` or `isLocked`). This is a data-integrity/documentation-mismatch pattern (verification metadata that implies temporal validity but is not enforced), which is why it is classified Medium rather than Low: the impact depends entirely on whether the business/regulatory policy requires automatic expiry enforcement, which this audit cannot determine.

**Recommendation**: Explicitly document (e.g. in a `docs/identity-policy.md` or in the `IdentityInfo` doc comments themselves) that expiry fields are informational-only and enforcement is operational (off-chain monitoring + manual `setInfo`/lock), if that is the intended design. If automatic on-chain enforcement is required by policy, add an explicit check in `verifyIdentity()` (e.g. `assert(user.kycExpiration === 0 || user.kycExpiration > globals.latestTimestamp, 'ERR-KYC-EXPIRED')`) with an accompanying migration/rollout plan, since this would be a behavior-changing update for any account with a non-zero expiration already set.

**Defensive Acceptance Criteria**: If the fix direction is "enforce expiry," a regression test should assert that a call to `addLiquidity`/`removeLiquidity`/`swap` reverts once `globals.latestTimestamp` exceeds a non-zero `kycExpiration`/`investorForExpiration`, and succeeds again after `setInfo` refreshes the expiry to a future timestamp. If the fix direction is "document as informational," no code change is needed, only documentation.

**Limitations**: This audit takes no position on which policy is correct; it only confirms, independently, that the code path described by the project's own M-03 test still matches current behavior at this commit.

---

#### [M-02] `verificationSetter` role is declared and bootstrapped but never enforced — unused separation-of-duties control

**Severity**: Medium
**Status**: Open
**Confidence**: Static evidence (sub-review finding, independently confirmed by direct read)
**Location**: `contracts/BiatecIdentityProvider.algo.ts:189` (declaration), `:226` (set in `bootstrap`), `:290-295` (`setInfo`, the only method that mutates verification-related fields)

**Invariant**: The presence of a distinct `verificationSetter` global-state role, separate from `engagementSetter`, implies an intended separation of duties between "who can change a user's verification/KYC status" and "who can award engagement/loyalty points" — two operationally very different levels of trust.

**Evidence**: `verificationSetter = GlobalStateKey<Address>({ key: 'v' })` is written once, in `bootstrap()` (`BiatecIdentityProvider.algo.ts:226`), and is never read (`this.verificationSetter.value` does not appear anywhere else in the file). The only method that can change `verificationClass`, `isLocked`, `kycExpiration`, `investorForExpiration`, or any other identity field post-registration is `setInfo()` (lines 290-295), which is gated solely by `assert(this.txn.sender === this.engagementSetter.value)`. Confirmed by direct file read: no `verificationSetter`-gated method exists in the 450-line file.

**Prerequisites and Impact**: Requires no attacker action to be true today — this is a description of the deployed access-control surface. Impact: a single compromised or misused `engagementSetter` key has strictly broader power than its name and the contract's own state layout suggest (full control over KYC/lock status, not just engagement points), which is a larger blast radius than the separation-of-duties design implies. This is an authorization-model completeness gap, not a bypass of an existing check — `setInfo` is still correctly gated to one specific address.

**Recommendation**: Either (a) split `setInfo` into a `setEngagement(...)` method gated by `engagementSetter` (limited to points/ranks) and a `setVerification(...)` method gated by `verificationSetter` (limited to `verificationClass`, `isLocked`, `kycExpiration`, `investorForExpiration`), or (b) remove the unused `verificationSetter` state key and document that `engagementSetter` is intentionally the sole identity-mutation authority, to avoid the false impression of a second, independent control.

**Defensive Acceptance Criteria**: After a fix choosing option (a), a test should confirm `setEngagement` called by an address that is `verificationSetter` but not `engagementSetter` reverts, and vice versa for `setVerification`.

**Limitations**: Unverified whether `verificationSetter` is read by any *other* contract (e.g. a future or off-repo module) via cross-app global-state lookup — this review only confirms it is unused within `BiatecIdentityProvider.algo.ts` itself and within the other three contracts in this repository (grep-confirmed no cross-reference).

---

#### [M-03] Pause ("kill switch") coverage is inconsistent across mutating methods

**Severity**: Medium
**Status**: Open
**Confidence**: Static evidence (cross-referenced by both the lead reviewer and a sub-review, independently)
**Location**: Multiple:
- `contracts/BiatecClammPool.algo.ts:1316-1332` (`sendOnlineKeyRegistration`) — no `paused` check, unlike its sibling `sendOfflineKeyRegistration` (`:1339-1351`, which does check).
- `contracts/BiatecIdentityProvider.algo.ts:247-283` (`selfRegistration`) and `:290-295` (`setInfo`) — neither checks `paused`, unlike `updateApplication` (`:240-241`), `sendOnlineKeyRegistration` (`:306-307`), and `withdrawExcessAssets` (`:419-420`) in the same file.
- `contracts/BiatecConfigProvider.algo.ts` — no method reads `this.suspended.value` at all (it is only ever written, by `setPaused` at `:106-109`); the doc comment at `:38` describes the flag as suspending "all services... in the extreme case."

**Invariant**: Per the audit checklist's Pause Matrix requirement, every mutating method's pause behavior (checked / intentionally exempt) should be defined and consistent, especially for a documented emergency kill switch.

**Evidence**: Direct comparison of sibling methods within the same file shows the inconsistency is real, not a design pattern applied uniformly. `BiatecClammPool.sendOfflineKeyRegistration` (lines 1339-1351) explicitly fetches `paused` from the config app and asserts `paused === 0`; the structurally parallel `sendOnlineKeyRegistration` (lines 1316-1332) has no such check even though both are gated by the same `addressExecutiveFee` role and both are inner-transaction-issuing admin actions. In `BiatecIdentityProvider`, `selfRegistration` and `setInfo` mutate on-chain identity state (the very thing `BiatecConfigProvider.algo.ts:38`'s doc comment calls out — "identity modifications" — as covered by the kill switch) but do not consult the pause flag at all (and `selfRegistration`/`setInfo` do not even take an `appBiatecConfigProvider` parameter, so there is nothing to check against without a method-signature change). `BiatecConfigProvider` itself never reads its own `suspended` flag in any of its own admin methods (`bootstrap`, the `setAddress*` family, `setBiatecFee`, `sendOnlineKeyRegistration`, `withdrawExcessAssets`).

**Prerequisites and Impact**: All affected methods are already gated by a privileged-role check (`addressExecutiveFee` or `engagementSetter`/self for identity), so this is not an unauthorized-access issue — it is an **incompleteness of the emergency-stop mechanism**. During an active incident where `suspended` has been set to `1`, (a) `addressExecutiveFee` can still bring the pool's participation key online (`sendOnlineKeyRegistration`, `BiatecClammPool`), (b) `engagementSetter` can still register new identities or mutate verification/lock state (`BiatecIdentityProvider`), and (c) `addressUdpater`/`addressExecutive`/`addressExecutiveFee` can still fully reconfigure `BiatecConfigProvider` itself (including withdrawing its own excess-asset balance) regardless of the pause flag. Whether any of this is intentional (e.g., admins necessarily need to act *through* the paused period to resolve an incident) cannot be determined from the code alone.

**Recommendation**: Produce an explicit pause matrix (one row per mutating method, per contract) stating which are pause-gated and which are deliberately pause-exempt and why (e.g. "config-provider admin methods are exempt so operators can respond during an incident"), then align the code to that matrix — in particular, `sendOnlineKeyRegistration` in `BiatecClammPool` should almost certainly match its offline sibling for consistency, since bringing a pool online during a declared incident seems unlikely to be an intended exception.

**Defensive Acceptance Criteria**: Once the intended matrix is defined, a per-method test asserting revert-when-paused (or explicit pass-when-paused with a comment citing the matrix) should exist for every mutating method in all four contracts.

**Limitations**: This finding does not assert that any specific asymmetry is a "bug" — several are plausibly intentional (e.g., admins retaining control-plane access during a pause is common and often desirable). It is reported as a documentation/consistency gap because the current code gives no textual indication of which asymmetries are deliberate.

---

#### [M-04] `withdrawExcessAssets` (ConfigProvider and IdentityProvider) has no on-chain "excess" accounting — trusts the caller's requested amount entirely

**Severity**: Medium
**Status**: Open (authorized governance power, not an authorization defect — see Prerequisites)
**Confidence**: Static evidence
**Location**: `contracts/BiatecConfigProvider.algo.ts:202-208`; `contracts/BiatecIdentityProvider.algo.ts:416-426`

**Invariant**: A method named/documented as "withdraw **excess** assets" implies some on-chain notion of what is excess (balance minus tracked liabilities minus MBR) versus what is required for the contract's own operation.

**Evidence**: Both methods let `addressExecutiveFee` withdraw an arbitrary caller-supplied `amount` of any asset (or ALGO) with the sole protection being the AVM's native minimum-balance enforcement (an inner payment/asset-transfer that would push the account below its MBR is rejected by the ledger, not by contract logic). Neither `BiatecConfigProvider` nor `BiatecIdentityProvider` track any liabilities against their own balance (unlike `BiatecClammPool`, which maintains `assetABalanceBaseScale`/`assetBBalanceBaseScale` and enforces `ensurePoolBalancesWithinHoldings`) — these two support contracts are not expected to hold meaningful user-facing balances, so in practice "excess" is simply "whatever the account holds above MBR."

**Prerequisites and Impact**: Requires the `addressExecutiveFee` (ConfigProvider) or the address matching ConfigProvider's `ef` key (IdentityProvider) to be compromised or acting maliciously — this is an **authorized governance power**, not an authorization bypass, and is explicitly documented as such in both methods' doc comments ("Only addressExecutiveFee is allowed to execute this method"). It is listed as Medium rather than Informational because the method name and doc comment ("excess" assets) imply a bounded/audited semantic that the implementation does not actually provide, which could mislead an operator or a future integrator about what protection exists.

**Recommendation**: If these two contracts are ever expected to hold funds beyond incidental MBR/dust (e.g. protocol fee accumulation), add explicit tracked-liability accounting analogous to `BiatecClammPool`'s pattern. Otherwise, update the doc comments to state plainly that "excess" is defined only as "whatever the trusted `addressExecutiveFee` role chooses to withdraw, up to the AVM-enforced minimum balance," so the trust boundary is unambiguous to integrators and key custodians.

**Defensive Acceptance Criteria**: N/A for a documentation-only remediation. If liability tracking is added, a test should confirm a withdrawal that would exceed computed "excess" reverts even though the raw account balance would technically allow it.

**Limitations**: Not verified whether any off-chain multisig policy or additional signer threshold applies to the `addressExecutiveFee` key in production — that is outside this repository's scope.

---

#### [M-05] LP token opt-in detection in `clammAddLiquiditySender` is dead/inverted — always forces an extra transaction

**Severity**: Medium (functional correctness bug in the shipped SDK affecting every `addLiquidity` call; downgraded from what would otherwise be Low purely on code-quality grounds because it silently costs every integrator an extra signed transaction and fee on every call, and because the wasted `accountInformation` REST call could mask a real network/latency issue)
**Status**: Open
**Confidence**: Static evidence
**Location**: `src/biatecClamm/sender/clammAddLiquiditySender.ts:32-36`

**Invariant**: The SDK should only include an LP-token opt-in transaction in the group when the sender is not already opted into the LP asset.

**Evidence**:
```ts
let optinSender: boolean = true;
const acocunt = await input.algod.accountInformation(input.account.addr.toString()).do();
if (!acocunt.assets?.find((a) => a.assetId === input.assetLp)) {
  optinSender = true;
}
```
`optinSender` is initialized to `true` and the `if` branch — intended to detect "not yet opted in" — also just re-sets it to `true`. There is no corresponding `else { optinSender = false; }`. The account-information lookup is performed but its result is never used to change the outcome: `optinSender` is unconditionally `true`.

**Prerequisites and Impact**: Affects every caller of `clammAddLiquiditySender`, with no attacker involvement. Every `addLiquidity` call builds, signs, and submits one extra 0-amount self asset-transfer transaction (per `clammAddLiquidityTxs.ts`), even for accounts already holding the LP asset. This costs an extra transaction fee and one more slot in the atomic group's 16-transaction / box-ref budget on every call. It is not a fund-safety issue (a redundant 0-amount opt-in to an already-opted-in account succeeds harmlessly on-chain) but is a genuine functional defect that will surprise integrators expecting the SDK to skip the step, and silently wastes the REST call that was fetched specifically to make this decision.

**Recommendation**: Fix the branch, e.g. `const optinSender = !acocunt.assets?.find((a) => a.assetId === input.assetLp);`. Also verify the type of `a.assetId` returned by the algod REST client (commonly `number`/`bigint` depending on SDK version) matches `input.assetLp`'s type before relying on `===`, since a type mismatch would silently defeat the fix even after correcting the logic.

**Defensive Acceptance Criteria**: A unit/integration test should assert that calling `clammAddLiquiditySender` for an account already holding a non-zero balance of the LP asset produces a transaction group without an extra opt-in transfer, while a first-time caller's group does include one.

**Limitations**: This is a client-SDK observation, not a contract vulnerability; it does not affect on-chain security.

---

#### [M-06] `setInfo` does not bound several identity fields to their documented ranges

**Severity**: Medium (downgraded from what could be argued as Low, kept at Medium because it is a role-compromise blast-radius multiplier feeding directly into fee-math and percentile-based consumer logic — see Impact)
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecIdentityProvider.algo.ts:290-295` (`setInfo`), compared against the documented ranges at `:37-57` (`verificationStatus` bitmask), `:90-93`/`:103-105`/`:115-117` (engagement ranks documented as a 0–10000 percentile)

**Invariant**: Fields with a documented valid range (e.g. "Rank 0 means no interaction... Rank 10000 means highest interaction") should be validated at the point of mutation, per the general principle that state which downstream consumers assume is bounded should be bounded where it is written.

**Evidence**: `setInfo` validates only `info.feeMultiplierBase === SCALE` and `info.verificationClass <= 4`. It does not bound `feeMultiplier` (whereas `selfRegistration`, the only other entry point, forces it to exactly `2 * SCALE`), does not mask/bound `verificationStatus` against its documented bit range, and does not bound `biatecEngagementRank`/`avmEngagementRank`/`tradingEngagementRank` to the documented 0–10000 range. Confirmed by direct read of lines 290-295 against the doc comments earlier in the same file.

**Prerequisites and Impact**: Requires the `engagementSetter` role (already a privileged, trusted address) to be compromised or to make an operational error. If so, an out-of-documented-range `feeMultiplier` would feed directly into `BiatecClammPool.swap`'s fee computation (`feesMultiplier = s - (fee * user.feeMultiplier) / user.base`, `BiatecClammPool.algo.ts:987`) — this expression is not obviously protected against, e.g., a `feeMultiplier` so large that `feesMultiplier` underflows in `uint256` arithmetic if `fee * feeMultiplier / base > s`, which would need a very large `feeMultiplier` relative to `base` (not reachable by a value `setInfo` would normally be used to set, but not prevented by any assertion either). Out-of-range engagement ranks would similarly propagate to any percentile-based off-chain/on-chain logic that assumes the 0–10000 contract.

**Recommendation**: Mirror the documented bounds inside `setInfo`, e.g. `assert(info.tradingEngagementRank <= 10000)` (and the other two ranks), a sanity bound on `feeMultiplier` relative to `base`, and a mask-check on `verificationStatus` against the known bit range (0–131071 per the enumerated bits).

**Defensive Acceptance Criteria**: A test asserting `setInfo` reverts when called with `tradingEngagementRank > 10000` (and similarly for the other bounded fields) once the fix lands.

**Limitations**: Whether `fee * feeMultiplier / base` can actually underflow given TEALScript's `uint256` semantics (wraparound vs. revert) was not independently verified by execution; this is flagged as a reachable-input-bounds question for the fix, not a confirmed exploit.

---

#### [M-07] Shared aggregated price/volume box is not filtered by pool quality or verification class — oracle-pollution risk for `getPrice(...,0)`

**Severity**: Medium
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecPoolProvider.algo.ts:156-157` (`poolsAggregated = BoxMap<AssetsCombined, AppPoolInfo>`), `:507-619` (`registerPool` seeds the aggregate only if absent), `:837-1041` (`updatePriceBoxAggregated`, invoked by every pool sharing the same asset pair via `registerTrade`), `:1156-1172` (`getPrice(assetA, assetB, 0)`, public readonly, returns the shared aggregate)

**Invariant**: A price feed offered for external/oracle consumption should reflect trustworthy, sufficiently liquid trading activity, or should clearly disclaim that it does not.

**Evidence**: `deployPool` is fully permissionless for any asset pair at any `verificationClass` down to `0` ("no kyc", `BiatecPoolProvider.algo.ts:374`). The aggregated box is keyed purely by `(assetA, assetB)`, so every pool ever deployed for a given pair — regardless of liquidity depth or verification class — writes into the same shared entry on every trade. `getPrice(assetA, assetB, 0)` returns this box directly with no per-contributor attribution, and its stored `verificationClass` field reflects only whichever pool first created the pair's aggregate entry, not later contributors.

**Prerequisites and Impact**: Requires only a normal, permissionless `deployPool` call for an already-popular asset pair, then self-trading (wash trading) within the new, low-liquidity pool. Impact is specific to any external integrator that treats `getPrice(...,0)` as a canonical price oracle for that pair without independently verifying liquidity depth — such an integrator's price feed could be skewed by a thin, attacker-controlled pool. This is a design-level oracle-manipulation risk rather than a defect in the arithmetic itself; severity depends on whether any consumer actually relies on this aggregate as a trusted oracle, which this review cannot determine from the repository alone, hence Medium rather than High.

**Recommendation**: Either segment the aggregate by verification class (or minimum liquidity threshold) in addition to asset pair, or explicitly document — in-code and in any oracle-facing integration guide — that `getPrice(...,0)` is not manipulation-resistant and must not be used as a sole price source without an independent liquidity/verification-class check by the consumer (the README's own existing warning, "Never use single pool VWAP as sole price source," is a good start but does not cover the *aggregated* box specifically).

**Defensive Acceptance Criteria**: If segmentation is implemented, a test confirming a low-`verificationClass` pool's trades do not affect a `getPrice` query scoped to a higher verification class.

**Limitations**: No external protocol's actual reliance on this specific `getPrice(...,0)` call path was confirmed; this is reported as a design-level risk per the checklist's "Price Oracle Manipulation" item.

---

#### [M-08] `deployPool` wires only two of the three-to-four approval-program box slots that `loadCLAMMContractData` accepts, with ~1% size headroom remaining before this silently matters

**Severity**: Medium
**Status**: Open
**Confidence**: Static evidence, including a direct read of the current compiled artifact size
**Location**: `contracts/BiatecPoolProvider.algo.ts:212-218` (`clammApprovalProgram1/2/3` box declarations; `clammApprovalProgram4` commented out), `:308-334` (`loadCLAMMContractData`, which writes into `clammApprovalProgram3` for program sizes 8192–12288 bytes, with a dead/commented `else` branch for ≥12288 that would silently drop data), `:379-386` (`deployPool`'s inner app-create call, which supplies only `clammApprovalProgram1` + `clammApprovalProgram2`, i.e. a maximum of 8192 bytes)

**Invariant**: The approval-program bytecode accepted and stored by the admin-only loader (`loadCLAMMContractData`) should be the exact bytecode actually deployed by `deployPool`.

**Evidence**: `loadCLAMMContractData` accepts and stores program bytes across up to three boxes (supporting up to 12,288 bytes total) with no error for the currently-dead ≥12,288-byte case. `deployPool`'s inner application-create transaction, however, only references `clammApprovalProgram1` and `clammApprovalProgram2` (max 8,192 bytes) — `clammApprovalProgram3` is declared and loadable but never actually used at deployment time. This audit independently read `contracts/artifacts/BiatecClammPool.arc56.json`'s `byteCode.approval` field at this commit: the compiled program is **8,093 bytes**, i.e. 99 bytes (about 1.2%) below the 8,192-byte point at which box 3 would become load-bearing and yet still be silently excluded from `deployPool`.

**Prerequisites and Impact**: Requires the `addressUdpater`-gated `loadCLAMMContractData` to be called with a future, larger compiled `BiatecClammPool` program (e.g. after a legitimate feature addition), with no built-in warning that the loaded program exceeds what `deployPool` will actually use. If that happens, either every subsequent `deployPool` call fails (bytecode too short/invalid — a deployment-wide DoS, fail-safe) or, in a worse case if the truncated bytecode happens to still assemble validly, pools could be deployed running logic that differs from what was loaded and audited. Given only ~1% headroom remains at this commit, this is a near-term operational risk for the project's own upgrade process, not a currently-exploitable defect.

**Recommendation**: Either wire `clammApprovalProgram3` (and `4`, if genuinely needed) into `deployPool`'s `approvalProgram` array, or add an explicit size assertion in `loadCLAMMContractData` rejecting any program larger than 8,192 bytes (what `deployPool` actually supports today), so a mismatch is caught at load time rather than discovered at the next deployment attempt.

**Defensive Acceptance Criteria**: A test asserting that loading a program between 8,193 and 12,288 bytes either (a) is correctly used by a subsequent `deployPool` call end-to-end, or (b) is rejected by `loadCLAMMContractData` with a clear error — whichever remediation direction is chosen.

**Limitations**: This is a latent-risk finding based on current compiled size versus code paths; it does not describe an issue reachable at the exact reviewed commit without an admin action (loading an oversized program) that has not occurred.

---

### Low Severity Issues

#### [L-01] `TODO` comment left in shipped math helper questioning its own correctness

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecClammPool.algo.ts:1643`

```ts
const P2 = (((priceMaxSqrt /* 10D */ * inAmount) /* AD */ / s) * assetBBalance) /* BD */ / s; // << TODO CHECK B Decimals not applied?
```

**Description**: The developers' own inline comment flags uncertainty about whether asset-B decimal scaling is correctly applied in this intermediate term of `calculateAssetBWithdrawOnAssetADeposit`. Tracing the surrounding algebra (the `b*d*y` term of the quadratic-formula derivation documented in the comments above the function), `assetBBalance` is already carried in base-scale (9-decimal) units by the caller's contract-level invariant (all `*BalanceBaseScale` state is base-scale), so no separate "asset B decimals" conversion is needed at this point — the comment appears to be a stale developer note rather than an active defect, and the project's own extensive `calculations.test.ts` / `extreme.test.ts` / mainnet-replay tests exercise this function without failure. However, an unresolved `TODO` questioning correctness in the exact function that determines how much of a user's counter-asset a swap releases warrants explicit closure.

**Recommendation**: Either remove the comment once the derivation is confirmed correct (as this audit's static trace suggests), or add a short derivation note confirming why no extra scaling is needed at that line, so a future reader does not have to re-derive it from scratch.

---

#### [L-02] Broad admin `doAppCall` proxy power, bounded only by post-hoc solvency check

**Severity**: Low (authorized governance power with an existing compensating control, not an authorization defect)
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecClammPool.algo.ts:1358-1411`

**Description**: `doAppCall`, gated by `addressExecutiveFee` and (per M-03 above) the pause flag, allows the caller to make the pool's account issue an arbitrary inner payment plus an arbitrary inner application call to any `applicationID` with 1 or 2 raw ABI argument bytes, "mainly created for the xgov calls" per its doc comment. After the call, `ensurePoolBalancesWithinHoldings` is checked, which prevents the pool from ending up under-collateralized relative to its recorded `assetABalanceBaseScale`/`assetBBalanceBaseScale` liabilities — so this cannot be used to make the pool insolvent relative to LP claims. It can, however, move any *excess* (unrecorded) balance the pool happens to hold to an arbitrary destination via the leading payment and whatever the called app does with received value.

**Recommendation**: This is consistent with the contract's stated design (governance flexibility for e.g. xGov participation) and is already constrained by the solvency check; no code change is strictly required. Consider documenting explicitly, next to the method, that the post-hoc `ensurePoolBalancesWithinHoldings` check is the deliberate safety boundary for this method, so a future maintainer does not accidentally weaken or remove it while treating the method as "just a governance passthrough."

---

#### [L-03] `setInfo` access-control assert has no descriptive error message

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecIdentityProvider.algo.ts:291`

**Description**: `assert(this.txn.sender === this.engagementSetter.value);` lacks an error-message string, unlike the equivalent check one line later (`:293`, `'Verification class out of bounds'`) and every other access-control assert in both `BiatecConfigProvider.algo.ts` and the rest of `BiatecIdentityProvider.algo.ts`. Purely a debuggability/integrator-experience issue — a failed call here surfaces a bare `assert failed` with no indication of which check failed.

**Recommendation**: Add a message, e.g. `'Only engagementSetter can call setInfo'`, consistent with the rest of the codebase's style.

---

#### [L-04] Documentation gap: README links to five `docs/` files that do not exist in this repository

See "Documentation Gaps" section below for full detail (cross-listed here as it also functions as a Low-severity code/repo-quality finding: a fresh clone following the README's own links will hit five broken links, including the two explicitly under a "Security" heading — `docs/liquidity-fee-protection.md` and `docs/liquidity-rounding.md`, and the link `docs/integration-guide.md#security-considerations` referenced directly under README's "Security Considerations" section).

**Location**: `README.md:173, 195-204, 222`

---

#### [L-05] `selfRegistration` is public and unauthenticated, creating unbounded box growth funded by the app's own reserve

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence; not independently load-tested
**Location**: `contracts/BiatecIdentityProvider.algo.ts:247-283`

**Description**: Any address can call `selfRegistration` for itself (guarded only by "not already registered for this address," `:248`) with a fixed, harmless default payload (`verificationClass = 0`, `feeMultiplier = 2 * SCALE`, i.e. identical to the unregistered default returned by `getUser`/`getUserShort`). Each call creates one new box in the `identities` `BoxMap`, whose minimum-balance requirement is paid from the identity-provider contract's own account balance (TEALScript `BoxMap` semantics), not from the caller. This method does not itself accept a funding payment transaction. Since every box requires a distinct sender address, an attacker would need to fund and sign from many distinct accounts to meaningfully grow box count — this is not a cheap single-account griefing vector, and per AVM semantics, if the contract's own balance is ever insufficient to cover the next box's MBR, that specific `selfRegistration` call is **rejected** (the transaction fails and no state is corrupted), not silently accepted into an insolvent state.

**Recommendation**: If unbounded public box creation against the contract's own reserve is not intended, consider requiring an accompanying MBR-covering payment transaction as part of `selfRegistration` (mirroring how `BiatecClammPool.bootstrap` requires a `txSeed` payment), so the cost of box growth is borne by whoever triggers it rather than by the identity-provider contract's own operating balance.

**Defensive Acceptance Criteria**: If a funding-payment requirement is added, a test should confirm `selfRegistration` reverts when not accompanied by a sufficient payment transaction, and succeeds when it is.

**Limitations**: The realistic cost/attractiveness of this as a griefing vector (given it requires many distinct funded accounts, each of which could just as easily be used to grief in cheaper ways elsewhere on Algorand) was not quantified; this is reported for completeness per the Box Storage checklist item, not because a practical attack path was demonstrated.

---

#### [L-06a] `currentPrice` state is updated only after the cross-app `registerTrade` inner call in `swap()`

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecClammPool.algo.ts:1126-1155`

**Description**: All balance/liquidity state (`assetABalanceBaseScale`, `assetBBalanceBaseScale`, `Liquidity`, `LiquidityUsersFromFees`, `LiquidityBiatecFromFees`) is committed before the inner `sendMethodCall` to `appBiatecPoolProvider.registerTrade` (lines 1137-1153), but `this.currentPrice.value` is assigned only afterward (line 1155), meaning `currentPrice` specifically is stale (pre-swap) during that external call. `appBiatecPoolProvider` is a governance-configured, trusted app (not user-controlled), so this is not currently exploitable, but it is a Checks-Effects-Interactions ordering inconsistency worth closing as defense in depth, especially since every other piece of relevant state is already updated first.

**Recommendation**: Move the `this.currentPrice.value = newPrice` assignment to before the `sendMethodCall`, consistent with the rest of the function's state-then-external-call ordering.

---

#### [L-06b] Dead/commented-out post-swap solvency assertions in `swap()`

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecClammPool.algo.ts:1156-1176`

**Description**: A large commented-out block shows `swap()` previously verified, post-trade, that real on-chain holdings were ≥ the tracked virtual balances, and that the output was non-trivial (`ERR-BALANCE-CHECK-1/2/3`, `ERR-ZERO-DEPOSIT`). These checks are absent today, while the structurally similar `ensurePoolBalancesWithinHoldings` check **is** still invoked in `distributeExcessAssets`, `withdrawExcessAssets`, and `doAppCall` — but never in `swap()` itself. Since `swap()`'s bookkeeping adjusts tracked balances by the exact amount transferred via `doAxfer`, the check is likely redundant by construction today, and the existing `assert(amountAForStatsInAssetDecimals > 0 && amountBForStatsInAssetDecimals > 0, ...)` (line 1133) already replaces the old zero-output guard. Flagged because commented-out safety checks are a recognized audit red flag warranting explicit sign-off rather than silent removal.

**Recommendation**: Either delete the dead code (reduces confusion for future readers, no runtime value if genuinely redundant) or, if any future change to fee handling could cause the virtual/real balances to drift, restore an equivalent check explicitly.

---

#### [L-06c] `distributeExcessAssets`'s "distribute all" sentinel (`amount == 1`) produces an unintended result when used for both sides of a same-asset (staking) pool in one call

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecClammPool.algo.ts:1211-1238`

**Description**: For a same-asset (staking) pool, if the caller passes `amountA === 1` and `amountB === 1` in the same call (both meaning "distribute all available balance"), the B-branch's correction `distributedAmountB = distributedAmountB - distributedAmountA` uses the **already-reassigned** `distributedAmountA` from the A-branch, algebraically collapsing to `distributedAmountB = total - (total - oldB) = oldB` — i.e. side B's tracked balance is left unchanged and side A silently absorbs 100% of the "excess." This is restricted to the trusted `addressExecutiveFee` role (no external attacker path) and is likely not the caller's intent if they expected both sides to be independently auto-computed, so it is a logic footgun rather than a vulnerability.

**Recommendation**: Either assert that at most one of `amountA`/`amountB` may be the sentinel value `1` when `assetA.id === assetB.id`, or fix the formula so both resolve independently and correctly, or explicitly document the resulting behavior if it is actually intended.

---

#### [L-06d] `calculateLiquidityWithD`'s fallback (underflow-prone) branch is only guarded by an invariant that could be marginally violated by rounding at very tight price ranges

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecClammPool.algo.ts:1560-1569`

**Description**: `L3 = 2 * priceMinSqrt * s / priceMaxSqrt` should always be `≤ 2*s` given the pool invariant `priceMinSqrt ≤ priceMaxSqrt`, which is what keeps execution in the primary branch (`:1560-1565`). Integer-division rounding when `priceMinSqrt` is extremely close to `priceMaxSqrt` (a very tight configured price range) could in principle tip `L3` marginally above `2*s`, diverting execution into the `else` branch (`:1566-1569`); if `dSqrt > L1 + L2` there, the `uint256` subtraction underflows, which TEALScript/AVM checked arithmetic reverts rather than wraps — i.e. worst case is a failed transaction/readonly call (DoS for pools with an extremely tight range), not a fund-loss or silently-wrong-result outcome.

**Recommendation**: Add an explicit guard/assert reaffirming `priceMinSqrt <= priceMaxSqrt` at the point of use (if not already fully guaranteed by construction elsewhere), and/or handle the near-equal-price-bound rounding case explicitly rather than relying on the branch being unreachable by algebraic argument alone.

---

#### [L-07] `registerPool` does not check the platform-wide pause flag

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence
**Location**: `contracts/BiatecPoolProvider.algo.ts:459-620` (`registerPool`)

**Description**: Unlike most other mutating methods in this file (`bootstrap`, `updateApplication`, `setNativeTokenName`, `loadCLAMMContractData`, `sendOnlineKeyRegistration`, `withdrawExcessAssets`, all of which re-check `paused` from the config app), `registerPool` never references `appBiatecConfigProvider` or the pause flag at all — it relies solely on `globals.callerApplicationID` and the `recentPoolsN` ring membership check. If the platform is paused after a pool's `bootstrap()` succeeds (which does check pause) but before `registerPool` runs, registration still completes, which is inconsistent with pause apparently being intended to halt new onboarding. This is part of the same broader pause-matrix inconsistency documented in M-03.

**Recommendation**: Add a pause check in `registerPool`, reading the config app via the caller pool's own stored `appBiatecConfigProvider` global state (the same cross-app global-state read pattern already used elsewhere in this method for other fields).

---

#### [L-08] No client-side input validation before transaction construction in `txs/*.ts` builders

**Severity**: Low
**Status**: Open
**Confidence**: Static evidence
**Location**: `src/biatecClamm/txs/*.ts` (e.g. `clammSwapTxs.ts`, `clammDistributeExcessAssetsTxs.ts`, `clammWithdrawExcessAssetsTxs.ts`, `clammRemoveLiquidityAdminTxs.ts`)

**Description**: None of the transaction builders validate `bigint` inputs (amounts ≥ 0, asset IDs ≥ 0, `assetA !== assetB` where the pool semantics require it) before constructing the ABI call. Since the on-chain contract is the ultimate authority and negative/malformed `bigint` values fail at algosdk's ABI-encoding layer before ever reaching the network (no case was found where a malformed input could produce a *silently wrong* on-chain outcome), this is not a fund-safety issue, but integrators receive a generic algosdk encoding error rather than an actionable SDK-level message.

**Recommendation**: Add lightweight guard clauses (amount ≥ 0n, asset IDs ≥ 0n, and in particular require `minimumToReceive > 0n` be a conscious choice surfaced to the integrator, since `0` disables slippage protection on-chain — see positive note in Documentation Gaps re: README's own warning about this) with clear error messages before constructing transactions.

---

### Informational Issues

#### [I-01] `governor` global state in `BiatecIdentityProvider` is set but never read within the file

**Location**: `contracts/BiatecIdentityProvider.algo.ts:187, 225`. Possibly consumed only by external readers of this contract's global state (key `'g'`); worth confirming intended consumers actually exist, otherwise it is dead state.

#### [I-02] Positive: authority-rotation and one-shot bootstrap logic in `BiatecIdentityProvider.bootstrap` is correctly implemented

**Location**: `contracts/BiatecIdentityProvider.algo.ts:214-231`. The re-bootstrap branch correctly sources the authorizing `addressUdpater` from the *currently stored* config app rather than from the caller-supplied new `appBiatecConfigProvider` parameter, preventing a takeover via a spoofed config app claiming self-authorization. This matches the code comment's citation of "Audit 2026-09-07 M-02" and was independently confirmed correct by this review, not merely taken on faith from the comment.

#### [I-03] Positive: cross-contract config-spoofing protection is consistently applied

**Location**: Throughout all four contracts, every observed cross-app global-state read (e.g. `appBiatecConfigProvider.globalState('u'/'ef'/'s'/'p'/'f'/'i')`) is preceded by an assertion that the caller-supplied `AppID` parameter equals the contract's own recorded reference to that app, before any value is read from it. No bypass of this pattern was found in any of the four contracts.

#### [I-04] Positive: box storage usage in `BiatecIdentityProvider` is safe

**Location**: `contracts/BiatecIdentityProvider.algo.ts:185`. Uses TEALScript's `BoxMap<Address, IdentityInfo>` abstraction with existence properly checked via `.exists` before every read/write path observed. No manual box-name concatenation or collision risk identified in this file.

#### [I-05] `isLocked` enforcement is entirely external to `BiatecIdentityProvider`

**Location**: `contracts/BiatecIdentityProvider.algo.ts` (state definition) vs. `contracts/BiatecClammPool.algo.ts:926-929` (the actual enforcement point). Noted for completeness: the lock flag itself does nothing within the identity contract; all protective effect depends on every consumer (currently only `BiatecClammPool.verifyIdentity`) correctly checking it, which this review confirmed it does.

#### [I-06] No confirmation-wait after transaction submission in most SDK senders

**Location**: `src/common/sendRawTransactionWithErrorDecoding.ts:12-19` and most callers (e.g. `clammAddLiquiditySender.ts:52`, `clammSwapSender.ts:36`). Only `clammCreateSender.ts` waits for confirmation (needed to parse the created pool's app ID from logs). Errors from outright rejection are still surfaced (not swallowed) via `exposeLogicError`, but callers otherwise only receive a `txid` with no guarantee of eventual block inclusion. Recommend documenting this clearly or offering an optional wait-for-confirmation flag.

#### [I-07] Unused Node-only logging utility in `src/common/getLogger.ts`

**Location**: `src/common/getLogger.ts`. Not imported anywhere under `src/` at the time of this review; uses Node-only `fs`-based `winston-daily-rotate-file` transports that would not work if ever imported into a browser bundle. Recommend removing if genuinely unused, or documenting it as Node-only tooling.

#### [I-08] Unlabeled placeholder box-reference names in pool-creation transaction builder

**Location**: `src/biatecClamm/txs/clammCreateTxs.ts:47-52, 72-83` (literal box names like `'capb1'`/`'13'`/`'21'` etc.). These do not follow the self-describing prefix convention used elsewhere (`getBoxReferenceFullConfig.ts`, `getBoxReferencePool.ts`, etc.) and carry no comment explaining their purpose (they appear to be opcode/box-budget padding references). Recommend documenting why they are referenced, to keep the client in sync with any future on-chain box-layout change.

#### [I-09] Positive: slippage/minimum-output parameter is mandatory and correctly threaded in the swap builder

**Location**: `src/biatecClamm/txs/clammSwapTxs.ts`. `minimumToReceive` is a required field passed through as an explicit ABI argument; there is no code path that silently builds a swap with unlimited-slippage semantics without the caller having to explicitly choose the value (including `0`, which the contract treats as "no restriction" per `BiatecClammPool.algo.ts:1037-1039` — this makes `0` a meaningful, deliberate choice by the caller, not an SDK default).

#### [I-10] No hardcoded secrets found

**Location**: Reviewed `src/biatecClamm/`, `src/common/`, `src/boxes/`, `src/biatecConfig/`, `src/biatecIdentity/`, `src/biatecPools/`, and spot-checked `src/bin/*.ts`. All mnemonics are sourced from `process.env.signer1..5`; no hardcoded keys/mnemonics found.

#### [I-11] `NATIVE_RESERVE_MICROALGO` is a deliberately fixed constant, not a dynamic `minBalance` read — design rationale is well-documented in-code

**Location**: `contracts/BiatecClammPool.algo.ts:24-35`. Flagged as Informational only to record that this review read and agrees with the stated rationale (a fixed constant is more conservative than tracking the account's true, growth-dependent minimum balance) — no issue found.

#### [I-12] `assetADecimals`/`assetBDecimals` bound only rejects >9 decimals, silently defaults unregistered-native-asset case to 6

**Location**: `contracts/BiatecClammPool.algo.ts:237-242, 288-291`. `bootstrap` asserts `assetA.decimals <= SCALE_DECIMALS` (9) only when `assetA.id > 0`; for the native asset (`id === 0`) decimals are hardcoded to 6 without an assertion, which is correct for ALGO (6 decimals) but relies on that assumption holding for every chain this contract might ever be deployed to (the same genesis-hash-driven multi-chain design seen for `nativeTokenName`). Not an issue for Algorand, Voi, or Aramid (all reportedly 6-decimal native units), but worth a defensive comment if a lower/higher-decimal native chain is ever targeted.

#### [I-13] `calculateDistributedLiquidity` and related `@abi.readonly` helper methods are correctly marked read-only

**Location**: `contracts/BiatecClammPool.algo.ts` (multiple, e.g. `:1417`, `:1428`, `:1459`, `:1516`, `:1584`, `:1612`, `:1670`, `:1724`, `:1746`, `:1767`). All pure math/query helper methods reviewed are correctly annotated `@abi.readonly`, consistent with them performing no state mutation — spot-checked and confirmed no state-mutating assignment exists in any of these methods.

#### [I-14] `updateApplication` version-tracking pattern is consistent across all four contracts

**Location**: `BiatecClammPool.algo.ts:167-174`, `BiatecConfigProvider.algo.ts:72-77`, `BiatecIdentityProvider.algo.ts:236-245`, and (per the pool-provider sub-review) `BiatecPoolProvider.algo.ts`. Each correctly logs both the old (constant) and new (caller-supplied) version strings and requires the correct `addressUdpater` role, consistent with the "M-01 to M-04" fix documented in `AUDIT_FIXES_SUMMARY.md` (noted here only as an independently-confirmed current-state observation, not as reliance on that document's claims).

#### [I-15] Positive: `registerPool`'s anti-spoofing authentication is sound; `FakePool.algo.ts` exists specifically to test it

**Location**: `contracts/BiatecPoolProvider.algo.ts:459-507`; `contracts/FakePool.algo.ts` (confirmed by direct read to be a 15-line test-only contract whose sole purpose is to call `registerPool` without having gone through the canonical `deployPool` flow, i.e. a deliberate malicious-registration simulator). `registerTrade`'s authorization (`assert(appPoolId === globals.callerApplicationID)`) and `updatePriceBoxInfo`'s re-validation of `assetA`/`assetB` against the pool's own registered config were also confirmed correct. H-01 above concerns this control's *availability* (griefing via ring eviction), not a defeat of its authentication logic — an arbitrary/malicious app still cannot register itself.

#### [I-16] `deployPool`'s `appBiatecPoolProvider` parameter is unchecked locally but safely defended by the callee

**Location**: `contracts/BiatecPoolProvider.algo.ts:360-425` (no local assertion that the caller-supplied `appBiatecPoolProvider` equals `globals.currentApplicationID`); defended by `contracts/BiatecClammPool.algo.ts:217` (`assert(globals.callerApplicationID == appBiatecPoolProvider, ...)`) and `:246-250` (cross-check against the config app's stored pool-provider reference). A spoofed value would simply cause the whole `deployPool` group to revert in the callee; no practical impact. Adding a local defensive assertion in `deployPool` itself would make the invariant self-evident and fail faster, but is not required for correctness.

#### [I-17] Box-naming collision risk in `BiatecPoolProvider` reviewed and found sound

**Location**: `contracts/BiatecPoolProvider.algo.ts` — box prefixes `p` (pools), `pc` (poolsByConfig), `fc` (fullConfigs), `s` (poolsAggregated), and the fixed `capb1`–`capb4` approval-program-page keys are structurally distinct in both prefix and encoded key length; no realistic collision path was identified.

---

## Missing Test Scenarios

### Identified Gaps in Test Coverage

1. **Test Scenario**: `deployPool` → `registerPool` ring-buffer eviction race (see H-01)

   - **Risk Level**: High
   - **Current Coverage**: None found — no test exercises calling `deployPool` more than 10 times between a target pool's deployment and its `bootstrapStep2`/`registerPool` call to confirm/deny the eviction behavior described in H-01.
   - **Recommendation**: Add a test that deploys a target pool, then issues 10 additional unrelated `deployPool` calls, then attempts `bootstrapStep2` on the target and asserts the actual (pre-fix) failure mode, followed by a corresponding positive test once a fix (atomic registration or an unbounded pending-registration record) lands.

2. **Test Scenario**: Pause-matrix enforcement for every mutating method across all four contracts (see M-03)

   - **Risk Level**: Medium
   - **Current Coverage**: Partial — some methods (e.g. `BiatecClammPool.removeLiquidityAdmin`, `distributeExcessAssets`) are implicitly covered by tests that happen to check `E_PAUSED`, but there is no systematic per-method matrix test, and the gaps identified in M-03 (`sendOnlineKeyRegistration` in `BiatecClammPool`, `selfRegistration`/`setInfo` in `BiatecIdentityProvider`, all of `BiatecConfigProvider`'s own admin methods) have no test asserting either behavior.
   - **Recommendation**: Add a parameterized test suite that, for each mutating method in each contract, asserts the documented pause behavior (revert or deliberate pass-through) once the pause matrix from M-03 is formally defined.

3. **Test Scenario**: `setInfo` boundary/range validation (see M-06)

   - **Risk Level**: Medium
   - **Current Coverage**: None found for out-of-range `feeMultiplier`, `verificationStatus`, or engagement-rank values passed to `setInfo`.
   - **Recommendation**: Add tests asserting `setInfo` reverts for values outside the documented ranges once bounds are added to the contract.

4. **Test Scenario**: `verificationSetter`-gated method (see M-02)

   - **Risk Level**: Medium
   - **Current Coverage**: N/A — no such method currently exists to test.
   - **Recommendation**: If `setInfo` is split per the M-02 recommendation, add access-control tests for each new method confirming role separation.

5. **Test Scenario**: Identity-expiry enforcement (see M-01)

   - **Risk Level**: Medium (policy-dependent)
   - **Current Coverage**: Explicitly covered as a "current behavior" pin (`audit-2026-09-07-m03-identity-policy.test.ts`), i.e. the *absence* of enforcement is tested, but no test exists for the *enforced* behavior since it is not implemented. Once/if a policy decision is made, add the corresponding positive/negative enforcement tests.

6. **Test Scenario**: `clammAddLiquiditySender` opt-in-skip behavior (see M-05)

   - **Risk Level**: Low (SDK correctness, not contract security)
   - **Current Coverage**: None found — no test asserts the transaction group differs for an already-opted-in vs. not-yet-opted-in sender.
   - **Recommendation**: Add an SDK-level test asserting the extra opt-in transaction is included only when actually needed.

7. **Test Scenario**: `withdrawExcessAssets` (ConfigProvider/IdentityProvider) draining below a "true excess" threshold (see M-04)

   - **Risk Level**: Low
   - **Current Coverage**: Not found in the reviewed test files (these two contracts' `withdrawExcessAssets` methods were not observed to have dedicated tests, unlike `BiatecClammPool`'s equivalent, which is exercised in `balance-guards.test.ts`/`misc.test.ts`).
   - **Recommendation**: Add basic access-control tests for these two methods if not already present elsewhere in the suite (a full-suite run confirmed all existing tests pass, but this review did not exhaustively map every test to every method).

8. **Test Scenario**: Multi-user concurrent operations / interleaved swap-and-liquidity-change races

   - **Risk Level**: Low–Medium
   - **Current Coverage**: The existing suite is thorough on sequential scenarios (including extreme values, overpay, staking, mainnet replay) but concurrent/interleaved multi-account scenarios within a single atomic group boundary were not observed as a distinct test category.
   - **Recommendation**: Add scenarios exercising two independent LPs depositing/withdrawing around a swap to further corroborate the pro-rata fee-entitlement math under realistic multi-party conditions (largely already implied correct by the project's own `audit-2026-09-07-h01-lp-entitlement.test.ts`, but not with more than one concurrent LP observed in the reviewed subset).

---

## Documentation Gaps

### Missing or Incomplete Documentation

1. **Area**: `docs/` folder is missing five files that `README.md` actively links to

   - **Issue**: `README.md` links to `docs/basic-use-cases.md` (`:195`), `docs/staking-pools.md` (`:173, 196`), `docs/integration-guide.md` (`:197, 209, 214`), `docs/liquidity-fee-protection.md` (`:202`), `docs/liquidity-rounding.md` (`:203, 225`), and `docs/error-codes.md` (`:204, 213`). Direct inspection of the `docs/` directory at this commit shows it contains **only** `docs/publishing.md`. All six other links are broken.
   - **Risk**: Two of the six missing files are linked directly under README's own "Security" heading (`docs/liquidity-fee-protection.md`, `docs/liquidity-rounding.md`) and one under "Security Considerations" (`docs/integration-guide.md#security-considerations`), which the README itself describes as containing "Critical warnings for developers." A new integrator following the README today cannot reach this promised security guidance at all.
   - **Recommendation**: Either restore/author the six missing files, or remove the dead links from `README.md` until the content exists, to avoid an integrator believing security guidance exists and was simply not found, when in fact it was never published to this location.
   - **Location**: `README.md:173, 195-204, 209, 213-214, 222, 225`; confirmed via `docs/` directory listing at commit `0c61109`.
   - **Priority**: High (broken security-documentation links are a user-safety issue, even though this is a documentation rather than code finding).

2. **Area**: Pause-matrix / emergency-response behavior (relates to M-03)

   - **Issue**: `BiatecConfigProvider.algo.ts:38`'s doc comment states the kill switch suspends "all services (deposit, trading, withdrawal, identity modifications and more)," but this is not accurate for every mutating method across the four contracts (see M-03).
   - **Risk**: An operator relying on the doc comment during an incident could incorrectly believe all four contracts' admin surfaces are frozen once `suspended = 1`.
   - **Recommendation**: Update the doc comment to accurately scope what is/isn't covered, or close the gaps identified in M-03.
   - **Location**: `contracts/BiatecConfigProvider.algo.ts:38`.
   - **Priority**: Medium.

3. **Area**: Identity expiry semantics (relates to M-01)

   - **Issue**: `kycExpiration`/`investorForExpiration` are documented as "unix time... when kyc form expires" without stating that this is currently informational-only and not enforced on-chain.
   - **Risk**: A reader of the doc comment alone (without also finding the M-03 test) could assume expiry is automatically enforced.
   - **Recommendation**: Add an explicit note next to the field definitions in `BiatecIdentityProvider.algo.ts:136-140` stating current enforcement status.
   - **Location**: `contracts/BiatecIdentityProvider.algo.ts:136-140`.
   - **Priority**: Medium.

4. **Area**: `doAppCall`'s safety boundary is not documented at the call site (relates to L-02)

   - **Issue**: The method's doc comment explains its purpose ("mainly created for the xgov calls") but does not state that `ensurePoolBalancesWithinHoldings` is the deliberate safety boundary preventing insolvency.
   - **Risk**: A future maintainer could weaken/remove the post-call check without realizing it is load-bearing for this method's safety.
   - **Recommendation**: Add an inline comment at `BiatecClammPool.algo.ts:1409-1410` explaining why the check is there.
   - **Location**: `contracts/BiatecClammPool.algo.ts:1353-1411`.
   - **Priority**: Low.

---

## Security Best Practices

### Current Implementation vs. Best Practices

| Practice                   | Status | Notes |
| --------------------------- | ------ | ----- |
| Input validation            | ⚠️     | On-chain contract-level validation is generally thorough (e.g. price/fee bounds, asset-ID matching, verification-class bounds in `setInfo`'s `verificationClass` check), but see M-06 (unbounded fields in `setInfo`) and L-08 (no client-side pre-validation). |
| Access control               | ✅     | Every privileged mutating method reviewed is gated by an on-chain role check sourced from validated config state; no bypass found. M-02 notes an *unused* role rather than a broken one. |
| Reentrancy protection        | ✅     | Algorand's atomic-group/inner-transaction model and this codebase's pattern of updating state before/around `sendMethodCall`/`sendAssetTransfer` calls, combined with the AVM's lack of external callback reentrancy (unlike EVM), was not found to admit a reentrancy path in the reviewed code. |
| Integer overflow/underflow   | ⚠️     | Extensive use of `uint256` intermediate math with careful base-scale conversions; `setCurrentLiquidityNonDecreasing`'s bounded-drop allowance and the LP-entitlement quadratic-share formula (both documented in-code with the rationale for prior fixes) appear sound under static review, but see M-06 for one unverified theoretical underflow path gated behind a role compromise. |
| Error handling                | ✅     | Nearly every `assert` carries a descriptive error string (see L-03 for the one exception found); the SDK's `sendRawTransactionWithErrorDecoding` correctly surfaces logic errors via `exposeLogicError` rather than swallowing them. |
| Gas optimization (opcode budget) | ✅  | `increaseOpcodeBudget()` calls are present at the entry of the heavier math-driving methods (`addLiquidity`, `removeLiquidity`, `swap`, `distributeExcessAssets`, `removeLiquidityAdmin`); the full test suite's successful execution of extreme-value scenarios is consistent with adequate budgeting. |
| Event logging / observability | ✅  | `log(version)` calls on create/update, and `registerTrade`/`registerPool` cross-app calls to `BiatecPoolProvider` that appear designed to build an off-chain-indexable event trail. |
| Code documentation            | ✅  | Contract code is unusually well-commented, including explicit references to prior audit findings and their fixes, and algebraic derivations for the AMM math — a notable strength. |
| Test coverage                 | ✅  | 28 suites / 131 tests, all passing at this commit, spanning normal, extreme, overpay, staking, mainnet-replay, and prior-audit-regression scenarios. See Missing Test Scenarios for specific gaps. |

Legend: ✅ Implemented | ⚠️ Partially Implemented | ❌ Not Implemented

---

## Risk Assessment

### Overall Risk Rating

**Risk Level**: Medium

The presence of one High severity finding (H-01: permanent, low-cost, permissionless swap-functionality denial-of-service against a newly deployed pool via `recentPoolsN` ring eviction) is the primary driver of an overall Medium rather than Low rating; it does not, on its own evidence, enable fund theft or LP-supply manipulation, but it is a realistic, cheaply-triggerable, and currently-unmitigated path to permanently disabling a specific pool's core trading function. The remaining Medium-severity findings are concentrated in policy/documentation completeness (identity expiry enforcement, pause-matrix consistency, an unused separation-of-duties role, oracle-aggregate segmentation, an approval-program size/wiring mismatch with shrinking headroom) and one real SDK functional bug (redundant opt-in transaction), rather than in exploitable fund-loss paths. The codebase overall shows a mature, iterative security posture (extensive in-code audit-trail comments, a dedicated regression-test suite pinning prior fixes), and H-01 is a gap in a specific, narrow flow (pool onboarding) rather than a systemic weakness.

### Risk Breakdown

| Category                | Risk Level | Description |
| ------------------------ | ---------- | ------------ |
| Smart Contract Security  | Medium     | No fund-drain or LP-inflation path identified, and core AMM/fee-accounting invariants match their documented derivation and are covered by regression tests; however H-01 is a realistic, low-cost path to a permanent denial of a specific pool's swap functionality. |
| Economic Model           | Low        | Fee split, rounding-in-favor-of-pool, and liquidity non-decrease logic were traced and match documented invariants; `overpay.test.ts` confirms overpay profit accrues to LPs by design, not to an attacker. M-07 (oracle-aggregate pollution) is a secondary economic-model risk contingent on external reliance on `getPrice(...,0)`. |
| Access Control            | Low–Medium | All checks found were correctly implemented where present; M-02/M-03/M-04/L-07 identify gaps in *completeness*/*consistency* of the control surface rather than bypasses of existing controls. `registerPool`'s own anti-spoofing authentication (distinct from its H-01 availability gap) was confirmed sound. |
| Data Integrity             | Medium     | M-01 (unenforced expiry) and M-06 (unbounded `setInfo` fields) mean some identity state can drift outside its documented semantic range without on-chain prevention; M-08 (approval-program wiring/size mismatch) is a data-integrity risk for the deployment pipeline specifically. |
| User Safety                 | Medium     | L-04's broken security-documentation links directly undermine the README's own stated user-safety mechanism ("Review the security considerations before mainnet deployment"); H-01 is a user-safety risk specifically for newly-deployed pools during their onboarding window. |

### Potential Attack Vectors

1. **Attack Vector**: Permissionless `recentPoolsN` ring-buffer eviction to permanently block a target pool's registration and swap capability (H-01)

   - **Likelihood**: Medium (requires ~54.5 Algo and 10 sequential `deployPool` calls, timed within the window before the target's `bootstrapStep2`/`registerPool` call lands; no privileged role needed; could also occur unintentionally under organic high-volume pool creation)
   - **Impact**: High for the targeted pool (permanent loss of swap functionality; liquidity remains withdrawable, so not a full fund lock)
   - **Mitigation**: None today beyond the narrow timing window itself; see H-01 recommendation for closing the atomicity gap.

2. **Attack Vector**: Compromise of `engagementSetter` key used to set arbitrary/out-of-range identity fields (M-02, M-06)

   - **Likelihood**: Low (requires key compromise, an off-chain/operational concern)
   - **Impact**: Medium (broad blast radius across verification/lock/fee-multiplier state; theoretical fee-math edge case flagged but not confirmed exploitable)
   - **Mitigation**: Existing single-role gate; recommend splitting roles and adding range checks per M-02/M-06.

3. **Attack Vector**: Reliance on unenforced KYC/investor expiry by a user whose verification has lapsed (M-01)

   - **Likelihood**: High that this occurs in practice if expiry is meant to be meaningful (it is not attacker-driven, it is simply current behavior for any lapsed account)
   - **Impact**: Depends entirely on undetermined business/regulatory policy
   - **Mitigation**: None on-chain today; operational monitoring plus manual `setInfo` is the only current control.

4. **Attack Vector**: Action taken through a support contract's admin surface during a declared pause (M-03)

   - **Likelihood**: Low (requires a privileged key to act during an active incident, which is itself an unusual/monitored event)
   - **Impact**: Low–Medium depending on which specific gap is exercised (bringing a pool's key online is lower impact than, say, a config admin action, none of which allow bypassing solvency checks)
   - **Mitigation**: Role-gating remains in place throughout; only the pause layer is incomplete.

---

## Recommendations

### Priority 1 (Critical - Immediate Action Required)

None identified at this severity in this review.

### Priority 2 (High - Short Term)

1. Close the `deployPool` / `registerPool` atomicity gap (H-01): either fold pool registration into the same atomic flow as deployment, or replace the fixed 10-slot `recentPoolsN` ring with an unbounded, appId-keyed pending-registration record, so a pool cannot be permanently evicted from registering (and thus permanently lose swap capability) by unrelated `deployPool` traffic.
2. Restore or de-link the six `docs/*.md` files referenced by `README.md` (L-04), especially the two under the "Security" heading, so integrators are not misled into believing security documentation exists and is simply hard to find.

### Priority 3 (Medium - Medium Term)

1. Make an explicit, documented policy decision on KYC/investor-expiry enforcement (M-01) and align code and documentation to it.
2. Resolve the `verificationSetter`/`engagementSetter` role ambiguity in `BiatecIdentityProvider` (M-02) — either wire up the second role or remove the dead state.
3. Define and implement a consistent pause matrix across all four contracts (M-03, L-07), paying particular attention to `sendOnlineKeyRegistration` in `BiatecClammPool` and `registerPool` in `BiatecPoolProvider`.
4. Clarify or implement bounded "excess" accounting for `withdrawExcessAssets` in `BiatecConfigProvider`/`BiatecIdentityProvider` (M-04).
5. Add range validation to `setInfo` for `feeMultiplier`, `verificationStatus`, and engagement ranks (M-06).
6. Fix the inverted opt-in-detection logic in `clammAddLiquiditySender` (M-05) — low engineering cost, real per-call cost to every integrator today.
7. Document or mitigate the shared aggregated-price-box oracle-pollution risk (M-07).
8. Reconcile `loadCLAMMContractData`'s accepted program size with what `deployPool` actually deploys, before the ~1% remaining headroom is exhausted (M-08).

### Priority 4 (Low - Long Term)

1. Resolve or annotate the stale `TODO` comment in `calculateAssetBWithdrawOnAssetADeposit` (L-01).
2. Document the safety rationale for `doAppCall`'s post-hoc solvency check (L-02).
3. Add an error message to the one bare `assert` found in `BiatecIdentityProvider.setInfo` (L-03).
4. Consider requiring a funding payment for `selfRegistration` if unbounded public box growth against the contract's own reserve is undesired (L-05).
5. Reorder `currentPrice` assignment before the cross-app `registerTrade` call in `swap()` for consistent checks-effects-interactions style (L-06a).
6. Remove or restore the commented-out post-swap solvency assertions in `swap()` (L-06b).
7. Guard `distributeExcessAssets`'s dual-sentinel (`amountA===1 && amountB===1`) case for same-asset pools (L-06c).
8. Add a defensive guard against the theoretical underflow-revert path in `calculateLiquidityWithD` at extremely tight price ranges (L-06d).
9. Add a pause check to `registerPool` (L-07).
10. Add lightweight client-side input validation to the TypeScript transaction builders (L-08).

---

## Testing Recommendations

### Additional Test Scenarios Required

1. **Scenario**: Systematic pause-matrix test across all four contracts' mutating methods

   - **Purpose**: Close the gap identified in M-03 and prevent regression once the matrix is defined
   - **Priority**: Medium
   - **Complexity**: Medium (many methods, but a shared test helper could parameterize most of it)

2. **Scenario**: `setInfo` range-boundary tests for `feeMultiplier`/`verificationStatus`/engagement ranks

   - **Purpose**: Close the gap identified in M-06
   - **Priority**: Medium
   - **Complexity**: Simple

3. **Scenario**: SDK-level test asserting `clammAddLiquiditySender` correctly skips the LP opt-in transaction for already-opted-in senders

   - **Purpose**: Close the gap identified in M-05; prevents silent cost regression for integrators
   - **Priority**: Medium
   - **Complexity**: Simple

4. **Scenario**: Explicit test(s) for `withdrawExcessAssets` access control in `BiatecConfigProvider` and `BiatecIdentityProvider`

   - **Purpose**: Close the coverage gap noted for M-04, ensure the existing role gate has an explicit regression test
   - **Priority**: Low
   - **Complexity**: Simple

---

## Compliance and Standards

### Algorand Standards Compliance

- [x] ARC-4 (Algorand Application Binary Interface) — all contracts are TEALScript-compiled ARC-4-compliant applications (ABI method selectors, typed args) per the generated ARC-56 artifacts observed in `contracts/artifacts/*.arc56.json`.
- [x] ARC-32 / ARC-56 (Application Specification) — ARC-56 JSON specs are generated as part of the build (`contracts/artifacts/*.arc56.json`), consumed by `algokit generate client` to produce the TypeScript clients.
- [ ] ARC-3 (Algorand Asset Parameters Conventions) — not directly assessed; the LP tokens created by `doCreatePoolToken` (`BiatecClammPool.algo.ts:357-393`) do not set an ARC-3-style metadata URL/hash, which appears intentional (LP tokens are functional/accounting tokens, not NFTs/metadata-bearing assets) but was not independently confirmed against ARC-3's full spec.
- Other relevant ARCs: none identified as applicable beyond the above.

### General Security Standards

- [x] DeFi Security Best Practices — slippage protection (`minimumToReceive`), rounding-in-favor-of-the-pool, and non-decreasing liquidity invariants are implemented and tested; see Findings for the specific gaps identified.
- [ ] OWASP Smart Contract Top 10 — not formally cross-checked item-by-item against this list; the Security Checklist in `audits/AI-AUDIT-INSTRUCTIONS.md` was used instead as the primary structured checklist, which covers substantially overlapping ground (access control, arithmetic, reentrancy, front-running/MEV via slippage protection, etc.).

---

## Appendix

### A. Tools and Resources Used

- `npm run build` (TEALScript `0.107.2` compiler via `@algorandfoundation/tealscript`, then `algokit generate client`)
- `npx ts-node scripts/compute-bytecode-hashes.ts` (project's own bytecode-hashing script)
- `npm run test` (Jest via `ts-jest`, against an already-running AlgoKit LocalNet: `algokit_sandbox_algod`, `_indexer`, `_conduit`, `_postgres`, all confirmed `Up` via `docker ps` before the run)
- `git log`, `git status` for provenance
- Manual/LLM-assisted static code review (no automated TEAL static-analysis tool was available/used)
- Four parallel sub-reviews (general-purpose review agents) covering, respectively: `BiatecClammPool.algo.ts` swap/fee/math section, `BiatecConfigProvider.algo.ts` + `BiatecIdentityProvider.algo.ts` in full, `BiatecPoolProvider.algo.ts` in full, and the TypeScript client SDK — each independently confirmed by the lead reviewer against the cited source before inclusion in this report

### B. Glossary

- **CLAMM**: Concentrated Liquidity Automated Market Maker — an AMM design (popularized by Uniswap v3) where liquidity is deposited within a bounded price range rather than across the full `(0, ∞)` range.
- **Base scale**: This codebase's internal 9-decimal fixed-point representation (`SCALE = 1_000_000_000`), used to normalize assets of differing native decimals (e.g. 6-decimal ASAs, 6-decimal ALGO) for uniform math.
- **Same-asset / staking pool**: A pool where `assetA.id === assetB.id` (including the native-token case `assetA.id === assetB.id === 0`), used to create interest/reward-bearing "b-" prefixed LP tokens (e.g. `bAlgo`) rather than a conventional two-asset trading pair.
- **MBR**: Minimum Balance Requirement — the AVM-enforced minimum ALGO balance an account (including an application's own account) must hold, scaling with its state/box/asset footprint.

### C. Related Audits

- Seventeen prior audit reports exist in `audits/` (dated 2025-10-27 through 2026-09-07, spanning multiple AI models). Per this audit's independence methodology, these were not read for discovery material; `AUDIT_FIXES_SUMMARY.md` was skimmed only for repository-history context. See that folder for the full history.

### D. Contact Information

- **Auditor Contact**: This audit was performed by Claude Sonnet 5 (Anthropic) on behalf of the requesting user (scholtzandcojsa@gmail.com per session context); no independent auditor contact channel is established by this report.
- **Report Version**: 1.0
- **Last Updated**: 2026-09-26

---

## Disclaimer

This audit is a point-in-time assessment of the repository at commit `0c611095c04103f80d8c3d23ed03a4762e9620f3` and does not constitute a guarantee of the absence of vulnerabilities. It was performed by an AI model (Claude Sonnet 5) via static code reading, algebraic/logical reasoning, and one fresh execution of the project's own test suite against a local Algorand sandbox; no independent fuzzing, formal verification, symbolic execution, or third-party manual human audit was performed as part of this report. No exploit reproductions were executed against any network, per the audit instructions' safety constraints — findings involving arithmetic edge cases or role-compromise scenarios are reported as static evidence / unverified hypotheses where explicitly noted, not as runtime-confirmed exploits. Any code changes made after this commit require independent re-assessment. This report does not constitute financial, legal, or regulatory advice, and carries no warranty of completeness or fitness for any particular purpose.

---

**End of Report**
