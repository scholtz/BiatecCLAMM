# Security Policy

Biatec DEX (BiatecCLAMM) is a concentrated-liquidity AMM whose smart contracts custody user funds. We take security reports seriously.

## Reporting a vulnerability

**Please do not open a public issue or pull request for a vulnerability.**

Report privately by either:

- GitHub private vulnerability reporting: <https://github.com/scholtz/BiatecCLAMM/security/advisories/new>
- Email: [scholtz-oss-scanner@biatec.io](mailto:scholtz-oss-scanner@biatec.io)

Please include:

- the affected contract or SDK component and version (see `package.json` and the on-chain contract version);
- the network (Algorand mainnet, Voi, testnet, LocalNet) and application IDs, if applicable;
- a reproducer: the exact transaction group / arguments, or a script, and the resulting balances;
- the impact you believe it has, and any suggested fix.

## What to expect

- We aim to acknowledge reports within 3 business days and to share an initial assessment within 10 business days.
- We will keep you informed while we fix the issue and will coordinate disclosure with you. Because pools hold user funds and deployed contracts are upgraded through governed processes, fixes may take time; please give us a reasonable period before any public disclosure.
- We will credit reporters in the release notes or audit summary unless you prefer to stay anonymous.

## Scope

In scope:

- Smart contracts in `contracts/*.algo.ts` (`BiatecClammPool`, `BiatecPoolProvider`, `BiatecConfigProvider`, `BiatecIdentityProvider`) and their deployed instances.
- The TypeScript SDK and CLI scripts in `src/` published as `biatec-concentrated-liquidity-amm`.

Out of scope: test helpers (`FakePool`, `__test__/`), generated artifacts and clients, the documentation site, third-party dependencies and the Algorand protocol itself, and findings already described in the reports under [`audits/`](audits/). See [`.oss-scanner/threat_model.md`](.oss-scanner/threat_model.md) for how we rate severity and what we consider by design.

## Supported versions

Security fixes are made on `main` and released as a new npm version and, where contracts change, a new contract version. Only the latest released version and the contracts currently referenced by `getConfig()` are supported.

## Prior audits

Audit reports and fix summaries are in [`audits/`](audits/) and [`AUDIT_FIXES_SUMMARY.md`](AUDIT_FIXES_SUMMARY.md).
