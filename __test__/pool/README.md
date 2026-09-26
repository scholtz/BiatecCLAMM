# BiatecClammPool Test Suite

This directory contains the organized test suite for the BiatecCLAMM pool functionality. The tests have been split into logical categories for better maintainability and organization.

## Test Files

### Core Test Files

- **deployment.test.ts** (2 tests)
  - Pool deployment tests
  - Pool provider registration validation

- **calculations.test.ts** (8 tests)
  - `calculatePrice` - Price calculation tests
  - `calculateAssetBWithdrawOnAssetADeposit` - Asset B withdrawal calculations
  - `calculateAssetAWithdrawOnAssetBDeposit` - Asset A withdrawal calculations
  - `calculateLiquidity` - Liquidity calculation tests
  - `calculateAssetAWithdrawOnLPDeposit` - LP token withdrawal for Asset A
  - `calculateAssetBWithdrawOnLPDeposit` - LP token withdrawal for Asset B
  - `calculateAssetBDepositOnAssetADeposit` - Asset B deposit calculations
  - `calculateAssetADepositOnAssetBDeposit` - Asset A deposit calculations

- **liquidity.test.ts** (3 tests)
  - `addLiquidity1` - Initial liquidity addition
  - `addLiquidity2` - Secondary liquidity addition
  - `removeLiquidity` - Liquidity removal operations

- **swaps.test.ts** (2 tests)
  - `swapAtoB` - Swap from Asset A to Asset B
  - `swapBtoA` - Swap from Asset B to Asset A

- **fees.test.ts** (5 tests)
  - LP fee management (0% and 50% Biatec fee scenarios)
  - ASASR integration tests
  - LP fee withdrawal from Biatec account
  - Asset distribution to LP holders

- **extreme.test.ts** (4 tests)
  - Extreme-SamePriceLowTop - Same price range boundary tests
  - Extreme-SmallMinMaxPriceDiff - Very small price range tests
  - Extreme-ExtremePrice-Min - Extremely low minimum price tests
  - Extreme-No-Fees - Zero fee scenario tests

- **misc.test.ts** (3 tests)
  - Algorand network protection
  - Algo vs ASA pool tests
  - NPM method tests (getPools)

- **mainnet-replay-3720188642.test.ts** (1 test, ~1 minute)
  - Replays the complete mainnet history of pool app 3720188642 (Gold/GoldDAO) from `../test-data/mainnet-pool-3720188642.json`
    (3 deposits, 238 swaps by two aggregators with their recorded identity fee multipliers, full LP redemption)
  - Asserts the accounting invariant `L == distributedLp + Lu + Lb` after every liquidity operation, that swaps reproduce the
    mainnet outputs exactly and that only Biatec's fee share remains after all LP tokens are redeemed
  - `REPLAY_STRICT=0` reproduces the history without the invariant assertions (useful to compare a contract build against mainnet)

### Audit 2026-09-07 acceptance tests

Derived from the "Missing Test Scenarios" table of `audits/2026-09-07-audit-report-ai-github-copilot.md`. The
defects they uncovered (H-02, M-02, L-01, L-02) were fixed in the contracts on 2026-09-26; the tests now guard the
fixed behaviour.

- **audit-2026-09-07-helpers.ts** - shared helpers (pool accounting reader, aggregate backing check, funded accounts, identity records)
- **audit-2026-09-07-h01-lp-entitlement.test.ts** (2 tests) - LP minting never exceeds the conservative entitlement, also with pre-existing fee liquidity; sub-unit deposits are rejected atomically
- **audit-2026-09-07-h02-same-asset-backing.test.ts** (5 tests) - aggregate liabilities of same-asset (staking) pools versus the single physical holding across add / distribute / withdrawExcess / remove, including the `amountA = 1` "distribute everything" sentinel
- **audit-2026-09-07-m02-provider-authority.test.ts** (4 tests) - creator versus updater authority after `setAddressUdpater` rotation; re-running a provider `bootstrap` requires the current config updater (`E_UPDATER`)
- **audit-2026-09-07-m03-identity-policy.test.ts** (4 tests) - pause, locked identity, verification class and the (not enforced) identity expiry
- **audit-2026-09-07-l01-doAppCall-shapes.test.ts** (4 tests) - proxy call shapes verified on the target application: one or two arguments, with or without payment, other counts rejected with `E_ARGS`
- **audit-2026-09-07-l02-native-token-name.test.ts** (3 tests) - LP token native name is derived purely from `globals.genesisHash` (`Voi` on Voi mainnet, `Aramid` on Aramid mainnet, `Algo` everywhere else including localnet), never from the pool provider's mutable `nativeTokenName` config; the two mainnet hashes are checked against the compiled approval program since they cannot be reached from a local test network
- **../audit-2026-09-07-l03-optin-sender.test.ts** (2 tests, 1 `failing`) - SDK unit test of the LP opt-in decision in `clammAddLiquiditySender`; the `test.failing` case pins the still open L-03 defect and must be switched to `test` once fixed

### Supporting Files

- **shared-setup.ts**
  - Common imports and exports
  - Constants (SCALE, SCALE_A, SCALE_B, etc.)
  - `setupPool()` function for test initialization
  - Shared test fixtures and utilities

## Test Data

All test data has been extracted to JSON files in `../__test__/test-data/` directory. Tests use the `convertToBigInt()` helper function to handle BigInt values from JSON.

## Running Tests

Run all pool tests:
```bash
npm test -- __test__/pool
```

Run specific test file:
```bash
npm test -- __test__/pool/calculations.test.ts
```

Run specific test category:
```bash
npm test -- __test__/pool/extreme.test.ts
```

## Test Organization Benefits

1. **Improved Maintainability**: Tests are grouped by functionality
2. **Faster Test Location**: Easy to find specific test categories
3. **Better Parallelization**: Test files can run in parallel
4. **Clearer Test Coverage**: Categories make it obvious what's being tested
5. **Easier Debugging**: Smaller files are easier to navigate and debug
6. **Reduced Merge Conflicts**: Multiple developers can work on different test files

## Migration Notes

This structure was created by splitting the original `BiatecClammPool.test.ts` (4,400+ lines) into 7 focused test files plus a shared setup file. All test functionality remains unchanged - only the organization has improved.
