# Security Audit Report Template

## Audit Metadata

- **Audit Date**: 2026-02-13
- **Audit Type**: AI Model
- **Repository**: BiatecCLAMM
- **Git Commit Hash**: `8c022fb4b9892269921b4eef8e97b628498507d9`
- **Git Commit Date**: 2026-02-13 08:01:47 UTC
- **Branch/Tag**: main
- **Auditor Information**:
  - **AI Model**: GPT-5.3-Codex by GitHub Copilot
  - **Human Auditors**: Ludovit Scholtz
- **Audit Duration**: ~2.0 hours (static review + tooling)
- **Audit Scope**: contracts (`*.algo.ts`), transaction builders (`src/biatecClamm/txs`), selected docs, and test execution status

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

This audit found **one High**, **two Medium**, and **one Informational** issue. The highest-risk finding is an arithmetic underflow in swap fee discount calculation that can produce an extremely large effective input amount when identity multipliers are misconfigured, enabling severe pool-drain behavior in a privileged misconfiguration scenario.

A second material issue exists in the add-liquidity transaction builder: identity box references are not attached to the CLAMM call despite on-chain identity verification. A third medium issue remains the fixed `1_000_000` microALGO reserve assumption for balance checks, which can diverge from real app minimum balance requirements.

Overall posture is **Medium Risk**: core access checks and invariants are strong, but arithmetic and resource-reference edge cases remain exploitable under realistic operational mistakes.

---

## Scope and Methodology

### Repository Context

- **contracts LOC**: 3292
- **src LOC**: 4073
- **tests LOC**: 6429

### Audit Scope

**Smart Contracts Reviewed**:

- [x] `contracts/BiatecClammPool.algo.ts`
- [x] `contracts/BiatecConfigProvider.algo.ts`
- [x] `contracts/BiatecIdentityProvider.algo.ts`
- [x] `contracts/BiatecPoolProvider.algo.ts`
- [x] `contracts/FakePool.algo.ts` (spot-check)

**Source Code Reviewed**:

- [x] TypeScript transaction builders (`src/biatecClamm/txs/`)
- [ ] Sender functions (`src/biatecClamm/sender/`) (limited spot-check only)
- [ ] Common utilities (`src/common/`) (not deeply reviewed)
- [ ] Box management (`src/boxes/`) (not deeply reviewed)
- [x] Other modules: selected identity/pool helper references

**Documentation Reviewed**:

- [x] `README.md`
- [x] `docusaurus/docs/staking-pools.md`
- [ ] `docusaurus/docs/liquidity-fee-protection.md`
- [ ] `docusaurus/docs/liquidity-rounding.md`
- [ ] `docusaurus/docs/basic-use-cases.md`
- [ ] `IMPLEMENTATION_SUMMARY.md`
- [x] `.github/copilot-instructions.md`

**Test Coverage Reviewed**:

- [x] Test files in `__test__/` (via runner output)
- [ ] Test coverage metrics (not generated)
- [x] Edge case handling (reviewed statically in test sources and failure output)

### Methodology

- Manual static analysis of TEALScript code paths for swaps, liquidity accounting, identity checks, and privileged functions.
- Targeted resource/reference review in transaction builders for app/box alignment with contract expectations.
- Reproducibility anchoring via commit hash/date and bytecode hash generation.
- Test execution via workspace Jest runner (`runTests`), with environment-driven failure triage.

### Tooling/Execution Notes

- Test run result: **16 failed / 1 passed suites**, with dominant error `ECONNREFUSED ::1:4001` (`fetch failed`, KMD/localnet unavailable).
- This test outcome is treated as an environment availability issue, not direct functional regression proof.

---

## Findings

### Critical Severity Issues

_No critical-severity issues were identified in this audit._

### High Severity Issues

#### [H-01] Swap fee-discount underflow can inflate effective input and drain counter-asset reserves

**Severity**: High
**Status**: Open
**Component**: `BiatecClammPool`
**File**: `contracts/BiatecClammPool.algo.ts:923`

