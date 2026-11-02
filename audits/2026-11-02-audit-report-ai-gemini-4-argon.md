# Security Audit Report — BiatecCLAMM

## Audit Metadata

- **Audit Date**: 2026-11-02
- **Audit Type**: AI Model (Independent Fresh Review & Mathematical Verification)
- **Repository**: BiatecCLAMM (`projects/BiatecCLAMM`)
- **Git Commit Hash**: `9f525507b26d3fb03197d4989574cc697039d503`
- **Git Commit Date**: 2026-10-17 07:16:31 UTC (`2026-10-17T09:16:31+02:00`)
- **Branch/Tag**: `HEAD` (clean working tree at audit start)
- **Auditor Information**:
  - **AI Model**: Gemini 4 Argon (GitHub Copilot)
  - **Provider**: Google / GitHub Copilot
- **Tooling & Environment**:
  - **Node.js**: `v26.13.0`
  - **TEALScript Compiler**: `@algorandfoundation/tealscript` `0.107.2`
  - **Algod TEAL Compiler (LocalNet)**: `5.0.5` (`31186e99+`)
  - **TypeScript**: `5.9.3` (note: `@typescript-eslint/typescript-estree` declares `<5.6.0` support range)
  - **Test Runner**: `jest` `29.7.0` with `@algorandfoundation/algokit-utils` `^9.2.0` against isolated Algorand LocalNet (`algokit_sandbox_algod`)
- **Prior Exposure & Independence Disclosure**:
  - The audit request supplied the external concern: _"I have concerns over an exploit in Biatec that cause fee loss"_ and requested verification of the mathematics governing fee collection and multi-party liquidity aggregation across different times.
  - Per `audits/AI-AUDIT-INSTRUCTIONS.md`, no prior audit reports (`audits/2025-*.md`, `audits/2026-*.md`), historical finding summaries (`AUDIT_FIXES_SUMMARY.md`, `IMPLEMENTATION_SUMMARY.md`), or historical audit reproduction tests (`__test__/audit-*.test.ts`, `__test__/pool/audit-*.ts`) were opened during discovery. All findings and proofs were derived directly from the current source implementation.
- **Audit Scope**:
  - Smart contracts (`contracts/*.algo.ts` — 3,375 lines across 5 contracts)
  - TypeScript SDK, transaction builders, sender wrappers, and CLI scripts (`src/**/*.ts` — 5,593 lines)
  - On-chain test suites (`__test__/**/*.test.ts` — 8,450 baseline lines; expanded with `__test__/pool/multi-party-fee-aggregation.test.ts`)
  - Documentation (`README.md`, `docusaurus/docs/*.md`, `.github/copilot-instructions.md`)

### Contract Bytecode Hashes

The following SHA256 hashes fingerprint the compiled approval and clear state program bytecode in `contracts/artifacts/*.arc56.json`. The artifacts were freshly recompiled via `npm run build` (`tealscript contracts/*.algo.ts contracts/artifacts && algokit generate client ...`) and verified to produce byte-for-byte identical program bytecode to the committed artifacts at `9f525507b26d3fb03197d4989574cc697039d503`.

Because `npm run compute-bytecode-hashes` invokes `ts-node` (which is not listed in `devDependencies`), hashes were computed after the fresh build using Node's built-in `crypto` module:

```bash
node -e "const fs=require('fs'),crypto=require('crypto'),path=require('path'); for(const f of ['BiatecClammPool.arc56.json','BiatecConfigProvider.arc56.json','BiatecIdentityProvider.arc56.json','BiatecPoolProvider.arc56.json','FakePool.arc56.json']){const d=JSON.parse(fs.readFileSync(path.join('contracts/artifacts',f),'utf8')); console.log(d.name, crypto.createHash('sha256').update(Buffer.from(d.byteCode.approval,'base64')).digest('hex'), crypto.createHash('sha256').update(Buffer.from(d.byteCode.clear,'base64')).digest('hex'));}"
```

**BiatecClammPool.algo.ts** (`BIATEC-CLAMM-01-06-08`):

- **Approval Program SHA256**: `89a555f1d2d16122f71752e19a3e6d1d011d6ef8a508c7e9aea6259f732bb07b`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecConfigProvider.algo.ts** (`BIATEC-CONFIG-01-02-01`):

- **Approval Program SHA256**: `15bdcb6eb3d4369ce55525f4453c7642f4a2e72f041316124dec8b49c88e0872`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecIdentityProvider.algo.ts** (`BIATEC-IDENT-01-03-02`):

- **Approval Program SHA256**: `349f9a336ce345098b9fc6f768fa2a5ee7d45e1917419bb9880973218d3c5b72`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**BiatecPoolProvider.algo.ts** (`BIATEC-PP-01-05-04`):

- **Approval Program SHA256**: `de7c5805c1cfefd1dea0f11f9f56191a7b7c795d396917085b941c844c126f11`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

**FakePool.algo.ts**:

- **Approval Program SHA256**: `b303c1c803a3a56e7c04a6246861110f3ec38c7c28fabe1602d01a9b69feb1a7`
- **Clear Program SHA256**: `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`

---

## Executive Summary

This audit evaluated the BiatecCLAMM smart contract suite (`BIATEC-CLAMM-01-06-08`, `BIATEC-CONFIG-01-02-01`, `BIATEC-IDENT-01-03-02`, `BIATEC-PP-01-05-04`) and its TypeScript SDK, with focused mathematical and runtime verification of **fee collection** and **multi-party liquidity aggregation across different points in time**.

### Investigation of the Reported "Fee Loss" / Multi-Party Aggregation Concern

1. **Historical Context (Resolved in `01-06-05`–`01-06-08`)**:
   - In legacy versions (`BIATEC-CLAMM-01-06-04` and earlier), `processAddLiquidity` used a single-sided quadratic approximation to discount minted LP tokens when `LiquidityUsersFromFees > 0` and failed to book the unminted liquidity difference (`liquidityDelta - lpDeltaBase`) into `LiquidityUsersFromFees` (`Lu`). That defect caused unminted fee-dilution liquidity to become orphaned (owned by neither LP holders nor Biatec).
