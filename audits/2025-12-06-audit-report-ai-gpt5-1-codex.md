# Security Audit Report Template

## Audit Metadata

- **Audit Date**: 2025-12-06
- **Audit Type**: AI Model
- **Repository**: BiatecCLAMM
- **Git Commit Hash**: `3194d4fe46264eed3cb8f02631dd3399d714ee01`
- **Git Commit Date**: 2025-12-06 11:26:14 UTC
- **Branch/Tag**: main
- **Auditor Information**:
  - **AI Model**: GPT-5.1-Codex (Preview) by GitHub Copilot
  - **Human Auditors**: _None_
- **Audit Duration**: ~2.4 hours (manual review + targeted tooling)
- **Audit Scope**:
  - Smart contracts, TypeScript transaction builders, and supporting documentation listed below

### Contract Bytecode Hashes

The following SHA256 hashes verify the exact bytecode of the smart contracts audited. These hashes are computed from the base64-decoded approval and clear program bytecode in the generated ARC-56 JSON files.

**BiatecClammPool.algo.ts**:

- **Approval Program SHA256**: `d5af0104faa636835883acc9096d9908b4a1e2caa6fe8d662e62b141ec8b41b1`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecConfigProvider.algo.ts**:

- **Approval Program SHA256**: `15bdcb6eb3d4369ce55525f4453c7642f4a2e72f041316124dec8b49c88e0872`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecIdentityProvider.algo.ts**:

- **Approval Program SHA256**: `452993b634a286d3891e511322984774cc9a151e00a937b255815072487c3ec0`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecPoolProvider.algo.ts**:

- **Approval Program SHA256**: `e5447dd51b3a66d53c78ecd9eef4337527ed69254ae78b7bf8fe39e729ab22c7`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**FakePool.algo.ts**:

- **Approval Program SHA256**: `b303c1c803a3a56e7c04a6246861110f3ec38c7c28fabe1602d01a9b69feb1a7`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

_Note: To compute these hashes, decode the base64 values from `byteCode.approval` and `byteCode.clear` in the respective `contracts/artifacts/*.arc56.json` files, then compute SHA256 of the raw bytes._

---

## Executive Summary

The December 2025 AI audit focused on the current `main` branch commit and covered the CLAMM core contracts, identity/config/pool provider contracts, TypeScript transaction builders, and user-facing docs describing liquidity operations. One high-severity defect and two medium-severity defects were identified:

- **High**: Missing bounds checking around user-specific fee multipliers allows any over-provisioned discount to underflow the fee calculation and drain an entire pool in a single swap if an identity record is misconfigured or a delegated key is compromised.
- **Medium**: The `clammAddLiquidityTxs` helper omits the identity box reference even though `addLiquidity` always calls the identity provider, so any KYC-complete LP (i.e., anyone with an identity box) cannot add liquidity—creating a systemic DoS for verified users.
- **Medium**: Native ALGO reserve accounting assumes a fixed 1 ALGO minimum balance even though the application’s true `minBalance` grows with boxes, extra pages, and ASA opt-ins. Once the real requirement exceeds 1 ALGO, withdrawals revert and liquidity becomes stuck until the pool account is manually rebalanced.

No critical issues were found, but the highlighted items require timely remediation. Documentation and testing gaps were also recorded to prevent regressions.

Overall security posture is **Medium Risk**: most controls are solid, yet one misconfiguration pathway can still trigger catastrophic pool loss.

---

## Scope and Methodology

### Audit Scope

**Smart Contracts Reviewed**:

- [x] `contracts/BiatecClammPool.algo.ts`
- [x] `contracts/BiatecConfigProvider.algo.ts`
- [x] `contracts/BiatecIdentityProvider.algo.ts`
- [x] `contracts/BiatecPoolProvider.algo.ts`
- [ ] `contracts/FakePool.algo.ts`

**Source Code Reviewed**:

- [x] TypeScript transaction builders (`src/biatecClamm/txs/`)
- [ ] Sender functions (`src/biatecClamm/sender/`)
- [ ] Common utilities (`src/common/`)
- [ ] Box management (`src/boxes/`)
- [x] Other modules: `src/biatecClamm/txs/clammAddLiquidityTxs.ts`, `src/biatecClamm/txs/clammSwapTxs.ts`, `docusaurus/docs/basic-use-cases.md`

**Documentation Reviewed**:

- [ ] README.md
- [ ] docs/staking-pools.md
- [ ] docs/liquidity-fee-protection.md
- [ ] docs/liquidity-rounding.md
- [x] docs/basic-use-cases.md
- [ ] IMPLEMENTATION_SUMMARY.md
- [x] .github/copilot-instructions.md / audits/AI-AUDIT-INSTRUCTIONS.md