**Description**:
`feesMultiplier` is computed as:

```ts
const feesMultiplier = (s - ((this.fee.value as uint256) * (user.feeMultiplier as uint256)) / (user.base as uint256)) as uint256;
```

If `((fee * feeMultiplier) / base) >= s`, unsigned subtraction underflows. This can produce a near-max multiplier and therefore oversized `inAssetAfterFee`, after which swap output is only clamped by current pool reserve.

Identity values used in this expression are externally settable by privileged path `setInfo(...)` in `contracts/BiatecIdentityProvider.algo.ts:281-286`, which enforces `feeMultiplierBase === SCALE` but does not bound `feeMultiplier`.

**Impact**:

- Privileged misconfiguration (or compromised engagement setter) can lead to severe over-withdrawal behavior.
- Single-transaction drain of the opposite asset reserve is plausible where clamp limits become the only bound.

**Recommendation**:

1. Compute `discount = (fee * feeMultiplier) / base` and enforce `discount <= s` before subtraction.
2. Add upper bound in identity contract for `feeMultiplier` consistent with protocol economics.
3. Add explicit regression tests for boundary `discount == s` and `discount > s`.

---

### Medium Severity Issues

#### [M-01] Add-liquidity builder omits identity box on CLAMM app call

**Severity**: Medium
**Status**: Open
**Component**: TypeScript transaction builder
**File**: `src/biatecClamm/txs/clammAddLiquidityTxs.ts:118-129`

**Description**:
`clammAddLiquidityTxs` constructs `boxIdentity` but only applies `[boxPool, boxPoolByConfig]` to the CLAMM `addLiquidity` call. The contract path calls `verifyIdentity(...)` (`contracts/BiatecClammPool.algo.ts:405`), which may require identity-box availability during that call.

`boxIdentity` is currently attached to pool-provider noop, not the CLAMM call.

**Impact**:

- Verified users can hit box-reference failures on liquidity add.
- Integration reliability degrades, especially for KYC-enforced pools.

**Recommendation**:

1. Include `boxIdentity` in CLAMM `addLiquidity` `boxReferences`.
2. Add integration test with pre-created identity box and add-liquidity success assertion.

---

#### [M-02] Native-balance guard assumes fixed 1 ALGO reserve instead of actual min balance

**Severity**: Medium
**Status**: Open
**Component**: `BiatecClammPool`
**File**: `contracts/BiatecClammPool.algo.ts:373-375`

**Description**:
`ensureAssetBalanceMatchesState` computes native availability using:

```ts
const nativeAvailable = ((this.app.address.balance - <uint64>1_000_000) as uint256) * scaleFromBase;
```

This hard-codes a 1 ALGO reserve and does not track real app min-balance growth (boxes, opt-ins, state expansion).

**Impact**:

- Contract can believe liquidity is available when it is not spendable.
- Remove/distribute paths can fail in production as account MBR grows, potentially stranding liquidity until externally funded.

**Recommendation**:

1. Replace constant reserve with actual min-balance-aware calculation.
2. Add tests that increase MBR footprint and verify add/remove/distribute still behaves predictably.

---

### Low Severity Issues

_No low-severity issues were identified in this audit._

### Informational Issues

#### [I-01] `doAppCall` is intentionally broad; operational key controls are the primary safety boundary

**Severity**: Informational
**Status**: Open
**Component**: `BiatecClammPool`
**File**: `contracts/BiatecClammPool.algo.ts:1290-1325`

**Description**:
`doAppCall(...)` allows `addressExecutiveFee` to proxy arbitrary app calls with optional payment pre-call. This is likely intentional for xGov integration and automation, but materially expands blast radius of executive-fee key compromise.

**Recommendation**:

- Keep this function, but document strict operational controls (multisig, hardware isolation, timelocks/policies) in public docs and runbooks.

---

## Missing Test Scenarios

### Identified Gaps in Test Coverage

