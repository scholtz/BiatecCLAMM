# Discovering pools on-chain for trustless TVL

## Table of Contents {#-table-of-contents}

- [Why not just call an API](#-why-not-just-call-an-api)
- [Step 1: enumerate pools from the pool provider's boxes](#-step-1-enumerate-pools)
- [Step 2: read a pool's asset A / asset B from its global state](#-step-2-read-pool-assets)
- [Step 3: sum the real balances for TVL](#-step-3-sum-balances)
- [Putting it together](#-putting-it-together)
- [Network app IDs](#-network-app-ids)
- [Caveats](#-caveats)

## Why not just call an API {#-why-not-just-call-an-api}

Every Biatec CLAMM pool is created through, and registers itself with, a single
`BiatecPoolProvider` application. That application keeps a box for every pool it has ever
created, and the box **name** itself (not just the value) is an ABI-encoded record of the
pool's app id, its two assets, its price bounds, its fee and its LP token id.

Because that record lives in a box on an application that anyone can query, a TVL computation
does not need to trust a Biatec-hosted API or indexer: `algod` alone is enough to

1. list every pool the protocol has ever deployed, and
2. read each pool's asset A / asset B (and its real, on-chain balances of them).

This page documents the exact box layout and global state keys needed to do that, with the
TypeScript helpers this repo ships (`src/biatecClamm/getPools.ts`) as the reference
implementation. The same layout can be decoded with any SDK that can read boxes and application
state — `py-algorand-sdk`, `go-algorand-sdk`, or raw `algod` REST calls.

## Step 1: enumerate pools from the pool provider's boxes {#-step-1-enumerate-pools}

`BiatecPoolProvider` (`contracts/BiatecPoolProvider.algo.ts`) declares several `BoxMap`s, keyed
by different prefixes:

```ts
pools = BoxMap<uint64, AppPoolInfo>({ prefix: 'p' });
poolsByConfig = BoxMap<PoolConfig, uint64>({ prefix: 'pc' });
fullConfigs = BoxMap<FullConfig, uint64>({ prefix: 'fc' });
poolsAggregated = BoxMap<AssetsCombined, AppPoolInfo>({ prefix: 's' });
```

The one that matters for discovery is `fullConfigs`, prefixed `"fc"`. Every time a pool is
created, `registerPool()` writes one box per pool:

```ts
const fullConfig: FullConfig = {
  appId: appClammPool.id,
  assetA: assetA.id,
  assetB: assetB.id,
  lpTokenId: lpToken,
  min: pMin,
  max: pMax,
  fee: fee,
  verificationClass: verificationClass as uint8,
};
this.fullConfigs(fullConfig).value = appClammPool.id;
```

TealScript encodes the whole `FullConfig` struct into the **box name**, so the box name alone
carries everything needed to enumerate pools — the box value (the app id again) doesn't even
need to be read. Every `fc` box name is exactly 59 bytes:

| bytes | field | type |
|---|---|---|
| 0–1 | `"fc"` prefix (ASCII) | 2 bytes |
| 2–9 | `appId` | uint64, big-endian |
| 10–17 | `assetA` | uint64 |
| 18–25 | `assetB` | uint64 |
| 26–33 | `min` (price lower bound) | uint64 |
| 34–41 | `max` (price upper bound) | uint64 |
| 42–49 | `fee` | uint64 |
| 50–57 | `lpTokenId` | uint64 |
| 58 | `verificationClass` | uint8 (1 byte) |

Listing and filtering these boxes takes a single `algod` call — no indexer, no API:

```ts
import algosdk, { Algodv2 } from 'algosdk';

interface FullConfig {
  appId: bigint;
  assetA: bigint;
  assetB: bigint;
  min: bigint;
  max: bigint;
  fee: bigint;
  lpTokenId: bigint;
  verificationClass: bigint;
}

async function getPools(algod: Algodv2, poolProviderAppId: number | bigint): Promise<FullConfig[]> {
  const ret: FullConfig[] = [];
  const { boxes } = await algod.getApplicationBoxes(poolProviderAppId).do();

  for (const box of boxes) {
    if (box.name.length !== 59) continue;
    if (Buffer.from(box.name.subarray(0, 2)).toString('ascii') !== 'fc') continue;

    ret.push({
      appId: BigInt(algosdk.decodeUint64(box.name.subarray(2, 10))),
      assetA: BigInt(algosdk.decodeUint64(box.name.subarray(10, 18))),
      assetB: BigInt(algosdk.decodeUint64(box.name.subarray(18, 26))),
      min: BigInt(algosdk.decodeUint64(box.name.subarray(26, 34))),
      max: BigInt(algosdk.decodeUint64(box.name.subarray(34, 42))),
      fee: BigInt(algosdk.decodeUint64(box.name.subarray(42, 50))),
      lpTokenId: BigInt(algosdk.decodeUint64(box.name.subarray(50, 58))),
      verificationClass: BigInt(box.name[58]),
    });
  }
  return ret;
}
```

This is a slightly inlined version of the helper this repo actually ships and exports:
[`src/biatecClamm/getPools.ts`](https://github.com/scholtz/BiatecCLAMM/blob/main/src/biatecClamm/getPools.ts).
Since `assetA` / `assetB` / `min` / `max` / `fee` / `lpTokenId` / `verificationClass` are already
in the box name, this single call is enough to get every pool's app id **and** its two asset
ids — reading each pool's own global state (step 2) is only needed as an independent
cross-check, or when you don't already trust the pool provider's bookkeeping.

`algod.getApplicationBoxes` returns box *names* only, and by default caps the number of boxes
returned per call — for pool providers with many pools, page through it (the JS SDK exposes a
`max` and the REST endpoint a `next` cursor) rather than assuming one call returns everything.

## Step 2: read a pool's asset A / asset B from its global state {#-step-2-read-pool-assets}

Each `BiatecClammPool` application (`contracts/BiatecClammPool.algo.ts`) stores its two assets
in single-character global state keys:

```ts
assetA = GlobalStateKey<uint64>({ key: 'a' });
assetB = GlobalStateKey<uint64>({ key: 'b' });
assetABalanceBaseScale = GlobalStateKey<uint256>({ key: 'ab' });
assetBBalanceBaseScale = GlobalStateKey<uint256>({ key: 'bb' });
```

On-chain, `algod` reports global state keys base64-encoded. The generated ARC-56 spec
(`contracts/artifacts/BiatecClammPool.arc56.json`) confirms the exact encoding:

```json
"assetA": { "key": "YQ==", "keyType": "AVMBytes", "valueType": "uint64" },
"assetB": { "key": "Yg==", "keyType": "AVMBytes", "valueType": "uint64" }
```

`YQ==` is `base64("a")` and `Yg==` is `base64("b")`. So reading a pool's assets with nothing
but `algod.getApplicationByID` looks like this:

```ts
async function getPoolAssets(algod: Algodv2, poolAppId: number | bigint) {
  const app = await algod.getApplicationByID(poolAppId).do();
  const kv = app.params['global-state'] as { key: string; value: { uint: number; bytes: string; type: number } }[];

  const byKey = Object.fromEntries(kv.map((e) => [e.key, e.value]));
  const assetA = BigInt(byKey['YQ=='].uint); // base64("a")
  const assetB = BigInt(byKey['Yg=='].uint); // base64("b")
  return { assetA, assetB };
}
```

Because these values were already present in the `fc` box name from step 1, most callers can
skip this step entirely and trust the pool provider's registration — this step is only needed
if you specifically want to verify the provider against each pool's own state, independent of
what it reported at registration time.

## Step 3: sum the real balances for TVL {#-step-3-sum-balances}

Once you have a pool's app id and its two asset ids, TVL should come from the pool's **actual
on-chain balances**, not from any bookkeeping figure, so a bug or an unreconciled edge case in
the contract can't silently misreport it. Each `BiatecClammPool` application has its own
account (its app address), and that account holds the real ASA/ALGO reserves:

```ts
async function getPoolBalances(algod: Algodv2, poolAppId: number | bigint) {
  const poolAddress = algosdk.getApplicationAddress(poolAppId);
  const info = await algod.accountInformation(poolAddress).do();

  const balanceOf = (assetId: bigint) => {
    if (assetId === 0n) return BigInt(info.amount); // ALGO
    const holding = (info.assets as { 'asset-id': number; amount: number }[]).find(
      (a) => BigInt(a['asset-id']) === assetId
    );
    return holding ? BigInt(holding.amount) : 0n;
  };

  return balanceOf;
}
```

This is one `algod.accountInformation` call per pool — again no indexer, no API. Summing
`balanceOf(assetA)` and `balanceOf(assetB)` (converted to a common unit via a price feed, which
is out of scope for discovery itself) across every pool from step 1 gives a TVL figure derived
entirely from on-chain reads.

An alternative that avoids the extra account-info call is to read the pool's own
`assetABalanceBaseScale` / `assetBBalanceBaseScale` global state keys (`"ab"` / `"bb"`,
base64 `"YWI="` / `"YmI="`) — these are the same reserves already scaled to a fixed 1e18 base,
as `uint256`. In steady state they track the account's real ASA/ALGO holdings; the account
balance is the more defensive choice for TVL because it is the actual asset the pool custodies,
independent of the contract's internal accounting.

## Putting it together {#-putting-it-together}

```ts
const algod = new algosdk.Algodv2(token, server, port);
const poolProviderAppId = 3074197785n; // mainnet, see below

const pools = await getPools(algod, poolProviderAppId);

let tvlByAsset = new Map<bigint, bigint>();
for (const pool of pools) {
  const balanceOf = await getPoolBalances(algod, pool.appId);
  for (const assetId of [pool.assetA, pool.assetB]) {
    tvlByAsset.set(assetId, (tvlByAsset.get(assetId) ?? 0n) + balanceOf(assetId));
  }
}
```

`tvlByAsset` now holds, per asset id, the sum of that asset's real balance across every pool
the protocol has ever registered — computed with nothing but `algod` calls against the pool
provider and each pool's own application account.

## Network app IDs {#-network-app-ids}

The pool provider app id per network is in [`src/getConfig.ts`](https://github.com/scholtz/BiatecCLAMM/blob/main/src/getConfig.ts):

| Network (`genesisId`) | Pool provider app id |
|---|---|
| `mainnet-v1.0` | `3074197785` |
| `testnet-v1.0` | `741107916` |
| `voimain-v1.0` | `40133595` |

## Caveats {#-caveats}

- The `fc` box name is written once at pool creation and is never updated afterwards — it is
  safe to treat as immutable per pool, so results can be cached by `appId`.
- A pool's LP token id and fee are also embedded in the `fc` box name if a TVL dashboard wants
  to display them without extra reads.
- See [Repairing live pools after the LP-minting fix](./live-pool-reconciliation) for a worked
  example (`scripts/survey-orphaned-liquidity.ts`) that walks every mainnet pool via the pool
  provider and cross-checks each pool's internal liquidity accounting — the same box
  enumeration technique documented here.
