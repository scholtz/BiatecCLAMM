# Staking Pools (Interest-Bearing Token Pools)

## Overview

BiatecCLAMM now supports staking pools where asset A and asset B are the same token. This enables the creation of interest-bearing tokens like B-ALGO, B-USDC, etc., where liquidity providers can earn rewards from staking rewards, transaction fees, or other revenue sources that accrue to the pool.

## Use Cases

### 1. Native Token Staking (B-ALGO)

Create a pool where both asset A and asset B are set to 0 (native token). This creates a B-ALGO token that represents staked ALGO. Any ALGO that accrues to the pool (e.g., from consensus rewards, governance rewards, or direct deposits) can be distributed to B-ALGO holders.

### 2. Asset Staking (B-USDC, B-TOKEN, etc.)

Create a pool where both asset A and asset B are set to the same ASA ID. This creates a B-{TOKEN} token that represents staked tokens. This is useful for:

- Lending protocols where deposited assets earn interest
- Revenue-sharing mechanisms
- Yield aggregation strategies

## Pool Characteristics

When asset A equals asset B:

- **LP Token Name**: `B-{AssetName}` (e.g., "B-ALGO", "B-USDC")
- **LP Token Symbol**: The asset's unit name (e.g., "ALGO", "USDC")
- **Price Range**: Must be flat at 1:1 (priceMin = priceMax = currentPrice = SCALE). The contract now enforces this during bootstrap (error `E_STAKING_PRICE`).
- **Swaps**: Not meaningful since both assets are the same
- **Main Operations**: Add liquidity (stake), remove liquidity (unstake), distribute rewards

## How It Works

### 1. Pool Creation

```typescript
const { clientBiatecClammPoolProvider } = await setupPool({
  algod,
  assetA: 0n, // 0 for ALGO, or an ASA ID
  assetB: 0n, // Same as assetA
  biatecFee: 0n, // No Biatec fee
  lpFee: BigInt(SCALE / 100), // 1% fee (optional)
  p: BigInt(1 * SCALE), // Price = 1:1
  p1: BigInt(1 * SCALE), // Min price = 1
  p2: BigInt(1 * SCALE), // Max price = 1
  nativeTokenName: 'ALGO', // Optional helper parameter ensures provider global state matches
});

// When constructing transactions manually, configure the provider once via:
// await poolProviderClient.send.setNativeTokenName({
//   args: { appBiatecConfigProvider: configAppId, nativeTokenName: 'ALGO' },
//   appReferences: [configAppId],
// });
```

### 2. Adding Liquidity (Staking)

Users add liquidity to stake their tokens:

```typescript
const txId = await clammAddLiquiditySender({
  algod,
  account: userSigner,
  amountA: stakeAmount, // Amount to stake
  amountB: stakeAmount, // Same as amountA
  assetA: 0n, // 0 for ALGO
  assetB: 0n, // Same as assetA
  assetLP: lpTokenId,
  clientBiatecClammPool,
  appBiatecConfigProvider,
  appBiatecIdentityProvider,
  appBiatecPoolProvider,
});
```

Users receive B-{TOKEN} LP tokens representing their staked position.

### 3. Distributing Rewards

When rewards accrue to the pool (e.g., staking rewards, fees, direct deposits), the executive fee address distributes them:

```typescript
// 1. Rewards are deposited to the pool address
// (This can happen automatically via consensus rewards, or manually)

// 2. Executive fee address distributes the excess assets
const txId = await clammDistributeExcessAssetsSender({
  algod,
  account: executiveSigner,
  amountA: rewardsAmount * (SCALE / assetDecimals), // In base scale (9 decimals)
  amountB: 0n, // No rewards for asset B
  assetA: 0n, // 0 for ALGO
  assetB: 0n, // Same as assetA
  clientBiatecClammPool,
  appBiatecConfigProvider,
});
```

This increases the pool's liquidity proportionally, so when users withdraw, they receive more tokens than they deposited.

### 4. Removing Liquidity (Unstaking)

Users withdraw their stake plus earned rewards:

```typescript
const txId = await clammRemoveLiquiditySender({
  algod,
  account: userSigner,
  assetA: 0n,
  assetB: 0n,
  assetLP: lpTokenId,
  lpTokensToSend: lpBalance, // All or partial LP tokens
  clientBiatecClammPool,
  appBiatecConfigProvider,
  appBiatecIdentityProvider,
  appBiatecPoolProvider,
});
```

Users receive back their staked tokens plus a proportional share of the rewards.

## Technical Details

### Contract Changes

1. **Pool Provider Global State**: Added `nativeTokenName` (`nt`) to the pool provider global state with an admin-only `setNativeTokenName` method. The CLAMM bootstrap reads this value when creating LP tokens.

2. **Asset Validation**: Removed the assertion that prevented `assetA.id === assetB.id`. The contract now supports this configuration for staking pools.

3. **LP Token Naming**:

   - Standard pools: `B-{AssetA}-{AssetB}` with unit name `BLP`
   - Staking pools: `B-{AssetName}` with unit name matching the underlying asset

4. **Opt-in Logic**: Skips duplicate opt-in when assetA equals assetB.

### TypeScript API Changes

1. **clammCreateTxs / clammCreateSender**: No longer accept a `nativeTokenName` parameter; configure the pool provider once via `BiatecPoolProviderClient.send.setNativeTokenName`.

2. **setupPool**: Added optional `assetB` and `nativeTokenName` parameters for test scenarios

## Examples

### Example 1: B-ALGO Pool

```typescript
// Create B-ALGO pool
const pool = await setupPool({
  algod,
  assetA: 0n,
  assetB: 0n,
  biatecFee: 0n,
  lpFee: 0n,
  p: BigInt(SCALE),
  p1: BigInt(SCALE),
  p2: BigInt(SCALE),
  nativeTokenName: 'ALGO',
});

// Stake 100 ALGO
await clammAddLiquiditySender({
  amountA: 100n * BigInt(SCALE_ALGO),
  amountB: 100n * BigInt(SCALE_ALGO),
  // ... other params
});

// Simulate 10 ALGO rewards accruing to pool
// (Sent directly to pool address)

// Distribute rewards
await clammDistributeExcessAssetsSender({
  amountA: 10n * BigInt(SCALE), // 10 ALGO in base scale
  amountB: 0n,
  // ... other params
});

// Unstake (receives original 100 ALGO + proportional rewards)
await clammRemoveLiquiditySender({
  lpTokensToSend: lpBalance,
  // ... other params
});
```

### Example 2: B-USDC Pool (Lending Protocol)

```typescript
// Create B-USDC pool
const pool = await setupPool({
  algod,
  assetA: USDC_ASSET_ID,
  assetB: USDC_ASSET_ID,
  biatecFee: 0n,
  lpFee: 0n,
  p: BigInt(SCALE),
  p1: BigInt(SCALE),
  p2: BigInt(SCALE),
});

// User deposits 1000 USDC
await clammAddLiquiditySender({
  amountA: 1000n * BigInt(USDC_DECIMALS),
  amountB: 1000n * BigInt(USDC_DECIMALS),
  // ... other params
});

// Over time, lending interest accrues to the pool
// Executive address distributes interest to LP holders
await clammDistributeExcessAssetsSender({
  amountA: interestAmount,
  amountB: 0n,
  // ... other params
});

// User withdraws their deposit + earned interest
await clammRemoveLiquiditySender({
  lpTokensToSend: lpBalance,
  // ... other params
});
```

## Security Considerations

### Trust Model

Staking pools (B-ALGO, B-USDC, etc.) require trust in specific addresses and processes:

1. **Executive Fee Address Control**: Only the `addressExecutiveFee` account configured in the Biatec Config Provider can distribute rewards via `distributeExcessAssets`. This address has significant power:

   - Can distribute rewards to all LP holders
   - Can influence timing of reward distribution
   - Must accurately calculate reward amounts
   - **Recommendation**: Use a multi-signature account for this address

2. **Config Provider Integrity**: The config provider contract controls critical parameters:
   - Identity provider reference
   - Fee structure
   - Executive addresses
   - **Recommendation**: Ensure config provider is immutable or governed by DAO

### Differences from Liquidity Pools

Staking pools have unique characteristics:

- **No Impermanent Loss**: Since both assets are identical, there's no price risk
- **No Swap Price Discovery**: Rewards come from external sources, not trades
- **Simpler Price Model**: Always 1:1 at base scale
- **Reward Rate Externally Set**: Returns depend on reward distribution by executive address
- **Swap Operations Blocked**: The contract explicitly prevents swaps with error "Swaps not allowed in staking pools"

### Risk Factors

1. **Reward Shortfall**: If rewards aren't distributed as expected, staking yields nothing

   - Mitigation: Monitor executive address activity and reward distribution schedule

2. **Accounting Errors**: Incorrect `distributeExcessAssets` calls could lock funds or distribute unfairly

   - Mitigation: Thoroughly test reward distribution calculations off-chain first
   - Mitigation: Use the base scale (9 decimals) for all calculations

3. **Governance Changes**: Executive fee address change affects control

   - Mitigation: Require timelock for address changes
   - Mitigation: Multi-sig governance for config updates

4. **Price Validation**: Staking pools require `priceMin === priceMax === currentPrice`

   - The contract now enforces this validation in the `bootstrap` function
   - Error code: `E_STAKING_PRICE` if price range is not flat

5. **Asset Order Validation**: Standard pools now enforce `assetA.id < assetB.id` for non-staking pools
   - Staking pools bypass this check when `assetA.id === assetB.id`
   - Error code: `E_ASSET_ORDER` if order is wrong in standard pools

### Reward Distribution Best Practices

1. **Calculate in Base Scale**: Always convert reward amounts to base scale (multiply by 1e9) before calling `distributeExcessAssets`
2. **Verify Pool Balance**: Ensure the pool actually received the reward tokens before distributing
3. **Test First**: Run reward distribution on testnet with small amounts first
4. **Document Schedule**: Clearly communicate reward distribution frequency and amounts
5. **Monitor State**: Track pool liquidity before and after distribution to verify correctness

### Example Safe Reward Distribution

```typescript
// 1. Calculate reward in base scale
const rewardInTokenUnits = 1000n; // 1000 tokens
const tokenDecimals = 6n; // USDC has 6 decimals
const baseScale = 1_000_000_000n;
const rewardInBaseScale = rewardInTokenUnits * (baseScale / 10n ** tokenDecimals);

// 2. Send tokens to pool first
await algod.sendPaymentTransaction({
  from: executiveAddress,
  to: poolAddress,
  amount: rewardInTokenUnits * 10n ** tokenDecimals, // In native units
});

// 3. Distribute via contract
await clammDistributeExcessAssetsSender({
  appBiatecClammPool: poolAppId,
  appBiatecConfigProvider: configAppId,
  assetA: usdcAssetId,
  assetB: usdcAssetId,
  amountA: rewardInBaseScale,
  amountB: 0n,
  // ... other params
});
```

### Security Audits

Multiple AI-powered security audits have been conducted on the staking pool implementation. Key findings addressed:

- **[M-02]** Added validation for same-asset pool price ranges (must be flat)
- **[M-06]** Recommend adding deposit proof to `distributeExcessAssets` for safety
- **General** Staking pools are now explicitly validated during bootstrap

See `audits/` folder for detailed security audit reports.

### User Protection

1. **Reward Calculation**: The `distributeExcessAssets` method increases the pool's liquidity proportionally. Ensure the `amountA` parameter is calculated correctly in base scale (9 decimals).

2. **Price Stability**: Since staking pools use a 1:1 price ratio, the price should remain constant. Any significant deviation may indicate an issue.

3. **Rounding**: As with standard pools, small amounts may be lost to rounding. This is by design to protect the pool from bleeding.

## Testing

See `__test__/pool/staking.test.ts` for comprehensive test examples including:

- Creating a B-ALGO pool
- Creating a B-TOKEN pool with an ASA
- Distributing rewards and verifying LP profit

## Chain-Specific Configuration

Different blockchain networks may use different native token names:

- **Algorand Mainnet/Testnet**: 'ALGO'
- **Voi Network**: 'VOI'
- **Aramid Network**: 'ARAMID'

Use `setNativeTokenName` to configure the provider before deploying pools to ensure the LP token naming matches the target chain.
