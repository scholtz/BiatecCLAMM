---
sidebar_label: GeckoTerminal DEX Adapter
---

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

The examples below use the MainNet base URL (replace it with the TestNet one for TestNet) and real responses captured on 2026-10-04. Block numbers and reserves move on; a historical request returns the same events again (see [Guarantees](#-guarantees) for the one exception).

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
- `totalSupply` is the supply in whole units (already divided by `10^decimals`); it is absent when the chain does not report one. `metadata.type` is the asset kind (`ASA` for a standard asset) and `metadata.url` is present only when the asset has a URL. An empty asset name falls back to the unit name (and the other way round), then to the text "Asset" followed by the id.
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
- `asset0Id` is the pool's asset A and `asset1Id` its asset B, in the **on-chain order** of the pool contract; the adapter never reorders them (so ALGO, id `0`, can be `asset1Id` as above). The order never changes.
- `feeBps` is the pool's LP fee in basis points (`1` = 0.01 %). It is a JSON number that can be **fractional** (a 0.005 % fee is `0.5`), and the key is **absent** when the fee is not known or is outside the range 0 to 100 %.
- Unknown pools and pools labelled as scam are `404`; a pool that exists but cannot be described right now is a retryable `503`.

### events {#-events}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/events?fromBlock=65666403&toBlock=65666675"
```

Both bounds are **inclusive**. A request may span at most **1000 blocks** (`toBlock - fromBlock` at most 999). The response is `{ "events": [...] }`, sorted by block number, then `txnIndex`, then `eventIndex`; a range without events is `{ "events": [] }`.

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
| `priceNative` | The executed price of the swap: **asset1 per one asset0** (in the swap above 0.1515 ALGO per Vote). It is always greater than zero and is the ratio of the two swapped amounts, a decimal quotient with the precision of a .NET `decimal` (about 28 significant digits, written with at most 28 decimal places), so compare it with a tolerance instead of an exact equality. |
| `reserves` | The pool reserves of both assets **after** the event. |
| `metadata.fees0In` / `fees1In` | The **nominal** LP fee of a swap: the input amount multiplied by the pool's base fee, on the side of the input asset. The contract can scale the fee actually charged to a trader (a trader with a fee discount pays less than the nominal fee), so treat this as the pool fee rate applied to the input, not as an audited per-trader amount. The whole `metadata` object is **optional**: it is absent when the pool's fee is zero, outside the range 0 to 1, or not known. |
| `block` | `blockNumber` and `blockTimestamp` (unix seconds) of the block that holds the transaction. |
| `txnId` | The id of the top-level transaction (a swap routed through an inner transaction is reported under the transaction the user signed). |
| `txnIndex`, `eventIndex` | The position of the transaction in the block and of the event inside the transaction. Together with the block number they are **unique and deterministic**, and they define the order. For the oldest events, stored before the real position was recorded, the position is a deterministic stand-in placed after the real transactions of that block, so do not use it to look an event up on chain: use `txnId`. |
| `maker` | The account that sent the transaction. |
| `pairId` | The pool application id; resolves through `/pair`. |

Amounts are **decimal strings** in whole units (the raw amount divided by `10^decimals` of the asset). The traded amounts (`asset0In`, `asset1Out`, `amount0`, ...) never carry more fractional digits than the asset's decimals. `reserves`, the fees in `metadata` and `priceNative` can carry more digits: Biatec stores reserves in a `1e9` scale internally, and a fee is a fraction of the input amount (in the swap above 0.01 % of 4918.617175 is `0.4918617175`). They are all in the same whole units as the amounts.

## What is published {#-what-is-published}

- **Only Biatec DEX pools** (`dexKey` is `biatec`). The trade reporter tracks many Algorand DEXes for Biatec Scan, but this adapter lists the Biatec DEX only, so the events of other protocols never appear here. A 1000-block range can therefore be empty: Biatec pools trade less often than the whole chain.
- Only **confirmed** swaps and liquidity changes.
- An event that cannot be expressed per the standard is **skipped** (and logged on the server side) instead of being sent. GeckoTerminal stops indexing a DEX on the first invalid event, so the adapter prefers a missing event over a wrong one. The cases are:
  - a swap with a zero input or output amount, or with both reserves zero after it, or whose price rounds to zero or cannot be represented;
  - a `join` / `exit` without any amount, or one for which the reserves of **both** assets are not known from the transaction. A concentrated-liquidity position above or below the current price is **single-sided**: it changes only one reserve, the other is not part of the transaction's state change, and the adapter will not report a reserve it cannot prove. Single-sided deposits and withdrawals (and the first deposit into an empty pool or the removal of the last liquidity) are therefore **not** published as `join` / `exit`. This never hides trading volume: every swap carries the authoritative reserves of the pool after it;
  - an event of a pool or asset that is unknown or does not match the pool, and an event without a sender or transaction id.

  If you reconcile the feed against on-chain transactions, expect these differences: a swap is missing only in the rare cases listed above (an unusable amount or price), and `join` / `exit` events only cover liquidity changes that touch both assets of the pool.

## How to consume it {#-how-to-consume-it}

The pattern GeckoTerminal's indexer uses, and the one we test against:

1. Call `latest-block`.
2. Call `events` for `(lastIndexedBlock + 1) .. latest`, in slices of at most 1000 blocks.
3. For every `pairId` you have not seen, call `pair`; for every asset of that pair, call `asset`. A pair is immutable, and an asset is immutable apart from its `totalSupply` (which can change for a mintable asset), so both can be cached; refresh the supply occasionally if you display it.
4. Wait about 2 seconds and repeat.

Requesting a range whose `toBlock` is beyond `latest-block` answers a retryable `503` (see below). Splitting a range in two returns exactly the events of the whole range, so a consumer can walk the chain in slices of up to 1000 blocks and pick the slice size freely. If a slice answers `400` because it holds too many events, halve it and retry; only a single block that alone is too large can never be served (it is reported as such, not as a `503`).

## Error contract {#-error-contract}

Errors raised by the adapter are JSON objects of the form `{ "error": "..." }`. A query parameter that is not a number at all (for example `fromBlock=abc`) is rejected earlier by the web framework with a `400` and a standard problem-details JSON body (`application/problem+json`) instead.

| Status | When |
|---|---|
| `200` | Success (a range without events is a success with an empty list). |
| `400` | Missing or malformed parameter, `toBlock` smaller than `fromBlock`, a range wider than 1000 blocks (both bounds inclusive: `toBlock - fromBlock` is at most 999), a range that holds more events than one response may carry (request a smaller range), or a **single block** that alone holds more events than the API can return (a smaller range cannot help; this is deterministic and never succeeds on retry). Retrying the same request cannot help. |
| `404` | Unknown (or destroyed / scam-labelled) asset or pair; also every endpoint on a deployment where the adapter is switched off (empty body). |
| `429` | The per-IP rate limit was exceeded. The body is `{ "error": "Rate limit exceeded. Try again later." }` and the response carries `Retry-After: 60`: wait that long before the next request. A poller that asks every 2 seconds stays far below the limit. |
| `503` | **Retryable**, on every endpoint including `asset` and `pair`. `toBlock` is beyond the latest indexed block, or storage / lookup trouble (an asset or pool that cannot be read right now is never reported as unknown). The response carries `Retry-After: 2`. The adapter never answers with a partial list and never caches a partial answer. |

A consumer should treat `503` as "ask again in a moment, keep your position", and must not treat a `503` for an `asset` or `pair` as "does not exist".

## Guarantees {#-guarantees}

- **Immutability.** An answer for a range of blocks at or below `latest-block` does not change afterwards: repeated requests return identical bytes, and a historical event keeps its price, amounts, reserves, order and fees. A pair's asset order never changes, and its fee is the one set when the pool was created. The one deliberate exception is the publishing decision itself: if a pool is later classified as scam (a high scam rating), its events leave the feed from then on, and a range that is recomputed after its cached copy expired reflects that.
- **Completeness.** Every confirmed Biatec swap up to `latest-block` that can be expressed is in `events`, and so is every join and exit that can be expressed with both reserves; the events skipped as described in [What is published](#-what-is-published) are the only exceptions. A range is never answered before all of its blocks are stored.
- **Consistency across replicas.** All replicas report the same `latest-block`, so a consumer that is load-balanced between them sees one history.
- **Efficiency.** Asset and pair answers come from in-memory caches; `events` ranges are cached in memory and Redis once computed and concurrent identical requests are collapsed into one query.

## Quality assurance {#-quality-assurance}

The adapter is tested against GeckoTerminal's published standard on every change and after every deployment:

- A strict schema validator rejects any deviation from the standard (field names, formats, ordering, uniqueness of `(txnIndex, eventIndex)`, price and amount consistency).
- A live conformance suite runs against the real API after each rollout (and every few hours afterwards): schema, no gaps while following the chain like the indexer does, immutability against recorded **golden data** (historical events and pairs must be reproduced exactly), the error contract, latency budgets (`latest-block` and cached ranges under 800 ms at the 95th percentile, a cold 1000-block range under 8 s) and a burst of 50 concurrent pollers (100 requests) and 150 back-to-back requests without a single `429`.
- A deployment to MainNet is promoted only after the same suite passed on the TestNet stage, and the suite runs again on MainNet right after the rollout.

## Source of truth {#-source-of-truth}

The adapter is implemented in the [AVMTradeReporter](https://github.com/scholtz/AVMTradeReporter) repository (`Controllers/CoinGeckoController.cs`, `Services/CoinGecko/`; its `docs/GECKOTERMINAL.md` is the operations guide of the safety net). Limits such as the 1000-block span, the rate limit and the cache lifetimes are settings of that service; this page lists the values the Biatec deployments run with. The Swagger UI above is generated from the running service.

## Related documents {#-related-documents}

- [Integration Guide](./integration-guide.md) for integrating Biatec CLAMM pools on chain.
- [Logarithmic Tick System](./tick-system.md) for how the price range of a pool is defined.
- The full API of the trade reporter (including the endpoints that need authentication) is in the Swagger UI linked above.
