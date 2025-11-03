# Network Fees

This document explains the fee structure and mechanics in BiatecCLAMM concentrated liquidity pools.

## Overview

BiatecCLAMM implements a multi-tier fee system designed to compensate liquidity providers while maintaining protocol sustainability. Fees are collected during swap operations and distributed between liquidity providers and the protocol.

Users pay two types of fees:

1. **Protocol Fees**: Trading fees that go to liquidity providers and the protocol (currently 20% of LP fees go to Biatec)
2. **Network Fees**: Algorand blockchain fees required for transaction processing

## Algorand Network Fees

In addition to protocol fees, users must pay Algorand blockchain network fees for each transaction. These are paid in ALGO and cover the computational cost of processing transactions on the network.

### Minimum Transaction Fees

- **Base Fee**: 1,000 microAlgos (0.001 ALGO) per transaction
- **Application Calls**: Additional fees based on complexity and resource usage
- **Grouped Transactions**: Each transaction in a group pays the minimum fee

### Pool Creation Fees

Creating a new liquidity pool requires multiple transactions and has the highest network fees due to Minimum Balance Requirements (MBR) for the new pool account. **Note**: Pool creation requires a significant upfront investment of ~5 ALGO for MBR compliance.

**Transaction Breakdown:**

- Pool deployment transaction: 10,000 microAlgos (0.01 ALGO) static fee
- Pool provider NOOP calls: 2 × 1,000 microAlgos (0.002 ALGO)
- Minimum Balance Requirement (MBR): 5,000,000 microAlgos (5 ALGO) - required for pool account
- Bootstrap step 2: 5,000 microAlgos (0.005 ALGO) extra fee

**Total Network Fee**: ~5.018 ALGO (including MBR requirement)
**Total Transactions**: 4-6 transactions in a group

### Add Liquidity Fees

Adding liquidity to an existing pool:

**Transaction Breakdown:**

- Main add liquidity call: 8,000 microAlgos (0.008 ALGO) static fee
- Asset transfer transactions: 1-2 × 1,000 microAlgos (0.001-0.002 ALGO)
- Pool provider NOOP call: 1,000 microAlgos (0.001 ALGO)
- LP token opt-in (if needed): 1,000 microAlgos (0.001 ALGO)

**Total Network Fee**: ~0.011-0.013 ALGO
**Total Transactions**: 3-5 transactions in a group

### Swap Fees

Performing a token swap:

**Transaction Breakdown:**

- Main swap call: 12,000 microAlgos (0.012 ALGO) static fee
- Asset transfer transaction: 1,000 microAlgos (0.001 ALGO)

**Total Network Fee**: ~0.013 ALGO
**Total Transactions**: 2-3 transactions in a group

### Remove Liquidity Fees

Withdrawing liquidity from a pool:

**Transaction Breakdown:**

- Main remove liquidity call: 12,000 microAlgos (0.012 ALGO) static fee
- LP token transfer: 1,000 microAlgos (0.001 ALGO)

**Total Network Fee**: ~0.013 ALGO
**Total Transactions**: 1-2 transactions in a group

### Fee Optimization

The protocol uses transaction grouping to minimize network fees:

- **Atomic Transactions**: All operations in a group succeed or fail together
- **Shared References**: Box and app references are shared across grouped transactions
- **Efficient State Access**: Minimal on-chain state reads/writes

### Fee Estimation in Code

When estimating total user cost, include both protocol and network fees:

```typescript
// Protocol fee estimation
const protocolFee = (swapAmount * lpFeeRate) / SCALE;

// Network fee estimation (approximate)
const networkFee = 13000; // microAlgos for swap operations

// Total user cost
const totalCost = swapAmount + protocolFee + networkFee / 1_000_000; // Convert to ALGO
```

## Fee Types

### 1. Liquidity Provider (LP) Fees

**Definition**: Fees charged on swap transactions that compensate liquidity providers for providing capital to the pool.

**Configuration**:

- Set per individual pool (not globally)
- Range: 0% to 100% (represented in 9 decimal places)
- Example: 10% fee = `100_000_000` (0.1 \* 10^9)
- Stored in pool contract state as `fee`

**Calculation**: Applied to the incoming swap amount before calculating the swap output.

