# Security Audit Report Template

## Audit Metadata

- **Audit Date**: 2026-01-11
- **Audit Type**: AI Model
- **Repository**: BiatecCLAMM
- **Git Commit Hash**: `25320cb60939379502e2b21d3f11bd30963b88be`
- **Git Commit Date**: 2026-01-11 12:06:14 UTC
- **Branch/Tag**: main
- **Auditor Information**:
  - **AI Model**: GPT-5.2 by GitHub Copilot
  - **Human Auditors**: Ludovit Scholtz
- **Audit Duration**: ~2.0 hours (static review + targeted tooling)
- **Audit Scope**:
  - Smart contracts (primary focus: swap fee math, identity enforcement, min-balance safety)
  - TypeScript transaction builders (primary focus: required box/app references)
  - Targeted tests execution results (see methodology)

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

This January 2026 AI audit reviewed the current `main` branch commit and focused on safety of swap fee discount logic, correctness of identity enforcement integration, and robustness of ALGO min-balance assumptions. One high-severity issue and two medium-severity issues were identified:

- **High**: Swap fee discount computation can underflow when identity fee multipliers are misconfigured, potentially enabling a privileged/misconfigured identity to drain pools in a single swap.
- **Medium**: The `clammAddLiquidityTxs` transaction builder omits the identity box reference on the CLAMM `addLiquidity` app call, likely causing verified/KYC’d users (i.e., users with identity boxes) to fail add-liquidity with a box-reference error.
- **Medium**: Pool balance safety checks use a hard-coded 1 ALGO minimum balance reserve; real app min-balance can exceed this, creating a path to liquidity becoming stuck once the pool’s true minimum balance grows.

Tests were executed via `npm run test:nobuild` and all suites passed (`17` suites / `68` tests).

Overall security posture is **Medium Risk**: core patterns are solid, but the fee multiplier underflow is a protocol-loss class issue if identity configuration is ever compromised/mis-set.

---

## Scope and Methodology

### Repository Context

- **contracts LOC**: 3287
- **src LOC**: 3917
- **tests LOC**: 6429

### Audit Scope

**Smart Contracts Reviewed**:

- [x] `contracts/BiatecClammPool.algo.ts`
- [x] `contracts/BiatecConfigProvider.algo.ts` (spot-checked for referenced globals)
- [x] `contracts/BiatecIdentityProvider.algo.ts`
- [x] `contracts/BiatecPoolProvider.algo.ts` (spot-checked for box conventions)
- [ ] `contracts/FakePool.algo.ts` (not reviewed)

**Source Code Reviewed**:

- [x] TypeScript transaction builders (`src/biatecClamm/txs/`) (targeted: add liquidity)
- [ ] Sender functions (`src/biatecClamm/sender/`) (not reviewed)
- [ ] Common utilities (`src/common/`) (not reviewed)
- [ ] Box management (`src/boxes/`) (not reviewed)

**Documentation Reviewed**:

- [x] `.github/copilot-instructions.md`
- [x] `audits/AI-AUDIT-INSTRUCTIONS.md`
- [ ] Docusaurus docs (not reviewed)

**Test Coverage Reviewed**:

- [x] All Jest suites executed via `npm run test:nobuild`
- [ ] Coverage metrics (not generated)

### Methodology

- Static/manual review of the TEALScript contracts with emphasis on arithmetic safety (uint256), fee and discount math, and identity enforcement.
- Static/manual review of TypeScript transaction builder(s) to verify required box references and app references.
- Targeted grep-based discovery of high-risk patterns (discount multipliers, min-balance constants, identity calls).
- Contract bytecode hash anchoring via `npm run compute-bytecode-hashes`.
- Test execution via `npm run test:nobuild`.

### Limitations

- This is an AI audit without adversarial “red team” execution.
- No independent economic simulation or fuzzing was performed.
- Not all TS modules and docs were reviewed in depth.

---

## Findings

### Critical Severity Issues

_No critical-severity issues were identified in this audit._

### High Severity Issues

#### [H-01] Swap fee discount underflow can enable full pool drains under identity misconfiguration

**Severity**: High
**Status**: Open
**Component**: `BiatecClammPool`
**File**: `contracts/BiatecClammPool.algo.ts:923`

**Description**:
The swap fee discount multiplier is computed as:

- `feesMultiplier = s - (fee * user.feeMultiplier) / user.base`

If the computed `(fee * user.feeMultiplier)/user.base` is `>= s`, the subtraction will underflow when treated as an unsigned integer (uint256). That underflow can yield a near-max uint256 multiplier, which makes `inAssetAfterFee` become extremely large and can cause output clamping logic to pay out the entire counter-asset reserve (bounded only by pool balance).

`BiatecIdentityProvider.setInfo()` permits the engagement setter to write arbitrary `IdentityInfo` including `feeMultiplier` (while only checking `feeMultiplierBase === SCALE`). This makes the underflow reachable via misconfiguration or a compromised engagement-setter key.

**Impact**:
A single privileged/misconfigured identity can potentially drain a pool in one swap, causing direct loss of LP funds.

