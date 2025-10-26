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
import { clammCreateSender } from "biatec-concentrated-liquidity-amm"

const poolClient = await clammCreateSender({
  transactionSigner: signerAccount,
  clientBiatecPoolProvider: poolProviderClient,
  appBiatecConfigProvider: configAppId,
  assetA: 0n,              // Native token (ALGO)
  assetB: 0n,              // Same as asset A
  fee: 0n,                 // No fee
  verificationClass: 0,
  priceMin: BigInt(SCALE),
  priceMax: BigInt(SCALE),
  currentPrice: BigInt(SCALE),
  nativeTokenName: 'ALGO', // Chain-specific name
});
```

### Distributing Staking Rewards

```typescript
import { clammDistributeExcessAssetsSender } from "biatec-concentrated-liquidity-amm"

// After rewards accrue to the pool (e.g., from consensus rewards)
const txId = await clammDistributeExcessAssetsSender({
  algod,
  account: executiveSigner,
  amountA: rewardsAmount * BigInt(SCALE / assetDecimals), // Base scale
  amountB: 0n,
  appBiatecConfigProvider: configAppId,
  assetA: 0n,
  assetB: 0n,
  clientBiatecClammPool: poolClient,
});
```

For complete documentation, see [docs/staking-pools.md](docs/staking-pools.md).

### Key Features:
- **Interest-Bearing Tokens**: Create B-ALGO, B-USDC, or any B-{TOKEN}
- **Multi-Chain Support**: Works with ALGO, VOI, ARAMID networks
- **Reward Distribution**: Distribute staking rewards, interest, or fees to LP holders
- **Flexible Use Cases**: Lending protocols, yield aggregation, revenue sharing

### Use Cases:
1. **Native Token Staking**: B-ALGO pools for staking ALGO with consensus rewards
2. **Asset Staking**: B-USDC pools for lending protocol interest
3. **Revenue Sharing**: Distribute protocol fees to token holders
4. **Yield Aggregation**: Combine multiple yield sources
