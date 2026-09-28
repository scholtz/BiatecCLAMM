# Discovering pools on-chain for trustless TVL

## Table of Contents {#-table-of-contents}

- [Why not just call an API](#-why-not-just-call-an-api)
- [Step 1: enumerate pools from the pool provider's boxes](#-step-1-enumerate-pools)
- [Step 2: read a pool's asset A / asset B from its global state](#-step-2-read-pool-assets)
- [Step 3: sum the real balances for TVL](#-step-3-sum-balances)
- [Step 4: express TVL in USD using the on-chain 1-day VWAP](#-step-4-usd-tvl)
- [Putting it together](#-putting-it-together)
- [Network app IDs](#-network-app-ids)
- [Caveats](#-caveats)

:::caution Non-USD pairs
Steps 1–3 alone give you the TVL **per asset**, not in USD. A pool between two non-USD assets
(e.g. GoldDAO / ALGO) contributes raw units of both, not a dollar figure. [Step
4](#-step-4-usd-tvl) covers converting those balances to USD using the pool provider's own
on-chain VWAP prices, chaining through ALGO or, when a token isn't paired against ALGO either,
through Biatec's own VoteCoin (`VOTE`) as a second bridge asset.
:::

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

## Step 4: express TVL in USD using the on-chain 1-day VWAP {#-step-4-usd-tvl}

Summing raw asset balances (step 3) gives TVL denominated in each asset itself, which is not
useful for a single USD figure, and it's wrong to assume every pool is paired against a
stablecoin — most aren't. The pool provider tracks a trade-weighted VWAP price for every asset
**pair** it has ever seen a swap for, independent of any specific pool, in the `poolsAggregated`
box map (prefix `'s'`). That box is exactly what should be used to price non-USD balances,
because it comes from the same on-chain source as the balances themselves — no external price
feed or API required.

### The `poolsAggregated` box

Box name: 1-byte prefix `'s'` + 16-byte ABI-encoded `AssetsCombined` key:

| bytes | field | type |
|---|---|---|
| 0 | `"s"` prefix (ASCII) | 1 byte |
| 1–8 | `assetA` | uint64, big-endian |
| 9–16 | `assetB` | uint64, big-endian |

`assetA` **must be the lower asset id of the pair** — `assetA < assetB` — the box is only ever
written in that canonical order (see `getPrice()`'s doc comment and the `assert`s in
`updatePriceBoxAggregated`, `contracts/BiatecPoolProvider.algo.ts`). Always sort the pair before
building the box name or calling `getPrice`.

The box value is an `AppPoolInfo` struct. The fields relevant to pricing are:

```ts
type AppPoolInfo = {
  assetA: uint64;
  assetB: uint64;
  verificationClass: uint64;
  latestPrice: uint64;

  period1Duration: uint64; // 60 (seconds)
  period1NowVolumeA: uint64;
  period1NowVolumeB: uint64;
  period1NowVWAP: uint64;
  period1NowTime: uint64;
  period1PrevVolumeA: uint64;
  period1PrevVolumeB: uint64;
  period1PrevVWAP: uint64;
  period1PrevTime: uint64;
  // ...period1NowFeeA/B, period1PrevFeeA/B omitted above for brevity

  period2Duration: uint64; // 3600 * 24 = 1 day  <-- this is the bucket to use for TVL
  period2NowVolumeA: uint64;
  period2NowVolumeB: uint64;
  period2NowVWAP: uint64;
  period2NowTime: uint64;
  period2PrevVolumeA: uint64;
  period2PrevVolumeB: uint64;
  period2PrevVWAP: uint64;
  period2PrevTime: uint64;

  // period3* (1 week) and period4* (1 year) follow the same shape
};
```

The contract keeps 4 parallel rolling time buckets per pair — 60 seconds (period1), **1 day**
(period2), 1 week (period3) and 1 year (period4) — each split into a `Now` bucket (still
accumulating) and a `Prev` bucket (the last fully-closed bucket of that size). `periodNNowVWAP`
is a running, volume-B-weighted average of the swap mid-price `(priceFrom + priceTo) / 2` inside
the current bucket; buckets roll over (`Now` → `Prev`, `Now` reset) the moment
`floor(timestamp / periodDuration)` changes, i.e. buckets are epoch-aligned, not
rolling-window. This means **`period2NowVWAP` alone understates the true trailing 1-day
average** whenever the current UTC day is young — right after midnight it might reflect only a
few minutes of trades. For accounting purposes, blend `Now` with the tail of `Prev` so the
result always covers a full trailing 24h window:

```ts
function trailing1DayVwap(info: AppPoolInfo, nowSeconds: bigint): bigint {
  const duration = info.period2Duration; // 86400
  const elapsedInNow = nowSeconds - info.period2NowTime; // seconds into today's bucket
  const remainingFromPrev = duration - elapsedInNow; // seconds still "owed" from yesterday

  if (remainingFromPrev <= 0n || info.period2PrevVolumeB === 0n) {
    // today's bucket alone already spans (or exceeds) a full day, or there's no prior data
    return info.period2NowVWAP;
  }

  // weight Prev's volume by the fraction of the trailing 24h window it still covers
  const prevWeight = (info.period2PrevVolumeB * remainingFromPrev) / duration;
  const nowWeight = info.period2NowVolumeB;

  if (nowWeight + prevWeight === 0n) return info.period2PrevVWAP; // no trades at all today

  return (info.period2NowVWAP * nowWeight + info.period2PrevVWAP * prevWeight) / (nowWeight + prevWeight);
}
```

This weights each bucket's VWAP by how much of the trailing 24h window it actually contributes
— shortly after a day boundary, `Prev` dominates the blend (as it should, since almost all of
the trailing 24h is still yesterday's bucket); after a full day inside `Now`, `Prev`'s
contribution naturally drops to zero. There is no on-chain method that returns this blended
figure — `getPrice()` only returns the raw box — so this blending must be done off-chain, once
per pair, at read time.

Read a pair's price with nothing but `algod`:

```ts
function getAggregatedPriceBoxName(assetA: bigint, assetB: bigint): Uint8Array {
  if (assetA >= assetB) throw new Error('assetA must be the lower asset id');
  const name = new Uint8Array(17);
  name.set(Buffer.from('s', 'ascii'), 0);
  name.set(algosdk.encodeUint64(assetA), 1);
  name.set(algosdk.encodeUint64(assetB), 9);
  return name;
}

async function getPairVwap(algod: Algodv2, poolProviderAppId: number | bigint, assetA: bigint, assetB: bigint) {
  const boxName = getAggregatedPriceBoxName(assetA, assetB);
  const box = await algod.getApplicationBoxByName(poolProviderAppId, boxName).do();
  const info = decodeAppPoolInfo(box.value); // ABI-decode per contracts/artifacts/BiatecPoolProvider.arc56.json
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  return trailing1DayVwap(info, nowSeconds);
}
```

(`decodeAppPoolInfo` is a straightforward ABI tuple decode against the field order in
`contracts/artifacts/BiatecPoolProvider.arc56.json`; the generated
`BiatecPoolProviderClient` exposes the `AppPoolInfo` ABI type for this.)

### Chaining through a bridge asset when there's no direct USD pair

Most Biatec pairs are not directly against a USD stablecoin, and not every token is paired
against ALGO either — plenty of tokens are only ever pooled against Biatec's own governance
token, VoteCoin (mainnet asset id `452399768`, see `voteAssetId` in `.env.example`). `VOTE`
itself is deep, actively-traded liquidity (it's the asset half of Biatec's own protocol-fee
routing, and shows up as the pairing asset in a large share of the pools listed in
[Repairing live pools after the LP-minting fix](./live-pool-reconciliation)), which makes it a
second natural bridge asset alongside ALGO for tokens that don't have a direct USD or ALGO
route.

To price an arbitrary asset in USD, try routes in this order, using whichever resolves first:

1. **Direct**: `(asset, usdAssetId)` or `(usdAssetId, asset)` — if this box exists, its
   trailing 1-day VWAP already is the USD price, taking care to invert it (`1 / vwap`) when the
   USD asset is `assetA` (VWAP is quoted as B/A in the pool's own convention).
2. **Via ALGO**: `asset ↔ ALGO` combined with `ALGO ↔ usdAssetId`:
   `priceInUsd = priceInAlgo * algoPriceInUsd`.
3. **Via VoteCoin**: `asset ↔ VOTE` combined with `VOTE ↔ usdAssetId` (looked up the same way
   as the direct USD route — if VoteCoin itself has no direct USD pair, resolve
   `voteInUsd` first via its own ALGO route, `VOTE ↔ ALGO` combined with `ALGO ↔ usdAssetId`).

A single bridge-asset list keeps this generic instead of hardcoding two separate code paths:

```ts
async function getUsdPrice(
  algod: Algodv2,
  poolProviderAppId: number | bigint,
  assetId: bigint,
  usdAssetId: bigint,
  bridgeAssetIds: bigint[] = [0n, 452399768n] // ALGO, then VoteCoin (mainnet asset id)
): Promise<bigint | undefined> {
  if (assetId === usdAssetId) return 1n; // already USD

  const direct = await tryGetPairVwap(algod, poolProviderAppId, assetId, usdAssetId);
  if (direct !== undefined) return direct;

  for (const bridgeAssetId of bridgeAssetIds) {
    if (bridgeAssetId === assetId) continue; // asset is itself a bridge asset, skip self-route

    const assetInBridge = await tryGetPairVwap(algod, poolProviderAppId, assetId, bridgeAssetId);
    if (assetInBridge === undefined) continue; // no pair against this bridge asset, try the next one

    // resolve the bridge asset's own USD price recursively (covers e.g. VOTE -> ALGO -> USD)
    const bridgeInUsd = await getUsdPrice(algod, poolProviderAppId, bridgeAssetId, usdAssetId, bridgeAssetIds);
    if (bridgeInUsd === undefined) continue;

    return assetInBridge * bridgeInUsd; // adjust for each asset's decimal scale before combining
  }

  return undefined; // no USD route found through any configured bridge asset
}
```

`tryGetPairVwap` is `getPairVwap` above wrapped to return `undefined` instead of throwing when
`poolsAggregated(...).exists` is false for that pair (no box → no registered trades for it, so
that route can't be used). ALGO (asset id `0`) is the network's native asset and appears in
`AssetsCombined` like any ASA; VoteCoin's asset id is protocol-specific and per-network (only
the mainnet id, `452399768`, is documented in this repo's `.env.example` — confirm testnet's and
Voi's own VOTE asset id, if any, before reusing this list there). There is currently no
hardcoded USD-reference asset id in this repo either, so pick your USD-pegged ASA (e.g. the
network's USDC asset id) and pass it in as `usdAssetId` explicitly. Extend `bridgeAssetIds` with
any other consistently deep, actively-traded asset your deployment relies on as a pricing hub.

Real VWAP values are integers scaled by each asset's own decimals (the same base-unit
convention used elsewhere in the contract), so before combining `assetInAlgo * algoPriceInUsd`
or multiplying by a balance from step 3, normalize both operands to the same decimal base using
each asset's known `decimals` (from `algod.getAssetByID`).

## Putting it together {#-putting-it-together}

```ts
const algod = new algosdk.Algodv2(token, server, port);
const poolProviderAppId = 3074197785n; // mainnet, see below
const usdAssetId = 31566704n; // e.g. USDC on mainnet — pick your USD-pegged ASA

const pools = await getPools(algod, poolProviderAppId);

let tvlByAsset = new Map<bigint, bigint>();
for (const pool of pools) {
  const balanceOf = await getPoolBalances(algod, pool.appId);
  for (const assetId of [pool.assetA, pool.assetB]) {
    tvlByAsset.set(assetId, (tvlByAsset.get(assetId) ?? 0n) + balanceOf(assetId));
  }
}

let tvlUsd = 0;
for (const [assetId, balance] of tvlByAsset) {
  const priceUsd = await getUsdPrice(algod, poolProviderAppId, assetId, usdAssetId);
  if (priceUsd === undefined) continue; // no USD route found for this asset — report separately
  tvlUsd += Number(balance) * Number(priceUsd); // normalize decimals before multiplying, see above
}
```

`tvlByAsset` holds, per asset id, the sum of that asset's real balance across every pool the
protocol has ever registered, and `tvlUsd` is that same figure converted to USD using only
on-chain VWAP data — computed with nothing but `algod` calls against the pool provider and each
pool's own application account.

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
- `poolsAggregated` boxes only exist for asset pairs that have actually been traded at least
  once; a brand-new pool with no swaps yet has no price route until its first trade. Treat a
  missing box as "no USD price available yet", not as an error.
- `period2NowVWAP`/`period2PrevVWAP` reflect trade prices, not liquidity depth — for a very
  thinly traded pair the VWAP can be stale or easily moved by a small trade. Consider excluding,
  or flagging separately, assets whose only price route has very low `period2NowVolumeB` /
  `period2PrevVolumeB`.
- This document's VWAP blending logic is off-chain guidance derived from reading the contract;
  the contract itself exposes only the raw `Now`/`Prev` buckets via `getPrice()`, so any two
  integrators must agree on the same blending formula to get comparable TVL figures.
- See [Repairing live pools after the LP-minting fix](./live-pool-reconciliation) for a worked
  example (`scripts/survey-orphaned-liquidity.ts`) that walks every mainnet pool via the pool
  provider and cross-checks each pool's internal liquidity accounting — the same box
  enumeration technique documented here.
