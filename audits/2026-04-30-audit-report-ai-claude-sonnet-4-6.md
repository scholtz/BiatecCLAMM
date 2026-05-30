# Security Audit Report

## Audit Metadata

- **Audit Date**: 2026-04-30
- **Audit Type**: AI Model
- **Repository**: BiatecCLAMM
- **Git Commit Hash**: `fcc97627a70b600859f66a150e22180616d14f06`
- **Git Commit Date**: 2026-02-13T09:18:56+01:00
- **Branch/Tag**: main
- **Auditor Information**:
  - **AI Model**: Claude Sonnet 4.6 (claude-sonnet-4-6)
  - **Provider**: Anthropic (via GitHub Copilot)
  - **Human Auditors**: Ludovit Scholtz
- **Audit Duration**: ~3.0 hours (full static review of all contracts + client library review)
- **Audit Scope**:
  - All smart contracts (`contracts/*.algo.ts`) — full line-by-line review
  - TypeScript transaction builders (`src/biatecClamm/txs/`)
  - Test coverage analysis (`__test__/`)
  - Cross-reference with prior audit findings (Jan 2026, Feb 2026)

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

This April 2026 AI audit performed a comprehensive line-by-line review of all four production smart contracts and the TypeScript transaction builder layer. The bytecode hashes are identical to those reviewed in the January 2026 and February 2026 audits, confirming no contract changes have been deployed since those reviews.

The audit identified **1 High**, **4 Medium**, **4 Low**, and **4 Informational** issues. Two of the issues (H-01 and M-01) were first raised in the January 2026 audit and remain open in the current codebase. The remaining findings are newly identified in this review.

**Key findings:**

- **High (H-01 — pre-existing, unresolved)**: Swap fee discount computation can uint256-underflow when an `engagementSetter`-controlled identity user has a `feeMultiplier` configured such that `fee × feeMultiplier / base > SCALE`. This produces a wrap-around `feesMultiplier` in uint256 arithmetic, potentially corrupting swap output calculations.
- **Medium (M-01 — pre-existing, unresolved)**: The identity box reference in `clammAddLiquidityTxs` is placed in the companion pool-provider `noop` transaction rather than in the CLAMM pool's own `addLiquidity` transaction. Tests pass only because `populateAppCallResources: true` auto-fills resources. Real users with identity boxes using raw transaction builders may encounter box-reference failures.
- **Medium (M-02 — new)**: `removeLiquidityAdmin` does not recalculate or update `currentPrice` after removing pool liquidity, leaving the stored price oracle stale post fee-extraction.
- **Medium (M-03 — new)**: `deployPool` in `BiatecPoolProvider` only concatenates two of three available approval program chunks (`clammApprovalProgram3` is commented out). If the CLAMM approval program grows beyond 8,192 bytes, deployed pools will use a truncated program without any on-chain error.
- **Medium (M-04 — pre-existing, unresolved)**: Balance safety checks hard-code a 1 ALGO (1,000,000 µAlgo) minimum balance deduction for native ALGO pools. The actual Algorand minimum balance requirement scales with the number of opted-in assets and boxes, and can exceed 1 ALGO for pools with many assets.

Overall security posture is **Medium Risk**. The core liquidity maths, access control, and fee accounting are sound. The principal concerns are the fee-multiplier underflow exposure (requiring `engagementSetter` compromise or misconfiguration), the minimum balance assumption, and the stale price after admin fee removal.

---

## Scope and Methodology

### Repository Context

- **Smart contracts LOC**: 3,621 (5 files)
  - `BiatecClammPool.algo.ts`: 1,758 lines
  - `BiatecConfigProvider.algo.ts`: 232 lines
  - `BiatecIdentityProvider.algo.ts`: 441 lines
  - `BiatecPoolProvider.algo.ts`: 1,175 lines
  - `FakePool.algo.ts`: 15 lines
- **Test suites reviewed**: `__test__/pool/` (14 test files), `__test__/BiatecIdentity.test.ts`
- **Client library files reviewed**: `src/biatecClamm/txs/` (10 files)

### Audit Methodology

1. **Phase 1 — Smart Contract Review**: Full line-by-line reading of all five contract files
2. **Phase 2 — Client Library Review**: Focused review of transaction builders, specifically box/app reference construction
3. **Phase 3 — Test Coverage Analysis**: Review of test suite structure, identification of missing scenarios
4. **Phase 4 — Cross-Audit Comparison**: Compared findings against Jan 2026 and Feb 2026 audit reports to verify remediation status

### Smart Contracts Reviewed

- [x] `contracts/BiatecClammPool.algo.ts` — Full review
- [x] `contracts/BiatecConfigProvider.algo.ts` — Full review
- [x] `contracts/BiatecIdentityProvider.algo.ts` — Full review
- [x] `contracts/BiatecPoolProvider.algo.ts` — Full review
- [x] `contracts/FakePool.algo.ts` — Full review

### Client Libraries Reviewed

