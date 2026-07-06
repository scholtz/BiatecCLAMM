# Security Audit Report

## Audit Metadata

- **Audit Date**: 2026-05-30
- **Audit Type**: AI Model
- **Repository**: BiatecCLAMM
- **Git Commit Hash**: `9ee7a2212906dad3e924bbcbbd74323f38f7ec56`
- **Git Commit Date**: 2026-05-30 20:23:01 UTC
- **Branch/Tag**: main
- **Auditor Information**:
  - **AI Model**: Claude Opus 4.8 (claude-opus-4-8)
  - **Provider**: Anthropic (via GitHub Copilot)
  - **Human Auditors**: Ludovit Scholtz
- **Audit Duration**: ~2.5 hours (full static review of all contracts + provider review + cross-audit comparison)
- **Audit Scope**:
  - All smart contracts (`contracts/*.algo.ts`) — full line-by-line review
  - TypeScript transaction builders (`src/biatecClamm/txs/`) — spot review
  - Cross-reference with prior audit findings (Jan 2026, Feb 2026, Apr 2026)

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

This May 2026 AI audit performed a comprehensive line-by-line review of all five production smart contracts and a spot review of the TypeScript transaction builder layer.

**Bytecode continuity**: The five contract bytecode hashes are byte-for-byte identical to those reviewed in the January, February, and April 2026 audits. No production contract logic has changed since those reviews. Consequently, every previously reported unresolved finding remains present in the deployed bytecode and is reconfirmed below.

The audit reconfirms **1 High**, **4 Medium**, **3 Low**, and **3 Informational** issues. No new critical or high severity issues beyond the previously documented `feeMultiplier` underflow path were identified.

**Key findings:**

- **High (H-01 — pre-existing, unresolved)**: `setInfo()` in the identity provider applies no upper bound on `feeMultiplier`. The `swap()` fee discount `feesMultiplier = SCALE − (fee × feeMultiplier / base)` underflows in uint256 when `fee × feeMultiplier / base > SCALE`, wrapping to a near-`2^256` value and corrupting the post-fee input amount. Exploitation requires a malicious or misconfigured `engagementSetter` role.
- **Medium (M-01 — pre-existing, unresolved)**: `deployPool()` concatenates only approval-program chunks 1 and 2; chunk 3 is created and populated in `loadCLAMMContractData()` but is commented out at the deploy site. If the CLAMM approval program ever exceeds 8,192 bytes, deployed pools would silently receive a truncated program.
- **Medium (M-02 — pre-existing, unresolved)**: `removeLiquidity()` and `removeLiquidityAdmin()` recompute liquidity but never refresh `currentPrice`, leaving the on-chain price oracle stale after withdrawals/fee extraction.
- **Medium (M-03 — pre-existing, unresolved)**: Native-ALGO balance-safety checks and the `distributeExcessAssets` "distribute-all" special case hard-code a 1 ALGO (1,000,000 µAlgo) minimum-balance reservation rather than reading the account's actual minimum balance.
- **Medium (M-04 — pre-existing, unresolved)**: The identity box reference for `addLiquidity` is carried in the companion pool-provider `noop` transaction rather than the CLAMM `addLiquidity` transaction; tests pass only because `populateAppCallResources: true` auto-fills resources.

Overall security posture is **Medium Risk**. The core concentrated-liquidity maths, role-based access control, division-by-zero guards, and the non-decreasing-liquidity invariant are sound and well-defended. The principal residual concerns are the unbounded `feeMultiplier` underflow path (trusted-role dependent), the latent program-truncation risk, and the stale price after withdrawals.

---

## Scope and Methodology

### Repository Context

- **Smart contracts reviewed** (5 files):
  - `BiatecClammPool.algo.ts` (~1,758 lines) — main AMM logic
  - `BiatecConfigProvider.algo.ts` (~232 lines) — configuration/roles/fees
  - `BiatecIdentityProvider.algo.ts` (~441 lines) — KYC/identity/fee multiplier
  - `BiatecPoolProvider.algo.ts` (~1,175 lines) — pool registry, deployment, trade stats
  - `FakePool.algo.ts` (~15 lines) — test helper
- **Client library**: `src/biatecClamm/txs/` (spot review)
- **Comparison baseline**: `audits/2026-04-30-audit-report-ai-claude-sonnet-4-6.md` and earlier reports

### Methodology

