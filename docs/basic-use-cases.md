# Biatec CLAMM Basic Use Cases

This guide walks through the day-to-day flows supported by the Biatec concentrated liquidity AMM (CLAMM). It focuses on instantiating clients, funding liquidity inside a price band or at a constant price, removing liquidity, executing swaps, and consuming the pool-provider oracle feed. Advanced topics such as rounding behaviour and staking-specific flows are covered in the existing documents under `docs/`.

## Prerequisites

- Access to an Algorand network (Sandbox LocalNet, TestNet, or MainNet) and an `Algodv2` RPC endpoint.
- Deployed instances of the Biatec configuration provider, identity provider, and pool provider contracts. The examples below assume their app IDs are already known.
- A funded account represented as an `Algokit` `TransactionSignerAccount` to sign transactions.
- Familiarity with the 1e9 base scale (`SCALE = 1_000_000_000n`) used by the contracts. See `docs/liquidity-rounding.md` for precision details.
- Optional but recommended: use `getConfig(genesisId)` to pull the latest production app IDs for supported networks instead of hard-coding them.

## Shared Setup

```typescript
import algosdk from 'algosdk';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { mnemonicToSecretKey } from 'algosdk';
import { clientBiatecClammPool, BiatecPoolProviderClient, getConfig } from 'biatec-concentrated-liquidity-amm';

const ALGOD_URL = 'http://localhost:4001';
const ALGOD_TOKEN = 'a'.repeat(64);
const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');

const algorand = AlgorandClient.fromConfig({ algod });

const { addr, sk } = mnemonicToSecretKey(process.env.MNEMONIC!);
const signerAccount = {
  addr,
  signer: async (txs: algosdk.Transaction[], indexes: number[]) => {
    const signed = txs.map((tx) => tx.signTxn(sk));
    return indexes.map((i) => signed[i]);
  },
};

const {
  configAppId: configProviderAppId,
  identityAppId: identityProviderAppId,
  poolProviderAppId,
} = getConfig('testnet-v1.0');
const poolProviderClient = new BiatecPoolProviderClient({
  algorand,
  appId: poolProviderAppId,
});

// Point the CLAMM client at an existing pool once you know its app ID.
const poolAppId = 45678n;
const poolClient = clientBiatecClammPool({
  algorand,
  appId: poolAppId,
});
```

> **Tip:** Use the helper in `src/biatecClamm/getPools.ts` to discover pools managed by the pool provider when you only know an asset ID or verification class.

## Creating a Pool (Price Range vs Constant Price)

Pool creation is handled by `clammCreateSender`. Pass `priceMin`, `priceMax`, and `currentPrice` in base scale (1e9). Setting `priceMin === priceMax` pins the pool to a constant price, which is how staking pools are created.

```typescript
import { clammCreateSender } from 'biatec-concentrated-liquidity-amm';

const SCALE = 1_000_000_000n;

const poolClient = await clammCreateSender({
  transactionSigner: signerAccount,
  clientBiatecPoolProvider: poolProviderClient,
  appBiatecConfigProvider: configProviderAppId,
  assetA: 9581n,
  assetB: 0n, // 0n indicates the native token
  fee: 10_000_000n, // 1% fee expressed in base scale
  verificationClass: 0,
  priceMin: SCALE / 2n,
  priceMax: SCALE * 2n,
  currentPrice: SCALE,
  nativeTokenName: 'ALGO',
});

// clammCreateSender automatically calls bootstrapStep2, so the pool is ready for deposits.
```

For constant-price staking pools, reuse the snippet above and set `priceMin`, `priceMax`, and `currentPrice` to the same base-scale value (usually `SCALE`). See `docs/staking-pools.md` for additional staking-specific guidance.

## Supplying Liquidity

`clammAddLiquiditySender` wraps the grouped transaction set required to deposit both assets and reference the pool-provider metadata.