- [x] `src/biatecClamm/txs/clammAddLiquidityTxs.ts`
- [x] `src/biatecClamm/txs/clammSwapTxs.ts`
- [x] `src/biatecClamm/txs/clammRemoveLiquidityTxs.ts`
- [x] `src/biatecClamm/txs/clammBootstrapTxs.ts`
- [x] `src/biatecClamm/txs/clammCreateTxs.ts`

---

## Findings

### [H-01] Fee Multiplier Underflow in Swap Fee Calculation (Pre-existing, Unresolved)

**Severity**: High
**Status**: Open (first reported January 2026 audit, still present in current bytecode)
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` — `swap()` function

**Description**:

The swap function computes the effective fee multiplier as:

```typescript
const feesMultiplier = (s - ((this.fee.value as uint256) * (user.feeMultiplier as uint256)) / (user.base as uint256)) as uint256;
```

Where `s = 1_000_000_000`. The `user.feeMultiplier` is stored by the `engagementSetter` role via `setInfo()` in `BiatecIdentityProvider`. The `setInfo` function validates `verificationClass <= 4` but imposes **no upper-bound constraint on `feeMultiplier`**.

If a user's `feeMultiplier` is set to a value such that `fee × feeMultiplier / base > s`, the uint256 subtraction `s - (fee × feeMultiplier / base)` will **underflow**, wrapping to a very large uint256 value (≈ 2^256). When this inflated `feesMultiplier` is subsequently multiplied by `inAssetInBaseScale`, the result overflows uint256 and is truncated modulo 2^256.

**Impact**:

Under normal conditions (default `feeMultiplier = 2 * SCALE`, fee ≤ 10%), the product `fee × 2_000_000_000 / 1_000_000_000 = 2 × fee` which for max fee (100,000,000 = 10%) gives 200,000,000 < 1,000,000,000, so underflow does not occur. However:

- If `engagementSetter` misconfigures a user's `feeMultiplier` to `3 × SCALE` and the pool has a 100% fee, the subtraction underflows.
- A compromised `engagementSetter` can enable specific users to execute swaps with corrupted fee math, potentially draining pool funds.
- The `verifyIdentity` function bounds `verificationClass <= 4` but does **not** bound `feeMultiplier`.

**Proof of Concept**:

```
fee = 1_000_000_000 (100%, theoretical max)
feeMultiplier = 2_000_000_000 (set by engagementSetter)
base = 1_000_000_000
fee * feeMultiplier / base = 2_000_000_000 > s
feesMultiplier = 1_000_000_000 - 2_000_000_000 = uint256 underflow → ~2^256 - 10^9
```

**Recommendation**:

Add an upper-bound assertion in `verifyIdentity` or `setInfo`:

```typescript
// In verifyIdentity (contracts/BiatecClammPool.algo.ts)
assert(
  (this.fee.value as uint256) * (user.feeMultiplier as uint256) / (user.base as uint256) < s,
  'ERR-FEE-OVERFLOW'
);
```

Alternatively, cap `feeMultiplier` in `BiatecIdentityProvider.setInfo`:

```typescript
assert(info.feeMultiplier <= (2 * SCALE) as uint64, 'Fee multiplier too high');
```

---

### [M-01] Identity Box Reference in Wrong Transaction in `clammAddLiquidityTxs` (Pre-existing, Unresolved)

**Severity**: Medium
**Status**: Open (first reported January 2026 audit, still present)
**Component**: TypeScript Client Library
**File**: `src/biatecClamm/txs/clammAddLiquidityTxs.ts`

**Description**:

In `clammAddLiquidityTxs`, the identity box reference (`boxIdentity`) is included in the companion pool-provider `noop` transaction, not in the CLAMM pool's `addLiquidity` transaction:

```typescript
// noop companion — boxIdentity is here
await input.clientBiatecPoolProvider.createTransaction.noop({
  args: { _i: 1 },
  boxReferences: [boxFC, boxPriceFeed, boxIdentity],  // ← identity box in noop
  ...
})

// CLAMM addLiquidity — no identity box reference
await clientBiatecClammPool.createTransaction.addLiquidity({
  ...
  boxReferences: [boxPool, boxPoolByConfig],  // ← identity box MISSING
  ...
})
```

In Algorand AVM, box references are scoped to the individual top-level transaction that declares them (and its inner transactions). The identity box referenced in the `noop` transaction is NOT accessible to the `addLiquidity` transaction's inner calls. The CLAMM pool's `addLiquidity` calls `verifyIdentity`, which performs an inner call to `getUserShort` on the identity provider. The inner call attempts to read the user's identity box (prefix `'i'` + address). If the box exists (i.e., user has registered with Biatec Identity), this will fail with a box-reference error at runtime.

**Impact**:

Users who have completed KYC and have an identity box will receive a transaction failure when calling `addLiquidity`. Only completely un-registered users (where `getUserShort` returns the default "no identity" struct) are unaffected because the identity provider checks `if (!this.identities(user).exists)` and returns defaults without accessing the box. Tests pass because `algokit.Config.configure({ populateAppCallResources: true })` is set globally in `jest.setup.ts`, masking this issue.

**Recommendation**:

Move `boxIdentity` to the `addLiquidity` transaction's `boxReferences`:

```typescript
const tx = await clientBiatecClammPool.createTransaction.addLiquidity({
  ...
  boxReferences: [boxPool, boxPoolByConfig, boxIdentity],  // ← add boxIdentity here
  ...
});
```

Apply the same fix to `clammSwapTxs.ts` and `clammRemoveLiquidityTxs.ts` as they have the same pattern.

---

### [M-02] `removeLiquidityAdmin` Does Not Update `currentPrice` After Fee Extraction (New)

**Severity**: Medium
**Status**: Open
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` — `removeLiquidityAdmin()` function (~line 780)