1. **Phase 1 — Smart Contract Review**: Full line-by-line reading of `BiatecClammPool.algo.ts` (bootstrap, add/remove liquidity, swap, distribute/withdraw excess, key registration, doAppCall, and all liquidity/price math helpers).
2. **Phase 2 — Provider Review**: Method-by-method access-control and arithmetic review of the config, identity, and pool-provider contracts.
3. **Phase 3 — Targeted Verification**: Direct grep/read confirmation of the two most security-relevant claims (approval-program chunk assembly in `deployPool`, and `feeMultiplier` bounds in `setInfo`).
4. **Phase 4 — Cross-Audit Comparison**: Reconciled findings against the Jan/Feb/Apr 2026 reports and confirmed remediation status via identical bytecode hashes.

### Smart Contracts Reviewed

- [x] `contracts/BiatecClammPool.algo.ts` — Full review
- [x] `contracts/BiatecConfigProvider.algo.ts` — Full review
- [x] `contracts/BiatecIdentityProvider.algo.ts` — Full review
- [x] `contracts/BiatecPoolProvider.algo.ts` — Full review
- [x] `contracts/FakePool.algo.ts` — Full review

---

## Findings

### High Severity Issues

#### [H-01] Unbounded `feeMultiplier` Causes uint256 Underflow in Swap Fee Discount (Pre-existing, Unresolved)

**Severity**: High
**Status**: Open (first reported January 2026; identical bytecode at this commit)
**Component**: BiatecIdentityProvider / BiatecClammPool
**File**: `contracts/BiatecIdentityProvider.algo.ts:281` (`setInfo`), `contracts/BiatecClammPool.algo.ts` (`swap`)

**Description**:
`setInfo()` updates a user's identity record but only validates `feeMultiplierBase === SCALE` and `verificationClass <= 4`. It applies **no upper bound** to `feeMultiplier`:

```typescript
setInfo(user: Address, info: IdentityInfo) {
  assert(this.txn.sender === this.engagementSetter.value);
  assert(info.feeMultiplierBase === SCALE, 'FeeMultiplierBase must be set properly');
  assert(info.verificationClass <= 4, 'Verification class out of bounds');
  this.identities(user).value = info; // feeMultiplier accepted with no bound
}
```

`swap()` then computes the fee discount factor as:

```typescript
const feesMultiplier = (s - ((this.fee.value as uint256) * (user.feeMultiplier as uint256)) / (user.base as uint256)) as uint256;
```

`s` is `SCALE` (1e9). When `fee × feeMultiplier / base > SCALE`, the subtraction underflows in uint256 and wraps to a value close to `2^256`. The wrapped multiplier flows into `inAssetAfterFee = (inAssetInBaseScale * feesMultiplier) / s`, producing an enormous notional input. The downstream output is clamped to the available pool balance (`if (toSwap > balance) toSwap = balance`), so the immediate effect is a swap executed at a corrupted (effectively zero-fee or balance-draining) rate rather than a clean revert.

With the default `feeMultiplier = 2 × SCALE` and the max pool `fee = SCALE / 10` (10%), the product is `0.2 × SCALE < SCALE`, so normal operation is safe. The vulnerability is reachable only when the `engagementSetter` role writes a `feeMultiplier` large enough that `fee × feeMultiplier ≥ base × SCALE` (e.g. `feeMultiplier ≥ 10 × SCALE` for a 10% pool).

**Impact**:
A compromised or misconfigured `engagementSetter` can corrupt swap fee accounting for targeted users, enabling drained or mispriced swaps. Severity is bounded by the trusted-role requirement, but the absence of any guard makes a configuration mistake silently exploitable rather than self-rejecting.

**Recommendation**:

1. Add an explicit upper bound in `setInfo()`, e.g. `assert(info.feeMultiplier <= (4 * SCALE) as uint64, 'Fee multiplier out of bounds');`.
2. Defensively clamp in `swap()`: if `fee × feeMultiplier / base > SCALE`, either `assert(false)` or floor `feesMultiplier` at 0 so the path reverts instead of underflowing.

---

### Medium Severity Issues

#### [M-01] `deployPool()` Omits Approval-Program Chunk 3 — Latent Program Truncation (Pre-existing, Unresolved)

**Severity**: Medium
**Status**: Open
**Component**: BiatecPoolProvider
**File**: `contracts/BiatecPoolProvider.algo.ts:366`

**Description**:
`loadCLAMMContractData()` allocates and populates three approval-program chunks and sizes chunk 3 for programs up to 12,288 bytes:

```typescript
this.clammApprovalProgram3.create(approvalProgramSize < 8192 ? 0 : approvalProgramSize < 12288 ? approvalProgramSize - 8192 : 4096);
// ...
this.clammApprovalProgram3.replace(offset - 8192, data);
```

However, `deployPool()` assembles the approval program from only chunks 1 and 2; chunk 3 is commented out at the deploy site:

```typescript
approvalProgram: [
  this.clammApprovalProgram1.value,
  this.clammApprovalProgram2.value,
  // this.clammApprovalProgram3.value,
  // this.clammApprovalProgram4.value,
],
```

At the audited commit the CLAMM approval program fits within the two concatenated chunks (the pool compiles and all tests pass), so there is no current functional defect. The risk is latent: any future growth of the CLAMM approval program past 8,192 bytes would cause `deployPool()` to publish a **truncated** program. Because the omitted bytes are silently dropped (chunk 3 is still written to box storage), this could surface only at deployment time on a live network.

**Impact**:
Latent. If triggered, newly deployed pools would carry incomplete/invalid bytecode, potentially bricking pool creation or producing pools whose logic diverges from the audited source.

**Recommendation**:
Either (a) re-enable `this.clammApprovalProgram3.value` in the `deployPool()` approval-program array, or (b) add a compile/CI assertion that fails the build if the approval program exceeds the two-chunk (8,192-byte) budget, making the truncation impossible to ship unnoticed.

---

#### [M-02] `removeLiquidity()` / `removeLiquidityAdmin()` Leave `currentPrice` Stale (Pre-existing, Unresolved)

**Severity**: Medium
**Status**: Open
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` (`removeLiquidity`, `removeLiquidityAdmin`)

**Description**:
Both withdrawal paths update balances and call `this.setCurrentLiquidity()` but never recompute and store `this.currentPrice`. By contrast, `addLiquidity()`, `swap()`, and `distributeExcessAssets()` all recalculate and write `currentPrice` via `calculatePrice(...)`. For a balanced (proportional) removal the marginal price is mathematically unchanged, so this is typically benign; however, `removeLiquidityAdmin()` extracts only the Biatec fee-share liquidity (`LiquidityBiatecFromFees`), which is **not** a proportional removal of `assetA`/`assetB`, and can shift the true marginal price while leaving the stored `currentPrice` unchanged.

**Impact**:
The on-chain `currentPrice` (consumed by `status()` and reported to the pool provider as the "old price" baseline on the next trade) can be stale after admin fee extraction, mildly skewing the first post-extraction trade's VWAP/stats. No direct fund loss.

**Recommendation**:
After updating balances and liquidity in both removal methods, recompute `currentPrice` with `calculatePrice(assetABalanceBaseScale, assetBBalanceBaseScale, priceMinSqrt, priceMaxSqrt, Liquidity)` and store it, mirroring the swap/add paths.

---

#### [M-03] Hard-Coded 1 ALGO Minimum-Balance Reservation for Native Pools (Pre-existing, Unresolved)

**Severity**: Medium
**Status**: Open
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` (`ensureAssetBalanceMatchesState`, `distributeExcessAssets`)

**Description**:
Native-ALGO accounting reserves a fixed `1_000_000` µAlgo as the assumed minimum balance:

```typescript
const nativeAvailable = ((this.app.address.balance - <uint64>1_000_000) as uint256) * scaleFromBase;
// ...
distributedAmountA = ((this.app.address.balance - <uint64>1_000_000) as uint256) * this.assetADecimalsScaleFromBase.value;
```

The real Algorand minimum balance scales with opted-in assets, created assets, and boxes. For a typical native pool (base account + LP asset + one ASA + opt-ins) the MBR is well under 1 ALGO, so the constant is conservative and safe in the common case. It becomes inaccurate if a pool accrues additional MBR obligations; an over-low constant in the "distribute-all" special case (`amountA === 1`) could distribute liquidity the account must actually retain for MBR, risking a later MBR-violation on payout.

**Impact**:
Edge-case accounting drift for native-token pools with elevated MBR. No exploit under current pool configurations.

**Recommendation**:
Replace the hard-coded constant with `this.app.address.minBalance` so the reservation always reflects the account's actual minimum balance.

---

#### [M-04] Identity Box Reference Placed in Companion `noop` Rather Than `addLiquidity` Txn (Pre-existing, Unresolved)