**Test Coverage Reviewed**:

- [x] Test files in `__test__/`
- [ ] Test coverage metrics
- [ ] Edge case handling

### Methodology

- Static code review of Algorand TEALScript contracts with emphasis on arithmetic safety, access control, liquidity accounting, and identity enforcement.
- Manual analysis of TypeScript transaction builders to verify they supply the boxes/apps/assets required by the contracts.
- Targeted inspection of Jest test suites (staking/fees) to understand coverage and identify missing scenarios.
- Documentation review for operational guidance completeness (especially reward distribution semantics).
- Repository context gathering (`git log`, `tree`, LOC stats) and contract artifact hashing via `npm run compute-bytecode-hashes` to anchor the audit.

---

## Findings

### Critical Severity Issues

_No critical-severity issues were identified in this audit._

### High Severity Issues

#### [H-01] Fee multiplier underflow lets misconfigured identities drain entire pools

**Severity**: High
**Status**: Open
**Component**: `BiatecClammPool`
**File**: `contracts/BiatecClammPool.algo.ts:906-958`

**Description**:
`swap()` calculates the effective fee multiplier as `feesMultiplier = s - (fee * user.feeMultiplier) / user.base` with no upper-bound guard. Identity records (`BiatecIdentityProvider.algo.ts:278-310`) allow the engagement setter to set `feeMultiplier` to any uint64. When `feeMultiplier` is large enough that `(fee * feeMultiplier)/base >= s`, the subtraction wraps under uint256, producing a near-`2^256` multiplier. The attacker can deposit a dust-sized amount, the math inflates `inAssetAfterFee`, and the payout clamps to the entire counter-asset reserve (`toSwap > balance` branch). No fee is paid and the pool is drained in a single swap once such a misconfiguration exists.

**Impact**:
Compromise of the engagement setter key or accidental misconfiguration (e.g., granting a “2000% discount”) instantly gives the beneficiary an infinite swap credit, resulting in a total loss of whichever asset they target. Because identity discounts are per-user, only the misconfigured user is needed to exploit this. Pools cannot defend themselves and honest LPs bear the loss.

**Recommendation**:

- Enforce `feeMultiplier <= user.base * s / fee` (or simpler: `assert(feeShare <= s)` immediately after computing `(fee * multiplier)/base`).
- Alternatively clamp `feesMultiplier = max(0, s - feeShare)` to ensure it never wraps.
- Add explicit monitoring/alerting when governance sets fee multipliers near the limit.
- Extend tests to cover boundary values so the guard cannot regress.

### Medium Severity Issues

#### [M-01] `clammAddLiquidityTxs` omits the identity box, breaking adds for KYC’d LPs

**Severity**: Medium
**Status**: Open
**Component**: TypeScript transaction builder
**File**: `src/biatecClamm/txs/clammAddLiquidityTxs.ts:34-145` (CLAMM call) and `contracts/BiatecIdentityProvider.algo.ts:185-210`

**Description**:
`clammAddLiquidityTxs` fetches the identity box reference but only attaches it to the pool-provider NOOP transaction. The actual CLAMM `addLiquidity` call is issued with `boxReferences: [boxPool, boxPoolByConfig]`, omitting `boxIdentity`. However, `addLiquidity` always runs `verifyIdentity`, which internally calls `getUserShort` on the identity app. That method reads `this.identities(user)` stored as a `BoxMap` (prefix `'i'`). Without supplying the `[appBiatecIdentityProvider, 'i'+user]` box in the CLAMM transaction, the inner method call fails with `box not referenced` as soon as the user has an identity record. In practice, verified LPs are completely unable to add liquidity, amounting to a DoS against the intended compliance flow.

**Impact**:
All KYC’d users (anyone with an identity box) cannot add liquidity even though policy requires them to do so, blocking liquidity bootstrapping for enterprise participants and making their UX indistinguishable from a revert.

**Recommendation**:
Include `boxIdentity` in the `boxReferences` array passed to `clientBiatecClammPool.createTransaction.addLiquidity` (and the corresponding sender helpers). Add an integration test that registers an identity (creating the box) and confirms `addLiquidity` succeeds.

#### [M-02] Fixed 1 ALGO min-balance assumption can brick withdrawals

**Severity**: Medium
**Status**: Open
**Component**: `BiatecClammPool`
**File**: `contracts/BiatecClammPool.algo.ts:350-370`, `contracts/BiatecClammPool.algo.ts:1120-1146`