**Description**:

The `removeLiquidityAdmin` function allows the `addressExecutiveFee` to withdraw Biatec's earned fee liquidity. After computing and transferring assets, it calls `this.setCurrentLiquidity()` (which recalculates and stores `Liquidity`), but it **never recalculates `currentPrice`**.

Contrast with the regular `removeLiquidity` function which also does not update `currentPrice`, but at least the pool's `swap()` and `addLiquidity()` functions recalculate price after their operations. The `removeLiquidityAdmin` path is the only persistent state change operation that leaves `currentPrice` stale.

```typescript
// removeLiquidityAdmin:
this.assetABalanceBaseScale.value = newAssetA;
this.assetBBalanceBaseScale.value = newAssetB;
this.setCurrentLiquidity();  // ← liquidity updated
// ← currentPrice is NOT updated
```

**Impact**:

After `removeLiquidityAdmin` executes:
- `currentPrice` diverges from the actual price implied by the new `(assetABalance, assetBBalance)` state
- Off-chain oracle consumers reading `currentPrice` see a stale/incorrect price
- The on-chain `status()` view function returns incorrect `price` field
- The next `registerTrade` call to `BiatecPoolProvider` will use the stale `currentPrice` as `priceFrom`, corrupting VWAP statistics

**Recommendation**:

Add a price recalculation at the end of `removeLiquidityAdmin`, matching the pattern used in `distributeExcessAssets`:

```typescript
const newPrice = this.calculatePrice(
  this.assetABalanceBaseScale.value,
  this.assetBBalanceBaseScale.value,
  this.priceMinSqrt.value,
  this.priceMaxSqrt.value,
  this.Liquidity.value
);
this.currentPrice.value = newPrice as uint64;
```

The same fix should be applied to `removeLiquidity` for consistency.

---

### [M-03] `deployPool` Uses Only 2 of 3 Approval Program Chunks (New)

**Severity**: Medium
**Status**: Open
**Component**: BiatecPoolProvider
**File**: `contracts/BiatecPoolProvider.algo.ts` — `deployPool()` (~line 380) and `loadCLAMMContractData()` (~line 350)

**Description**:

The `loadCLAMMContractData` function partitions the CLAMM approval program into up to three 4,096-byte chunks stored in boxes `capb1`, `capb2`, and `capb3` (supporting programs up to 12,288 bytes). However, `deployPool` only concatenates the first two chunks:

```typescript
// deployPool:
approvalProgram: [
  this.clammApprovalProgram1.value,
  this.clammApprovalProgram2.value,
  // this.clammApprovalProgram3.value,  ← commented out
],
```

The current CLAMM approval program has bytecode hash `d5af0104...`. If the compiled program size exceeds 8,192 bytes (i.e., `clammApprovalProgram3` is non-empty after `loadCLAMMContractData`), any deployed pool will execute a truncated approval program. The truncated program is silently accepted by the AVM as a valid program (no size mismatch error at deploy time) but will fail with unexpected behaviors or immediate `err` opcode when the missing TEAL is reached.

**Impact**:

- Silent deployment of broken pools if CLAMM bytecode ever grows beyond 8,192 bytes
- Pools appear to deploy successfully but revert unexpectedly on first use
- No on-chain guard catches this condition

**Recommendation**:

Either:
1. Uncomment `clammApprovalProgram3` in `deployPool` to support programs up to 12,288 bytes:
   ```typescript
   approvalProgram: [
     this.clammApprovalProgram1.value,
     this.clammApprovalProgram2.value,
     this.clammApprovalProgram3.value,
   ],
   ```
2. Or add an on-chain assertion in `deployPool` that verifies the approval program does not exceed 8,192 bytes before deployment:
   ```typescript
   assert(this.clammApprovalProgram3.value.length === 0, 'Approval program too large for 2-chunk deployment');
   ```

---

### [M-04] Hard-Coded 1 ALGO Minimum Balance Reserve (Pre-existing, Unresolved)

