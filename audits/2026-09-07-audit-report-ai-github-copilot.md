# BiatecCLAMM Security Audit

## 1. Audit Metadata

| Field                    | Value                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| AI assistant             | GitHub Copilot                                                        |
| Underlying model/version | Not disclosed by the assistant interface; not inferred                |
| Provider                 | GitHub                                                                |
| Audit date               | 2026-09-07                                                            |
| Commit hash              | `d84ab2fa3c84cf66f9d0961c9041144413365d23`                            |
| Commit date              | `2026-09-07T10:20:30+02:00`                                           |
| Branch                   | `main`                                                                |
| Initial worktree         | Clean, verified with `git status --short`                             |
| Package version          | `0.9.43`                                                              |
| Review type              | Fresh source review with bounded, non-exploit regression verification |
| Release decision         | Do not treat this review as release approval                          |

**Independence statement:** No previous audit reports, audit summaries, or historical finding documents were opened. The current audit instructions were read. The request already included an LP-rounding reproduction test; this is prior exposure for H-01, not an independently discovered finding. Its asserted result was not accepted as fresh runtime evidence, and the reproduction was not executed. Other findings below were derived from current implementation reads. No contract fixes were applied.

### Contract Bytecode Hashes

The following SHA256 values identify base64-decoded ARC-56 bytecode after a successful fresh `npm run build`. They do not establish equivalence with any deployed application or constitute a bytecode-level security review.

| Contract                    | Approval bytes | Approval program SHA256                                            |
| --------------------------- | -------------: | ------------------------------------------------------------------ |
| BiatecClammPool             |           8155 | `d5af0104faa636835883acc9096d9908b4a1e2caa6fe8d662e62b141ec8b41b1` |
| BiatecConfigProvider        |            793 | `15bdcb6eb3d4369ce55525f4453c7642f4a2e72f041316124dec8b49c88e0872` |
| BiatecIdentityProvider      |           1726 | `452993b634a286d3891e511322984774cc9a151e00a937b255815072487c3ec0` |
| BiatecPoolProvider          |           5802 | `e5447dd51b3a66d53c78ecd9eef4337527ed69254ae78b7bf8fe39e729ab22c7` |
| FakePool, test support only |            136 | `b303c1c803a3a56e7c04a6246861110f3ec38c7c28fabe1602d01a9b69feb1a7` |

All five clear programs are one byte and have SHA256 `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b`.

**Provenance caveat:** The installed compiler was TEALScript `0.107.0`, while the package declares `^0.107.2`. The build succeeded with the installed version. These hashes must not be represented as a build with the declared compiler range. See I-01.

## 2. Executive Summary

The highest-priority concerns are LP issuance rounding and the solvency invariant for pools whose two accounting sides represent the same asset. Both are supported by source evidence; this review does not claim demonstrated theft, a quantified loss bound, or a live exploit.

| ID   | Severity      | Finding                                                                | Evidence                                 |
| ---- | ------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| H-01 | High          | LP minting overrides the conservative floor                            | Static; prior exposure disclosed         |
| H-02 | High          | Same-asset reserve checks do not enforce aggregate backing             | Static; privileged operations implicated |
| M-01 | Medium        | Liquidity operations lack caller-specified minimum outputs             | Static                                   |
| M-02 | Medium        | Provider bootstrap retains original-creator authority after setup      | Static; governance assumption explicit   |
| M-03 | Medium        | Identity expiry is not reflected in the pool authorization response    | Static; policy-dependent                 |
| L-01 | Low           | Application-call proxy silently omits supported-looking requests       | Static                                   |
| L-02 | Low           | Native-token naming configuration is ignored by pool creation          | Static                                   |
| L-03 | Low           | Add-liquidity sender always includes an LP opt-in                      | Static                                   |
| I-01 | Informational | Audit build tooling is not reproducible from the declared dependencies | Fresh command evidence                   |

There are **2 High, 3 Medium, 3 Low, and 1 Informational** findings. Severity is an engineering prioritization, not a claim that each item is independently exploitable. No Critical finding is asserted. Fresh verification passed **18 selected suites and 91 tests**, excluding the supplied reproduction file. The full-suite release gate remains unsatisfied as described in the appendix.

## 3. Scope and Methodology

### Coverage Matrix