**Severity**: Medium
**Status**: Open
**Component**: Client library (`src/biatecClamm/txs/clammAddLiquidityTxs.ts`)
**File**: `src/biatecClamm/txs/`

**Description**:
The transaction builder attaches the identity box reference to the companion pool-provider `noop` transaction instead of the CLAMM `addLiquidity` application call that actually reads the identity box during `verifyIdentity`. The test suite passes because `algokit.Config.configure({ populateAppCallResources: true })` auto-populates resource arrays across the group. Integrators who assemble groups manually (without resource auto-population) may hit box-reference (`unavailable box`) failures for identity-gated pools.

**Impact**:
No on-chain vulnerability; a client-side correctness/portability issue that can break add-liquidity for non-auto-populated integrations.

**Recommendation**:
Attach the identity box reference (`getBoxReferenceIdentity`) directly to the `addLiquidity` application-call transaction so the group is valid without relying on resource auto-population.

---

### Low Severity Issues

#### [L-01] No Explicit Address-Length/Non-Zero Validation on Role Setters

**Severity**: Low
**Status**: Open
**Component**: BiatecConfigProvider
**File**: `contracts/BiatecConfigProvider.algo.ts` (`setAddressUdpater`, `setAddressGov`, `setAddressExecutive`, `setAddressExecutiveFee`)

**Description**:
Role-setter methods are correctly gated to the `addressUdpater`/`addressExecutive` roles but do not assert the supplied address is non-zero. A privileged operator could set a role to the zero address, locking the corresponding capability. Type `Address` already enforces 32-byte length, so the residual risk is solely an accidental zero-address lockout.

**Impact**:
Operational footgun for a trusted role; no external attacker exposure.

**Recommendation**:
Add `assert(a !== globals.zeroAddress)` (or equivalent) to each role setter, or document the deliberate ability to null a role.

---

#### [L-02] `deployPool()` Is Permissionless

**Severity**: Low
**Status**: Open (by design)
**Component**: BiatecPoolProvider
**File**: `contracts/BiatecPoolProvider.algo.ts` (`deployPool`)

**Description**:
`deployPool()` requires only a ≥5,000,000 µAlgo seed payment and a matching config app; any sender can deploy a pool. This is intentional permissionless pool creation. Pool-level parameter safety (fee ≤ `SCALE/10`, ordered asset pair, price-range validity, decimals bounds) is enforced downstream in `BiatecClammPool.bootstrap()`, which also asserts `globals.callerApplicationID == appBiatecPoolProvider` and `this.txn.sender === this.app.creator`, so malformed pools cannot be created through this path. The residual concern is spam/DoS (mitigated by the 5 ALGO cost).

**Impact**:
Low — economic spam only; parameter abuse is blocked by `bootstrap()` validation.

**Recommendation**:
Document the permissionless design explicitly; optionally add an allowlist or rate control if pool-spam becomes a concern.

---

#### [L-03] Dust Swaps Revert via Stats Non-Empty Assertion