**Severity**: Medium
**Status**: Open (first reported January 2026 audit)
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` — `ensureAssetBalanceMatchesState()` (~line 370)

**Description**:

The native ALGO balance guard hard-codes a 1 ALGO (1,000,000 µAlgo) deduction when checking available ALGO:

```typescript
const nativeAvailable = ((this.app.address.balance - <uint64>1_000_000) as uint256) * scaleFromBase;
assert(nativeAvailable >= recorded, errorNative);
```

The actual Algorand minimum balance requirement scales with the number of opted-in assets, created assets, and storage boxes. For a CLAMM pool with:
- 2 opted-in ASAs: +200,000 µAlgo
- 1 created LP token (ASA): +100,000 µAlgo
- Global state (12 uint, 8 bytes): ~250,000 µAlgo
- 3 box entries in pool provider: variable

The real minimum balance can comfortably exceed 1,000,000 µAlgo. If the real minimum balance is, say, 1,500,000 µAlgo, the guard allows `assetABalanceBaseScale` to record up to 1,000,000 µAlgo more than is actually safely withdrawable, creating a scenario where withdrawals succeed at the contract level but fail at the ledger level.

**Recommendation**:

Use `globals.currentApplicationAddress.minBalance` instead of the hard-coded 1,000,000:

```typescript
const nativeAvailable = ((this.app.address.balance - this.app.address.minBalance) as uint256) * scaleFromBase;
```

This dynamically reflects the true minimum balance requirement.

---

### [L-01] `sendOnlineKeyRegistration` in `BiatecClammPool` Missing Pause Check (New)

**Severity**: Low
**Status**: Open
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` — `sendOnlineKeyRegistration()` (~line 1240) and `sendOfflineKeyRegistration()` (~line 1260)

**Description**:

The `sendOfflineKeyRegistration` method correctly checks the global `E_PAUSED` flag before proceeding:

```typescript
// sendOfflineKeyRegistration — has pause check ✓
const paused = appBiatecConfigProvider.globalState('s') as uint64;
assert(paused === 0, 'E_PAUSED');
```

However, `sendOnlineKeyRegistration` does **not** include this check:

```typescript
// sendOnlineKeyRegistration — no pause check ✗
sendOnlineKeyRegistration({
  selectionPk: selectionPk,
  ...
});
```

**Impact**:

When the global system is paused (e.g., during an emergency), the `addressExecutiveFee` can still register the pool's account for consensus participation. While unlikely to cause direct fund loss, it creates an inconsistency with the system-wide pause intent and may interfere with emergency response procedures.

**Recommendation**:

Add the pause check to `sendOnlineKeyRegistration`:

```typescript
sendOnlineKeyRegistration(appBiatecConfigProvider: AppID, ...): void {
  assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'E_CONFIG');
  const addressExecutiveFee = appBiatecConfigProvider.globalState('ef') as Address;
  assert(this.txn.sender === addressExecutiveFee, 'E_SENDER');
  const paused = appBiatecConfigProvider.globalState('s') as uint64;  // ← add this
  assert(paused === 0, 'E_PAUSED');  // ← add this
  sendOnlineKeyRegistration({ ... });
}
```

---

### [L-02] `bootstrap` Does Not Validate `currentPrice` Within `[priceMin, priceMax]` (New)

**Severity**: Low
**Status**: Open
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` — `bootstrap()` (~line 160)

**Description**:

The `bootstrap` function accepts a `currentPrice` parameter that is stored as-is without validating it falls within the pool's price range `[priceMin, priceMax]`:

```typescript
this.priceMin.value = priceMin;
this.priceMax.value = priceMax;
// ...
this.currentPrice.value = currentPrice;  // ← no validation against [priceMin, priceMax]
```

For standard (non-staking) pools, `currentPrice` should satisfy `priceMin <= currentPrice <= priceMax`. Deployers can pass any value including 0 or values far outside the range.

**Impact**:

- Off-chain tools reading `currentPrice` before any liquidity is added see a misleading price
- The pool's VWAP oracle is seeded with an incorrect `priceFrom` on the first trade
- Incorrect initial price passed to `registerPool` → `poolsAggregated` gets seeded with a wrong price

**Recommendation**:

Add validation for non-staking pools:

```typescript
if (!isSameAssetPool) {
  assert(currentPrice >= priceMin && currentPrice <= priceMax, 'E_INIT_PRICE');
}
```

---

### [L-03] VWAP Calculation Silent `uint256→uint64` Truncation (New)

**Severity**: Low
**Status**: Open
**Component**: BiatecPoolProvider
**File**: `contracts/BiatecPoolProvider.algo.ts` — `updatePriceBoxInfo()` and `updatePriceBoxAggregated()` (~lines 650, 840)

**Description**:

The VWAP calculation accumulates using `uint256` arithmetic but truncates to `uint64` for storage:

```typescript
info.period1NowVWAP = (
  (period1NowVolumeBUint256 * period1NowVWAPUint256 + amountBUint256 * priceUint256) /
  (period1NowVolumeBUint256 + amountBUint256)
) as uint64;
```

The denominator is a `uint64` addition which cannot overflow, but the numerator involves multiplication of two `uint256` values where `volumeB` could be large. If the resulting VWAP exceeds `2^64 - 1` (which would require prices > 18.4 billion in base-9 scale, i.e., > 18.4 in actual units), the cast truncates silently without error.

**Impact**:

For assets with extreme valuations (e.g., a pool priced at >18,446,744,073 in base scale), VWAP statistics would wrap to a wrong value. Low probability for realistic assets but a latent correctness risk.

**Recommendation**:

Add an assertion before the cast:

```typescript
const newVWAP = (period1NowVolumeBUint256 * period1NowVWAPUint256 + amountBUint256 * priceUint256) /
  (period1NowVolumeBUint256 + amountBUint256);
