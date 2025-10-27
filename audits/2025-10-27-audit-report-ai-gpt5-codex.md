# AI Security Audit Report

## 1. Audit Metadata

**AI Model**: GPT-5-Codex
**Provider**: GitHub Copilot
**Audit Date**: 2025-10-28
**Commit Hash**: c6d66f3dc403037f5becf9dad705624c79547255
**Commit Date**: 2025-10-28 00:25:30+01:00

## 2. Executive Summary

- Detected a high-severity flaw in pool deployment flow: the pool provider does not enforce the canonical configuration app, enabling hostile pools with arbitrary identity/fee policies.
- General contract logic, fee accounting, and identity verification appear robust when the official configuration is used as intended.
- Recommend urgent patch to lock deployment to the registered config, followed by regression tests and documentation updates clarifying trusted deployment requirements.

## 3. Scope and Methodology

- Reviewed smart contracts: `contracts/BiatecClammPool.algo.ts`, `contracts/BiatecPoolProvider.algo.ts`, `contracts/BiatecConfigProvider.algo.ts`, `contracts/BiatecIdentityProvider.algo.ts`.
- Sampled TypeScript helpers in `src/biatecClamm/txs` and `src/biatecClamm/sender` for transaction composition and reference integrity.
- Examined Jest suites under `__test__/clamm` and `__test__/pool` for coverage of pool deployment, fee accounting, swaps, and staking flows.
- Executed `npm run test` (pass) to ensure baseline behaviours are intact on the audited commit.
- Manual static analysis focused on access control, config linkage, identity enforcement, and arithmetic safety.

## 4. Findings

### High Severity

#### [H-01] Pool deployment accepts untrusted configuration apps

**Status**: Open
**Location**: `contracts/BiatecPoolProvider.algo.ts:181-266`

**Description**: `BiatecPoolProvider.deployPool` accepts caller-provided `appBiatecConfigProvider` and forwards it directly to the newly created pool without verifying that it matches the provider's registered config (`this.appBiatecConfigProvider.value`). A malicious actor can deploy a fake config contract, set its `p` global state to the legit pool provider ID, and then call `deployPool` with that contract. The resulting pool stores and trusts the hostile config.

**Impact**:

- Identity enforcement is bypassed: the malicious config can point `i` to an attacker-controlled identity app that always returns high verification classes.
- Fee ownership is subverted: the attacker can set `ef` and `f` to arbitrary values, claiming the protocol fee share or forcing arithmetic underflows in fee splitting by setting `f > SCALE`.
- Users interacting with such a pool believe they are using a governed deployment but are exposed to counterfeit compliance and fee logic.

**Proof of Concept**:

1. Deploy a lightweight config app where `globalState['p']` equals the genuine pool provider ID, `globalState['i']` equals a trivial contract returning `verificationClass = 4`, and `globalState['f'] = SCALE`.
2. Invoke `deployPool` supplying this config. The call succeeds, new pool stores the forged config, and identity checks now reference the attacker's contract.
3. Swap or add liquidity through the new pool without any real KYC, or drain the protocol fee balance via `removeLiquidityAdmin` using the attacker-set executive fee address.

**Recommendation**:

- Require `appBiatecConfigProvider === this.appBiatecConfigProvider.value` inside `deployPool` before approving the group.
- Consider logging and aborting if the provided config diverges to ease monitoring.
- Add regression tests covering attempts to deploy with mismatched config IDs.

### Medium Severity

_None identified._

### Low Severity

_None identified._

### Informational

- The deployment flow assumes the stored CLAMM approval program fits in two chunks; if future versions require the third chunk, uncommenting `clammApprovalProgram3` in `deployPool` will be necessary. No action required now, but keep the comment in sync with compiled bytecode size.

## 5. Missing Test Scenarios

### Missing Test: Reject non-canonical config during pool deployment

**Description**: Ensure `deployPool` fails when the supplied config app ID differs from the provider's registered config.
**Risk if Untested**: Regression could silently reintroduce [H-01], enabling hostile pool deployments.
**Test Steps**:

1. Deploy a dummy config contract with `globalState['p']` pointing at the pool provider.
2. Attempt `deployPool` using this dummy config.
3. Expect the transaction group to fail with the new guard.
   **Expected Behavior**: Pool creation aborts before inner app creation.
   **Edge Cases**: Same-config ID (should succeed), paused config (should fail with `ERR_PAUSED`).
   **Priority**: High

## 6. Documentation Gaps

### Documentation Gap: Trusted configuration requirement

**Missing Information**: Public docs do not state that `deployPool` must be called with the provider's registered config app, nor how to verify it on-chain.
**User Impact**: Integrators may unknowingly interact with pools deployed via forged configs, assuming official compliance.
**Recommended Documentation**:

- Document the canonical config app ID and a CLI snippet to verify it (`app globalstate`).
- Explain consequences of using unregistered configs and advise checking transaction params before signing.
  **Location**: `docs/basic-use-cases.md` and `docs/liquidity-fee-protection.md`.
  **Priority**: Medium

## 7. Security Best Practices

- **Access Control**: Config and identity setters inside config/identity contracts follow role-based checks; however, `deployPool` currently violates the "trust only registered config" principle.
- **Input Validation**: Most contract methods assert transaction structure and pause state. Strengthen deployment-time validation per [H-01].
- **Math Safety**: Liquidity and fee math use `uint256` with conservative flooring. Ensure config-provided fee percentages remain within `[0, SCALE]` by trusting only vetted configs.
- **Identity Enforcement**: Identity checks are robust given a trusted config; they become ineffective with forged configs—highlighting the need for the fix.

## 8. Risk Assessment

- **Overall Risk**: High.
- **Rationale**: A single high-severity issue enables creation of counterfeit pools with arbitrary identity and fee logic, directly undermining protocol guarantees.

## 9. Recommendations

1. Patch `BiatecPoolProvider.deployPool` to enforce the stored config app and re-audit before redeploying.
2. Scan existing deployed pools to ensure none reference unapproved config apps.
3. Expand automated tests to cover deployment guardrails and malicious-config scenarios.
4. Update operator runbooks/documentation to include config verification steps for auditors and integrators.

## 10. Testing Recommendations

- Add Jest/e2e coverage that tries to deploy a pool with a mismatched config and asserts failure.
- Include a positive test confirming deployment still succeeds with the official config after the guard is added.
- Create a regression test around `removeLiquidityAdmin` to ensure fee withdrawals remain bounded with valid configs.

## 11. Compliance and Standards

- **Algorand Smart Contract Guidelines**: Currently breached due to inadequate validation of cross-app references during deployment. Fixing [H-01] restores compliance with recommended trust boundaries.
- **DeFi Security Expectations**: Identity/KYC guarantees hinge on trusted configuration; until the fix ships, the protocol cannot claim enforced KYC on newly spawned pools.

## 12. Appendix

- Repository tree snapshot: `Get-ChildItem -Depth 2 | Format-Table` (truncated output focused on contract and src directories).
- Line counts: `contracts/*.algo.ts` = 3,380 lines; `src/*.ts` = 3,243 lines; `__test__/*.test.ts` = 5,765 lines.
- Tests executed: `npm run test` (pass).