2. **Current Implementation (`BIATEC-CLAMM-01-06-08`)**:
   - In `contracts/BiatecClammPool.algo.ts` (`processAddLiquidity`, lines 433–453), a depositor adding `liquidityDelta` ($\Delta L$) to a pool with circulating LP tokens $D$ (`distributedBefore`) and accrued user fee liquidity $L_u$ (`LiquidityUsersFromFees`) receives:
     $$X_{\text{base}} = \left\lfloor \frac{\Delta L \cdot D}{D + L_u} \right\rfloor, \quad \text{lpTokensToSend} = \left\lfloor \frac{X_{\text{base}}}{1000} \right\rfloor$$
     and the fee-dilution offset $\Delta L - X_{\text{base}}$ is credited directly to `LiquidityUsersFromFees` ($L_u' = L_u + \Delta L - X_{\text{base}}$).
   - **Mathematical & On-Chain Proof**:
     - **Zero Pre-Existing Fee Scooping**: If Party B deposits $\Delta L_B$ at $t_2$ after Party A has earned fees $L_{u,1}$, Party B's immediate withdrawal claim is $\le \Delta L_B$ (trailing by at most 1 micro-LP of flooring in favor of the pool). Party B cannot extract a single base unit of $L_{u,1}$.
     - **Zero Incumbent Fee Loss & Automatic Compounding**: Party A retains 100% of their initial liquidity $D_A$ plus 100% of $L_{u,1}$. When subsequent swaps occur at $t_3 > t_2$, new user fees $\Delta L_{u,2}$ are automatically split in exact proportion to each party's active liquidity at $t_2$: $(D_A + L_{u,1}) : \Delta L_B$.
     - **Zero Swap Fee Leakage**: In both `swap()` and `distributeExcessAssets()`, `biatecLiquidityFromFeeIncrement` is computed as `diff - usersLiquidityFromFeeIncrement`, guaranteeing $\Delta L_u + \Delta L_b = \text{diff}$ with zero rounding loss.
     - **Order-Independent Withdrawals**: Whether Party A withdraws before Party B or Party B withdraws before Party A, both parties receive identical payouts (within $\le 2$ atomic asset units of integer division flooring) and Biatec's protocol fee (`LiquidityBiatecFromFees`) remains completely isolated.

### Summary of Findings

No **Critical** or **High** severity vulnerabilities were identified in the current contracts. Two **Medium**, three **Low**, and two **Informational** findings were identified:

| Severity          | Count | IDs & Titles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :---------------- | :---: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Critical**      |   0   | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **High**          |   0   | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Medium**        |   2   | **[M-01]** Out-of-ratio `addLiquidity` followed by `removeLiquidity` executes a synthetic curve rebalance without charging swap fees (foregone fee revenue)<br/>**[M-02]** Potential `uint256` underflow in `payOutLiquidity` on 100% final redemption when downward curve rounding makes `Liquidity < D + Lu + Lb` (`unowned < 0`)                                                                                                                                                               |
| **Low**           |   3   | **[L-01]** `clammAddLiquiditySender` initializes `optinSender = true`, prepending a redundant LP opt-in transaction on every deposit<br/>**[L-02]** `BiatecClammPool.status()` casts `uint256` liquidity and balance fields to `uint64`, which traps on pools exceeding $1.844 \times 10^{19}$ base units<br/>**[L-03]** `payOutLiquidity` deducts base-scale `aToSend`/`bToSend` rather than transferred `aToSend64 * scaleA`, shifting sub-asset-unit remainders into untracked excess holdings |
| **Informational** |   2   | **[I-01]** Pause matrix differences across admin methods (`reconcileLiquidity`, `sendOnlineKeyRegistration`, `loadCLAMMContractData`) and duplicate-txid risk in `clammDistributeExcessAssetsTxs`<br/>**[I-02]** Stale quadratic LP-minting note in `.github/copilot-instructions.md` and legacy tuple layout in `src/biatecPools/parseStats.ts`                                                                                                                                                  |

---

## Scope and Methodology

### Audit Scope & Coverage Matrix

| Component                | File(s)                                                                       | Lines | Coverage Status       | Verification Method                                        |
| :----------------------- | :---------------------------------------------------------------------------- | :---: | :-------------------- | :--------------------------------------------------------- |
| Core CLAMM Pool Contract | `contracts/BiatecClammPool.algo.ts`                                           | 1,138 | ✅ Fully Reviewed     | Static analysis, algebraic proof, full LocalNet Jest suite |
| Configuration Provider   | `contracts/BiatecConfigProvider.algo.ts`                                      |  228  | ✅ Fully Reviewed     | Static analysis, LocalNet integration tests                |
| Identity Provider        | `contracts/BiatecIdentityProvider.algo.ts`                                    |  428  | ✅ Fully Reviewed     | Static analysis, `BiatecIdentity.test.ts` & pool tests     |
| Pool Provider & Oracle   | `contracts/BiatecPoolProvider.algo.ts`                                        |  773  | ✅ Fully Reviewed     | Static analysis, deployment, stats & ring-buffer tests     |
| Test Harness Contract    | `contracts/FakePool.algo.ts`                                                  |  14   | ✅ Fully Reviewed     | Static analysis, `deployment.test.ts`                      |
| Tx Builders & Senders    | `src/biatecClamm/txs/*.ts`, `src/biatecClamm/sender/*.ts`                     |  812  | ✅ Fully Reviewed     | Static analysis, LocalNet end-to-end tests                 |
| Common & Box Utilities   | `src/common/*.ts`, `src/biatecPools/*.ts`, `src/boxes/*.ts`, `src/ticks/*.ts` | 2,410 | ✅ Fully Reviewed     | Static analysis, unit & integration tests                  |
| Operational CLI Scripts  | `src/bin/*.ts`                                                                | 2,371 | ⚠️ Static Review Only | Static review (live multisig/MainNet scripts not executed) |
| Documentation            | `README.md`, `docusaurus/docs/*.md`, `.github/copilot-instructions.md`        |   —   | ✅ Fully Reviewed     | Cross-checked against contract implementation              |

### Full Test Suite Execution (Mandatory Gate)

Algorand LocalNet was started and verified healthy (`algokit_sandbox_algod`, `algokit_sandbox_indexer`, `algokit_sandbox_postgres`, `algokit_sandbox_conduit`), and the full build and test suite was executed fresh against commit `9f525507b26d3fb03197d4989574cc697039d503`:

1. **Baseline Full Build + Test Suite**:
   - **Command**: `npm run test` (`npm run build && jest`)
   - **Result**:
     ```text
     Test Suites: 34 passed, 34 total
     Tests:       155 passed, 155 total
     Snapshots:   0 total
     Time:        121.384 s
     Ran all test suites.
     ```
2. **New Multi-Party Fee & Liquidity Aggregation Test Suite**:
   - Added `__test__/pool/multi-party-fee-aggregation.test.ts` covering 5 multi-user, multi-epoch fee and staking reward scenarios.
   - **Command**: `npx jest __test__/pool/multi-party-fee-aggregation.test.ts`
   - **Result**: `Test Suites: 1 passed, 1 total | Tests: 5 passed, 5 total | Time: 48.155 s`
3. **Final Full Build + Test Suite (Including New Tests)**:
   - **Command**: `npm run test`
   - **Result**:
     ```text
     Test Suites: 35 passed, 35 total
     Tests:       160 passed, 160 total
     Snapshots:   0 total
     Time:        118.039 s
     Ran all test suites.
     ```

---

## Mathematical Verification of Fee Collection & Multi-Party Liquidity Aggregation

### 1. Curve Invariant & Homogeneity

- **Flat-Price / Staking Pools** (`priceMin === priceMax === P`):
  $$L(x, y) = \left\lfloor \frac{x \cdot P}{s} \right\rfloor + y, \quad s = 10^9$$
- **Bounded-Price Concentrated Liquidity Pools** (`priceMin < priceMax`, $a = \lfloor\sqrt{P_{\min} \cdot s}\rfloor$, $b = \lfloor\sqrt{P_{\max} \cdot s}\rfloor$):
  $$\left(x + \frac{L \cdot s}{b}\right)\left(y + \frac{L \cdot a}{s}\right) = L^2$$
  In real arithmetic, $L(x, y)$ is positive homogeneous of degree 1 ($L(\lambda x, \lambda y) = \lambda L(x, y)$ for $\lambda > 0$) and concave ($L(x_1 + x_2, y_1 + y_2) \ge L(x_1, y_1) + L(x_2, y_2)$, with equality when $(x_2, y_2)$ is proportional to $(x_1, y_1)$).

### 2. Multi-Party Fee Conservation & Non-Dilution Proof

Let $D_A$ be Party A's circulating LP tokens (in 9-decimal base scale) after depositing at $t_0$, and let $F_1 = L_{u,1} > 0$ be the user fee liquidity accrued from swaps during $[t_0, t_1]$. At $t_1$, Party A owns $D_A + F_1$ of user liquidity.

When Party B adds $\Delta L_B = L_{\text{new}} - L_{\text{old}}$ at $t_2$:

1. **Discounted LP Minting**:
   $$X_{\text{base}} = \left\lfloor \frac{\Delta L_B \cdot D_A}{D_A + F_1} \right\rfloor, \quad D_B = \left\lfloor \frac{X_{\text{base}}}{1000} \right\rfloor \times 1000 = X_{\text{base}} - r_B \quad (0 \le r_B < 1000)$$
2. **Fee Pool Adjustment**:
   $$L_{u,2} = F_1 + (\Delta L_B - X_{\text{base}})$$
3. **Total User Liquidity Conservation**:
   $$D_{\text{total}} + L_{u,2} = (D_A + X_{\text{base}} - r_B) + (F_1 + \Delta L_B - X_{\text{base}}) = D_A + F_1 + \Delta L_B - r_B$$
4. **Immediate Withdrawal Upper Bound for Party B**:
   $$\text{Claim}_B(t_2^+) = D_B + \left\lfloor \frac{L_{u,2} \cdot D_B}{D_A + D_B} \right\rfloor \le \left\lfloor \frac{(D_A + F_1 + \Delta L_B) \cdot X_{\text{base}}}{D_A + X_{\text{base}}} \right\rfloor \le \Delta L_B$$
5. **Incumbent Protection Lower Bound for Party A**:
   $$\text{Claim}_A(t_2^+) = (D_A + D_B + L_{u,2}) - \text{Claim}_B(t_2^+) \ge D_A + F_1$$
6. **Proportional Sharing of Subsequent Fees $F_2$ at $t_3 > t_2$**:
   Because $\frac{D_A}{D_A + D_B} = \frac{D_A + F_1}{D_A + F_1 + \Delta L_B}$ and $\frac{D_B}{D_A + D_B} = \frac{\Delta L_B}{D_A + F_1 + \Delta L_B}$ (up to $r_B < 10^{-6}\text{ LP}$), any subsequent fee increment $F_2$ added to $L_u$ is split between Party A and Party B in exact proportion to their active liquidity $(D_A + F_1) : \Delta L_B$.

---

## Findings

### Critical Severity Issues

None identified.

---

### High Severity Issues

None identified.

---

### Medium Severity Issues

#### [M-01] Out-of-Ratio `addLiquidity` Followed by `removeLiquidity` Executes a Synthetic Curve Rebalance Without Charging Swap Fees

**Severity**: Medium (Economic / Foregone Fee Revenue — does not reduce existing pool liquidity $L$ or steal accrued fees $L_u, L_b$, but allows bypassing swap fees on trades)
**Status**: Open
**Confidence**: Static evidence & mathematical proof
**Component**: `BiatecClammPool`
**Location**: `contracts/BiatecClammPool.algo.ts`, `addLiquidity()` (lines 332–411) and `payOutLiquidity()` (lines 476–490)

**Invariant**:
Any user interaction that exchanges Asset A for Asset B against the pool's reserves and alters the pool's reserve ratio $x / y$ and spot price $P$ should pay the pool's configured swap fee (`fee`) and protocol fee share (`biatecFee`).

**Evidence**:
In `BiatecClammPool.addLiquidity()` (lines 332–355), the deposit ratio enforcement logic (lines 356–410) is commented out, allowing a depositor to supply any combination $(\Delta x, \Delta y)$ into an existing pool with reserves $(x_1, y_1)$ and liquidity $L_1 = L(x_1, y_1)$.

1. When a caller deposits $(\Delta x, \Delta y)$ out of ratio ($\frac{\Delta x}{\Delta y} \ne \frac{x_1}{y_1}$), the pool reserves become $(x_2, y_2) = (x_1 + \Delta x, y_1 + \Delta y)$ and liquidity becomes $L_2 = L(x_2, y_2)$, crediting the caller with $\Delta L = L_2 - L_1$ of liquidity.
2. If the caller immediately invokes `removeLiquidity` for their minted LP tokens, `payOutLiquidity` returns the fraction $\frac{\Delta L}{L_2}$ of $(x_2, y_2)$ to the caller and leaves the pool with:
   $$x_1' = \frac{L_1}{L_2}(x_1 + \Delta x), \quad y_1' = \frac{L_1}{L_2}(y_1 + \Delta y)$$
3. By degree-1 homogeneity of the concentrated liquidity invariant $L(\cdot, \cdot)$:
   $$L(x_1', y_1') = \frac{L_1}{L_2} L(x_2, y_2) = L_1 = L(x_1, y_1)$$
4. Thus, $(x_1', y_1')$ lies on the **exact same constant-liquidity curve $L(x, y) = L_1$** as $(x_1, y_1)$. The caller has net-deposited $\Delta y_{\text{eff}} = y_1' - y_1$ and net-received $\Delta x_{\text{eff}} = x_1 - x_1'$ (the exact zero-fee swap output along $L = L_1$) without paying `this.fee` or `biatecFee` and without triggering `registerTrade`.

**Prerequisites and Impact**:

- Requires a non-empty pool (`assetA !== assetB`) where the caller passes identity verification (`verifyIdentity`) and holds sufficient capital to execute an `addLiquidity` + `removeLiquidity` pair.
- **What is NOT affected**: Incumbent LPs' liquidity $L_1$, pre-existing user fees $L_u$, and protocol fees $L_b$ are **never reduced** ($L(x_1', y_1') = L_1$).
- **What IS affected**: The pool and protocol forego the swap fee (`fee` and `biatecFee`) that would otherwise have been earned on the trade from $(x_1, y_1)$ to $(x_1', y_1')$, and the trade is not logged in `BiatecPoolProvider` volume statistics.

**Recommendation**:
When `this.Liquidity.value > 0` and `(this.assetABalanceBaseScale.value > 0 || this.assetBBalanceBaseScale.value > 0)`:

1. Enforce proportional deposits matching the current reserve ratio $(x : y)$ (returning any excess deposit or rejecting out-of-ratio deposits beyond a small rounding tolerance), **or**
2. Deduct the pool's swap fee rate on the imbalanced portion of the deposit so that single-sided/unbalanced liquidity additions accrue the equivalent swap fee into `LiquidityUsersFromFees` and `LiquidityBiatecFromFees`.

**Defensive Acceptance Criteria**:

- Any sequence of `addLiquidity` followed by immediate `removeLiquidity` that shifts the pool's reserve ratio $(x:y)$ must either be rejected as out-of-ratio or leave the pool with strictly greater liquidity $L_{\text{after}} > L_{\text{before}}$ commensurate with the swap fee on the net asset exchange.

**Limitations**:

- Fixing this changes the current intentional design choice ("allow user to deposit any combination of asset A and asset B" on line 356) and should be coordinated with front-end deposit flows.

---

#### [M-02] Potential `uint256` Underflow in `payOutLiquidity` on 100% Final Redemption When Downward Curve Rounding Makes `Liquidity < D + Lu + Lb` (`unowned < 0`)

**Severity**: Medium (Availability of 100% final-unit withdrawal when `unowned < 0`)
**Status**: Open
**Confidence**: Static evidence & mainnet state data (`docusaurus/docs/live-pool-reconciliation.md`)
**Component**: `BiatecClammPool`
**Location**: `contracts/BiatecClammPool.algo.ts`, `payOutLiquidity()` (lines 476–490), `removeLiquidity()` (lines 458–470), and `removeLiquidityAdmin()` (lines 502–530)

**Invariant**:
Holders of all remaining circulating LP tokens $D$ and the protocol fee executor holding $L_b$ must always be able to redeem their full balance (`lpToSend = lpHeld` or `removeLiquidityAdmin(amount = 0)`) without arithmetic underflow, even if cumulative integer floor truncations in `calculateCurrentLiquidity()` cause `this.Liquidity.value` to trail $D + L_u + L_b$ by a few base units (`unowned < 0`).

**Evidence**:

1. In `payOutLiquidity` (lines 476–490):
   ```ts
   const aToSend = this.calculateAssetAWithdrawOnLpDeposit(lpDeltaWithFees, this.assetABalanceBaseScale.value, this.Liquidity.value);
   ...
   this.assetABalanceBaseScale.value = this.assetABalanceBaseScale.value - aToSend;
   this.assetBBalanceBaseScale.value = this.assetBBalanceBaseScale.value - bToSend;
   this.setCurrentLiquidity();
   ```
   where `calculateAssetAWithdrawOnLpDeposit` computes `(assetABalance * lpDeltaWithFees) / liquidity`.
2. Notice that `payOutLiquidity` calls `this.setCurrentLiquidity()` (which writes the raw `calculateCurrentLiquidity()`), whereas `addLiquidity`, `swap`, and `distributeExcessAssets` call `this.setCurrentLiquidityNonDecreasing(oldLiquidity)`.
3. Because `calculateLiquidityD` and `calculateLiquidityWithD` perform multiple integer floor divisions, `calculateCurrentLiquidity(x', y')` after a partial withdrawal (or after a swap where `setCurrentLiquidityNonDecreasing` previously clamped a small rounding drop within `getLiquidityRoundingAllowance()`) can be a few base units smaller than $L - \Delta L_{\text{withdrawn}}$.
4. As documented in `docusaurus/docs/live-pool-reconciliation.md` (mainnet survey of 46 pools), `unowned = Liquidity - distributedLp - LiquidityUsersFromFees - LiquidityBiatecFromFees` reaches negative values down to `-2,238` base units on live pools. Calling `reconcileLiquidity()` also resets `unowned = 0`, removing any positive dust buffer before subsequent partial withdrawals.
5. When `unowned < 0` (i.e., `Liquidity < D + Lu + Lb`), the last participant to redeem 100% of their remaining claim (`removeLiquidity` with all remaining $D$ after $L_b$ was withdrawn, or `removeLiquidityAdmin(amount = 0)` after all $D$ was withdrawn) has `lpDeltaWithFees > this.Liquidity.value`.
6. When `lpDeltaWithFees > this.Liquidity.value`, `aToSend = (assetABalanceBaseScale * lpDeltaWithFees) / Liquidity > assetABalanceBaseScale`, causing `this.assetABalanceBaseScale.value - aToSend` on line 486 to **underflow `uint256` and revert the transaction**.

**Prerequisites and Impact**:

- Occurs only when a pool has `unowned < 0` (`Liquidity < D + Lu + Lb`) AND the very last withdrawer attempts to redeem 100% of the remaining claim in full (`lpDeltaWithFees > Liquidity`).
- **Operational Workaround (No Contract Upgrade Required)**:
  - For an LP holder: redeeming `lpHeld - 1` micro-LP (or leaving $\lceil |\text{unowned}| / 1000 \rceil$ micro-LP, worth $< 0.003$ LP units) keeps `lpDeltaWithFees <= Liquidity` and succeeds.
  - For `removeLiquidityAdmin`: passing `amount = min(LiquidityBiatecFromFees, Liquidity)` instead of `amount = 0` succeeds and withdraws 100% of the pool's remaining tracked reserves.

**Recommendation**:

1. **On-Chain (`BiatecClammPool.algo.ts` — `payOutLiquidity`)**: Clamp `lpDeltaWithFees` to `this.Liquidity.value` before computing `aToSend` and `bToSend`:
   ```ts
   const effectiveLpDelta = lpDeltaWithFees > this.Liquidity.value ? this.Liquidity.value : lpDeltaWithFees;
   ```
2. **Off-Chain (`src/common/calculateFeeWithdrawal.ts` and `src/bin/clamm-pool-withdraw-biatec-fees-to-all-pools.ts`)**: When `liquidityBiatecFromFees > liquidity`, pass `amount = liquidity` (instead of `0n`) to `removeLiquidityAdmin` and clamp `effectiveLb = liquidityBiatecFromFees > liquidity ? liquidity : liquidityBiatecFromFees` in `calculateFeeWithdrawal`.

**Defensive Acceptance Criteria**:

- On a pool where `D + Lu + Lb > Liquidity` by up to `getLiquidityRoundingAllowance()`, sequential 100% redemptions by all LP holders (`removeLiquidity`) and the fee executor (`removeLiquidityAdmin(amount = 0)`) must complete without `uint256` underflow and reduce `assetABalanceBaseScale` and `assetBBalanceBaseScale` cleanly to `0`.

**Limitations**:

- Only affects the final 100% dust-emptying withdrawal when `unowned < 0`; normal partial withdrawals where `lpDeltaWithFees <= Liquidity` are unaffected.

---

### Low Severity Issues

#### [L-01] `clammAddLiquiditySender` Always Sets `optinSender = true`, Prepending a Redundant LP Opt-In Transaction on Every Deposit

**Severity**: Low (Unnecessary transaction fee and group slot usage)
**Status**: Open
**Confidence**: Static evidence & runtime observation
**Component**: TypeScript SDK (`src/biatecClamm/sender/clammAddLiquiditySender.ts`)
**Location**: `src/biatecClamm/sender/clammAddLiquiditySender.ts`, lines 31–35

**Invariant**:
`clammAddLiquiditySender` should only include an LP token opt-in transaction (`txOptin`) when the sender account is not already opted into `input.assetLp`.

**Evidence**:
In `src/biatecClamm/sender/clammAddLiquiditySender.ts` (lines 31–35):

```ts
let optinSender: boolean = true;
const acocunt = await input.algod.accountInformation(input.account.addr.toString()).do();
if (!acocunt.assets?.find((a) => a.assetId === input.assetLp)) {
  optinSender = true;
}
```

Because `optinSender` is initialized to `true` and never set to `false`, `optinSender` is unconditionally `true` on every call. Every call to `clammAddLiquiditySender` therefore prepends a 0-amount self-transfer of `assetLp`, costing an extra 1,000 µAlgo network fee and consuming an extra transaction slot in the atomic group even when the user is already opted in.

**Recommendation**:
Initialize `let optinSender = false;` before the `if (!acocunt.assets?.find(...))` check:

```ts
const accountInfo = await input.algod.accountInformation(input.account.addr.toString()).do();
const optinSender = !accountInfo.assets?.some((a) => BigInt(a.assetId) === input.assetLp);
```

---

#### [L-02] `BiatecClammPool.status()` Casts `uint256` Balances and Liquidity Values to `uint64` Without Saturation

**Severity**: Low (Read-only `status()` method reverts on high-supply token pools)
**Status**: Open
**Confidence**: Static evidence
**Component**: `BiatecClammPool`
**Location**: `contracts/BiatecClammPool.algo.ts`, `status()` (lines 1114–1136)

**Invariant**:
Read-only status queries and operational scripts should not revert when a pool holds legitimate balances supported by the contract's `uint256` state variables.

**Evidence**:
`BiatecClammPool` stores `assetABalanceBaseScale`, `assetBBalanceBaseScale`, `Liquidity`, `LiquidityUsersFromFees`, and `LiquidityBiatecFromFees` as `uint256` in 9-decimal base scale, allowing pools to hold tokens with large total supplies. However, `status()` casts these values to `uint64` (`this.assetABalanceBaseScale.value as uint64`, `this.Liquidity.value as uint64`, etc.). In 9-decimal base scale, `uint64.max` ($18,446,744,073,709,551,615$) equals $\approx 1.844 \times 10^{10}$ whole tokens. If a pool holds more than $18.44\text{ billion}$ whole units of an asset (common for meme/governance tokens with $10^{11}$–$10^{12}$ supply), `status()` traps in TEAL on the `uint64` cast. Notably, `src/bin/clamm-pool-distribute-staking-to-all-pools.ts` calls `poolClient.status()` rather than reading `poolClient.state.global.getAll()`.

**Recommendation**:
Update `src/bin/clamm-pool-distribute-staking-to-all-pools.ts` (and any other off-chain scripts) to read `poolClient.state.global.getAll()` directly (as `clamm-pool-withdraw-biatec-fees-to-all-pools.ts` and `clamm-pool-reconcile-liquidity-to-all-pools.ts` already do), where `uint256` state keys are decoded as arbitrary-precision `bigint`.

---

#### [L-03] `payOutLiquidity` Deducts Full Base-Scale `aToSend`/`bToSend` Rather Than Transferred `aToSend64 * scale`, Shifting Sub-Unit Truncation Into Untracked Excess Balance

**Severity**: Low (Minor accounting drift of $< 1$ atomic asset unit per withdrawal into untracked excess holdings)
**Status**: Open
**Confidence**: Static evidence & runtime observation (`__test__/pool/multi-party-fee-aggregation.test.ts` Test 5)
**Component**: `BiatecClammPool`
**Location**: `contracts/BiatecClammPool.algo.ts`, `payOutLiquidity()` (lines 476–490)

**Invariant**:
`assetABalanceBaseScale` and `assetBBalanceBaseScale` should track the base-scale value of reserves actively backing the pool curve, decremented only by the base-scale equivalent of the atomic asset units actually transferred out of the pool.

**Evidence**:
In `swap()` (lines 618–633), the contract converts `toSwap` to asset decimals (`realSwapBDecimals`) and sets `realSwapBaseDecimals = realSwapBDecimals * scaleB` before subtracting from `assetBBalanceBaseScale`, keeping `assetBBalanceBaseScale` an exact multiple of `scaleB` and retaining the sub-unit truncation inside active curve liquidity.
In `payOutLiquidity()` (lines 476–488), however:

```ts
const aToSend = this.calculateAssetAWithdrawOnLpDeposit(lpDeltaWithFees, this.assetABalanceBaseScale.value, this.Liquidity.value);
const aToSend64 = (aToSend / this.assetADecimalsScaleFromBase.value) as uint64;
...
this.assetABalanceBaseScale.value = this.assetABalanceBaseScale.value - aToSend;
```

The contract transfers `aToSend64` (worth `aToSend64 * scaleA` base units), but subtracts the unrounded `aToSend` from `assetABalanceBaseScale`. The remainder `aToSend % scaleA` ($< 1$ atomic unit of Asset A) remains physically in the contract account (`realABalance`), but is removed from `assetABalanceBaseScale` (becoming untracked excess balance until `distributeExcessAssets(1, 1)` is called).

**Recommendation**:
Subtract `(aToSend64 as uint256) * this.assetADecimalsScaleFromBase.value` and `(bToSend64 as uint256) * this.assetBDecimalsScaleFromBase.value` in `payOutLiquidity` (matching `swap()`), so sub-unit withdrawal truncation remains in active pool reserves automatically.

---

### Informational Issues

#### [I-01] Pause Matrix Differences Across Admin Methods and Duplicate Transaction ID Risk in `clammDistributeExcessAssetsTxs`

**Severity**: Informational
**Status**: Open / Policy Clarification
**Component**: `BiatecClammPool`, `BiatecConfigProvider`, `BiatecPoolProvider`, and `src/biatecClamm/txs/clammDistributeExcessAssetsTxs.ts`
**Location**:

- `contracts/BiatecClammPool.algo.ts`: `reconcileLiquidity()` (line 535), `sendOnlineKeyRegistration()` (line 849)
- `contracts/BiatecPoolProvider.algo.ts`: `loadCLAMMContractData()` (line 253)
- `contracts/BiatecConfigProvider.algo.ts`: `sendOnlineKeyRegistration()` (line 187), `withdrawExcessAssets()` (line 202)
- `src/biatecClamm/txs/clammDistributeExcessAssetsTxs.ts` (lines 22–38)

**Description**:

1. **Pause Matrix**: Most user and admin methods check `appBiatecConfigProvider.globalState('s') === 0` (`E_PAUSED` / `ERR_PAUSED`). However, `BiatecClammPool.reconcileLiquidity`, `BiatecClammPool.sendOnlineKeyRegistration`, `BiatecPoolProvider.loadCLAMMContractData`, and `BiatecConfigProvider.withdrawExcessAssets` do not assert `paused === 0`. Note that `reconcileLiquidity` and `loadCLAMMContractData` being callable while `s === 1` is **required** by the maintenance runbook in `docusaurus/docs/live-pool-reconciliation.md` (Steps 2–5: pause protocol, upgrade pools, run `reconcileLiquidity`, then unpause).
2. **Duplicate TxID on Repeated `clammDistributeExcessAssetsTxs` Calls**: `clammDistributeExcessAssetsTxs` does not accept an optional `note` field. If an operator script calls `clammDistributeExcessAssetsSender` twice for the same pool with `amountA: 1n, amountB: 1n` within the same `firstValid`/`lastValid` round window (e.g. on LocalNet or fast blocks), Algod rejects the second call with `TransactionPool.Remember: transaction already in ledger`.

**Recommendation**:

1. Document the explicit Pause Matrix in `docusaurus/docs/error-codes.md` so operators know which maintenance methods remain active during a pause.
2. Add an optional `note?: Uint8Array` parameter to `clammDistributeExcessAssetsTxs` / `clammDistributeExcessAssetsSender`.

---

#### [I-02] Stale Quadratic LP-Minting Description in `.github/copilot-instructions.md` and Tuple Drift in `src/biatecPools/parseStats.ts`

**Severity**: Informational
**Status**: Open
**Component**: Developer Documentation & Legacy Parser
**Location**: `.github/copilot-instructions.md` (line 11) and `src/biatecPools/parseStats.ts` (lines 1–195)

**Description**:

1. `.github/copilot-instructions.md` line 11 still states: _"LP Minting vs Fees: `processAddLiquidity` solves the quadratic that discounts historic `LiquidityUsersFromFees` and floors the positive root before minting LP tokens."_ In `BIATEC-CLAMM-01-06-05+`, the quadratic formula was replaced by the exact linear pro-rata formula `lpDeltaBase = (liquidityDelta * distributedBefore) / (distributedBefore + usersFeeLiquidity)`.
2. `src/biatecPools/parseStats.ts` expects a 54-element array including `isVerified`, `period5*`, and `period6*`, whereas `BiatecPoolProvider.algo.ts`'s `AppPoolInfo` struct has 38 fields (periods 1–4, no `isVerified`). Generated clients (`BiatecPoolProviderClient.getPrice` / `getCurrentStatus`) decode the ARC-4 struct accurately and should be preferred over `parseStats`.

**Recommendation**:
Update `.github/copilot-instructions.md` to reference `lpDeltaBase = (liquidityDelta * distributedBefore) / (distributedBefore + usersFeeLiquidity)` and deprecate or align `src/biatecPools/parseStats.ts` with `AppPoolInfo`.

---

## Missing Test Scenarios (Identified & Resolved During Audit)

### Newly Added & Verified Test Scenarios (`__test__/pool/multi-party-fee-aggregation.test.ts`)

During this audit, we identified that while single-LP fee flows (`__test__/pool/fees.test.ts`) and immediate newcomer deposit-and-exit (`__test__/pool/liquidity.test.ts`) were tested, multi-epoch multi-party fee sharing and withdrawal-order independence were not covered by dedicated tests. We authored and executed `__test__/pool/multi-party-fee-aggregation.test.ts` (5 comprehensive tests, all passing on LocalNet):

1. **Two LPs Joining at Different Times Across Two Swap Epochs (`Test 1`)**:
   - Verifies that Alice (joining at $t_0$) earns 100% of Epoch 1 swap fees ($t_1$), Bob (joining at $t_2$) receives discounted LP tokens $D_B = \lfloor \frac{\Delta L_B \cdot D_A}{D_A + L_{u,1}} \rfloor$, and Epoch 2 swap fees ($t_3$) are distributed in exact proportion to active liquidity $(D_A + L_{u,1}) : \Delta L_B$.
2. **Withdrawal Order Independence & Protocol Fee Isolation (`Test 2`)**:
   - Runs twin pools with `lpFee = 5%`, `biatecFee = 20%` where Alice withdraws before Bob in Pool 1 and Bob withdraws before Alice in Pool 2, confirming identical payouts ($\le 2$ atomic units difference) and 100% preservation of `LiquidityBiatecFromFees`.
3. **Three LPs (Alice, Bob, Charlie) Across Three Fee Epochs with Partial & Full Withdrawals (`Test 3`)**:
   - Verifies the conservation invariant $|L - (D + L_u + L_b)| \le k \cdot 1000$ across deposits by three independent users, partial (50%) withdrawal by Alice, subsequent swaps, and full redemptions.
4. **Multi-Party Staking / Excess-Asset Reward Distribution (`Test 4`)**:
   - Verifies that `distributeExcessAssets` rewards earned before Bob stakes belong 100% to Alice (and Biatec's protocol share), while subsequent reward distributions are shared in proportion to compounded stake $(D_A + L_{u,1}) : \Delta L_B$.
5. **Rapid 5x Join/Exit Cycling by a Second Party (`Test 5`)**:
   - Verifies that repeated in-ratio `addLiquidity` + `removeLiquidity` cycling by a second account never profits the cycler in either asset and never decreases the incumbent LP's entitlement or the pool's physical asset holdings.

### Remaining Recommended Test Scenarios

1. **Test Scenario**: Final 100% redemption when `unowned < 0` (`Liquidity < D + Lu + Lb`)
   - **Risk Level**: Medium (`[M-02]`)
   - **Current Coverage**: Partial (`reconcile-liquidity.test.ts` tests single-LP redemption when `unowned == 0`)
   - **Recommendation**: Add a regression test exercising sequential multi-LP + admin 100% redemptions when `calculateCurrentLiquidity` rounds down after a partial withdrawal once `[M-02]` is patched.

---

## Documentation Gaps (Identified & Resolved During Audit)

### Newly Created Documentation

To ensure complete transparency and mathematical certainty regarding fee collection and multi-party liquidity aggregation, the following documentation was created and integrated into Docusaurus during this audit:

1. **`docusaurus/docs/multi-party-fee-aggregation.md`** (_Multi-Party Liquidity Aggregation & Fee Fairness Proof_):
   - Formal definitions of $L, D, L_u, L_b$ and the conservation invariant $L = D + L_u + L_b + U$.
   - Step-by-step proofs of **Theorem 1** (No Fee Scooping by Late Joiners), **Theorem 2** (100% Incumbent Principal & Fee Preservation), automatic fee compounding across epochs, and withdrawal order independence.
   - Complete numerical walkthrough with exact base-scale figures and Mermaid sequence diagram.
   - Mapping of all on-chain Jest verification suites and commands to run them locally.
2. **Cross-Links Added**:
   - Linked in `docusaurus/docs/intro.md` and `docusaurus/docs/liquidity-fee-protection.md`.

---

## Security Best Practices

### Current Implementation vs. Best Practices

| Practice                    | Status | Notes                                                                                                                                                                                 |
| :-------------------------- | :----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Input validation            |   ✅   | Asset IDs, transaction types, receivers, price bounds, and verification classes are validated in every entry point.                                                                   |
| Access control              |   ✅   | Role separation (`addressUdpater`, `addressExecutive`, `addressExecutiveFee`, `engagementSetter`) enforced across Config, Identity, Pool Provider, and Pool contracts.                |
| Reentrancy protection       |   ✅   | AVM atomic group model + inner transactions only call trusted Config/Identity/PoolProvider contracts (or `addressExecutiveFee`-authorized `doAppCall` with post-call balance checks). |
| Integer overflow/underflow  |   ⚠️   | `uint256` used for all intermediate curve and fee math; see `[M-02]` for potential underflow on final withdrawal if `unowned < 0` and `[L-02]` for `uint64` casts in `status()`.      |
| Error handling              |   ✅   | Concise, deterministic assertion codes (`E_CONFIG`, `ERR-LOW-VER`, `LP-ZERO-ERR`, `ERR-LIQ-DROP`, `E_A_B`, etc.).                                                                     |
| Rounding & precision safety |   ✅   | `LP-ZERO-ERR` prevents sub-micro-LP minting; `swap` steps down non-integer output by 1 unit; `setCurrentLiquidityNonDecreasing` maintains monotonic $L$.                              |
| Event & stats logging       |   ✅   | `BiatecPoolProvider.registerTrade` logs ARC-28 `tradeEvent` and updates 4 rolling VWAP/volume/fee periods per pool and per asset pair.                                                |
| Code documentation          |   ✅   | Comprehensive Docusaurus documentation covering fee protection, multi-party aggregation proofs, rounding, reconciliation, and staking pools.                                          |
| Test coverage               |   ✅   | 35 test suites (160 tests) passing against live Algorand LocalNet, including full 242-op MainNet pool replay and multi-party fee aggregation suites.                                  |

Legend: ✅ Implemented | ⚠️ Partially Implemented | ❌ Not Implemented

---

## Risk Assessment

### Overall Risk Rating

**Risk Level**: **Low** (with two Medium edge-case recommendations `[M-01]` and `[M-02]`)

### Risk Breakdown

| Category                | Risk Level | Description                                                                                                                                                                                                                                             |
| :---------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Smart Contract Security | Low        | Access controls, initialization guards (`setupFinished`, `priceMax === 0`), and physical balance backing checks (`ensurePoolBalancesWithinHoldings`) are sound.                                                                                         |
| Economic & Fee Model    | Low–Medium | Pre-existing fees ($L_u, L_b$) and incumbent principal ($D$) are strictly protected against dilution and scooping when multiple LPs join at different times. Out-of-ratio deposit + withdrawal (`[M-01]`) can bypass swap fees on synthetic rebalances. |
| Access Control          | Low        | Privileged roles are properly gated via `BiatecConfigProvider` state reads and verified against `this.appBiatecConfigProvider.value`.                                                                                                                   |
| Data Integrity          | Low        | `L == D + Lu + Lb + U` invariant holds across swaps, deposits, reward distributions, and withdrawals; `[M-02]` recommends clamping `lpDeltaWithFees <= Liquidity` in `payOutLiquidity`.                                                                 |
| User Safety             | Low        | Identity verification, pause switch (`s`), minimum swap output (`minimumToReceive`), and `LP-ZERO-ERR` protect users.                                                                                                                                   |

---

## Recommendations

### Priority 1 (Critical - Immediate Action Required)

None.

### Priority 2 (High - Short Term)

None.

### Priority 3 (Medium - Medium Term)

1. **Clamp `lpDeltaWithFees` to `this.Liquidity.value` in `payOutLiquidity` (`[M-02]`)**:
   - In `contracts/BiatecClammPool.algo.ts` (`payOutLiquidity`) and `src/common/calculateFeeWithdrawal.ts`, cap the withdrawal liquidity at `this.Liquidity.value` so that final 100% redemptions on pools with slightly negative `unowned` (`Liquidity < D + Lu + Lb`) never underflow `assetABalanceBaseScale - aToSend`.
2. **Evaluate Ratio Enforcement or Imbalance Fee in `addLiquidity` (`[M-01]`)**:
   - Decide whether non-empty pools should require proportional deposits or charge a swap fee on the unbalanced portion of a deposit to prevent zero-fee synthetic swaps via `addLiquidity` + `removeLiquidity`.

### Priority 4 (Low - Long Term)

1. **Fix `optinSender` initialization in `clammAddLiquiditySender.ts` (`[L-01]`)**:
   - Initialize `let optinSender = false;` so accounts already opted into `assetLp` do not pay for a redundant opt-in transaction on every deposit.
2. **Deduct `aToSend64 * scaleA` in `payOutLiquidity` (`[L-03]`)**:
   - Keep sub-asset-unit withdrawal rounding inside `assetABalanceBaseScale` / `assetBBalanceBaseScale` rather than shifting it to untracked excess holdings.
3. **Use `state.global.getAll()` instead of `status()` in CLI scripts (`[L-02]`) and update `.github/copilot-instructions.md` (`[I-02]`)**.

---

## Compliance and Standards

### Algorand Standards Compliance

- [x] **ARC-3**: Supported via asset creation helpers (`src/createArc3Files*.ts`).
- [x] **ARC-4**: Application Binary Interface routing and method signatures generated via TEALScript.
- [x] **ARC-28**: Structured `tradeEvent` emitted in `BiatecPoolProvider.registerTrade`.
- [x] **ARC-32 / ARC-56**: Application specifications generated in `contracts/artifacts/*.arc32.json` and `*.arc56.json`.

### General Security Standards

- [x] **DeFi Conservation Invariants**: Verified $L = D + L_u + L_b + U$ across single-user and multi-user lifecycles.
- [x] **Physical Backing Invariant**: Verified via `ensurePoolBalancesWithinHoldings` (including aggregate liability check for same-asset pools and `NATIVE_RESERVE_MICROALGO` reserve floor).

---

## Appendix

### A. Tools and Resources Used

- **TEALScript Compiler**: `@algorandfoundation/tealscript` `0.107.2`
- **Algorand LocalNet**: `algokit` LocalNet (`algod` `5.0.5`)
- **Test Framework**: Jest `29.7.0` + `ts-jest` `29.4.11` + `@algorandfoundation/algokit-utils` `^9.2.0`
- **Linter**: ESLint `8.57.1` (`eslint-config-airbnb-base`, `eslint-config-airbnb-typescript`, `eslint-plugin-prettier`)

### B. Glossary

- **Base Scale (`SCALE`)**: $10^9$ (`1_000_000_000`), the internal fixed-point precision used for prices, square roots, balances (`ab`, `bb`), and liquidity (`L`, `Lu`, `Lb`).
- **`D` (`distributedLp`)**: Circulating LP token supply outside the pool application account, scaled from 6 LP decimals to 9 base decimals ($\times 1000$).
- **`Lu` (`LiquidityUsersFromFees`)**: Pool liquidity earned from swap fees or distributed rewards that belongs pro rata to circulating LP token holders.
- **`Lb` (`LiquidityBiatecFromFees`)**: Pool liquidity earned from swap fees or distributed rewards that belongs to the Biatec protocol fee executor (`addressExecutiveFee`).
- **`unowned`**: $L - (D + L_u + L_b)$, the sub-micro-LP rounding dust remaining after deposits, which can be credited via `reconcileLiquidity`.

### C. Verification Notes / Limitations

- All 35 Jest test suites (160 tests) were executed fresh against an isolated Algorand LocalNet instance and passed.
- Operational scripts under `src/bin/` that interact with external MainNet endpoints and multisig env vars were reviewed statically and not executed against live networks.

### D. Contact Information

- **Auditor**: Gemini 4 Argon (GitHub Copilot)
- **Report Version**: 1.0
- **Last Updated**: 2026-11-02

---

## Disclaimer

This audit report represents a point-in-time security and mathematical assessment of the BiatecCLAMM repository at commit `9f525507b26d3fb03197d4989574cc697039d503`. While comprehensive static analysis, mathematical proofs, and on-chain LocalNet test suites were executed, no audit can guarantee the complete absence of vulnerabilities. Any subsequent modifications to smart contract sources, compiler versions, or deployment configurations require independent re-verification.

---

**End of Report**