```typescript
import { clammAddLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammAddLiquiditySender({
  clientBiatecClammPool: poolClient,
  clientBiatecPoolProvider: poolProviderClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  assetADeposit: 2_500_000n, // amount in the asset's native decimals
  assetBDeposit: 2_500_000n,
});
```

- The sender automatically opts into the LP token if needed.
- Deposits must respect the pool’s price range. When adding liquidity to a wide range, size both deposits according to the ratios exposed by the off-chain calculators under `contracts/clients/BiatecPoolProviderClient.ts` (`calculateAsset*` queries).
- For detailed rounding expectations, read `docs/liquidity-rounding.md` and `docs/liquidity-fee-protection.md`.

## Withdrawing Liquidity

`clammRemoveLiquiditySender` burns LP tokens in exchange for the underlying assets plus accrued fees.

```typescript
import { clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammRemoveLiquiditySender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  lpToSend: 3_000_000n,
});
```

Use the `clammRemoveLiquidityAdminSender` helper if you need an administrative withdrawal that bypasses the identity checks (reserved for governance flows).

## Swapping Assets

`clammSwapSender` executes a swap in either direction. Provide the asset you are sending, the amount, and the minimum amount you are willing to receive (after fees) in the counter asset.

```typescript
import { clammSwapSender } from 'biatec-concentrated-liquidity-amm';

await clammSwapSender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  appBiatecPoolProvider: poolProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  fromAsset: 9581n,
  fromAmount: 10_000_000n,
  minimumToReceive: 9_800_000n,
});
```

The swap helper attaches pool-provider and identity box references automatically. To estimate output amounts before submitting a swap, call the read-only calculator methods exposed on `BiatecPoolProviderClient` (for example, `clientBiatecPoolProvider.getPrice` or the `calculateAsset*` family of methods).

## Consuming the Pool-Provider Oracle Feed

The Biatec pool provider maintains on-chain oracle data for each asset pair. Call the generated `getPrice` method with `appPoolId = 0n` to retrieve the aggregated metrics. The return value is already decoded into camelCase fields.

```typescript
const priceInfo = await poolProviderClient.appClient.getPrice({
  args: {
    assetA: 0n,
    assetB: 9581n,
    appPoolId: 0n, // zero => aggregated across all pools for the pair
  },
});

console.log('latest price (base scale):', priceInfo.latestPrice);
console.log('period1 VWAP (base scale):', priceInfo.period1NowVwap);
console.log('most recent trade fee (asset A):', priceInfo.period1NowFeeA);
```

When you need pool-specific oracle data, pass the CLAMM app ID as `appPoolId` instead of zero. The method returns the same `AppPoolInfo` structure in both cases.

## Additional Operations

- **Distribute rewards:** `clammDistributeExcessAssetsSender` credits staking or fee rewards to LP holders. Amounts must be expressed in the 1e9 base scale.
- **Withdraw protocol fees:** `clammWithdrawExcessAssetsSender` lets the fee executor retrieve accumulated protocol revenue.
- **Toggle validator status:** `clammSendOnlineKeyRegistrationSender` and `clammSendOfflineKeyRegistrationSender` wrap the AVM key registration flows when the pool account stakes on consensus chains.
- **Pool discovery and quoting:** `getPools` (from `src/biatecClamm/getPools.ts`) enumerates registry entries; the generated pool-provider client exposes pure functions for sizing deposits and withdrawals (e.g., `calculateAssetADepositOnAssetBDeposit`).

## Recommended Reading

- `docs/liquidity-rounding.md` for rounding and precision rules.
- `docs/liquidity-fee-protection.md` for fee accounting guarantees.
- `docs/staking-pools.md` for constant-price (same-asset) staking scenarios.

These building blocks cover the standard user journey: create or discover a pool, provide liquidity with the correct price bounds, earn fees, execute swaps, and rely on the pool provider for oracle-grade price data.