| Surface                                                             | Review performed                                                                                                                                            | Boundary                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Main pool](../contracts/BiatecClammPool.algo.ts)                   | Entire source read: initialization, deposits, withdrawals, swaps, fee/reward allocation, identity checks, privileged operations, arithmetic helpers, status | No formal proof or exploit execution                                                           |
| [Configuration provider](../contracts/BiatecConfigProvider.algo.ts) | Entire source read: authority, pause, reference changes, fee limits, treasury methods                                                                       | Deployed governance/key custody not inspected                                                  |
| [Identity provider](../contracts/BiatecIdentityProvider.algo.ts)    | Entire source read: bootstrap, registration, setters, queries, administrative methods                                                                       | Off-chain identity renewal service not inspected                                               |
| [Pool provider](../contracts/BiatecPoolProvider.algo.ts)            | Entire source read: template loading, creation, registration, rolling statistics, authority                                                                 | No historical chain-data or oracle-manipulation study                                          |
| CLAMM SDK                                                           | Creation/add/remove/swap builders, add/remove/swap senders, transaction submission helper, identity box helper                                              | Other SDK modules and off-chain numerical implementations not exhaustively reviewed            |
| Tests                                                               | Selected current test bodies and names inspected; 18 non-reproduction suites and 91 tests passed in a fresh completed run                                   | Not a test-coverage measurement or full-suite certification                                    |
| [Staking documentation](../docusaurus/docs/staking-pools.md)        | Current English staking documentation checked against code                                                                                                  | Other documentation, translations, and website builds excluded                                 |
| Generated artifacts/clients                                         | Freshly rebuilt; all five artifact pairs hashed                                                                                                             | Generated code not independently audited; FakePool is not a production contract in this review |
| Dependencies and deployment                                         | Installed tool versions and local services checked                                                                                                          | No dependency vulnerability database scan, production deployment verification, or key audit    |

The review traced checks and mutations across owning methods, distinguished fixed-price from bounded-price calculations, and checked whether the SDK exposes on-chain safeguards. Existing test names were used to identify coverage limitations, not as proof that an invariant holds. Searches were scoped to current contracts, SDK files, and ordinary tests.

### Trust Assumptions

- The configured updater is intentionally powerful and can change code or critical references. This power alone is not an authorization defect.
- The fee executive is trusted to allocate rewards and execute permitted treasury/governance actions; mistakes should nevertheless be constrained by reserve checks.
- Identity enforcement is intentionally centralized. This review does not assume that storing expiry timestamps automatically specifies an on-chain renewal policy.
- ASA freeze/clawback controls, wallet group inspection, and off-chain services remain external trust dependencies.
- AVM rejection rolls back the transaction group. An arithmetic rejection is not, by itself, evidence of committed state corruption.

## 4. Findings

### H-01: LP Minting Overrides the Conservative Floor

**Severity:** High. **Status:** Open. **Confidence:** High in the local rounding defect; economic extent unverified.

