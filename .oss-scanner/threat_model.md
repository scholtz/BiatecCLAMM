# Threat model

## What this project does and where untrusted input enters
Biatec DEX (https://dex.biatec.io) is a concentrated-liquidity AMM (Uniswap-v3-style price ranges, plus a flat-price mode) for the Algorand Virtual Machine (Algorand, Voi). It is financial infrastructure: pools custody user funds, so loss, theft, lock-up or mispricing of funds is the primary concern.

The repository holds:
- **Smart contracts** in `contracts/*.algo.ts` (TEALScript, compiled to AVM TEAL in `contracts/artifacts/`):
  - `BiatecClammPool` - one app per pool. Entry points: `addLiquidity`, `removeLiquidity`, `swap`, `reconcileLiquidity`, `removeLiquidityAdmin`, `distributeExcessAssets`, `withdrawExcessAssets`, online/offline key registration, `updateApplication`, plus read-only getters/`status`. Pools report trades to the pool provider (`registerTrade`). Also the fixed-point math (`calculate*`) with uint256 arithmetic, sqrt prices and rounding.
  - `BiatecPoolProvider` - registry and statistics of pools, pool deployment (`loadCLAMMContractData`, `registerPool`), `registerTrade`, boxes.
  - `BiatecConfigProvider` - global configuration and role addresses (updater, governor, executive, fee executor), pause flag, protocol fee.
  - `BiatecIdentityProvider` - KYC/engagement identity records per user (boxes) used to gate pool access and fee tiers.
  - `FakePool.algo.ts` - test helper, not deployed.
- **TypeScript SDK** in `src/` (published to npm as `biatec-concentrated-liquidity-amm`): transaction builders (`src/*/txs`), senders, box-reference helpers, tick/price helpers (`src/ticks`), and operator CLI scripts (`src/bin`, `*.sh`).

Untrusted input, in order of importance:
1. **Any application call or transaction group sent to a deployed contract by an arbitrary account.** The attacker controls the sender, ABI arguments, the foreign `AppID` / `AssetID` / account references passed as arguments (e.g. `appBiatecConfigProvider`, `appBiatecIdentityProvider`, `assetA/B/Lp`), the payment and asset-transfer transactions in the group (receiver, asset id, amount, group position, transaction types, rekey/close-to fields) and the swap/deposit amounts. Contracts must not trust caller-supplied app ids or asset ids without verifying them against stored global state or the config provider.
2. **Assets listed in a pool.** Pool creators choose the two assets and the price range. Asset properties (decimals, clawback, freeze, manager, reserve) can be adversarial.
3. **Pool creation.** Any account can create a pool via the pool provider. The deployed pool bytecode is supplied through `loadCLAMMContractData` by an authorised account and must match what the pool provider expects.
4. **SDK inputs.** Values read from algod/indexer, ARC-14 auth headers, and user-supplied amounts and prices flowing into the transaction builders. The SDK runs in the user's wallet/frontend context; a flaw that makes it build a transaction different from what the user intended is in scope.

## Components that matter most / least
Most important:
- `contracts/BiatecClammPool.algo.ts` - custody of funds, swap/liquidity math, rounding direction, fee accounting, LP-token minting/burning, price-range invariants, behaviour at range boundaries, inner-transaction side effects, group-transaction validation.
- `contracts/BiatecPoolProvider.algo.ts` and `contracts/BiatecConfigProvider.algo.ts` - authorisation of privileged methods, pool registration and approval-program verification, `updateApplication` paths, pause logic, trade statistics.
- `contracts/BiatecIdentityProvider.algo.ts` - who can set identity info, whether identity gating can be bypassed, box handling.
- `src/ticks`, `src/biatecClamm/txs`, `src/biatecClamm/sender`, `src/common`, `src/boxes`: correctness of amounts, fees, slippage and box references when building transactions; parsing of on-chain state (`parseStatus`, `parseStats`).

Less important but in scope: operator CLI scripts in `src/bin`, `scripts/` and `*.sh`. They read operator mnemonics from the environment, which is expected. Report issues there (injection, secret leakage) at lower severity.

Out of scope:
- `node_modules/`, `dist/`, `docusaurus/` (documentation site), `contracts/artifacts/` and `contracts/clients/` (generated from the contracts by `npm run build`, although committed; report the bug in the contract source or generator inputs instead, but note that the image build regenerates them in place; run `git status` / `git diff` in `/src` after the build to spot committed copies that differ from generator output).
- `contracts/FakePool.algo.ts` and test code under `__test__/` (not deployed). Tests marked `test.failing` document known open SDK issues (e.g. `clammAddLiquiditySender` always keeping `optinSender` true); do not re-report those.
- `audits/` and the markdown summaries (prior audit reports; read them for context on already-fixed issues, do not re-report them).
- Vulnerabilities in third-party dependencies (algosdk, algokit-utils, the TEALScript compiler, the Algorand protocol/AVM itself) unless this repository uses them in a clearly unsafe way.

Authorisation expectations: `registerTrade` logs a trade event and updates the per-pool and per-pair price/volume statistics boxes. Its only check is that the calling application is the `appPoolId` it names, so any app can write statistics for itself and for any asset pair, including the shared per-pair aggregate. The statistics are informational (price/volume reporting) and must not feed any fund-moving logic; report it if the aggregate boxes can be corrupted in a way that breaks other callers (e.g. box growth/DoS, overflow reverting legitimate pools' trades) or if on-chain logic depends on them. `withdrawExcessAssets` and `sendOnlineKeyRegistration` on the config, identity and pool-provider contracts must only be callable by the fee executor set in the config provider, and those contracts are not expected to hold user funds. Pool-level `withdrawExcessAssets` must never touch user liquidity. Config setters are callable only by the updater, except the fee and fee-executor setters, which are gated to the executive.

## How to exercise it
- `npm ci && npm run build` has already been run in the image: TEALScript compiled `contracts/*.algo.ts` into `contracts/artifacts/` (TEAL, ARC-4/32/56 JSON) and typed clients were generated in `contracts/clients/`.
- Offline unit tests that need no node: `npx jest __test__/Ticks.test.ts __test__/common __test__/audit-2026-09-07-l03-optin-sender.test.ts`.
- The contract test suites (`__test__/clamm`, `__test__/pool`, `__test__/BiatecIdentity.test.ts`) need an **Algorand LocalNet** (algod :4001, kmd :4002, indexer :8980, normally started with `algokit localnet start`, which needs Docker) and cannot run in the scanner VM. Instead: (a) reason from the TypeScript contract source and the generated TEAL; (b) re-implement the `calculate*` fixed-point math in a small script to probe rounding, overflow and zero-liquidity edge cases and invariants (rounding never creates value, liquidity never decreases on a swap, deposit then withdraw never returns more than deposited); (c) use `__test__/clamm/math.test.ts` and `__test__/Ticks.test.ts` as examples of how the pool math is called. In `contracts/BiatecClammPool.algo.ts`, `calculateLiquidityFlatPrice`, `calculateLiquidityD`, `calculatePrice`, `calculateAssetBWithdrawOnAssetADeposit` and friends are the arithmetic core.
- `audits/` contains prior audit reports and `AUDIT_FIXES_SUMMARY.md` describes fixes. Code comments such as "audit 2026-09-07 H-01" mark hardened spots. Use them to avoid duplicate reports and to check that a fix cannot be bypassed through a sibling code path.

## How you rate severity
- **Critical**: an unprivileged attacker can steal or permanently lock pool funds or LP tokens, mint LP tokens without matching deposits, drain via swap/rounding with positive expected profit after fees, take over a privileged role (updater, governor, executive, fee executor), or replace pool/config/identity app references to redirect funds.
- **High**: loss of funds under special but realistic conditions (specific price range or asset configuration, a malicious asset); bypass of identity gating or the pause flag; a privileged method callable by the wrong role; permanently failing `swap`/`removeLiquidity` on a pool (fund lock-up); an SDK bug that builds a transaction sending funds somewhere other than the user asked (wrong receiver, amount or asset, slippage ignored).
- **Medium**: loss bounded to dust or fee revenue; rounding that favours the trader by tiny amounts but cannot be repeated profitably; DoS of non-withdrawal paths; wrong statistics or price reporting that cannot move funds; opcode-budget exhaustion that blocks one call type.
- **Low**: griefing without financial impact; missing input validation with no exploitable consequence; minor SDK/CLI robustness or secret-handling issues.
- A finding needs a concrete reproducer: an exact transaction group / arguments (or a math script with numbers) and the resulting balances. Findings that rely on a compromised privileged key are at most Low, unless the contracts are meant to restrict that role (for example, the fee executor must not be able to touch user liquidity). Findings that need the Algorand protocol itself to misbehave are out of scope.
- Proposed patches should be minimal changes to the TypeScript contract source in `contracts/`, mindful of AVM opcode budget and box/storage costs. Do not change ABI signatures of deployed contracts unless unavoidable.

## Anything to leave alone
- Do not report differences between TEALScript compiler output and the TypeScript source unless a concrete exploit exists.
- Do not report that privileged roles can pause the system, change fees or update contracts. This is by design and governed off-chain; only report it if a non-privileged caller can bypass the intended restriction.
- Do not report missing rate limits, front-running/MEV on public swaps (slippage protection via `minimumToReceive` is the intended defence), or that anyone can create pools with worthless assets.
- Do not report TypeScript compile errors or missing `@types` in `src/createGoldToken.ts`, `src/createNFTToken.ts` and `src/createArc3Files*.ts` (one-off operator scripts, known to be stale).
- Do not report secrets in `.env.example` or test mnemonics under `__test__/` (LocalNet only).
