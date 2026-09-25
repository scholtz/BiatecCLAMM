# Biatec

First gold and silver coins in usage at 500 BC to 100 BC around Bratislava area were minted with label BIATEC. Slovak National Bank used the Biatec coin image on the official slovak fiat currency before EUR was adopted.

We believe that Algorand and whole AVM ecosystem provides new form of digital identity and payments solutions. The brand name Biatec creates for us historic narrative as we live now the historic moments of early crypto adoption.

Algorand is novel distributed ledger technology (DLT) which does not fork because of efficiency of PPoS. It provides instant transaction finality, sub 3 second economic finality and has highest AMM swap throughput. Users do not pay for failed transactions and each transfer of value even in milions costs less then a penny.

[www.biatec.io](https://www.biatec.io)

## Biatec DEX

We are building DEX like solution which will utilize the Automated Market Maker smart contracts, mainly the Concentrated liquidity AMM algorithm.

This work has been performed with support from the Algorand Foundation xGov Grants Program - [xGov#80](https://github.com/algorandfoundation/xGov/blob/main/Proposals/xgov-80.md).

## Biatec Concentrated Liquidity Smart Contract

This repo is dedicated to Biatec CL AMM Smart contract.

## Tests

![Tests](https://raw.githubusercontent.com/scholtz/BiatecCLAMM/main/img/tests.png)

## NPM package

```
npm i biatec-concentrated-liquidity-amm
```

## Examples

### Retrieve deployed app IDs

```ts
import { getConfig } from 'biatec-concentrated-liquidity-amm';

const { configAppId, identityAppId, poolProviderAppId } = getConfig('testnet-v1.0');
```

Supported genesis IDs are `mainnet-v1.0`, `voimain-v1.0`, and `testnet-v1.0`. The helper throws if you pass an unsupported network so deployments stay explicit.

## Add liquidity

```
import {clientBiatecClammPool, clammAddLiquiditySender} from "biatec-concentrated-liquidity-amm"

const client = clientBiatecClammPool({
  appId: .. ,
  sender: ..;
  algod: ..;
})
const txId = await clammAddLiquiditySender({
  clientBiatecClammPool,
  account: TransactionSignerAccount,
  algod: algosdk.Algodv2,

  appBiatecConfigProvider: bigint,
  appBiatecIdentityProvider: bigint,
  assetA: bigint,
  assetB: bigint,
  assetLP: bigint,

  assetADeposit: bigint,
  assetBDeposit: bigint,
})
```

## SWAP

```
import {clientBiatecClammPool, clammSwapSender} from "biatec-concentrated-liquidity-amm"

const client = clientBiatecClammPool({
  appId: .. ,
  sender: ..;
  algod: ..;
})
const txId = await clammSwapSender({
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLP: bigint;

  assetADeposit: bigint;
  assetBDeposit: bigint;
})
```

## Remove liquidity and collect fees

```
import {clientBiatecClammPool, clammRemoveLiquiditySender} from "biatec-concentrated-liquidity-amm"

const client = clientBiatecClammPool({
  appId: .. ,
  sender: ..;
  algod: ..;
})
const txId = await clammRemoveLiquiditySender({
  clientBiatecClammPool: BiatecClammPoolClient;
  account: TransactionSignerAccount;
  algod: algosdk.Algodv2;

  appBiatecConfigProvider: bigint;
  appBiatecIdentityProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  assetLP: bigint;

  lpToSend: bigint;
})
```

## Staking Pools (NEW)

BiatecCLAMM now supports staking pools where asset A and asset B are the same token. This enables creation of interest-bearing tokens like B-ALGO, B-USDC, etc.

### Creating a Native Token Staking Pool (B-ALGO)

```typescript
import { clammCreateSender } from 'biatec-concentrated-liquidity-amm';

await poolProviderClient.send.setNativeTokenName({
  args: {
    appBiatecConfigProvider: configAppId,
    nativeTokenName: 'Algo',
  },
  appReferences: [configAppId],
});

const poolClient = await clammCreateSender({
  transactionSigner: signerAccount,
  clientBiatecPoolProvider: poolProviderClient,
  appBiatecConfigProvider: configAppId,
  assetA: 0n, // Native token (ALGO)
  assetB: 0n, // Same as asset A
  fee: 0n, // No fee
  verificationClass: 0,
  priceMin: BigInt(SCALE),
  priceMax: BigInt(SCALE),
  currentPrice: BigInt(SCALE),
});
```

### Distributing Staking Rewards

```typescript
import { clammDistributeExcessAssetsSender } from 'biatec-concentrated-liquidity-amm';

// After rewards accrue to the pool (e.g., from consensus rewards)
// Note: rewardsAmount should already be in asset decimals (e.g., microAlgos)
// Convert to base scale (9 decimals) by multiplying with scale factor
const rewardsInBaseScale = (rewardsAmount * BigInt(SCALE)) / BigInt(assetDecimals);

const txId = await clammDistributeExcessAssetsSender({
  algod,
  account: executiveSigner,
  amountA: rewardsInBaseScale, // Amount in base scale (9 decimals)
  amountB: 0n,
  appBiatecConfigProvider: configAppId,
  assetA: 0n,
  assetB: 0n,
  clientBiatecClammPool: poolClient,
});
```

For complete documentation, see [docs/staking-pools.md](docs/staking-pools.md).

### Key Features:

- **Create Interest-Bearing Tokens**: Build B-ALGO, B-USDC, or any B-{TOKEN}
- **Support Multi-Chain Networks**: Works with ALGO, VOI, ARAMID chains
- **Distribute Rewards to LP Holders**: Share staking rewards, interest, or fees
- **Enable Flexible Use Cases**: Power lending protocols, yield aggregation, revenue sharing

### Use Cases:

1. **Native Token Staking**: B-ALGO pools for staking ALGO with consensus rewards
2. **Asset Staking**: B-USDC pools for lending protocol interest
3. **Revenue Sharing**: Distribute protocol fees to token holders
4. **Yield Aggregation**: Combine multiple yield sources

## Documentation

Comprehensive documentation is available in the `docs/` folder:

### Core Documentation

- **[Basic Use Cases](docs/basic-use-cases.md)** - Getting started with pools, swaps, and liquidity
- **[Staking Pools](docs/staking-pools.md)** - Create B-ALGO, B-USDC interest-bearing tokens
- **[Integration Guide](docs/integration-guide.md)** - Best practices for integrating CLAMM into your application
- **[Publishing](docs/publishing.md)** - How the npm package is published via GitHub Actions and how to set up the `NPM_TOKEN` secret

### Technical Details

- **[Liquidity Fee Protection](docs/liquidity-fee-protection.md)** - How fee accounting protects LPs
- **[Liquidity Rounding](docs/liquidity-rounding.md)** - Rounding behavior and user expectations
- **[Error Codes](docs/error-codes.md)** - Complete reference of all error messages

### Security

- **[Security Audits](audits/)** - Multiple AI-powered security audit reports
- **[Integration Security](docs/integration-guide.md#security-considerations)** - Critical warnings for developers

### Key Resources

- 📖 **Error Troubleshooting**: See [error-codes.md](docs/error-codes.md) for solutions
- 🔐 **Security Best Practices**: Review [integration-guide.md](docs/integration-guide.md) before deployment
- 🧪 **Testing**: Examples in `__test__/` folder show proper usage patterns
- 🛡️ **Audit Reports**: Six AI security audits in `audits/` folder

## Security Considerations

⚠️ **Important Security Notices**:

1. **Price Oracle Usage**: Never use single pool VWAP as sole price source. See [integration guide](docs/integration-guide.md#using-clamm-as-price-oracle) for safe patterns.
2. **Slippage Protection**: Always enforce minimum slippage (≥0.5%). Never use `minimumToReceive = 0`.
3. **Identity Verification**: All operations require proper KYC verification class.
4. **LP Token Rounding**: Small rounding losses (< 0.0001%) are expected. See [liquidity-rounding.md](docs/liquidity-rounding.md).

Multiple security audits have been conducted. Review the `audits/` folder before mainnet deployment.

## Ticks

Biatec CLAMM uses a **canonical logarithmic tick grid**: an absolute set of price
boundaries, fixed once and for all, that every integrator (and the Biatec DEX frontend)
snaps to. A bin's width is roughly a fixed fraction of the price, so sensible bins exist
at any magnitude (both at `1000` and at `0.001`), and because the boundaries are
absolute — they never depend on the current price, on a window, or on a previous
computation — pools created on different days at different prices land in exactly the
same bins and their liquidity aggregates instead of fragmenting.

Every decade `[10^k, 10^(k+1))` is anchored at `1, 2, 5` (`…, 100, 200, 500, 1000, 2000,
5000, …`). Each anchor segment (`[1,2)`, `[2,5)`, `[5,10)`, times `10^k`) is subdivided per
tick width:

| Tick type | Precision | Bins per decade | Bin width                        | Boundaries around 1500              |
| --------- | --------- | --------------- | -------------------------------- | ----------------------------------- |
| `wide`    | 0         | 3               | one bin per anchor segment (~100%) | 1000, 2000, 5000                  |
| `normal`  | 1         | 35              | 4% – 10% of the price            | 1000, 1100, …, 1900, 2000, 2200, …  |
| `narrow`  | 2         | 350             | 0.4% – 1% of the price           | 1000, 1010, …, 1990, 2000, 2020, …  |

For precision ≥ 1 the bin width inside a segment is `anchor × 10^(k-precision)` — always a
"nice" `1`, `2` or `5 × 10^n` number. `wide` is the one special case: a whole anchor
segment is a single bin, so its widths are `1`, `3` and `5 × 10^k`.

```ts
import {
  TICK_TYPES, // ['wide','normal','narrow'] — build a selector from this
  DEFAULT_TICK_TYPE, // 'normal'
  TickType,
  getTickSize, // width of the bin containing a price, for a tick type
  getTickDecimals, // decimals to display for a price + tick type
  snapPriceToTick, // snap an arbitrary price onto the grid
  tickGridBoundaries, // all boundaries covering a price window
  tickTypeForPrecision, // map a raw/asset precision to the nearest tick type
  precisionForTickType,
} from 'biatec-concentrated-liquidity-amm';

// 1) Let a user pick a tick width (e.g. render TICK_TYPES as buttons)
const tickType: TickType = 'wide';

// 2) Size / decimals for the current price (correct at any magnitude)
getTickSize(1500, 'wide'); // 1000   (bin [1000, 2000))
getTickSize(0.9, 'normal'); // 0.05  (bin [0.9, 0.95))
getTickSize(10000, 'normal'); // 1000
getTickDecimals(0.001, 'narrow'); // 5

// 3) Snap a price a user typed onto the shared grid before creating a pool
snapPriceToTick(0.94, 'normal'); // 0.95
snapPriceToTick(1500, 'wide'); // 2000   (nearest)
snapPriceToTick(1500, 'wide', 'down'); // 1000
snapPriceToTick(10123, 'normal', 'up'); // 11000  ('down' | 'up' | 'nearest')

// 4) The full grid over a window — identical for every caller, whatever the window
tickGridBoundaries(536, 2140, precisionForTickType('wide')); // [500, 1000, 2000, 5000]
tickGridBoundaries(1080, 2160, precisionForTickType('wide')); // [1000, 2000, 5000]

// 5) Map an asset-derived numeric precision (e.g. 4) to a tick type
tickTypeForPrecision(4); // 'narrow'
precisionForTickType('normal'); // 1
```

Building a min/max price range for a concentrated position:

```ts
import { snapPriceToTick, TickType } from 'biatec-concentrated-liquidity-amm';

function buildRange(priceLow: number, priceHigh: number, tickType: TickType) {
  return {
    priceMin: snapPriceToTick(priceLow, tickType, 'down'),
    priceMax: snapPriceToTick(priceHigh, tickType, 'up'),
  };
}
buildRange(0.91, 1.02, 'narrow'); // { priceMin: 0.91, priceMax: 1.02 }
buildRange(1200, 1800, 'wide'); // { priceMin: 1000, priceMax: 2000 }
```

Pick the tick width that turns an existing position's `[min, max]` into a movable,
multi-bin ("focused") selection — e.g. when pre-filling an "add liquidity" form so the
user can slide the range and seed nearby bins. Returns `null` for a single-price / wall
position:

```ts
import { suggestTickTypeForRange } from 'biatec-concentrated-liquidity-amm';

suggestTickTypeForRange(1000, 2000); // 'wide'   (exactly one wide bin)
suggestTickTypeForRange(0.9, 1.0); // 'normal' (two normal bins of 0.05)
suggestTickTypeForRange(1, 1); // null     (wall / single-price position)
suggestTickTypeForRange(0.9, 1.0, { minBins: 2, maxBins: 40 }); // tune the bin bounds
```

Grid primitives (`tickGridBoundaryBelow` / `tickGridBoundaryAbove`, `nextTickGridBoundary` /
`prevTickGridBoundary`, `tickGridWidthAt`, `tickGridBoundaries`, `TICK_GRID_ANCHORS`) and the
fixed-point `initPriceDecimals` (`fitPrice` = bin start, `tick` = bin width, both on the
same canonical grid) are also exported if you need to build a full price distribution.