**Location:** [LP conversion](../contracts/BiatecClammPool.algo.ts#L666); [withdrawal accounting](../contracts/BiatecClammPool.algo.ts#L728).

**Evidence and invariant:** The minting path computes a base-scaled entitlement and divides it into LP-token units, but overrides a positive sub-unit result with a whole LP unit. That contradicts the stated conservative-floor rule. Withdrawal accounting treats issued units as full claims rather than tracking their originally unrounded backing.

**Prerequisites and impact:** Fine-grained asset contributions can be smaller than LP issuance granularity. In that regime, rounding need not favor existing LPs. The source supports a dilution concern; this audit does not quantify cumulative loss, transaction-cost-adjusted profitability, or affected live pools. The supplied test drew attention to this path but was not run.

**Remediation:** Preserve the floor through the final denomination conversion and reject an unrepresentable mint atomically. Review the quadratic's zero-result handling as part of the same fix. Expose minimum LP output and clearly communicate minimum deposit granularity.

**Defensive acceptance criterion:** Newly issued claims must not exceed conservatively calculated entitlement, including below-unit boundaries and pre-existing fee balances.

### H-02: Same-Asset Reserve Checks Do Not Enforce Aggregate Backing

**Severity:** High. **Status:** Open. **Confidence:** High in the invariant gap; downstream outcomes not reproduced.

**Location:** [Reserve-check helper](../contracts/BiatecClammPool.algo.ts#L383); [reward allocation](../contracts/BiatecClammPool.algo.ts#L1132); [withdrawal accounting](../contracts/BiatecClammPool.algo.ts#L728).

**Evidence and invariant:** The balance helper checks each accounting side independently against the corresponding physical holding. For distinct assets that is appropriate. For identical assets, both sides refer to the same physical holding, so independent comparisons do not establish that their sum is backed. Reward allocation and privileged spending rely on this helper, while withdrawals account for both sides.

**Prerequisites and impact:** A same-asset pool has claims on both accounting sides, and a privileged allocation/spending operation relies on the incomplete check. The guard can give an operator false assurance about solvency; overstated claims can result in unavailable withdrawals or unequal recovery. This is not characterized as an unprivileged authorization bypass.

**Remediation:** Normalize liabilities by physical asset ID and compare aggregate recorded backing with spendable holdings. Use one canonical staking balance or explicitly aggregate both sides everywhere, including reward allocation, excess withdrawal, application calls, and status reporting. Apply a consistent native-reserve policy.

**Defensive acceptance criterion:** After every successful balance-changing operation, total liabilities for each physical asset must not exceed its spendable holding. Include native and ASA staking, both populated sides, and partial withdrawals in coverage.

### M-01: Liquidity Operations Lack Caller-Specified Minimum Outputs

**Severity:** Medium. **Status:** Open. **Confidence:** High.

**Location:** [Add-liquidity ABI](../contracts/BiatecClammPool.algo.ts#L399), [remove-liquidity ABI](../contracts/BiatecClammPool.algo.ts#L728), [add builder](../src/biatecClamm/txs/clammAddLiquidityTxs.ts), [remove builder](../src/biatecClamm/txs/clammRemoveLiquidityTxs.ts).

**Evidence and invariant:** Add liquidity does not accept a minimum LP output; removal does not accept minimum A/B outputs. The methods enforce positive output in some cases, but that is not a user-defined economic bound. The SDK cannot supply missing ABI safeguards. Swaps, by contrast, expose `minimumToReceive`.

**Prerequisites and impact:** Pool state changes between quoting/signing and execution. A successful liquidity operation can settle outside the user's intended output limits. This finding does not assert a particular transaction-ordering attack.

**Remediation:** Add minimum LP output for deposits and minimum per-asset outputs for withdrawals, checked atomically on chain. Thread them through generated clients and builders, with denomination-aware quoting and a documented validity policy.

**Defensive acceptance criterion:** A stale quote that violates the signed bounds must reject without moving funds; an acceptable updated quote must succeed.

### M-02: Provider Bootstrap Retains Original-Creator Authority

**Severity:** Medium. **Status:** Open pending governance clarification. **Confidence:** High in the code behavior.

**Location:** [Identity bootstrap](../contracts/BiatecIdentityProvider.algo.ts#L214), [pool-provider bootstrap](../contracts/BiatecPoolProvider.algo.ts#L222), [configuration authority rotation](../contracts/BiatecConfigProvider.algo.ts#L96).

**Evidence and invariant:** Both provider bootstraps authenticate the original application creator and overwrite configuration without a one-time initialization guard. Identity bootstrap also overwrites role addresses. They do not require authorization from the current configured updater after initialization.

**Prerequisites and impact:** The deployment creator differs from the intended long-term authority and its signing capability remains available. Rotating the updater alone does not retire the creator's separate configuration power. This is a residual privileged authority, not arbitrary public access.

**Remediation:** Make initialization one-shot. Route subsequent reconfiguration through explicitly documented current-governance authorization, preferably with staged acceptance. Include creator retirement in deployment handover procedures.

**Defensive acceptance criterion:** After setup and authority rotation, the retired creator cannot change provider configuration or identity roles; the documented current authority can perform supported changes.

### M-03: Identity Expiry Is Not Reflected in Pool Authorization

**Severity:** Medium if expiry is intended to gate access. **Status:** Open policy question. **Confidence:** High in the absence of on-chain expiry evaluation.

**Location:** [Short identity response](../contracts/BiatecIdentityProvider.algo.ts#L374), [pool identity enforcement](../contracts/BiatecClammPool.algo.ts#L845).

**Evidence and invariant:** Identity records contain KYC and investor-form expiration fields. The short response used by pools returns stored class/lock values without considering the current timestamp, and pool checks do not receive the expiry fields.

**Prerequisites and impact:** If eligibility is meant to end automatically at expiry, an expired record can retain its stored permissions until an authorized off-chain update changes it. If an external renewal/locking service is intentionally authoritative, this is an operational dependency rather than proof of policy bypass.

**Remediation:** Specify expiry semantics, including zero values and withdrawal access. Either derive effective eligibility on chain or document and monitor the external enforcement service with a defined failure policy. Avoid unintentionally trapping principal when introducing expiry enforcement.

**Defensive acceptance criterion:** Before/at/after-expiry behavior matches the approved policy for trading, deposits, and withdrawals, including service outages.

### L-01: Application-Call Proxy Silently Omits Requests

**Severity:** Low. **Status:** Open. **Confidence:** High.

**Location:** [Application proxy](../contracts/BiatecClammPool.algo.ts#L1284), [current proxy test](../__test__/pool/doAppCall.test.ts#L45).

**Evidence and impact:** Active forwarding branches require a positive payment. A request without a payment can return successfully without invoking the target. Forwarded argument arrays are also fixed to the first two entries despite the public array-shaped parameter. This can silently omit a legitimate governance operation or truncate its arguments. The inspected test covers a paid call with two arguments only.

**Remediation:** Support the documented call shapes or explicitly reject unsupported ones. Validate argument count and forward the intended arguments. Verify target-side effects rather than considering outer-call success sufficient.

### L-02: Native-Token Naming Configuration Is Ignored

**Severity:** Low. **Status:** Open. **Confidence:** High.

**Location:** [Pool naming input](../contracts/BiatecClammPool.algo.ts#L244), [provider setter](../contracts/BiatecPoolProvider.algo.ts#L280), [staking naming test](../__test__/pool/staking.test.ts#L50).

**Evidence and impact:** Pool creation hardcodes `Algo` while the provider exposes a configurable native-token name. The documentation says that configuration is consumed. Native pools on other supported chains can receive incorrect metadata. The test labeled custom naming supplies the same `Algo` default and does not distinguish configuration use from hardcoding.

**Remediation:** Read and validate the configured name at creation, accounting for ASA name/unit byte limits, or remove the unsupported promise from the API/documentation. Test a genuinely non-default name. Existing ASA metadata migration requires separate consideration.

### L-03: Add-Liquidity Sender Always Includes an LP Opt-In

**Severity:** Low. **Status:** Open. **Confidence:** High.

**Location:** [Opt-in decision](../src/biatecClamm/sender/clammAddLiquiditySender.ts#L32).

**Evidence and impact:** `optinSender` starts as true and is only assigned true again when no holding exists. Existing LP holders therefore receive an unnecessary self-transfer, increasing group size, transaction fees, and signing workload. This is not a demonstrated asset-loss defect beyond the redundant transaction cost.

**Remediation:** Set the flag directly from absence of the LP holding. Cover both an existing holding with zero balance and a missing holding.

### I-01: Audit Tooling Does Not Match Declared Dependencies

**Severity:** Informational. **Status:** Open. **Confidence:** Fresh command evidence.

**Location:** [Package scripts/dependencies](../package.json), [hash helper](../scripts/compute-bytecode-hashes.ts).

`npm run compute-bytecode-hashes` failed because `ts-node` was unavailable. The package script relies on it without declaring it here. Separately, the installed compiler was `0.107.0`, outside the declared `^0.107.2` range. The successful local build is useful evidence, but not evidence of a reproducible install/build from the manifest.

**Remediation:** Declare the script runtime or use a supported runtime available in the pinned toolchain. Enforce dependency/lockfile consistency and compiler-version recording in CI. Make the hash helper fail with a nonzero exit status for any missing or invalid artifact.

## 5. Missing Test Scenarios

These are defensive acceptance gaps in the inspected coverage, not a claim that every repository test was exhaustively analyzed.

| Priority | Required property                                                                         | Relevant current coverage                                                                       |
| -------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| High     | LP denomination conversion never exceeds conservative entitlement                         | Supplied reproduction excluded; positive liquidity examples do not establish this property      |
| High     | Aggregate same-asset liabilities remain backed across all balance-changing methods        | Balance-guard tests exercise individual A/B failures; staking tests cover selected reward flows |
| Medium   | Minimum output bounds protect deposits and withdrawals                                    | ABI currently lacks these bounds                                                                |
| Medium   | Retired creators lose setup authority; approved governance retains only documented powers | Provider lifecycle authorization needs dedicated coverage                                       |
| Medium   | Identity expiry, pause, and withdrawal policy are explicit and tested                     | Inspected identity tests set timestamps but do not establish time-driven enforcement            |
| Low      | Proxy calls either execute the requested shape or reject clearly                          | Inspected test uses payment plus exactly two arguments                                          |
| Low      | Non-default native names survive creation                                                 | Current custom-name test uses the default                                                       |
| Low      | LP opt-in is omitted when a holding already exists                                        | Sender branch needs a focused unit test                                                         |

## 6. Documentation Gaps

The current [staking guide](../docusaurus/docs/staking-pools.md) should be corrected in English before localized copies are updated:

- It claims staking bootstrap enforces `priceMin = priceMax = currentPrice = SCALE`; the source only checks equality of the range endpoints for same-asset pools. Resolve the intended economic rule before claiming enforcement.
- It describes provider-driven native names and `B-{AssetName}` staking names, while current creation uses the hardcoded native name and a lowercase `b` prefix.
- Its add/remove examples use fields such as `amountA`, `assetLP`, and `lpTokensToSend` that do not match the inspected sender interfaces. Examples also need the actual pool-provider client where required.
- Its reward decimal conversion is not the base-scale conversion used by the contracts. Express scaling using powers of ten and BigInt consistently.
- Same-asset examples should state the sum of both transfers as the actual deposit; describing two full-sized transfers as one stake understates the debit.
- Document automatic versus operator-driven identity expiry, transaction submission versus confirmation, governance bootstrap authority, and native reserve policy.

These recommendations are not documentation edits in this audit. Only the audit instructions and this report were intentionally changed.

## 7. Security Best Practices

**Observed controls:** Pool configuration and identity references are bound to stored configuration; pool operations check class/lock/pause; swaps validate the transfer sender and expose a minimum output; protocol fee withdrawals are capped by accrued protocol liquidity; pool creation binds configuration; trade reporting authenticates the caller application; inner transaction failures roll back their groups.

**Areas needing improvement:** Conservative LP rounding, aggregate staking reserves, liquidity output bounds, one-time initialization, explicit expiry semantics, and fail-closed forwarding/tooling behavior.

**Governance observations, not additional proven exploits:** The pool's online key registration accepts a caller-specified inner fee without the pause/balance guard used by some other privileged methods. Identity `selfRegistration` and `setInfo` do not consult the global pause switch. Review and document whether these exceptions are intentional. The identity engagement setter can replace the full identity record, so its actual authority exceeds engagement scoring alone.

## 8. Risk Assessment

**Overall: elevated pending remediation and verification.** H-01 concerns the integrity of issued claims; H-02 concerns backing of staking claims. Governance assumptions and output-limit omissions increase residual risk but should not be conflated with public unauthorized access.

This report does not establish deployed exposure, maximum loss, exploit profitability, or a guarantee of safety for unlisted paths. Passing ordinary regression tests would not discharge the identified invariant gaps. Any upgrade needs regenerated clients, byte-size/resource checks, deployment comparison, and affected regression gates.

## 9. Recommendations

1. Resolve H-01 and H-02 before relying on the reviewed minting/staking accounting for a release.
2. Add caller-defined output bounds to liquidity operations, with corresponding SDK changes.
3. Close or formally document persistent creator authority and identity-expiry policy.
4. Correct proxy behavior, native metadata configuration, and redundant opt-ins.
5. Make the build/hash environment reproducible and align the English staking guide with verified behavior.

## 10. Testing Recommendations

Use isolated LocalNet fixtures and deterministic, bounded invariant checks. Cover distinct-asset fixed-price pools, bounded-price pools, native staking, and ASA staking separately. Vary supported decimals and fee states; compare output rounding and aggregate backing using exact integers rather than floating point.

Test both allowed and rejected operations, with explicit post-state assertions and multiple independently funded users. For rejection tests, prove rollback of both holdings and accounting. Cover empty/full exits, donations, role handover, resource limits, and timestamp-policy boundaries. Keep exploit scripts and production interaction outside this review workflow.

## 11. Compliance and Standards

The review used Algorand/AVM transaction atomicity, TEALScript integer/state semantics, and common authorization/accounting principles as review criteria. ARC-56 artifacts were used for fingerprints; ARC conformance was not independently certified. No formal verification, legal/compliance determination, regulatory KYC certification, or external audit attestation is implied.

## 12. Appendix: Verification and Limitations

### Fresh Commands and Results

| Action                                                                                           | Result                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `git status --short` before edits                                                                | Clean                                                                                                                  |
| `git log -1 --format="%H %cI"`                                                                   | Revision and date recorded above                                                                                       |
| `npm run build`                                                                                  | Passed: contract compilation and all five generated clients                                                            |
| `npm run compute-bytecode-hashes`                                                                | Failed: `ts-node` not recognized                                                                                       |
| Node JSON/crypto fallback                                                                        | Passed: all five approval and clear programs hashed; nonempty bytecode checked                                         |
| `docker ps --format "{{.Names}} {{.Ports}}"`                                                     | Existing Algorand LocalNet services present; no reset/start performed                                                  |
| Endpoint environment check                                                                       | `ALGOD_SERVER`, `INDEXER_SERVER`, `KMD_SERVER` unset; fixture defaults used                                            |
| Editor `runTests` with 18 explicit non-reproduction files                                        | No tests discovered by the editor adapter; not a Jest result                                                           |
| `npm run test:nobuild -- --runInBand --testPathIgnorePatterns audit-2026-09-07.test.ts --silent` | Incomplete capture: two suite passes, no final summary. Superseded by the completed rerun below; not counted as a pass |
| `npx prettier audits/AI-AUDIT-INSTRUCTIONS.md --check`                                           | Passed after formatting                                                                                                |

The completed rerun used this exact PowerShell command:

```powershell
npm run test:nobuild -- --maxWorkers=4 --testPathIgnorePatterns audit-2026-09-07.test.ts --silent --json --outputFile="$env:TEMP\biatec-audit-2026-09-07-results.json"
```

```text
Test Suites: 18 passed, 18 total
Tests:       91 passed, 91 total
Snapshots:   0 total
Time:        133.223 s, estimated 200 s
```

The command exited successfully and wrote a dedicated fresh JSON result. No selected test failed, so there are no failures to classify. These results verify the existing selected regressions, not the finding-specific acceptance criteria proposed in this report.

The exact full-suite command `npm run test` was **not** executed in this review. Compilation was run separately, and the explicit reproduction file was excluded from Jest to keep verification non-exploit. Consequently the mandatory full-suite audit/release gate is **not satisfied**, despite all selected tests passing. No cached Jest result or user-reported prior run is counted as this audit's evidence.

Additional verification: `npm ls @algorandfoundation/tealscript --depth=0` reported `ELSPROBLEMS` and confirmed installed `0.107.0` is invalid for `^0.107.2`. All 28 report source links resolved with valid line bounds. Editor diagnostics reported no errors in either audit document.

### Environment

- Windows / PowerShell.
- Node `v26.5.0`; TypeScript `5.9.3`; Jest `29.7.0`; installed TEALScript `0.107.0`.
- Existing LocalNet Algod, Indexer, Conduit, and PostgreSQL containers were observed. No production endpoint or deployed pool was interrogated.
- Rebuilding produced no substantive tracked contract/client diff at the time of inspection. No dependency install or contract edit was performed.

### Hash Fallback

The fallback used Node's `fs`, `JSON.parse`, `Buffer.from(value, 'base64')`, and `crypto.createHash('sha256')` for the five named ARC-56 files. It checked both fields were present and printed decoded byte lengths and hashes. It did not execute contract programs. Unlike the package helper's catch-and-log behavior, missing fields caused this fallback to fail.

### Remaining Limits

No live exploit reproduction, formal numerical proof, bytecode disassembly audit, dependency advisory scan, production asset/governance inventory, exhaustive SDK review, full documentation review, or measured test coverage was performed. Finding-specific runtime outcomes remain unverified unless explicitly updated above. Complete the missing verification and a separate remediation review before changing the release decision.