1. **Test Scenario**: Fee-discount underflow boundaries (`discount == s`, `discount > s`)
   - **Risk Level**: High
   - **Current Coverage**: None
   - **Recommendation**: Add swap tests with crafted identity multipliers validating safe revert and no state corruption

2. **Test Scenario**: Add-liquidity with identity box present
   - **Risk Level**: Medium
   - **Current Coverage**: Partial
   - **Recommendation**: Create identity for LP account and assert `clammAddLiquidityTxs` group succeeds end-to-end

3. **Test Scenario**: Native MBR growth and liquidity operations
   - **Risk Level**: Medium
   - **Current Coverage**: None
   - **Recommendation**: Increase app storage/opt-ins, then verify remove/distribute operations with ALGO remain executable

4. **Test Scenario**: Privileged `doAppCall` guardrails
   - **Risk Level**: Low
   - **Current Coverage**: Partial
   - **Recommendation**: Add negative tests for non-executive callers and parameter abuse cases

---

## Documentation Gaps

### Missing or Incomplete Documentation

1. **Area**: Transaction builder resource requirements
   - **Issue**: Current docs do not clearly map per-method required `boxReferences` and `appReferences` for identity-dependent calls.
   - **Risk**: Integrators may submit valid-looking groups that fail on-chain with resource errors.
   - **Recommendation**: Add a “Required references per method” table to integration docs.

2. **Area**: Executive operational security for `doAppCall`
   - **Issue**: Privileged breadth exists in code but operational hardening guidance is not explicit in user-facing docs.
   - **Risk**: Key-management weaknesses can become protocol-level incident vectors.
   - **Recommendation**: Add explicit operational controls and incident-response checklist to security docs.

---

## Security Best Practices

### Current Implementation vs. Best Practices

| Practice                   | Status | Notes                                                                                      |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Input validation           | ⚠️     | Strong in many paths, but fee-discount math lacks underflow guard                          |
| Access control             | ✅     | Privileged methods consistently gated by config addresses                                  |
| Reentrancy protection      | ✅     | AVM model + grouped execution reduces classic reentrancy surface                           |
| Integer overflow/underflow | ⚠️     | High-risk underflow path present in swap fee-discount expression                           |
| Error handling             | ✅     | Assertions and error codes are broadly used                                                |
| Gas optimization           | ⚠️     | Multiple `increaseOpcodeBudget()` and heavy math; generally acceptable for AVM constraints |
| Event logging              | ❌     | Limited explicit event-style telemetry (typical in AVM apps)                               |
| Code documentation         | ⚠️     | Core comments are present; integration resource requirements under-documented              |
| Test coverage              | ⚠️     | Broad suite exists; local environment failures blocked runtime validation this pass        |

Legend: ✅ Implemented | ⚠️ Partially Implemented | ❌ Not Implemented

---

## Risk Assessment

### Overall Risk Rating

**Risk Level**: Medium

### Risk Breakdown

| Category                | Risk Level | Description                                                           |
| ----------------------- | ---------- | --------------------------------------------------------------------- |
| Smart Contract Security | Medium     | Strong controls overall; one high-impact arithmetic edge case remains |
| Economic Model          | Medium     | Fee-discount misconfiguration can materially skew swap outcomes       |
| Access Control          | Low        | Privileged operations are gated, but key security remains critical    |
| Data Integrity          | Medium     | ALGO reserve assumption can desync recorded vs spendable balances     |
| User Safety             | Medium     | Box reference omissions can break critical user flows                 |

### Potential Attack Vectors

1. **Attack Vector**: Identity multiplier misconfiguration leading to swap math underflow
   - **Likelihood**: Medium
   - **Impact**: High
   - **Mitigation**: Access control on `setInfo`; missing arithmetic cap remains

2. **Attack Vector**: Liquidity operation failures from MBR growth
   - **Likelihood**: Medium
   - **Impact**: Medium
   - **Mitigation**: Current fixed reserve check is insufficient for dynamic MBR

