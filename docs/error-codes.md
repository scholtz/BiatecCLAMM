# BiatecCLAMM Error Codes Reference

This document provides a comprehensive reference of all error codes used in the BiatecCLAMM smart contract system. Understanding these error codes will help developers debug issues and provide better user experiences.

## Error Code Format

Error codes follow a consistent format:
- **Short codes**: 3-4 character codes prefixed with `E_` or `ERR-`
- **Example**: `E_CONFIG`, `ERR-LOW-VER`

## Core Contract Errors

### BiatecClammPool

#### Configuration and Initialization Errors

| Code | Description | Cause | Resolution |
|------|-------------|-------|------------|
| `E_CONFIG` | Configuration app mismatch | Provided config app ID doesn't match registered config | Verify correct config app reference |
| `E_UPDATER` | Not authorized updater | Sender is not the authorized updater address | Use correct updater account |
| `E_SENDER` | Unauthorized sender | Sender not authorized for this operation | Use authorized account (creator, executive, etc.) |
| `E_PRICE_MAX` | Bootstrap already called | Cannot bootstrap twice | Pool already initialized |
| `E_PRICE` | Invalid price | Price must be greater than zero | Set valid price values |
| `E_FEE` | Bootstrap already done | Fee already set, cannot bootstrap again | Pool already initialized |
| `E_PAUSED` | Services paused | Protocol is currently paused by admin | Wait for unpause or contact admin |
| `E_STAKING_PRICE` | Invalid staking pool price | Same-asset pools require flat price range | Set priceMin === priceMax for staking pools |
| `E_ASSET_ORDER` | Invalid asset order | Asset A must be less than Asset B | Ensure assetA.id < assetB.id |

#### Liquidity and Balance Errors

| Code | Description | Cause | Resolution |
|------|-------------|-------|------------|
| `E_ZERO_LIQ` | Zero liquidity | Liquidity is zero before division | Ensure pool has liquidity |
| `E_ZERO_DENOM` | Zero denominator | Denominator in calculation is zero | Check input parameters |
| `ERR-LIQ-DROP` | Liquidity drop exceeded | Liquidity decreased more than allowed | Check for rounding errors or state inconsistency |
| `ERR-TOO-MUCH` | Excessive withdrawal | Attempting to withdraw more than available | Reduce withdrawal amount |
| `ERR-BALANCE-CHECK-1` | Balance check failed (Asset A) | Asset A balance inconsistent | Check pool state |
| `ERR-BALANCE-CHECK-2` | Balance check failed (Asset B) | Asset B balance inconsistent | Check pool state |

#### Identity and Verification Errors

| Code | Description | Cause | Resolution |
|------|-------------|-------|------------|
| `ERR-INVALID-CONFIG` | Invalid config app | Config app doesn't match pool's registered config | Use correct config app reference |
| `ERR-WRONG-IDENT` | Wrong identity provider | Identity provider doesn't match config | Use correct identity provider |
| `ERR-USER-LOCKED` | User account locked | User account is locked by identity provider | Contact support to unlock |
| `ERR-LOW-VER` | Verification class too low | User's verification class below minimum | Complete required KYC verification |
| `ERR-HIGH-VER` | Verification class out of bounds | Verification class exceeds maximum (4) | Check identity provider data |

#### Swap Errors

| Code | Description | Cause | Resolution |
|------|-------------|-------|------------|
| `E_ASSET_A` | Invalid Asset A | Asset A doesn't match pool's Asset A | Use correct asset |
| `E_ASSET_B` | Invalid Asset B | Asset B doesn't match pool's Asset B | Use correct asset |
| `Swaps not allowed in staking pools` | Swap attempt in staking pool | Cannot swap in same-asset pools | Use add/remove liquidity instead |
| `Minimum to receive is not met` | Slippage protection triggered | Output less than minimumToReceive | Increase slippage tolerance or retry |

### BiatecConfigProvider

| Code | Description | Cause | Resolution |
|------|-------------|-------|------------|
| `Only addressUdpater setup in the config can update application` | Unauthorized update attempt | Sender is not the updater | Use authorized updater address |
| `E_PAUSED` | Services paused | Protocol paused globally | Wait for admin to unpause |

### BiatecIdentityProvider

| Code | Description | Cause | Resolution |
|------|-------------|-------|------------|
| `Configuration app does not match` | Config mismatch | Provided config doesn't match registered | Use correct config app |
| `Only addressUdpater setup in the config can update application` | Unauthorized update | Not the authorized updater | Use updater account |
| `ERR_PAUSED` | Services paused | Protocol currently paused | Wait for unpause |
| `FeeMultiplierBase must be set properly` | Invalid fee multiplier | Fee multiplier must equal SCALE | Set feeMultiplierBase to SCALE (1000000000) |
| `Verification class out of bounds` | Invalid verification class | Class must be 0-4 | Use valid verification class |