**Severity**: Low
**Status**: Open (acceptable)
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` (`swap`)

**Description**:
`swap()` asserts `amountAForStatsInAssetDecimals > 0 && amountBForStatsInAssetDecimals > 0` before registering the trade. A swap whose output rounds down to zero in the destination asset's decimals reverts. This is the intended anti-LP-bleed behavior (rounding always favors the pool) and protects users from zero-output deposits, but the failure mode for dust amounts is a revert rather than a graceful no-op.

**Impact**:
Minor UX — dust-sized swaps fail. Funds are safe (atomic revert).

**Recommendation**:
Keep the protection; surface a dedicated error code and document the minimum economically-viable swap size for integrators.

---

### Informational Issues

#### [I-01] Large Volume of Commented-Out Dead Code

**Severity**: Informational
**File**: `contracts/BiatecClammPool.algo.ts` (`addLiquidity` and surrounding helpers)

Substantial blocks of commented-out logic (the legacy proportional-deposit/excess-return path, `setDepositsValueIfNeeded`, post-swap balance asserts) remain in the source. This obscures the active control flow and complicates audit. Recommend removing dead code or relocating it to version-control history / documentation.

#### [I-02] Inconsistent Error-Code Convention

**Severity**: Informational
**File**: All contracts

Error strings mix terse coded forms (`E_CONFIG`, `ERR-LOW-VER`, `LP-ZERO-ERR`) with full-sentence messages (`'Minimum to receive is not met'`, `'Stats to register must not be empty'`). Standardizing on a single coded convention (with an off-chain code→message map) reduces program size and eases client-side error handling.

#### [I-03] `noop()` on Pool Provider Is Publicly Callable

**Severity**: Informational
**File**: `contracts/BiatecPoolProvider.algo.ts` (`noop`)

`noop()` is intentionally public to extend app-call resource/budget limits within groups. It has no state side effects. Recommend a brief code comment documenting the deliberate public exposure to avoid future "missing access control" false positives.

---

## Missing Test Scenarios

### Identified Gaps in Test Coverage

1. **`feeMultiplier` boundary / underflow (H-01)**

   - **Risk Level**: High
   - **Current Coverage**: None
   - **Recommendation**: Add a test that sets `feeMultiplier` via `setInfo()` to a value where `fee × feeMultiplier / base > SCALE` and asserts that `swap()` reverts (post-fix) rather than executing a corrupted-rate swap.

2. **Stale `currentPrice` after `removeLiquidityAdmin` (M-02)**

   - **Risk Level**: Medium
   - **Current Coverage**: None
   - **Recommendation**: Extract Biatec fee liquidity via `removeLiquidityAdmin`, then assert `status().price` equals `calculatePrice(...)` of the post-extraction balances.

3. **Approval program > 8,192 bytes deployment (M-01)**

   - **Risk Level**: Medium
   - **Current Coverage**: None
   - **Recommendation**: Add a CI check (or test) asserting the compiled CLAMM approval program size stays within the two-chunk budget actually concatenated by `deployPool()`.

4. **Native pool with elevated MBR distribute-all (M-03)**
   - **Risk Level**: Medium
   - **Current Coverage**: Partial
   - **Recommendation**: Test `distributeExcessAssets(amountA = 1)` on a native pool whose real MBR exceeds 1 ALGO and assert no subsequent MBR violation.

---

## Documentation Gaps

1. **Area**: `feeMultiplier` semantics and bounds

   - **Issue**: Allowed range and the `fee × feeMultiplier / base` interaction with `SCALE` are undocumented.
   - **Risk**: Operators may set out-of-range multipliers (H-01).
   - **Recommendation**: Document the valid `feeMultiplier` range and the engagement-setter responsibility.

2. **Area**: Permissionless `deployPool`
   - **Issue**: The intentional permissionless design and the downstream `bootstrap()` validation guarantees are not documented together.
   - **Risk**: Misunderstanding of the trust model.
   - **Recommendation**: Add a "Pool creation trust model" section to the docs.

---

## Security Best Practices

| Practice                   | Status | Notes                                                                                  |
| -------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Input validation           | ⚠️     | Strong in CLAMM `bootstrap`/`swap`; missing `feeMultiplier` upper bound (H-01)         |
| Access control             | ✅     | Role checks consistent across all privileged methods; caller-app checks on registry    |
| Reentrancy protection      | ✅     | AVM model + atomic groups; no external re-entrant call surface                          |
| Integer overflow/underflow | ⚠️     | uint256 math well-contained except the `feesMultiplier` underflow path (H-01)          |
| Error handling             | ✅     | Explicit asserts with codes; division-by-zero guards present (`E_ZERO_DENOM`, `E_ZERO_LIQ`) |
| Gas/opcode budget          | ✅     | `increaseOpcodeBudget()` used appropriately in heavy paths                              |
| Event/stats logging        | ✅     | `registerTrade` reports prices/volumes/fees to the pool provider                        |
| Code documentation         | ⚠️     | Good NatSpec; offset by large dead-code blocks (I-01)                                   |
| Test coverage              | ⚠️     | Strong functional coverage; missing adversarial/boundary cases (see gaps)              |

Legend: ✅ Implemented | ⚠️ Partially Implemented | ❌ Not Implemented

---

## Risk Assessment

### Overall Risk Rating

**Risk Level**: Medium

### Risk Breakdown

| Category                | Risk Level | Description                                                                 |
| ----------------------- | ---------- | --------------------------------------------------------------------------- |
| Smart Contract Security | Medium     | Sound core maths; one trusted-role-dependent underflow path (H-01)          |
| Economic Model          | Low        | Non-decreasing-liquidity invariant enforced; rounding favors the pool       |
| Access Control          | Low        | Consistent role/caller checks across all privileged entry points           |
| Data Integrity          | Medium     | Stale `currentPrice` after admin fee removal (M-02); latent truncation (M-01)|
| User Safety             | Low        | `minimumToReceive` slippage guard; dust-swap revert protection              |

### Potential Attack Vectors

1. **`engagementSetter` misconfiguration / compromise (H-01)**

   - **Likelihood**: Low (trusted role)
   - **Impact**: High
   - **Mitigation**: Add `feeMultiplier` upper bound + defensive clamp in `swap()`

2. **Future program-size growth → truncated deploy (M-01)**

   - **Likelihood**: Low
   - **Impact**: High (if triggered)
   - **Mitigation**: Re-enable chunk 3 or add CI size guard

3. **Pool spam via permissionless `deployPool` (L-02)**
   - **Likelihood**: Low
   - **Impact**: Low
   - **Mitigation**: 5 ALGO seed cost; downstream `bootstrap()` parameter validation

---

## Recommendations

### Priority 1 (High — Immediate)

1. Bound `feeMultiplier` in `setInfo()` and add a defensive clamp/assert on `feesMultiplier` in `swap()` (H-01).

### Priority 2 (Medium — Short Term)

1. Re-enable approval-program chunk 3 in `deployPool()` or add a build-time size assertion (M-01).
2. Recompute and store `currentPrice` in `removeLiquidity()` and `removeLiquidityAdmin()` (M-02).
3. Replace the hard-coded `1_000_000` MBR reservation with `this.app.address.minBalance` (M-03).
4. Attach the identity box reference to the `addLiquidity` txn in the client builder (M-04).

### Priority 3 (Low — Medium Term)

1. Add non-zero-address assertions to config role setters (L-01).
2. Document the permissionless `deployPool` trust model (L-02).
3. Add dedicated dust-swap error code and integrator guidance (L-03).

### Priority 4 (Informational — Long Term)

1. Remove commented-out dead code (I-01).
2. Standardize error-code convention (I-02).
3. Comment the intentional public `noop()` (I-03).

---

## Testing Recommendations

1. **Scenario**: `feeMultiplier` underflow boundary

   - **Purpose**: Verify swap reverts when `fee × feeMultiplier / base > SCALE`
   - **Priority**: High
   - **Complexity**: Medium

2. **Scenario**: Price oracle freshness after `removeLiquidityAdmin`

   - **Purpose**: Detect stale `currentPrice` (M-02)
   - **Priority**: Medium
   - **Complexity**: Simple

3. **Scenario**: Approval-program size guard
   - **Purpose**: Prevent shipping a truncated deploy (M-01)
   - **Priority**: Medium
   - **Complexity**: Simple

---

## Compliance and Standards

### Algorand Standards Compliance

- [x] ARC-4 (ABI) — Methods use ABI routing and typed args
- [x] ARC-56 (App spec) — Artifacts generated for all contracts
- [x] ARC-3 (Asset params) — LP token naming conventions applied (B-/b-prefixes)

### General Security Standards

- [x] OWASP Smart Contract Top 10 — Reviewed; access control and arithmetic emphasized
- [x] DeFi Security Best Practices — Slippage guard, rounding-favors-pool, invariant checks present

---

## Appendix

### A. Tools and Resources Used

- Manual static review (line-by-line)
- `grep`/file reads for targeted verification
- `npm run compute-bytecode-hashes` for bytecode attestation
- Cross-reference with prior audit reports (Jan/Feb/Apr 2026)

### B. Glossary

- **SCALE**: Base fixed-point scale, 1e9 (9 decimals).
- **feeMultiplier / base**: Per-user fee adjustment factor from the identity provider; effective fee = `fee × feeMultiplier / base`.
- **LiquidityUsersFromFees / LiquidityBiatecFromFees**: Liquidity accrued from swap fees, split between LPs and Biatec.

### C. Related Audits

- `audits/2026-04-30-audit-report-ai-claude-sonnet-4-6.md`
- `audits/2026-02-13-audit-report-ai-gpt5-3-codex.md`
- `audits/2026-01-11-audit-report-ai-gpt5-2-copilot.md`

### D. Contact Information

- **Report Version**: 1.0
- **Last Updated**: 2026-05-30

---

## Disclaimer

This audit is a point-in-time static assessment of the smart contract source at the specified commit. The five production contract bytecode hashes are identical to prior 2026 audits, confirming no contract logic changed since those reviews; previously reported unresolved findings therefore remain in force. No audit can guarantee the absence of all vulnerabilities. Any code change after this commit requires re-assessment. This report does not constitute financial, legal, or investment advice, and the auditor accepts no liability for losses arising from use of the audited code.