3. **Attack Vector**: Executive key compromise abusing `doAppCall`
   - **Likelihood**: Low
   - **Impact**: High
   - **Mitigation**: Caller gating exists; operational key controls must be strict

---

## Recommendations

### Priority 1 (Critical - Immediate Action Required)

1. Patch swap fee-discount computation with explicit underflow guard (`discount <= SCALE`) before subtraction.
2. Add identity-contract validation bounds for `feeMultiplier` in `setInfo`.

### Priority 2 (High - Short Term)

1. Fix `clammAddLiquidityTxs` to include identity box in CLAMM `addLiquidity` call.
2. Add end-to-end identity-present add-liquidity test.

### Priority 3 (Medium - Medium Term)

1. Replace fixed ALGO reserve with min-balance-aware accounting.
2. Add MBR-growth regression tests for remove/distribute flows.

### Priority 4 (Low - Long Term)

1. Document method-by-method resource references for SDK integrators.
2. Expand operational security guidance for privileged executive keys.

---

## Testing Recommendations

### Additional Test Scenarios Required

1. **Scenario**: Fee-discount arithmetic boundary fuzzing
   - **Purpose**: Validate no underflow/overflow and expected swap outputs across identity multipliers
   - **Priority**: Critical
   - **Complexity**: Medium

2. **Scenario**: Identity-box-required liquidity add flow
   - **Purpose**: Ensure transaction builder always supplies required box references
   - **Priority**: High
   - **Complexity**: Simple

3. **Scenario**: ALGO min-balance growth under real box usage
   - **Purpose**: Validate solvency checks against dynamic MBR changes
   - **Priority**: High
   - **Complexity**: Medium

4. **Scenario**: `doAppCall` misuse matrix (caller/params/resources)
   - **Purpose**: Confirm privileged-only execution and controlled behavior under malformed payloads
   - **Priority**: Medium
   - **Complexity**: Medium

---

## Compliance and Standards

### Algorand Standards Compliance

- [ ] ARC-3 (Algorand Asset Parameters Conventions)
- [x] ARC-4 (Algorand Application Binary Interface)
- [x] ARC-32 (Application Specification)
- [x] Other relevant ARCs: ARC-56 artifacts generated and used by clients

### General Security Standards

- [x] OWASP Smart Contract Top 10 (partially aligned; identified residual gaps)
- [x] DeFi Security Best Practices (partially aligned)
- [x] Other standards: Algorand smart-contract security guidance (partial alignment)

---

## Appendix

### A. Tools and Resources Used

- `git log -1 --format="%H %cI"`
- `npm run compute-bytecode-hashes`
- Workspace search and targeted file inspection
- VS Code Jest runner via `runTests`

### B. Glossary

- **MBR**: Minimum Balance Requirement on Algorand app accounts
- **SCALE**: Base math scale factor (`1_000_000_000`)
- **KYC**: Know Your Customer identity verification state used by pool checks

### C. Related Audits

- `audits/2026-01-11-audit-report-ai-gpt5-2-copilot.md`
- `audits/2025-12-06-audit-report-ai-gpt5-1-codex.md`

### D. Contact Information

For questions or clarifications regarding this audit:

- **Auditor Contact**: GitHub Copilot (AI-assisted)
- **Report Version**: 1.0
- **Last Updated**: 2026-02-13

---

## Disclaimer

This audit is a point-in-time assessment of the repository state at the commit listed above. No audit guarantees complete absence of vulnerabilities. Any code change after this review can alter risk posture and should trigger re-audit of affected components. Operational security (key custody, deployment controls, and environment hardening) remains essential and out-of-scope for pure code review.

---

**End of Report**

## Remarks from developers

fee multiplier in identity contract can be set only by authorized multisig account

`boxIdentity` is currently attached to pool-provider noop, not the CLAMM call, which is good because it is in the single tx group and resources are shared in AVM.

Fixed 1 ALGO reserve for clamm pool was selected as the safe maximum min reserve.
