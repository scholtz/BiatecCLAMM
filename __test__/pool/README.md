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