**Recommendation**:

- Add a guard in the swap fee calculation path: compute `feeShare = (fee * user.feeMultiplier) / user.base` and `assert(feeShare <= s, 'ERR-FEE-MULT')` before subtracting.
- Consider enforcing reasonable bounds for `feeMultiplier` in `BiatecIdentityProvider.setInfo()` to prevent unsafe values from ever being stored.
- Add regression tests for boundary cases (see “Missing Test Scenarios”).

---

### Medium Severity Issues

#### [M-01] Add-liquidity tx builder omits identity box reference for the CLAMM call

**Severity**: Medium
**Status**: Open
**Component**: TypeScript transaction builder
**File**: `src/biatecClamm/txs/clammAddLiquidityTxs.ts:127`

**Description**:
The CLAMM contract’s `addLiquidity()` calls `verifyIdentity(...)`, which typically requires reading the identity box for the sender via the identity provider.

In `clammAddLiquidityTxs`, `boxIdentity` is computed, but the CLAMM `addLiquidity` app call uses:

- `boxReferences: [boxPool, boxPoolByConfig]`

and does not include `boxIdentity`. This is likely to fail for users who actually have identity boxes (KYC’d/registered users), producing a box reference error at runtime.

**Impact**:
Verified users can be denied service for adding liquidity, creating a systemic UX break and liquidity bootstrapping risk.

**Recommendation**:

- Include `boxIdentity` in the CLAMM `addLiquidity` transaction’s `boxReferences`.
- Add an integration test that registers an identity for a user (creating the identity box) and then successfully adds liquidity.

---

#### [M-02] Fixed 1 ALGO reserve assumption risks liquidity getting stuck as min-balance grows

**Severity**: Medium
**Status**: Open
**Component**: `BiatecClammPool`
**File**: `contracts/BiatecClammPool.algo.ts:374`

**Description**:
For native ALGO pools, `ensureAssetBalanceMatchesState` checks available balance using:

- `nativeAvailable = (balance - 1_000_000) * scaleFromBase`

This assumes a constant 1 ALGO “reserve,” but actual Algorand application minimum balance grows with state and box usage. As boxes/opt-ins accumulate, the true required minimum may exceed 1 ALGO and cause withdrawals/transfers to fail even when this check passes.

**Impact**:
Liquidity removals and administrative transfers can revert once the pool account’s true minimum balance grows, effectively stranding user funds until manually rebalanced.

**Recommendation**:

- Use the true minimum balance value (e.g., `globals.currentApplicationAddress.minBalance`) rather than a constant.
- Alternatively track a configurable buffer set during bootstrap and keep it in sync with min-balance growth.
- Add a test that increases min-balance requirements (via box creation / opt-ins) and asserts withdrawals still succeed.

---

### Low Severity Issues

_No low-severity issues were recorded in this audit._

### Informational Issues

_No informational-only issues were recorded in this audit._

---

## Missing Test Scenarios

1. **Swap fee multiplier underflow boundary test**
   - **Risk Level**: High
   - **Current Coverage**: None
   - **Recommendation**: Add a test that sets an identity with `feeMultiplier` large enough to make `(fee * feeMultiplier)/base >= s`, then assert swap reverts with a clear error.

2. **Add-liquidity succeeds with identity box present**
   - **Risk Level**: Medium
   - **Current Coverage**: Partial (liquidity tests do not necessarily create identity boxes)
   - **Recommendation**: Add a test that creates an identity record (box exists) and verifies `clammAddLiquidityTxs` can still add liquidity.

3. **Native min-balance growth scenario**
   - **Risk Level**: Medium
   - **Current Coverage**: None
   - **Recommendation**: Add a test that increases app min-balance requirements and asserts pool withdrawals/removals don’t deadlock.

---

## Documentation Gaps

- No explicit documentation was found (in the audited subset) describing the requirement that CLAMM app calls must include the identity box reference in the same transaction group, even if the pool-provider NOOP includes it.
- Consider adding a short “Box References Required” section to the developer docs for tx builders/senders.

---

## Fix Prioritization

1. **Immediate**: [H-01] Add hard guard against fee multiplier underflow.
2. **Next**: [M-01] Fix add-liquidity builder box references; add regression tests.
3. **Next**: [M-02] Replace the fixed 1 ALGO reserve assumption with true min-balance logic; add regression tests.

---

## Appendix: Commands Executed

- `git log -1 --format="%H %cI"`
- `npm run compute-bytecode-hashes`
- `npm run test:nobuild`

## Remarks from developers

fee multiplier in identity contract can be set only by authorized multisig account

The common range is 1 to 2, but can change in the future. Users must always do swaps with receive minimum amount to be set. The profit from the fee multiplier goes to liquidity providers. If fee multiplier would be set to 0, no fees would be accumulated with swapping, but the LP funds are safe in this case.

setInfo documentation was updated to show that only authorized account can do the change.

boxIdentity box is referenced in the noop tx in clammAddLiquidityTxs method call.

Fixed 1 ALGO reserve for clamm pool was selected as the safe maximum min reserve.