**Description**:
`ensureAssetBalanceMatchesState` derives native-ALGO availability via `nativeAvailable = (balance - 1_000_000) * scale`, hard-coding a 1 ALGO reserve even though Algorand apps must keep `globals.currentApplicationAddress.minBalance`, which grows with global keys, boxes, assets, and extra pages. Once the true minimum exceeds 1 ALGO (common for CLAMM pools that hold multiple assets and boxes), the pool can record `assetABalanceBaseScale` values that leave the account underfunded after a withdrawal. Subsequent `doAxfer` calls then fail with `underflow of min balance`, blocking liquidity removals and distributions until an operator manually tops up the account.

**Impact**:
A busy pool will eventually accumulate enough boxes/ASA opt-ins for its real min balance to exceed 1 ALGO, at which point LP withdrawals begin reverting despite the state claiming funds exist. This is a systemic DoS that strands user liquidity.

**Recommendation**:

- Replace the constant with `globals.currentApplicationAddress.minBalance` (the team already prototyped this in the commented `setDepositsValueIfNeeded`).
- Alternatively track a configurable `minBalanceBuffer` global set during bootstrap to reflect the real requirement plus margin.
- Add monitoring to detect when `assetABalanceBaseScale` would push the account below its true min balance.

### Low Severity Issues

_No low-severity issues were recorded._

### Informational Issues

_No informational-only issues were recorded beyond the documentation gaps noted later in this report._

---

## Missing Test Scenarios

1. **Swap fee underflow regression test**
   - **Risk Level**: High
   - **Current Coverage**: None
   - **Recommendation**: Add a unit/integration test that sets a mock identity with a `feeMultiplier` above the safe threshold and asserts that `swap()` now reverts with a descriptive error. This guards the fix for [H-01].

2. **Add-liquidity with identity box**
   - **Risk Level**: Medium
   - **Current Coverage**: None (current add-liquidity tests rely on anonymous identities)
   - **Recommendation**: Extend `__test__/pool/liquidity.test.ts` (or similar) to first register a user via `BiatecIdentityProvider.setInfo`, confirm the box exists, and only then call `clammAddLiquidityTxs`. The test should fail before the patch and pass afterwards, preventing future regressions.

---

## Documentation Gaps

1. **Reward sweep sentinel value**
   - **Area**: `docs/basic-use-cases.md`
   - **Issue**: The documentation instructs operators to call `clammDistributeExcessAssetsSender` but never explains the sentinel semantics (`amountA === 1` or `amountB === 1` means “distribute all currently held balance”).
   - **Risk**: Operators may accidentally send `1` assuming it is one “base unit”, unintentionally sweeping the full reserve or, conversely, avoid the feature entirely due to uncertainty.
   - **Recommendation**: Add an explicit callout in `docs/basic-use-cases.md` (and API references) describing the sentinel and showing examples for targeted vs. full distribution.

2. **Identity box requirement for CLAMM transactions**
   - **Area**: Developer onboarding docs / transaction-builder guides
   - **Issue**: None of the docs mention that every CLAMM call touching identity data must include the identity box reference.
   - **Risk**: Third-party integrators will repeat the `clammAddLiquidityTxs` mistake, leading to failing transactions in production.
   - **Recommendation**: Document the box requirements in the builder section and provide ready-to-use helper snippets.

---

## Security Best Practices

| Practice                   | Status | Notes                                                                 |
| -------------------------- | ------ | --------------------------------------------------------------------- |
| Input validation           | ✅     | Extensive asserts guard transaction fields and asset IDs.             |
| Access control             | ✅     | Config/identity references checked on every privileged path.          |
| Reentrancy protection      | ✅     | Algorand atomic groups + minimal inner calls prevent reentrancy.      |
| Integer overflow/underflow | ⚠️     | Fee multiplier subtraction lacks bounds (see [H-01]).                 |
| Error handling             | ✅     | Consistent assert messages and early exits.                           |
| Gas/opcode optimization    | ⚠️     | Multiple `increaseOpcodeBudget()` calls; acceptable but watch limits. |
| Event logging              | ⚠️     | Pool provider logs trades; CLAMM could emit more granular events.     |
| Code documentation         | ✅     | Contracts well-commented; docs need sentinel expansion.               |
| Test coverage              | ⚠️     | Broad Jest suites exist but miss critical misconfiguration cases.     |

Legend: ✅ Implemented | ⚠️ Partially Implemented | ❌ Not Implemented

---

## Risk Assessment

### Overall Risk Rating

**Risk Level**: Medium

### Risk Breakdown

