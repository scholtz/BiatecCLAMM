# GeckoTerminal DEX Adapter

Biatec DEX publishes its swaps and liquidity changes to [GeckoTerminal](https://www.geckoterminal.com) (CoinGecko) through a **DEX adapter API** that follows the *GeckoTerminal Integration API Standards v0.1* for non-EVM chains. The adapter is served by the Biatec trade reporter (AVMTradeReporter), the same service that powers [Biatec Scan](https://scan.biatec.io), so it reads the data the Biatec DEX itself shows.

This page is the reference for CoinGecko / GeckoTerminal reviewers and for anyone who wants to consume the adapter: base URLs, the four endpoints with real responses, the data semantics, the error contract and the guarantees the adapter keeps.

## Base URLs {#-base-urls}

| Network | Base URL | Swagger UI |
|---|---|---|
| **Algorand MainNet** | `https://api.algorand.scan.biatec.io/api/coingecko/` | [swagger/index.html](https://api.algorand.scan.biatec.io/swagger/index.html) |
| **Algorand TestNet** | `https://api.testnet.scan.biatec.io/api/coingecko/` | [swagger/index.html](https://api.testnet.scan.biatec.io/swagger/index.html) |

- The endpoints are listed in the Swagger UI under the `/api/coingecko/*` paths, with their query parameters and response models.
- All endpoints are plain `GET` requests that return `application/json`.
- A deployment can switch the adapter off; every endpoint then answers a bare `404` with an empty body (the two URLs above have it on).
- **No authentication is required.** The rest of the Biatec trade API uses ARC-14 signed tokens; the adapter deliberately does not, because the GeckoTerminal indexer cannot sign them.
- Rate limit: the adapter has its own bucket of 1200 requests per minute per client IP (the indexer polls about every 2 seconds), separate from the 60 per minute anonymous budget of the rest of the API.

## Endpoints {#-endpoints}

| Endpoint | Purpose |
|---|---|
| `GET /latest-block` | The newest block for which every swap, join and exit is stored and searchable. |
| `GET /asset?id=ASSET_ID` | Metadata of an asset that is part of a published pool. |
| `GET /pair?id=POOL_APP_ID` | Metadata of a pool (a trading pair). |
| `GET /events?fromBlock=FROM&toBlock=TO` | Swap, join and exit events of a block range. |

The examples below use the MainNet base URL; replace it with the TestNet one for TestNet.

### latest-block {#-latest-block}

```bash
curl https://api.algorand.scan.biatec.io/api/coingecko/latest-block
```

```json
{ "block": { "blockNumber": 65671739, "blockTimestamp": 1791140699 } }
```

`blockNumber` is the Algorand round, `blockTimestamp` its unix time in seconds. The value is a **watermark of fully processed blocks**: every event up to and including this block can already be requested from `/events`. It is held back a few seconds so that the search index is refreshed before GeckoTerminal asks for the events. Every replica of the service answers with the same value (it is mirrored to Redis), and the value never moves backwards. Until the watermark is known the endpoint answers `503`.

### asset {#-asset}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/asset?id=452399768"
```

```json
{
  "asset": {
    "id": "452399768",
    "name": "Vote Coin",
    "symbol": "Vote",
    "decimals": 6,
    "totalSupply": "1000000000",
    "metadata": { "type": "ASA", "url": "https://www.vote-coin.com/" }
  }
}
```

- ALGO is asset id `0`: `{"asset":{"id":"0","name":"Algorand","symbol":"ALGO","decimals":6,"totalSupply":"10000000000", ...}}`.
- `totalSupply` is the supply in whole units (already divided by `10^decimals`).
- Only assets of **published pools** are answered, so the endpoint cannot be used to make the service look up arbitrary assets. An unknown or destroyed asset is `404`; an asset that cannot be read right now is a retryable `503` (see [Error contract](#-error-contract)), never a `404`.

### pair {#-pair}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/pair?id=3136517663"
```

```json
{
  "pair": {
    "id": "3136517663",
    "dexKey": "biatec",
    "asset0Id": "452399768",
    "asset1Id": "0",
    "feeBps": 1
  }
}
```

- A pair is one Biatec CLAMM **pool**. Its `id` is the application id of the pool contract, so the same two assets with a different fee tier or a different price range are different pairs.
- `asset0Id` is the pool's asset A and `asset1Id` its asset B, in the **on-chain order**. The order never changes.
- `feeBps` is the pool's LP fee in basis points (`1` = 0.01 %). It is a JSON number that can be **fractional** (a 0.005 % fee is `0.5`), and the key is **absent** when the fee is not known.
- Unknown pools and pools labelled as scam are `404`; a pool that exists but cannot be described right now is a retryable `503`.

### events {#-events}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/events?fromBlock=65666403&toBlock=65666675"
```

Both bounds are **inclusive**. A request may span at most **1000 blocks**. The response is `{ "events": [...] }`, sorted by block number, then `txnIndex`, then `eventIndex`; a range without events is `{ "events": [] }`.

**Swap**

```json
{
  "eventType": "swap",
  "asset0In": "4918.617175",
  "asset1Out": "745.160378",
  "priceNative": "0.1514979416953709148954045199",
  "metadata": { "fees0In": "0.4918617175" },
  "block": { "blockNumber": 65666403, "blockTimestamp": 1791126026 },
  "txnId": "MFFCTLZFHLLPYGAAUT3LZ55Z4NAO4B6ADXOHD64XEXG3EATIAMMQ",
  "txnIndex": 1,
  "eventIndex": 0,
  "maker": "7YZORIFPVIGBU4Y2KPCKXYWDJE2VQT5EKFZ2NEYETMQGAHMQNJCBHIZPFU",
  "pairId": "3136517663",
  "reserves": { "asset0": "1068648.098149176", "asset1": "233179.618669844" }
}
```

**Join** (liquidity added; an `exit` has the same shape for liquidity removed)

```json
{
  "eventType": "join",
  "amount0": "398.549045",
  "amount1": "0.035351",
  "block": { "blockNumber": 65662126, "blockTimestamp": 1791114232 },
  "txnId": "G77DGPNZK562IHIRSCEWSIP5UM4DYYVSO2T7T4735AHTMRWUDH5A",
  "txnIndex": 1,
  "eventIndex": 0,
  "maker": "USFJPKLPDKZOGA64GJ4ESBDHF3RHSQONSU6QGPDT7OOYN3DRYJLAWRNXLE",
  "pairId": "3721772702",
  "reserves": { "asset0": "162718.169058", "asset1": "18.093768" }
}
```

| Field | Meaning |
|---|---|
| `eventType` | `swap`, `join` (liquidity deposit) or `exit` (liquidity withdrawal). |
| `asset0In` + `asset1Out` or `asset1In` + `asset0Out` | A swap has exactly one direction: what the trader paid and what the trader received, in whole units of each asset. |
| `amount0`, `amount1` | The amounts of a `join` / `exit`, in whole units. |
| `priceNative` | The executed price of the swap: **asset1 per one asset0** (in the swap above 0.1515 ALGO per Vote). It is always greater than zero and is the ratio of the two swapped amounts, rounded to decimal precision (at most 28 significant digits), so compare it with a tolerance. |
| `reserves` | The pool reserves of both assets **after** the event. |
| `metadata.fees0In` / `fees1In` | The LP fee paid on a swap: the input amount multiplied by the pool's fee. |
| `block` | `blockNumber` and `blockTimestamp` (unix seconds) of the block that holds the transaction. |
| `txnId` | The id of the top-level transaction (a swap routed through an inner transaction is reported under the transaction the user signed). |
| `txnIndex`, `eventIndex` | The position of the transaction in the block and of the event inside the transaction. Together with the block number they are unique and define the order. |
| `maker` | The account that sent the transaction. |
| `pairId` | The pool application id; resolves through `/pair`. |

Amounts are **decimal strings** in whole units (the raw amount divided by `10^decimals` of the asset). The traded amounts (`asset0In`, `asset1Out`, `amount0`, ...) never carry more fractional digits than the asset's decimals. `reserves`, the fees in `metadata` and `priceNative` can carry more digits: Biatec stores reserves in a `1e9` scale internally, and a fee is a fraction of the input amount (in the swap above 0.01 % of 4918.617175 is `0.4918617175`). They are all in the same whole units as the amounts.

## What is published {#-what-is-published}

- **Only Biatec DEX pools** (`dexKey` is `biatec`). The trade reporter tracks many Algorand DEXes for Biatec Scan, but this adapter lists the Biatec DEX only, so the events of other protocols never appear here. A 1000-block range can therefore be empty: Biatec pools trade less often than the whole chain.
- Only **confirmed** swaps and liquidity changes.
- An event that cannot be expressed per the standard is **skipped** (and logged on the server side) instead of being sent. GeckoTerminal stops indexing a DEX on the first invalid event, so the adapter prefers a missing event over a wrong one. The cases are:
  - a swap with a zero input or output amount, or with both reserves zero after it, or whose price rounds to zero or cannot be represented;
  - a `join` / `exit` without any amount, or after which the reserve of either asset is zero (for example the very first deposit into an empty pool, or removing the last liquidity);
  - an event of a pool or asset that is unknown or does not match the pool, and an event without a sender or transaction id.

  If you reconcile the feed against on-chain transactions, expect these differences and nothing else.

## How to consume it {#-how-to-consume-it}

The pattern GeckoTerminal's indexer uses, and the one we test against:

1. Call `latest-block`.
2. Call `events` for `(lastIndexedBlock + 1) .. latest`, in slices of at most 1000 blocks.
3. For every `pairId` you have not seen, call `pair`; for every asset of that pair, call `asset`. Pair and asset data is immutable apart from the supply, so it can be cached.
4. Wait about 2 seconds and repeat.

Requesting a range whose `toBlock` is beyond `latest-block` answers a retryable `503` (see below). Splitting a range in two returns exactly the events of the whole range, so a consumer can walk the chain in slices of any size.

## Error contract {#-error-contract}

Errors raised by the adapter are JSON objects of the form `{ "error": "..." }`. A query parameter that is not a number at all (for example `fromBlock=abc`) is rejected earlier by the web framework with a `400` and a standard problem-details JSON body (`application/problem+json`) instead.

| Status | When |
|---|---|
| `200` | Success (a range without events is a success with an empty list). |
| `400` | Missing or malformed parameter, `toBlock` smaller than `fromBlock`, more than 1000 blocks, or a range that holds more events than one response may carry (use a smaller range). Retrying the same request cannot help. |
| `404` | Unknown (or destroyed / scam-labelled) asset or pair; also every endpoint on a deployment where the adapter is switched off (empty body). |
| `503` | **Retryable**, on every endpoint including `asset` and `pair`. `toBlock` is beyond the latest indexed block, or storage / lookup trouble (an asset or pool that cannot be read right now is never reported as unknown). The response carries `Retry-After: 2`. The adapter never answers with a partial list and never caches a partial answer. |

A consumer should treat `503` as "ask again in a moment, keep your position", and must not treat a `503` for an `asset` or `pair` as "does not exist".

## Guarantees {#-guarantees}

- **Immutability.** An answer for a range of blocks at or below `latest-block` does not change afterwards: repeated requests return identical bytes, and a historical event keeps its price, amounts, reserves, order and fees. A pair's asset order and fee never change.
- **Completeness.** Every confirmed Biatec swap, join and exit up to `latest-block` is in `events`, except the events skipped as described in [What is published](#-what-is-published); a range is never answered before all of its blocks are stored.
- **Consistency across replicas.** All replicas report the same `latest-block`, so a consumer that is load-balanced between them sees one history.
- **Efficiency.** Asset and pair answers come from in-memory caches; `events` ranges are cached in memory and Redis once computed and concurrent identical requests are collapsed into one query.

## Quality assurance {#-quality-assurance}

The adapter is tested against GeckoTerminal's published standard on every change and after every deployment:

- A strict schema validator rejects any deviation from the standard (field names, formats, ordering, uniqueness of `(txnIndex, eventIndex)`, price and amount consistency).
- A live conformance suite runs against the real API after each rollout (and every few hours afterwards): schema, no gaps while following the chain like the indexer does, immutability against recorded **golden data** (historical events and pairs must be reproduced exactly), the error contract, latency budgets (`latest-block` and cached ranges under 800 ms at the 95th percentile, a cold 1000-block range under 8 s) and 50 concurrent pollers without rate limiting.
- A deployment to MainNet is promoted only after the same suite passed on the TestNet stage, and the suite runs again on MainNet right after the rollout.

## Related documents {#-related-documents}

- [Integration Guide](./integration-guide.md) for integrating Biatec CLAMM pools on chain.
- [Logarithmic Tick System](./tick-system.md) for how the price range of a pool is defined.
- The full API of the trade reporter (including the endpoints that need authentication) is in the Swagger UI linked above.
