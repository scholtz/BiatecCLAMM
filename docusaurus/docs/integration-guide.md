# BiatecCLAMM Integration Guide

This guide provides best practices and security considerations for integrating BiatecCLAMM concentrated liquidity pools into your application or protocol.

## Table of Contents {#-table-of-contents}

- [Quick Start](#-quick-start)
- [Security Considerations](#-security-considerations)
- [Using CLAMM as Price Oracle](#-using-clamm-as-price-oracle)
- [Transaction Construction](#-transaction-construction)
- [Box References](#-required-box-references)
- [Common Integration Patterns](#-common-integration-patterns)
- [Error Handling](#-error-handling)
- [Testing Your Integration](#-testing-your-integration)

## Quick Start {#-quick-start}

### Installation {#-installation}

```bash
npm install biatec-concentrated-liquidity-amm
```

### Basic Pool Interaction {#-basic-pool-interaction}

```typescript
import { clammSwapSender, clammAddLiquiditySender, clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

// Swap example
const swapResult = await clammSwapSender({
  algod,
  sender,
  appBiatecClammPool: poolAppId,
  appBiatecConfigProvider: configAppId,
  appBiatecIdentityProvider: identityAppId,
  appBiatecPoolProvider: poolProviderAppId,
  assetA: usdcAssetId,
  assetB: algoAssetId,
  assetIn: usdcAssetId,
  amountIn: 1000000n, // 1 USDC (6 decimals)
  minimumToReceive: 900000n, // 5% slippage tolerance
});
```

## Security Considerations {#-security-considerations}

### Critical Security Warnings {#-critical-security-warnings}

⚠️ **NEVER use CLAMM VWAP as the sole price source for high-value decisions**

The Volume Weighted Average Price (VWAP) can be manipulated by large single-block trades. If your protocol makes financial decisions based on price data, you MUST:

1. **Combine Multiple Sources**: Use VWAP from multiple pools
2. **Time-Weight Data**: Average prices across multiple periods
3. **Implement Circuit Breakers**: Halt operations on large price moves
4. **Use Median Prices**: Take median of multiple CLAMM pools
5. **Set Deviation Limits**: Reject prices that deviate too far from reference

### Price Oracle Anti-Patterns {#-price-oracle-anti-patterns}

❌ **DON'T DO THIS:**

```typescript
// DANGEROUS: Using single pool VWAP for liquidations
const price = await getPoolVWAP(poolId);
if (collateralValue < debtValue * price) {
  liquidate(user); // Can be manipulated!
}
```

✅ **DO THIS INSTEAD:**

```typescript
// SAFE: Multiple sources with deviation checks
const prices = await Promise.all([getPoolVWAP(poolId1), getPoolVWAP(poolId2), getPoolVWAP(poolId3), getExternalOraclePrice()]);

const medianPrice = getMedian(prices);
const maxDeviation = 0.05; // 5%

for (const price of prices) {
  if (Math.abs(price - medianPrice) / medianPrice > maxDeviation) {
    throw new Error('Price manipulation detected');
  }
}

// Now safe to use medianPrice
if (collateralValue < debtValue * medianPrice) {
  liquidate(user);
}
```

### Identity Verification {#-identity-verification}

All liquidity and swap operations require identity verification. Your integration must:

1. **Check Verification Class**: Ensure users meet pool's minimum verification class
2. **Handle Locked Accounts**: Gracefully handle `ERR-USER-LOCKED` errors
3. **Cache Identity Data**: Consider caching identity lookups (with expiration)
4. **Provide Clear Errors**: Inform users why operations fail (insufficient verification)

### Slippage Protection {#-slippage-protection}

⚠️ **ALWAYS enforce minimum slippage protection**

While the contract allows `minimumToReceive = 0`, this exposes users to sandwich attacks:

```typescript
// Minimum recommended slippage protection
const MIN_SLIPPAGE_BPS = 50; // 0.5%

function calculateMinimumReceive(expectedOutput: bigint, slippageBps: bigint): bigint {
  const actualSlippage = slippageBps < MIN_SLIPPAGE_BPS ? MIN_SLIPPAGE_BPS : slippageBps;
  return (expectedOutput * (10000n - actualSlippage)) / 10000n;
}
```

## Using CLAMM as Price Oracle {#-using-clamm-as-price-oracle}

### Safe Price Retrieval Pattern {#-safe-price-retrieval-pattern}

```typescript
interface PriceDataPoint {
  poolId: number;
  price: bigint;
  volume: bigint;
  timestamp: number;
  period: string;
}

class SafePriceOracle {
  private readonly minPools = 3;
  private readonly maxDeviation = 0.05; // 5%
  private readonly timeWindow = 300; // 5 minutes

  async getPrice(assetA: bigint, assetB: bigint): Promise<bigint> {
    // 1. Get prices from multiple pools
    const pools = await this.findPoolsForPair(assetA, assetB);
    if (pools.length < this.minPools) {
      throw new Error(`Insufficient liquidity sources (${pools.length} < ${this.minPools})`);
    }

    // 2. Fetch VWAP from each pool
    const priceData = await Promise.all(pools.map((pool) => this.getPoolPriceData(pool)));

    // 3. Filter recent data only
    const cutoff = Date.now() / 1000 - this.timeWindow;
    const recentData = priceData.filter((d) => d.timestamp > cutoff);

    if (recentData.length < this.minPools) {
      throw new Error('Insufficient recent price data');
    }

    // 4. Calculate median price
    const prices = recentData.map((d) => d.price).sort((a, b) => Number(a - b));
    const median = prices[Math.floor(prices.length / 2)];

    // 5. Check for manipulation (outliers)
    for (const data of recentData) {
      const deviation = Math.abs(Number(data.price - median)) / Number(median);
      if (deviation > this.maxDeviation) {
        throw new Error(`Price manipulation detected: ${deviation * 100}% deviation`);
      }
    }

    // 6. Return volume-weighted average of remaining data
    let totalValue = 0n;
    let totalVolume = 0n;
    for (const data of recentData) {
      totalValue += data.price * data.volume;
      totalVolume += data.volume;
    }

    return totalValue / totalVolume;
  }

  private async getPoolPriceData(poolId: number): Promise<PriceDataPoint> {
    // Implementation fetches VWAP from pool provider box storage
    // See BiatecPoolProvider.algo.ts for box structure
  }
}
```

### Price Feed Health Monitoring {#-price-feed-health-monitoring}

Monitor your price feeds continuously:

```typescript
interface PriceHealthMetrics {
  poolCount: number;
  averageSpread: number;
  maxDeviation: number;
  totalVolume: bigint;
  stalestTimestamp: number;
}

async function checkPriceHealth(assetPair: [bigint, bigint]): Promise<PriceHealthMetrics> {
  // Check health metrics and alert if:
  // - Pool count drops below minimum
  // - Spread widens beyond threshold
  // - Volume drops significantly
  // - Data becomes stale
}

// Run health checks periodically
setInterval(() => {
  const health = await checkPriceHealth([usdcId, algoId]);
  if (health.poolCount < 3) {
    alertOps('Insufficient price sources');
  }
  if (health.maxDeviation > 0.1) {
    alertOps('Price manipulation possible');
  }
}, 60000); // Every minute
```

## Transaction Construction {#-transaction-construction}

### Required Box References {#-required-box-references}

When calling CLAMM methods, include these box references:

```typescript
const boxReferences = [
  // Pool statistics box
  { appIndex: poolProviderAppId, name: encodeBoxName('p', poolAppId) },

  // Pair statistics box
  { appIndex: poolProviderAppId, name: encodeBoxName('s', assetA, assetB) },

  // Identity box
  { appIndex: identityAppId, name: encodeBoxName('i', userAddress) },
];

function encodeBoxName(prefix: string, ...params: (number | string)[]): Uint8Array {
  // Helper to encode box names correctly
  // See src/boxes/index.ts for reference implementation
}
```

### Transaction Group Patterns {#-transaction-group-patterns}

#### Simple Swap {#-simple-swap}

```typescript
const group = [
  // 1. Asset transfer to pool
  makeAssetTransferTxn(sender, poolAddress, assetIn, amount),

  // 2. Pool swap call (with box references)
  makeApplicationCallTxn(sender, poolAppId, 'swap', {
    foreignApps: [configAppId, identityAppId, poolProviderAppId],
    foreignAssets: [assetA, assetB],
    boxes: boxReferences,
  }),

  // 3. Pool provider NOOP (registers trade)
  makeApplicationNoOpTxn(sender, poolProviderAppId),
];

// Assign group ID
algosdk.assignGroupID(group);
```

#### Add Liquidity {#-add-liquidity}

```typescript
const group = [
  // 1. Asset A transfer
  makeAssetTransferTxn(sender, poolAddress, assetA, amountA),

  // 2. Asset B transfer
  makeAssetTransferTxn(sender, poolAddress, assetB, amountB),

  // 3. LP token opt-in (if needed)
  makeAssetTransferTxn(sender, sender, lpToken, 0),

  // 4. Add liquidity call
  makeApplicationCallTxn(sender, poolAppId, 'addLiquidity', {
    foreignApps: [configAppId, identityAppId, poolProviderAppId],
    foreignAssets: [assetA, assetB, lpToken],
    boxes: boxReferences,
  }),
];
```

### Gas (Fee) Estimation {#-gas-fee-estimation}

CLAMM operations can be complex and require adequate fees:

```typescript
function estimateFees(operationType: 'swap' | 'addLiquidity' | 'removeLiquidity'): number {
  const baseFee = 1000; // 0.001 ALGO minimum fee

  const opcodeBudgetMultiplier = {
    swap: 4, // Swap uses increaseOpcodeBudget() multiple times
    addLiquidity: 5, // Complex liquidity math
    removeLiquidity: 4,
  };

  return baseFee * opcodeBudgetMultiplier[operationType];
}

// Usage
const txn = makeApplicationCallTxn(sender, poolId, 'swap', {
  fee: estimateFees('swap'),
  // ... other params
});
```

## Common Integration Patterns {#-common-integration-patterns}

### DEX Aggregator Integration {#-dex-aggregator-integration}

```typescript
interface PoolQuote {
  poolId: number;
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpact: number;
  route: [bigint, bigint][];
}

class DEXAggregator {
  async getBestQuote(assetIn: bigint, assetOut: bigint, amountIn: bigint): Promise<PoolQuote> {
    // 1. Find all relevant pools
    const directPools = await this.findPools(assetIn, assetOut);
    const multiHopRoutes = await this.findMultiHopRoutes(assetIn, assetOut);

    // 2. Get quotes from each
    const quotes = await Promise.all([...directPools.map((p) => this.getPoolQuote(p, amountIn)), ...multiHopRoutes.map((r) => this.getRouteQuote(r, amountIn))]);

    // 3. Return best quote by output amount
    return quotes.sort((a, b) => Number(b.outputAmount - a.outputAmount))[0];
  }

  async executeSwap(quote: PoolQuote): Promise<string> {
    // Execute the swap with proper slippage protection
    const minOutput = this.applySlippage(quote.outputAmount, 0.5); // 0.5%

    if (quote.route.length === 1) {
      // Direct swap
      return await this.directSwap(quote, minOutput);
    } else {
      // Multi-hop requires atomic composition
      return await this.multiHopSwap(quote, minOutput);
    }
  }
}
```

### Lending Protocol Integration {#-lending-protocol-integration}

```typescript
interface CollateralPosition {
  user: string;
  collateralAsset: bigint;
  collateralAmount: bigint;
  debtAsset: bigint;
  debtAmount: bigint;
  healthFactor: number;
}

class LendingProtocol {
  private priceOracle: SafePriceOracle;

  async checkLiquidation(position: CollateralPosition): Promise<boolean> {
    // Get safe price with manipulation protection
    const collateralPrice = await this.priceOracle.getPrice(
      position.collateralAsset,
      0n // ALGO
    );
    const debtPrice = await this.priceOracle.getPrice(position.debtAsset, 0n);

    // Calculate health factor with safety margins
    const collateralValue = position.collateralAmount * collateralPrice;
    const debtValue = position.debtAmount * debtPrice;
    const liquidationThreshold = 1.2; // 120% collateralization

    const healthFactor = Number(collateralValue) / Number(debtValue);

    return healthFactor < liquidationThreshold;
  }

  async liquidate(position: CollateralPosition): Promise<string> {
    // 1. Verify liquidation is valid
    if (!(await this.checkLiquidation(position))) {
      throw new Error('Position is healthy');
    }

    // 2. Calculate liquidation bonus (incentive for liquidators)
    const liquidationBonus = 1.05; // 5% bonus

    // 3. Swap collateral for debt via CLAMM
    const swapAmount = position.debtAmount * liquidationBonus;

    return await clammSwapSender({
      // Swap collateral to debt token
      assetIn: position.collateralAsset,
      amountIn: swapAmount,
      minimumToReceive: position.debtAmount, // Exact debt repayment
      // ... other params
    });
  }
}
```

### Yield Aggregator Integration {#-yield-aggregator-integration}

```typescript
interface YieldStrategy {
  poolId: number;
  apy: number;
  tvl: bigint;
  risk: 'low' | 'medium' | 'high';
}

class YieldAggregator {
  async findBestYield(asset: bigint): Promise<YieldStrategy> {
    // Find B-{TOKEN} staking pools for the asset
    const stakingPools = await this.findStakingPools(asset);

    // Calculate APY for each (based on recent reward distributions)
    const strategies = await Promise.all(
      stakingPools.map(async (pool) => ({
        poolId: pool.id,
        apy: await this.calculateAPY(pool),
        tvl: await this.getTVL(pool),
        risk: this.assessRisk(pool),
      }))
    );

    // Filter by minimum TVL and risk tolerance
    const safeStrategies = strategies.filter((s) => s.tvl > 100000n && s.risk !== 'high');

    // Return highest APY
    return safeStrategies.sort((a, b) => b.apy - a.apy)[0];
  }

  async deposit(strategy: YieldStrategy, amount: bigint): Promise<string> {
    // Add liquidity to staking pool (B-{TOKEN})
    return await clammAddLiquiditySender({
      appBiatecClammPool: strategy.poolId,
      amountA: amount,
      amountB: amount, // Same asset for staking pools
      // ... other params
    });
  }
}
```

## Error Handling {#-error-handling}

### Comprehensive Error Handling {#-comprehensive-error-handling}

```typescript
async function safeSwap(params: SwapParams): Promise<SwapResult> {
  try {
    return await clammSwapSender(params);
  } catch (error) {
    // Parse error message
    const errorMsg = error.message || '';

    if (errorMsg.includes('ERR-LOW-VER')) {
      throw new UserError('Insufficient identity verification. Please complete KYC.');
    }

    if (errorMsg.includes('ERR-USER-LOCKED')) {
      throw new UserError('Your account is locked. Contact support.');
    }

    if (errorMsg.includes('Minimum to receive is not met')) {
      throw new UserError('Price moved unfavorably. Try increasing slippage tolerance.');
    }

    if (errorMsg.includes('E_PAUSED')) {
      throw new UserError('Protocol is currently paused. Try again later.');
    }

    if (errorMsg.includes('E_ZERO_LIQ')) {
      throw new UserError('Pool has insufficient liquidity.');
    }

    // Unknown error - log for debugging
    console.error('Unexpected swap error:', error);
    throw new Error('Swap failed. Please try again or contact support.');
  }
}

class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
```

### Retry Logic {#-retry-logic}

```typescript
async function swapWithRetry(params: SwapParams, maxRetries: number = 3): Promise<SwapResult> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await safeSwap(params);
    } catch (error) {
      lastError = error;

      // Don't retry user errors
      if (error instanceof UserError) {
        throw error;
      }

      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await sleep(delay);

      console.log(`Swap attempt ${attempt} failed, retrying in ${delay}ms...`);
    }
  }

  throw new Error(`Swap failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

## Testing Your Integration {#-testing-your-integration}

### Unit Tests {#-unit-tests}

```typescript
describe('CLAMM Integration', () => {
  it('should handle slippage correctly', async () => {
    const quote = await getSwapQuote(usdcId, algoId, 1000000n);
    const minOutput = calculateMinimumReceive(quote.output, 50n); // 0.5%

    const result = await clammSwapSender({
      // ... params
      minimumToReceive: minOutput,
    });

    expect(result.amountOut).toBeGreaterThanOrEqual(minOutput);
  });

  it('should reject insufficient verification', async () => {
    // Mock user with low verification class
    await expect(clammSwapSender(/* params with low-ver user */)).rejects.toThrow('ERR-LOW-VER');
  });

  it('should handle price manipulation', async () => {
    const prices = [
      100n,
      101n,
      102n,
      150n, // Outlier
    ];

    await expect(validatePrices(prices)).rejects.toThrow('Price manipulation detected');
  });
});
```

### Integration Tests {#-integration-tests}

Test against Algorand sandbox:

```bash
# Start sandbox
algokit localnet start

# Run integration tests
npm run test:integration
```

### Security Testing {#-security-testing}

1. **Price Manipulation Tests**: Attempt large swaps and verify VWAP changes are detected
2. **Slippage Tests**: Test with zero and insufficient slippage protection
3. **Identity Tests**: Test with locked accounts and insufficient verification
4. **Pause Tests**: Verify operations fail when protocol is paused
5. **Overflow Tests**: Test with maximum uint64 values

## Best Practices Checklist {#-best-practices-checklist}

Before deploying your integration:

- [ ] Use multiple price sources, never single pool VWAP
- [ ] Implement circuit breakers for price anomalies
- [ ] Enforce minimum slippage protection (≥0.5%)
- [ ] Handle all error codes gracefully
- [ ] Implement retry logic with exponential backoff
- [ ] Include all required box references
- [ ] Test on testnet extensively
- [ ] Monitor price feed health continuously
- [ ] Document your integration for auditors
- [ ] Have incident response plan for price manipulation
- [ ] Use multi-sig for admin operations
- [ ] Regular security reviews of your integration
- [ ] Load test with realistic volume
- [ ] Verify fee estimation is adequate

## Security Audit References {#-security-audit-references}

Multiple security audits have been conducted on BiatecCLAMM. Review these before integrating:

- `audits/2025-10-27-audit-report-ai-claude-3-5.md` - Comprehensive security analysis
- `audits/2025-10-27-audit-report-ai-gpt5-codex.md` - Oracle manipulation concerns
- `audits/2025-10-27-audit-report-ai-gemini-2-5-pro.md` - VWAP vulnerabilities

Key takeaways for integrators:

- VWAP can be manipulated in single blocks
- Always use multiple price sources
- Implement circuit breakers
- Test extensively before mainnet

## Support and Resources {#-support-and-resources}

- **GitHub**: [https://github.com/scholtz/BiatecCLAMM](https://github.com/scholtz/BiatecCLAMM)
- **Documentation**: See `docs/` folder for detailed guides
- **Error Codes**: `docs/error-codes.md` for complete reference
- **Security**: `audits/` folder for audit reports
- **Examples**: `__test__/` for usage examples

---

**Last Updated**: 2025-10-27
**Version**: 1.0
**Maintained By**: BiatecCLAMM Team
