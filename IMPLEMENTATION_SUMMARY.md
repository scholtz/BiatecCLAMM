# Staking Pools Implementation Summary

## Overview

This implementation adds support for staking pools to BiatecCLAMM, enabling the creation of interest-bearing tokens where asset A and asset B are the same.

## Changes Made

### Smart Contract Changes

#### BiatecClammPool.algo.ts

1. **Removed asset equality assertion**: Line 185 - Removed `assert(assetA.id !== assetB.id)` to allow same assets
2. **Bootstrap now reads provider state**:
   - Line 179: Fetches `nativeTokenName` from the pool provider global state
   - Purpose: Support different chain names (ALGO, VOI, ARAMID) without extra arguments
3. **Updated doCreatePoolToken**:
   - Line 295: Accepts the resolved `nativeTokenName` value
   - Lines 299-318: Updated LP token naming logic:
     - Staking pools: `B-{AssetName}` with asset symbol
     - Standard pools: `B-{AssetA}-{AssetB}` with 'BLP' symbol
4. **Skip duplicate opt-in**: Lines 222-224 - Only opt-in to assetB if different from assetA

#### BiatecPoolProvider.algo.ts

1. **Native token configuration**:
   - Added `nativeTokenName` global state key with admin-only `setNativeTokenName`
   - `deployPool` no longer accepts a `nativeTokenName` argument; CLAMM bootstrap reads from global state

### TypeScript API Changes

#### src/biatecClamm/txs/clammCreateTxs.ts

1. **Interface update**: Lines 14-15 - Removed optional `nativeTokenName?: string` parameter
2. **Parameter removal**: Deploy calls no longer forward a native token argument
3. **Box reference handling**: Lines 73-81 - Handle duplicate box references when assets are same

#### src/biatecClamm/sender/clammCreateSender.ts

1. **Interface update**: Line 21 - Removed optional `nativeTokenName?: string` parameter
2. **Provider configuration**: Callers rely on pool provider `setNativeTokenName`

### Test Infrastructure

#### **test**/pool/shared-setup.ts

1. **Interface update**: Lines 63-69 - Added `assetB?: bigint` and `nativeTokenName?: string`
2. **Asset handling**: Lines 87-106 - Support explicit assetB parameter or create default
3. **Provider configuration**: Line 198 - Configure native token name through `setNativeTokenName`

#### **test**/pool/staking.test.ts (NEW)

Comprehensive test suite with three test cases:

1. **Native Token Pool Test**:

   - Creates B-ALGO pool (assetA = assetB = 0)
   - Verifies LP token name is 'B-ALGO'
   - Verifies LP token unit name is 'ALGO'

2. **Asset Pool Test**:

   - Creates test token and B-TEST pool (assetA = assetB = testAssetId)
   - Verifies both assets are the same in pool state
   - Verifies LP token naming matches asset

3. **Staking Rewards Test**:
   - Creates B-ALGO pool
   - Adds initial liquidity
   - Sends 100 ALGO rewards to pool
   - Distributes rewards using clammDistributeExcessAssetsSender
   - Verifies liquidity increases
   - Withdraws and verifies profit

### Documentation

#### docs/staking-pools.md (NEW)

Complete guide covering:

- Overview and use cases
- Pool characteristics
- How it works (4 steps: creation, staking, rewards, unstaking)
- Technical details
- Examples for B-ALGO and B-USDC
- Security considerations
- Testing instructions
- Chain-specific configuration

#### README.md

Added staking pools section with:

- Quick start examples
- Pool creation code
- Reward distribution code
- Key features list
- Use cases

#### .github/copilot-instructions.md

Added staking pools section covering:

- Same asset pool support
- Native token staking
- Asset staking
- Reward distribution
- Testing references
- Documentation links

## Breaking Changes

None - fully backward compatible. Existing pools work exactly as before.

## New Features

1. ✅ Create staking pools with assetA = assetB
2. ✅ Support native token pools (B-ALGO, B-VOI, B-ARAMID)
3. ✅ Support ASA staking pools (B-USDC, B-TOKEN, etc.)
4. ✅ Distribute rewards to LP holders proportionally
5. ✅ Multi-chain support via provider `setNativeTokenName`
6. ✅ Interest-bearing token functionality

## Testing

Tests require Algorand sandbox:

```bash
algokit localnet start
npm run build
npm run test -- __test__/pool/staking.test.ts
```

## Use Cases Enabled

1. **Native Token Staking**: Stake ALGO and earn consensus/governance rewards
2. **Lending Protocols**: Create B-USDC for interest-bearing deposits
3. **Revenue Sharing**: Distribute protocol fees to token holders
4. **Yield Aggregation**: Combine multiple yield sources into one token

## Files Changed

- `contracts/BiatecClammPool.algo.ts`
- `contracts/BiatecPoolProvider.algo.ts`
- `src/biatecClamm/txs/clammCreateTxs.ts`
- `src/biatecClamm/sender/clammCreateSender.ts`
- `__test__/pool/shared-setup.ts`
- `__test__/pool/staking.test.ts` (new)
- `__test__/BiatecClammPool.test.ts`
- `docs/staking-pools.md` (new)
- `README.md`
- `.github/copilot-instructions.md`

## Code Review Status

✅ Code review completed
✅ All feedback addressed
✅ Ready for final testing

## Next Steps

1. Run local tests with Algorand sandbox
2. Deploy to testnet for integration testing
3. Update client documentation
4. Announce new feature

## Security Notes

- Only executive fee address can distribute rewards
- Rounding always favors the pool (prevents bleeding)
- Price should remain 1:1 for staking pools
- Reward amounts must be in base scale (9 decimals)