assert(newVWAP <= <uint256>0xFFFFFFFFFFFFFFFF, 'VWAP_OVERFLOW');
info.period1NowVWAP = newVWAP as uint64;
```

---

### [L-04] `doAppCall` Silently No-Ops When `payAmount === 0` (New)

**Severity**: Low
**Status**: Open
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` — `doAppCall()` (~line 1290)

**Description**:

The `doAppCall` function has two active code paths, both gated by `appCallParams.payAmount > 0`. The function returns without doing anything if `payAmount === 0`:

```typescript
doAppCall(appBiatecConfigProvider: AppID, appCallParams: AppCallParams, apps: AppID[], assets: AssetID[], accounts: Address[], appArgs: bytes[]): void {
  // ...access control checks...
  if (appCallParams.payAmount > 0 && apps.length === 0 && ...) {
    // path 1: execute payment + app call
  } else if (appCallParams.payAmount > 0) {
    // path 2: execute payment + app call with full references
  }
  // ← implicit return with no action if payAmount === 0
  this.ensurePoolBalancesWithinHoldings(this.assetA.value, this.assetB.value);
}
```

The commented-out `else if` branches (for calling without payment) were removed, leaving governance calls without payment amount (pure app calls like xGov voting) completely non-functional.

**Impact**:

- xGov voting calls or governance interactions that do not require a payment (pure `appl` calls) will be silently accepted (no error) but produce no on-chain effect
- Off-chain callers have no way to detect the silent no-op without reading contract state
- Pool's stake participation in governance becomes unusable for zero-payment calls

**Recommendation**:

Either restore the `else` branch for pure app calls, or add an assertion that ensures at least one execution path is taken:

```typescript
assert(appCallParams.payAmount > 0, 'E_CALL_REQUIRES_PAYMENT');
```

Or implement the pure app-call path to support governance voting:

```typescript
} else {
  this.pendingGroup.addAppCall({
    applicationID: appCallParams.applicationID,
    accounts: accounts,
    applicationArgs: [appArgs[0]],
    applications: apps,
    assets: assets,
    note: appCallParams.note,
    fee: appCallParams.fee,
    onCompletion: OnCompletion.NoOp,
    isFirstTxn: true,
  });
  this.pendingGroup.submit();
}
```

---

### [I-01] Native Token Name Hardcoded as 'Algo' in `bootstrap` (New)

**Severity**: Informational
**Status**: Open
**Component**: BiatecClammPool
**File**: `contracts/BiatecClammPool.algo.ts` — `bootstrap()` (~line 222)

**Description**:

The `bootstrap` function hardcodes the native token name as `'Algo'` regardless of the chain the contract is deployed on:

```typescript
// let nativeTokenNameBytes = appBiatecPoolProvider.globalState('nt') as bytes;
// [... commented-out code that would read from pool provider ...]
const nativeTokenNameBytes = 'Algo';  // ← hardcoded
```

The `BiatecPoolProvider` has a `nativeTokenName` global state key (`'nt'`) set via `setNativeTokenName()` specifically to support multi-chain deployments (Algorand = 'Algo', Voi = 'VOI', Aramid = 'ARAMID'). This code was previously implemented but was commented out, likely as a workaround for a TEALScript compilation issue.

**Impact**:

- Staking pools on Voi or Aramid networks will create LP tokens named `bAlgo` instead of `bVOI`/`bARAMID`
- This is user-facing cosmetic but confusing for users on non-Algorand chains
- The `setNativeTokenName` function on the pool provider becomes effectively dead code

**Recommendation**:

Re-enable reading the native token name from the pool provider, fixing whatever TEALScript issue caused the revert:

```typescript
const nativeTokenNameBytes = appBiatecPoolProvider.globalState('nt') as bytes;
```

---

### [I-02] `selfRegistration` Allows Unlimited Box Creation (Pre-existing)

**Severity**: Informational
**Status**: Open
**Component**: BiatecIdentityProvider
**File**: `contracts/BiatecIdentityProvider.algo.ts` — `selfRegistration()` (~line 250)

**Description**:

Any Algorand address can call `selfRegistration()` to create an identity box. The function validates that all initial fields are at default values, preventing privilege escalation, but it requires the identity contract to have sufficient minimum balance to fund box storage. If the contract is pre-funded by Biatec (or through the `withdrawExcessAssets` reverse pattern), mass self-registration by bot addresses could exhaust the contract's balance, causing legitimate registrations to fail due to insufficient MBR.

**Impact**:

Potential storage exhaustion attack if the contract address is heavily pre-funded. Each identity box consumes approximately 250+ bytes of box storage, costing ~6,250 µAlgo per box in Algorand MBR. An attacker willing to pay box creation fees can bloat the contract.

**Recommendation**:

Require self-registering users to fund the box creation cost via a payment transaction:

```typescript
selfRegistration(txFundBox: PayTxn, user: Address, info: IdentityInfo) {
  verifyPayTxn(txFundBox, {
    receiver: this.app.address,
    amount: { greaterThanEqualTo: 6500 }  // box MBR cost
  });
  // ...existing validation...
}
```

---

### [I-03] Extensive Dead (Commented-Out) Code (Pre-existing)

**Severity**: Informational
**Status**: Open
**Component**: All contracts (primarily BiatecClammPool, BiatecPoolProvider)

**Description**:

All contracts, particularly `BiatecClammPool.algo.ts` and `BiatecPoolProvider.algo.ts`, contain extensive commented-out code sections:

- `addLiquidity`: ~80 lines of commented-out excess-deposit refund logic
- `deployPool`: commented-out period 5 and 6 tracking
- `doAppCall`: commented-out pure app-call paths
- `bootstrap`: commented-out dynamic native token name retrieval

While this is not a security issue, the dead code:
- Increases cognitive complexity for reviewers
- Creates uncertainty about intended behavior (is this code coming back?)
- May contain security-relevant logic that auditors might mistakenly think is active

**Recommendation**:

Remove commented-out code that is not planned for near-term reactivation. Use git history as the source of removed implementations.

---

### [I-04] `setInfo` in Identity Contract Has No Upper Bound on `feeMultiplier` (Related to H-01)

**Severity**: Informational (exploitation path requires H-01)
**Status**: Open
**Component**: BiatecIdentityProvider
**File**: `contracts/BiatecIdentityProvider.algo.ts` — `setInfo()` (~line 275)

**Description**:

The `setInfo` function validates `verificationClass <= 4` and `feeMultiplierBase === SCALE` but imposes no upper bound on `feeMultiplier`:

```typescript
setInfo(user: Address, info: IdentityInfo) {
  assert(this.txn.sender === this.engagementSetter.value);
  assert(info.feeMultiplierBase === SCALE, 'FeeMultiplierBase must be set properly');
  assert(info.verificationClass <= 4, 'Verification class out of bounds');
  // ← no assert on info.feeMultiplier upper bound
  this.identities(user).value = info;
}
```

The default value on `selfRegistration` is enforced as `feeMultiplier = 2 * SCALE`. The `engagementSetter` can legitimately set values from 0 (no fee discount for user — wait, actually `feeMultiplier = 0` means zero fees, which is a maximum discount) up to any uint64. This directly enables the H-01 underflow scenario.

**Recommendation**:

Add an upper bound to `setInfo`:

```typescript
assert(info.feeMultiplier <= (2 * SCALE) as uint64, 'feeMultiplier cannot exceed 2x SCALE');
```

---

## Missing Test Scenarios

### Missing Test: Fee Multiplier Boundary Conditions

**Description**: Test that the swap function correctly handles edge cases in fee multiplier computation, specifically verifying behavior when `feeMultiplier` approaches or exceeds the value that would cause underflow.

**Risk if Untested**: H-01 issue is not caught by existing tests; a compromised `engagementSetter` could exploit this without detection.

**Test Steps**:

1. Set up pool with maximum fee (10%)
2. Configure a user with `feeMultiplier = 2 * SCALE` (current default) and verify swap succeeds
3. Configure a user with `feeMultiplier = 3 * SCALE` (invalid, above max) and verify it is rejected by `setInfo` or `verifyIdentity`
4. Verify swap transaction reverts with an appropriate error when called with such a user

**Expected Behavior**: Either `setInfo` should reject the invalid multiplier, or `verifyIdentity` should assert before computing `feesMultiplier`.

**Priority**: High

---

### Missing Test: `removeLiquidityAdmin` Price Staleness

**Description**: Test that `currentPrice` is updated correctly after `removeLiquidityAdmin` executes.

**Risk if Untested**: Price oracle becomes stale after every admin fee extraction, corrupting VWAP statistics.

**Test Steps**:

1. Bootstrap pool, add liquidity, execute swaps to accumulate fees in `LiquidityBiatecFromFees`
2. Record `currentPrice` before `removeLiquidityAdmin`
3. Execute `removeLiquidityAdmin` to extract all Biatec fees
4. Assert that the price returned by `getCurrentPrice()` reflects the new balances

