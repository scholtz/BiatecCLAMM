# Test Data Refactoring Status

## ✅ Completed - Simple TestSets (Moved to JSON)

The following tests have been successfully refactored to load test data from JSON files in `__test__/test-data/`:

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

## ✅ Completed - Complex TestSets with BigInt

The following tests with complex nested objects and BigInt values have been refactored:

14. ✅ LP fees 10%, Biatec fee - 0% → `lp-fees-10-biatec-fee-0.json`
15. ✅ LP fees 10%, Biatec fee - 50% → `lp-fees-10-biatec-fee-50.json`

These tests use the `convertToBigInt()` helper function to convert string representations back to BigInt values.

## 🔲 Remaining Complex TestSets

The following tests still have inline testSet definitions and would benefit from extraction to JSON files:

16. 🔲 ASASR - LP fees 10%, Biatec fee - 0%
17. 🔲 I can withdraw lp fees from biatec account
18. 🔲 If someone deposits the asset a or asset b to the pool
19. 🔲 Extreme-SamePriceLowTop - ASASR
20. 🔲 Extreme-SmallMinMaxPriceDiff - ASASR
21. 🔲 Extreme-ExtremePrice-Min - ASASR
22. 🔲 Extreme-No-Fees - ASASR EURUSD
23. 🔲 I can have algo vs asa in the pool

These tests are significantly more complex with:
- Very large nested objects with many BigInt fields
- Stats objects with time-series data
- Multiple status check objects

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
