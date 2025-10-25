# Test Data Refactoring Status

## ✅ Completed - ALL TestSets Moved to JSON

**All 23 tests** in `BiatecClammPool.test.ts` have been successfully refactored to load test data from JSON files in `__test__/test-data/`:

### Simple Calculation Tests (13)
1. ✅ calculatePrice → `calculate-price.json`
2. ✅ calculateAssetBWithdrawOnAssetADeposit → `calculate-asset-b-withdraw-on-asset-a-deposit.json`
3. ✅ calculateAssetAWithdrawOnAssetBDeposit → `calculate-asset-a-withdraw-on-asset-b-deposit.json`
4. ✅ calculateLiquidity → `calculate-liquidity.json`
5. ✅ calculateAssetAWithdrawOnLPDeposit → `calculate-asset-a-withdraw-on-lp-deposit.json`
6. ✅ calculateAssetBWithdrawOnLPDeposit → `calculate-asset-b-withdraw-on-lp-deposit.json`
7. ✅ calculateAssetBDepositOnAssetADeposit → `calculate-asset-b-deposit-on-asset-a-deposit.json`
8. ✅ calculateAssetADepositOnAssetBDeposit → `calculate-asset-a-deposit-on-asset-b-deposit.json`
9. ✅ addLiquidity1 → `add-liquidity.json`
10. ✅ addLiquidity2 → `add-liquidity-second.json`
11. ✅ swapAtoB → `swap-a-to-b.json`
12. ✅ swapBtoA → `swap-b-to-a.json`
13. ✅ removeLiquidity → `remove-liquidity.json`

### Complex Tests with BigInt (10)
14. ✅ LP fees 10%, Biatec fee - 0% → `lp-fees-10-biatec-fee-0.json`
15. ✅ LP fees 10%, Biatec fee - 50% → `lp-fees-10-biatec-fee-50.json`
16. ✅ ASASR - LP fees 10%, Biatec fee - 0% → `asasr-lp-fees-10-biatec-fee-0.json`
17. ✅ I can withdraw lp fees from biatec account → `withdraw-lp-fees-from-biatec-account.json`
18. ✅ If someone deposits assets to the pool → `distribute-assets-to-lp-holders.json`
19. ✅ Extreme-SamePriceLowTop - ASASR → `extreme-same-price-low-top-asasr.json`
20. ✅ Extreme-SmallMinMaxPriceDiff - ASASR → `extreme-small-min-max-price-diff.json`
21. ✅ Extreme-ExtremePrice-Min - ASASR → `extreme-extreme-price-min.json`
22. ✅ Extreme-No-Fees - ASASR EURUSD → `extreme-no-fees-eurusd.json`
23. ✅ I can have algo vs asa in the pool → `algo-vs-asa-pool.json`

All complex tests use the `convertToBigInt()` helper function to convert string representations of BigInt values.

## Helper Utilities

### convertToBigInt.ts

A utility function that recursively converts string representations of numbers to BigInt in test data objects. This is necessary because JSON doesn't natively support BigInt values.

**Usage:**
```typescript
import { convertToBigInt } from './test-data/convertToBigInt';
import testData from './test-data/my-test.json';

const testSet = convertToBigInt(testData);
// All numeric strings in the JSON are now BigInt values
```

## Benefits Achieved

1. **Separation of Concerns**: Test data is now separate from test logic
2. **Maintainability**: Test data can be updated without modifying test code
3. **Reusability**: Test data can be shared across multiple tests if needed
4. **Readability**: Tests are more focused on logic rather than data definition
5. **Consistency**: Same pattern as existing clamm tests (math.test.ts, liquidity.test.ts)

## Other Test Files

- ✅ BiatecIdentity.test.ts - No testSets found
- ✅ Npm.test.ts - No testSets found
- ✅ clamm/math.test.ts - Already uses JSON test data
- ✅ clamm/liquidity.test.ts - Already uses JSON test data
- ✅ clamm/deployment.test.ts - No testSets found