**Expected Behavior**: `currentPrice` should equal `calculatePrice(newAssetA, newAssetB, priceMinSqrt, priceMaxSqrt, newLiquidity)` after admin removal.

**Priority**: Medium

---

### Missing Test: Deployment with Approval Program Exactly at 8,192 Bytes

**Description**: Test pool deployment when the CLAMM approval program is at the boundary where `clammApprovalProgram3` would be non-empty.

**Risk if Untested**: Silent deployment of truncated pools if program size grows.

**Test Steps**:

1. Load CLAMM data in chunks, verify only chunks 1 and 2 are used in `deployPool`
2. Assert chunk 3 is zero-length for the current program
3. Document maximum program size supported by current configuration

**Priority**: Medium

---

### Missing Test: `doAppCall` with `payAmount === 0`

**Description**: Test that `doAppCall` behaves predictably when called with `payAmount = 0`.

**Risk if Untested**: Off-chain governance callers believe the call was executed when it was silently ignored.

**Test Steps**:

1. Call `doAppCall` with `payAmount = 0` and a valid app call
2. Verify that no inner transaction was executed
3. Verify transaction succeeds (no revert) but has no effect

**Expected Behavior**: Either revert with a clear error, or execute the app call. Silent no-op is unacceptable.

**Priority**: Low

---

### Missing Test: `sendOnlineKeyRegistration` When Paused

**Description**: Verify that key registration is blocked when the system is paused.

**Test Steps**:

1. Set system to paused state
2. Call `sendOnlineKeyRegistration` as `addressExecutiveFee`
3. Verify it succeeds (current behavior — bug) vs. reverts (expected behavior)

**Priority**: Low

---

### Missing Test: Identity Box Reference in Production (No `populateAppCallResources`)

**Description**: Test `clammAddLiquidityTxs` with `populateAppCallResources: false` and a user who has an identity box.

**Risk if Untested**: Production users with KYC identity fail to add liquidity silently; only discovered at runtime.

**Test Steps**:

1. Register a user via `selfRegistration` to create an identity box
2. Disable `populateAppCallResources`
3. Attempt to add liquidity using `clammAddLiquidityTxs`
4. Verify the transaction succeeds (after fix) or fails with box-reference error (current)

**Priority**: Medium

---

## Documentation Gaps

### Documentation Gap: Fee Multiplier Bounds

**Missing Information**: What are the valid bounds for `feeMultiplier` set by `engagementSetter`? The contract enforces `feeMultiplierBase === SCALE` but the user-facing documentation does not state limits on `feeMultiplier`.

**User Impact**: Integration partners implementing the `engagementSetter` role may set unsafe values.

**Recommended Documentation**: Add to `BiatecIdentityProvider` documentation that `feeMultiplier` must be in range `[0, 2 * SCALE]` and document the semantic meaning (values > SCALE = discount vs premium).

**Priority**: High

---

### Documentation Gap: `doAppCall` Limitations

**Missing Information**: The `doAppCall` function is documented as "mainly created for the xgov calls" but the current implementation only works when `payAmount > 0`. Pure governance votes (no payment) are not supported.

**Recommended Documentation**: Update `doAppCall` JSDoc to document the `payAmount > 0` requirement and list supported governance call patterns.

**Priority**: Low

---

### Documentation Gap: Multi-Chain Native Token Name

**Missing Information**: The `setNativeTokenName` function on `BiatecPoolProvider` exists for multi-chain support, but the `BiatecClammPool.bootstrap` currently ignores it (hardcoded 'Algo'). Documentation should clearly state which networks are supported and what LP token names to expect.

**Priority**: Low

---

## Security Best Practices

### Access Control Assessment

| Privilege Role | Contract | Methods | Status |
|---|---|---|---|
| `addressUdpater` (multisig) | BiatecConfigProvider | `updateApplication`, `setAddressUdpater`, `setPaused`, `setAddressGov`, `setAddressExecutive`, `setBiatecIdentity`, `setBiatecPool` | ✅ Well-controlled |
| `addressExecutive` | BiatecConfigProvider | `setAddressExecutiveFee`, `setBiatecFee` | ✅ Well-controlled |
| `addressExecutiveFee` | All pools | `removeLiquidityAdmin`, `distributeExcessAssets`, `withdrawExcessAssets`, `sendOnline/OfflineKeyRegistration`, `doAppCall` | ⚠️ High-privilege single key |
| `engagementSetter` | BiatecIdentityProvider | `setInfo` | ⚠️ No `feeMultiplier` bound (H-01) |
| Pool Provider | BiatecClammPool | `bootstrap` (caller must be `appBiatecPoolProvider`) | ✅ Properly restricted |

### Pause Mechanism Assessment

