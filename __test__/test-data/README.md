# Test Data Refactoring Status

## Completed - Simple TestSets (Moved to JSON)

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

## Complex TestSets - Require BigInt Conversion

The following tests contain complex nested objects with BigInt values. They require a helper function to convert string values from JSON to BigInt:

14. ⚠️ LP fees 10%, Biatec fee - 0% → `lp-fees-10-biatec-fee-0.json` (JSON created, needs converter)
15. 🔲 LP fees 10%, Biatec fee - 50%
16. 🔲 ASASR - LP fees 10%, Biatec fee - 0%
17. 🔲 I can withdraw lp fees from biatec account
18. 🔲 If someone deposits the asset a or asset b to the pool
19. 🔲 Extreme-SamePriceLowTop - ASASR
20. 🔲 Extreme-SmallMinMaxPriceDiff - ASASR
21. 🔲 Extreme-ExtremePrice-Min - ASASR
22. 🔲 Extreme-No-Fees - ASASR EURUSD
23. 🔲 I can have algo vs asa in the pool

## Next Steps

To complete the refactoring of complex tests:

1. Create a helper function to recursively convert string values to BigInt in loaded JSON data
2. Extract remaining complex testSets to JSON files with string representations of BigInt values
3. Update tests to use the helper function when loading complex test data
4. Test all changes to ensure tests still pass

## Other Test Files

- ✅ BiatecIdentity.test.ts - No testSets found
- ✅ Npm.test.ts - No testSets found
- ✅ clamm/math.test.ts - Already uses JSON test data
- ✅ clamm/liquidity.test.ts - Already uses JSON test data
- ✅ clamm/deployment.test.ts - No testSets found