```typescript
// Fee calculation in swap function
const feesMultiplier = (s - ((this.fee.value as uint256) * (user.feeMultiplier as uint256)) / (user.base as uint256)) as uint256;
const inAssetAfterFee = (inAssetInBaseScale * feesMultiplier) / s;
```

### 2. Biatec Protocol Fees

**Definition**: A percentage of LP fees that the protocol collects for operational sustainability.

**Configuration**:

- Set globally in the BiatecConfigProvider contract
- **Current Rate**: 20% of LP fees
- Maximum: 50% of LP fees, Minimum 0% of LP fees (enforced by contract)
- Stored as `biatecFee` in config contract
- Example: 10% of LP fees = `100_000_000` (0.1 \* 10^9)

**Distribution**: When Biatec fees are enabled, collected fees are split between users and the protocol:

```typescript
if (biatecFee === 0n) {
  const usersLiquidityFromFeeIncrement = diff;
  this.LiquidityUsersFromFees.value = this.LiquidityUsersFromFees.value + usersLiquidityFromFeeIncrement;
} else {
  const usersLiquidityFromFeeIncrement = (diff * (s - biatecFee)) / s;
  const biatecLiquidityFromFeeIncrement = diff - usersLiquidityFromFeeIncrement;
  this.LiquidityUsersFromFees.value = this.LiquidityUsersFromFees.value + usersLiquidityFromFeeIncrement;
  this.LiquidityBiatecFromFees.value = this.LiquidityBiatecFromFees.value + biatecLiquidityFromFeeIncrement;
}
```

### 3. User Fee Multipliers

**Definition**: Fee discounts or surcharges based on user identity verification level and activity.

**Configuration**:

- Determined by identity verification class and user activity level
- **Range**: 1.0 to 2.0 (multiplier applied to base LP fees)
- **Base Multiplier**: 2.0 (anonymous users pay 2x the base LP fee)
- Verified users can receive discounts down to 1.0x (no surcharge)
- Applied as multiplier to base LP fees

**Activity-Based Determination**:

- **Anonymous Users**: 2.0x multiplier (double fees)
- **Verified Basic**: 1.5x multiplier (50% surcharge)
- **Verified Advanced**: 1.2x multiplier (20% surcharge)
- **Verified Premium**: 1.0x multiplier (no surcharge)

**Source**: Retrieved from BiatecIdentityProvider contract during swap operations.

## Fee Collection Process

### During Swaps

1. **Input Amount**: User sends tokens to swap
2. **Fee Deduction**: LP fees are deducted from input amount
3. **User Multiplier**: Identity-based fee multiplier is applied
4. **Swap Calculation**: Output amount calculated using adjusted input
5. **Liquidity Update**: Pool liquidity increases by fee amount
6. **Fee Distribution**: Fees split between users and Biatec (if configured)

### Fee Accounting

Fees are tracked in pool state as additional liquidity:

- `LiquidityUsersFromFees`: Fees belonging to liquidity providers
- `LiquidityBiatecFromFees`: Fees collected by the protocol

These values represent unrealized fee liquidity that increases the value of LP tokens.

## Fee Withdrawal

### For Liquidity Providers

LP fees are automatically included when withdrawing liquidity. The withdrawal calculation accounts for fee accrual:

```typescript
// Fee-adjusted withdrawal calculation
const percentageOfL = (lpAmount * s) / totalLpSupply;
const assetAOut = (assetABalance * percentageOfL) / s;
const assetBOut = (assetBBalance * percentageOfL) / s;
```

### For Protocol Fees

Protocol fees can be withdrawn by the designated executive fee address using `distributeExcessAssets` or `withdrawExcessAssets` methods.

## Fee Protection Mechanisms

### New LP Protection

To prevent new liquidity providers from claiming historical fees, the protocol uses a quadratic formula when minting LP tokens:

```
X^2 + X(sumDistributedAndFees − Q) − Q * distributedBefore = 0
```

This ensures new LPs cannot immediately withdraw historical fees that belong to existing providers.

### Rounding Behavior

- LP token calculations use flooring to favor existing liquidity providers
- Small rounding differences (< 20% of base scale) may occur but remain in the pool
- Withdrawals may return slightly less than deposits due to fee protection