The `E_PAUSED` flag (`suspended` key `'s'` in BiatecConfigProvider) is correctly checked in:
- ✅ `addLiquidity` → via `verifyIdentity`
- ✅ `removeLiquidity` → via `verifyIdentity`
- ✅ `swap` → via `verifyIdentity`
- ✅ `distributeExcessAssets`
- ✅ `withdrawExcessAssets`
- ✅ `removeLiquidityAdmin`
- ✅ `sendOfflineKeyRegistration` in BiatecClammPool
- ❌ `sendOnlineKeyRegistration` in BiatecClammPool (L-01)

### Integer Arithmetic Safety

- All large multiplications use `uint256` intermediate values before casting to `uint64` — good practice
- Division-by-zero guarded in all swap calculation paths (`E_ZERO_DENOM`, `E_ZERO_LIQ`)
- Liquidity non-decrease invariant enforced by `setCurrentLiquidityNonDecreasing` with `ERR-LIQ-DROP`
- Fee-related arithmetic: vulnerable to underflow only via H-01 path (compromised `engagementSetter`)

---

## Risk Assessment

| Category | Assessment |
|---|---|
| **Overall Risk** | Medium |
| **Smart Contract Code Quality** | Good |
| **Access Control** | Good (with H-01 caveat) |
| **Mathematical Correctness** | Good (with H-01 caveat) |
| **Algorithmic Complexity** | Well-handled with `increaseOpcodeBudget()` calls |
| **State Consistency** | Good, with minor M-02 staleness issue |
| **Test Coverage** | Good (14 test files) — masked by `populateAppCallResources` |
| **Client Library Safety** | Medium (identity box reference placement M-01) |
| **Documentation Quality** | Good |

---

## Recommendations (Prioritized)

### Priority 1 — High (Should fix before next deployment)

1. **[H-01]** Add upper-bound assertion on `feeMultiplier` in either `BiatecIdentityProvider.setInfo` or `BiatecClammPool.verifyIdentity` to prevent uint256 underflow in fee computation.

### Priority 2 — Medium (Fix in next release)

2. **[M-01]** Move `boxIdentity` from the pool provider `noop` companion transaction to the CLAMM pool's `addLiquidity` (also `swap`, `removeLiquidity`) transaction in the TypeScript builders. Add integration test with `populateAppCallResources: false` for an identity-registered user.

3. **[M-02]** Add `currentPrice` recalculation at the end of `removeLiquidityAdmin` using `calculatePrice()`.

4. **[M-03]** Uncomment `clammApprovalProgram3` in `deployPool`, or add an on-chain assertion verifying chunk 3 is empty before 2-chunk deployment.

5. **[M-04]** Replace hard-coded `1_000_000` minimum balance reserve with `this.app.address.minBalance` in `ensureAssetBalanceMatchesState`.

### Priority 3 — Low (Improve in next maintenance window)

6. **[L-01]** Add `E_PAUSED` check to `sendOnlineKeyRegistration` in `BiatecClammPool` for consistency.

7. **[L-02]** Validate `currentPrice ∈ [priceMin, priceMax]` during `bootstrap` for standard (non-staking) pools.

8. **[L-03]** Add overflow assertions before VWAP `uint256→uint64` casts in `BiatecPoolProvider`.

9. **[L-04]** Either restore the pure app-call path in `doAppCall` or add an explicit assertion that `payAmount > 0` is required.

### Priority 4 — Informational

10. **[I-01]** Restore dynamic native token name reading from pool provider in `bootstrap`.

11. **[I-02]** Require a payment transaction from self-registering users to fund box MBR costs.

12. **[I-03]** Remove stale commented-out code blocks.

13. **[I-04]** Add `feeMultiplier` upper-bound assertion in `setInfo`.

---

## Appendix

### Comparison with Previous Audit Findings

| Finding | Jan 2026 Audit | Feb 2026 Audit | Apr 2026 Audit (This) |
|---|---|---|---|
| Fee multiplier underflow | High — Open | Not explicitly re-confirmed | High — Still Open |
| Identity box in wrong tx | Medium — Open | Not explicitly re-confirmed | Medium — Still Open |
| Hard-coded 1 ALGO MBR | Medium — Open | Not explicitly re-confirmed | Medium — Still Open |
| `removeLiquidityAdmin` missing price update | Not identified | Not identified | Medium — New |
| `deployPool` 2/3 chunks | Not identified | Not identified | Medium — New |
| `sendOnlineKeyRegistration` no pause check | Not identified | Not identified | Low — New |
| `bootstrap` currentPrice validation | Not identified | Not identified | Low — New |
| VWAP uint64 truncation | Not identified | Not identified | Low — New |
| `doAppCall` silent no-op | Not identified | Not identified | Low — New |
| Native token name hardcoded | Not identified | Not identified | Informational — New |

### Contract Version Strings

- `BiatecClammPool`: `BIATEC-CLAMM-01-06-04`
- `BiatecConfigProvider`: `BIATEC-CONFIG-01-02-01`
- `BiatecIdentityProvider`: `BIATEC-IDENT-01-03-01`
- `BiatecPoolProvider`: `BIATEC-PP-01-05-03`