### BiatecPoolProvider

| Code | Description | Cause | Resolution |
|------|-------------|-------|------------|
| `E_CONFIG` | Config mismatch | Provided config doesn't match registered | Use registered config app |
| `Configuration app does not match` | Config app mismatch | Wrong config app provided | Verify config app ID |
| `Only addressUdpater setup in the config can update application` | Unauthorized update | Sender not authorized updater | Use updater account |
| `ERR_PAUSED` | Services paused | Protocol is paused | Wait for admin action |
| `Pool already registered` | Duplicate pool registration | Pool or config already exists | Check existing pools |

## Common Error Scenarios

### Pool Creation Failures

**Error**: `E_STAKING_PRICE`
```
Cause: Creating a staking pool (assetA === assetB) with priceMin !== priceMax
Solution: For staking pools, set priceMin = priceMax = 1000000000 (SCALE)
```

**Error**: `E_CONFIG` in deployPool
```
Cause: Attempting to deploy pool with non-registered config app
Solution: Use the canonical config app registered with the pool provider
```

### Swap Failures

**Error**: `ERR-LOW-VER`
```
Cause: User's verification class insufficient for pool requirements
Solution: Complete additional KYC/identity verification to raise class
```

**Error**: `Swaps not allowed in staking pools`
```
Cause: Attempting to swap in a B-ALGO or B-USDC staking pool
Solution: Use distributeExcessAssets for rewards, add/remove liquidity only
```

**Error**: `Minimum to receive is not met`
```
Cause: Price moved unfavorably during transaction, slippage protection triggered
Solution: Increase minimumToReceive tolerance or wait for better price
```

### Liquidity Provision Failures

**Error**: `E_ZERO_LIQ`
```
Cause: Attempting operation when pool has zero liquidity
Solution: Initialize pool with liquidity first
```

**Error**: `ERR-LIQ-DROP`
```
Cause: Liquidity calculation resulted in unacceptable decrease
Solution: Check for calculation errors or rounding issues
```

### Administrative Operation Failures

**Error**: `E_UPDATER` or `E_SENDER`
```
Cause: Trying to perform admin function without proper authorization
Solution: Use the designated admin account (addressUpdater, addressExecutiveFee, etc.)
```

**Error**: `E_PAUSED`
```
Cause: Protocol-wide pause is active
Solution: Wait for admin to unpause services, or contact protocol governance
```

## Error Handling Best Practices

### For Developers

1. **Always Check Config**: Ensure all app references (config, identity, pool provider) are correct
2. **Validate Inputs**: Check asset IDs, amounts, and slippage parameters before submission
3. **Handle Pause State**: Check if protocol is paused before attempting operations
4. **Use Try-Catch**: Wrap contract calls in try-catch and parse error messages
5. **Log Errors**: Log full error context for debugging

### For Users

1. **Identity Verification**: Ensure your account has sufficient verification class
2. **Slippage Tolerance**: Set appropriate slippage protection for volatile markets
3. **Pool Type**: Understand difference between liquidity pools and staking pools
4. **Account Status**: Verify your account is not locked before transactions

## Debugging Tips

### Finding Error Context

When an error occurs:

1. **Check Transaction Logs**: Use Algorand indexer to view transaction details
2. **Verify App References**: Ensure all application IDs match expected values
3. **Check Global State**: Read global state of config/identity/pool apps
4. **Inspect Box Storage**: Verify box references are included in transaction
5. **Review Recent Changes**: Check if protocol was recently updated or paused

### Common Misconfigurations

- **Wrong Config App**: Using testnet config on mainnet or vice versa
- **Missing Box References**: Forgetting to include required box references
- **Incorrect App Order**: Apps must be in correct order in foreign apps array
- **Insufficient Fees**: Not enough fees for complex operations requiring opcode budget increases

## Error Recovery

### For Recoverable Errors

Most errors are recoverable by correcting the issue and retrying:

- Identity verification: Complete required KYC
- Config errors: Use correct app references
- Slippage: Adjust tolerance and retry
- Pause: Wait for services to resume

### For Unrecoverable Errors

Some errors require admin intervention:

- Account locked: Contact identity provider
- Protocol paused: Wait for governance decision
- Contract bugs: Report to developers

## Support

If you encounter an error not documented here or need assistance:

1. **GitHub Issues**: Open issue with full error details
2. **Documentation**: Check docs/ folder for guides
3. **Audit Reports**: Review audits/ folder for known issues
4. **Community**: Join community channels for support

---

**Last Updated**: 2025-10-27
**Version**: 1.0
**Maintained By**: BiatecCLAMM Team