## Fee Examples

### Example 1: 1% LP Fee, No Biatec Fee

```
Swap Input: 100 USDC
LP Fee: 1% = 1 USDC
Effective Input: 99 USDC
Output: Calculated based on 99 USDC
Fee Added to Pool: 1 USDC worth of liquidity
Distribution: 100% to liquidity providers
```

### Example 2: 1% LP Fee, 20% Biatec Fee

```
Swap Input: 100 USDC
LP Fee: 1% = 1 USDC
Biatec Fee: 20% of LP fee = 0.2 USDC
User Fee: 80% of LP fee = 0.8 USDC
Effective Input: 99 USDC
Output: Calculated based on 99 USDC
Distribution: 0.8 USDC to LPs, 0.2 USDC to protocol
```

### Example 3: With User Fee Multiplier (Anonymous User)

```
Base LP Fee: 1% = 1 USDC
User Multiplier: 2.0 (anonymous user - double fees)
Effective Fee: 2.0 USDC
Biatec Fee: 20% of effective fee = 0.4 USDC
User Fee: 80% of effective fee = 1.6 USDC
Effective Input: 98 USDC
Output: Calculated based on 98 USDC
Distribution: 1.6 USDC to LPs, 0.4 USDC to protocol
```

### Example 4: With User Fee Multiplier (Verified Premium User)

```
Base LP Fee: 1% = 1 USDC
User Multiplier: 1.0 (verified premium - no surcharge)
Effective Fee: 1.0 USDC
Biatec Fee: 20% of effective fee = 0.2 USDC
User Fee: 80% of effective fee = 0.8 USDC
Effective Input: 99 USDC
Output: Calculated based on 99 USDC
Distribution: 0.8 USDC to LPs, 0.2 USDC to protocol
```

## Configuration

### Setting LP Fees

LP fees are configured per pool during creation via the pool provider contract.

### Setting Biatec Fees

Biatec fees are set globally by the executive address:

```typescript
// Only addressExecutive can set Biatec fees
bootstrap(biatecFee: uint256, ...): void
```

### Fee Limits

- **LP Fees**: 0% to 100%
- **Biatec Fees**: 0% to 50% of LP fees (currently set to 20%)
- **User Multipliers**: 1.0 to 2.0 (based on identity verification and activity)

## Monitoring Fees

### Pool Status

Use the `status()` method to monitor fee accumulation:

```typescript
const poolStatus = await poolClient.status({
  appBiatecConfigProvider,
  assetA,
  assetB,
  assetLp,
});

console.log('LP Fees:', poolStatus.liquidityUsersFromFees);
console.log('Biatec Fees:', poolStatus.liquidityBiatecFromFees);
console.log('Current Fee Rate:', poolStatus.fee);
console.log('Biatec Fee Rate:', poolStatus.biatecFee);
```

### Fee Tracking

The pool provider contract tracks fee statistics across multiple periods for analytics.

## Security Considerations

### Fee Manipulation

- Fees cannot be changed retroactively
- Fee settings are immutable once pools are created
- Protocol fees require executive multisig approval

### Fee Distribution

- Fee withdrawal requires proper authorization
- Excess asset distribution is restricted to executive addresses
- All fee operations are logged and verifiable

## Integration Guidelines

### Fee Estimation

When building user interfaces, always estimate fees:

```typescript
const estimatedFee = (inputAmount * lpFee) / SCALE;
const effectiveInput = inputAmount - estimatedFee;
```

### Slippage Calculation

Include fees in slippage calculations:

```typescript
const minimumOutput = expectedOutput * (1 - slippageTolerance - feeRate);
```

### Fee Display

Clearly show all applicable fees to users:

- LP fee rate
- Biatec fee rate (if applicable)
- User fee multiplier effect
- Total effective fee
- Estimated network fees in ALGO

## Testing

The protocol includes comprehensive fee testing scenarios:

- Various LP fee rates (0%, 1%, 10%)
- Biatec fee combinations (0%, 50%)
- User fee multipliers
- Fee withdrawal scenarios
- Fee protection mechanisms

Test data files are available in `__test__/test-data/` for validation.