| Category                | Risk Level | Description                                                                  |
| ----------------------- | ---------- | ---------------------------------------------------------------------------- |
| Smart Contract Security | Medium     | Core math mostly safe, but fee underflow is a latent catastrophic bug.       |
| Economic Model          | Medium     | Liquidity accounting strong; mispriced discounts can bypass fee economics.   |
| Access Control          | Low        | Config and admin paths thoroughly validated.                                 |
| Data Integrity          | Medium     | Balance-vs-holdings drift possible because of fixed min-balance assumptions. |
| User Safety             | Medium     | Verified LPs currently unable to add liquidity; error path unclear in UX.    |

### Potential Attack Vectors

1. **Fee discount underflow drain**
   - **Likelihood**: Medium (depends on identity misconfiguration or key compromise)
   - **Impact**: High (full pool drain)
   - **Mitigation**: Implement bounds check and monitoring as described in [H-01].

2. **Identity-box omission DoS**
   - **Likelihood**: High (current builders already omit it)
   - **Impact**: Medium (blocks compliant LPs, restricting protocol adoption)
   - **Mitigation**: Update builders + documentation and add regression tests.

---

## Recommendations

### Priority 1 (Critical - Immediate Action Required)

1. Add a strict bounds check (and revert) after computing the per-user fee share to eliminate `feesMultiplier` underflow ([H-01]).

### Priority 2 (High - Short Term)

1. Patch `clammAddLiquidityTxs` (and any custom builder) to always include the identity box; add automated tests covering KYC’d users ([M-01]).
2. Document and monitor identity discount settings; restrict who can call `setInfo` and require multisig approvals for large fee multipliers.

### Priority 3 (Medium - Medium Term)

1. Replace the fixed 1 ALGO subtraction with `globals.currentApplicationAddress.minBalance` usage, and add alarms if balances approach the limit ([M-02]).
2. Publish operator docs detailing the `amount == 1` sentinel for reward sweeps and identity box requirements.

### Priority 4 (Low - Long Term)

1. Expand event logging within CLAMM to include add/remove liquidity events for better monitoring.
2. Consider tightening opcode usage by removing redundant `increaseOpcodeBudget()` calls once profiling confirms headroom.

---

## Testing Recommendations

1. **Fee-multiplier bounds test**
   - **Purpose**: Ensure swaps revert when `(fee * feeMultiplier)/base >= SCALE`.
   - **Priority**: High
   - **Complexity**: Medium (requires configurable identity record in test harness).

2. **Identity-box inclusion test**
   - **Purpose**: Ensure every CLAMM builder includes `getBoxReferenceIdentity` whenever the identity provider is referenced.
   - **Priority**: Medium
   - **Complexity**: Medium (needs end-to-end transaction assembly validation).

---

## Compliance and Standards

### Algorand Standards Compliance

- [ ] ARC-3 (Algorand Asset Parameters Conventions)
- [ ] ARC-4 (Algorand Application Binary Interface)
- [ ] ARC-32 (Application Specification)
- [ ] Other relevant ARCs

### General Security Standards

- [ ] OWASP Smart Contract Top 10
- [ ] DeFi Security Best Practices
- [ ] Other standards

_(Future audits should explicitly verify and tick the boxes once evidence is documented.)_

---

## Appendix

### A. Tools and Resources Used

- Manual code review in VS Code
- `git log`, `tree`, `find` LOC statistics
- `npm run compute-bytecode-hashes`
- Targeted Jest suite inspection
- Algorand/TEALScript documentation & project-specific audit instructions

### B. Glossary

- **CLAMM**: Concentrated Liquidity Automated Market Maker
- **LP**: Liquidity Provider
- **SCALE**: Fixed 1e9 base used throughout the contracts

### C. Related Audits

- See prior reports under `audits/` (e.g., `2025-11-19-audit-report-ai-gemini-3.md`).

### D. Contact Information

For questions regarding this audit:

- **Auditor Contact**: GitHub Copilot (AI) — no direct email; re-run audit for clarifications.
- **Report Version**: 1.0
- **Last Updated**: 2025-12-06

---

## Disclaimer

This assessment is a point-in-time review of the repository state at commit `3194d4fe46264eed3cb8f02631dd3399d714ee01`. No audit can guarantee the absence of vulnerabilities, and code that changes after this commit is outside the scope of the report. The authors assume no liability for damages arising from reliance on this document. Always conduct additional reviews and testing before deploying to production networks.

## Remarks from developers

The finding in this security report is not valid as the fee multiplier can be modified only up to 50% ensured in the BiatecConfig smart contract and this setting is controlled by executive address multisig address.

Claimed issues regarding `clammAddLiquidityTxs` were checked and found not true. Identity contract is properly referenced in the npm library as well as identity is checked in the add liquidity method in smart contract.
