# Logarithmic Tick System

Biatec CLAMM uses a **logarithmic tick system**: a tick is a fixed fraction of the price, so a sensible tick width exists at any magnitude (both at `1000` and at `0.000001`). Rather than asking integrators to reason about a raw numeric `precision`, the SDK exposes three named tick widths — `wide`, `normal`, and `narrow` — plus helpers to size, snap, and select between them. Everyone (the Biatec DEX frontend and any integrator) should use these helpers so pools and positions land on the same canonical ticks.

## Why Ticks Matter {#-why-ticks-matter}

Concentrated liquidity positions are defined by a `[priceMin, priceMax]` range (see `docs/basic-use-cases.md`). If every integrator picked arbitrary bounds, liquidity would fragment across many near-duplicate pools instead of concentrating into shared ones. Snapping prices to a shared tick grid before creating a pool or setting a range keeps liquidity concentrated and makes ranges composable across UIs.

## Tick Types {#-tick-types}

| Tick type | Precision | Approx. step | Use it for                   |
| --------- | --------- | ------------ | ----------------------------- |
| `wide`    | 0         | ~100%        | very few, very coarse levels  |
| `normal`  | 1         | ~10%         | balanced default               |
| `narrow`  | 2         | ~1%          | many, finer price levels       |

Lower precision → wider ticks. `normal` is the recommended default (`DEFAULT_TICK_TYPE`).

```typescript
import { TICK_TYPES, DEFAULT_TICK_TYPE, TickType } from 'biatec-concentrated-liquidity-amm';

TICK_TYPES; // ['wide', 'normal', 'narrow'] — build a selector/toggle from this
DEFAULT_TICK_TYPE; // 'normal'
```

## Core Functions {#-core-functions}

All of these are exported from the package root (`biatec-concentrated-liquidity-amm`).

### `getTickSize(price, tickType)` {#-gettticksize}

Returns the clean, "nice" (1/2/5×10^k) tick size for a price at a given tick type. This is the main entry point for sizing UI steppers and grids — it fixes the raw sub-1 tick math (`0.9` at `wide` would otherwise be `0.09`) into a clean `0.1`.

```typescript
import { getTickSize } from 'biatec-concentrated-liquidity-amm';

getTickSize(0.9, 'wide'); // 0.1
getTickSize(10000, 'normal'); // 1000
getTickSize(0.001, 'narrow'); // 0.00001
```

### `getTickDecimals(price, tickType)` {#-gettickdecimals}

Number of decimals to display for a price at a given tick type — use this to format input fields and labels consistently with the tick grid.

```typescript
import { getTickDecimals } from 'biatec-concentrated-liquidity-amm';

getTickDecimals(0.001, 'narrow'); // 5
getTickDecimals(10000, 'normal'); // 0
```

### `snapPriceToTick(price, tickType, rounding?)` {#-snappricetotick}

Snaps an arbitrary price onto the tick grid. Call this whenever a user types a free-form price, and before creating a pool, so the resulting bounds land on ticks shared across the whole ecosystem instead of a one-off value.

`rounding` accepts `'nearest'` (default), `'down'`, or `'up'`.

```typescript
import { snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

snapPriceToTick(0.94, 'wide'); // 0.9   (nearest, rounds down)
snapPriceToTick(0.96, 'wide'); // 1     (nearest, rounds up)
snapPriceToTick(10123, 'normal', 'up'); // 11000
snapPriceToTick(10123, 'normal', 'down'); // 10000
```

Use `'down'` for a range's lower bound and `'up'` for its upper bound so the resulting range always contains the user's original input:

```typescript
import { snapPriceToTick, TickType } from 'biatec-concentrated-liquidity-amm';

function buildRange(priceLow: number, priceHigh: number, tickType: TickType) {
  return {
    priceMin: snapPriceToTick(priceLow, tickType, 'down'),
    priceMax: snapPriceToTick(priceHigh, tickType, 'up'),
  };
}

buildRange(0.91, 1.02, 'narrow'); // { priceMin: 0.91, priceMax: 1.02 }
```

### `suggestTickTypeForRange(low, high, options?)` {#-suggesttickttypeforrange}

Given an existing `[low, high]` price range (for example a pool's current `priceMin`/`priceMax`), picks the **widest** tick type whose grid still spans between `minBins` (default `1`) and `maxBins` (default `40`) ticks across that range. Returns `null` for a degenerate range (`high <= low`, i.e. a single-price "wall" position) or when no tick width fits within the bin bounds.

This is the right helper for pre-filling an "add liquidity" form from an existing pool: because the default `minBins` is `1`, a pool's exact `[min, max]` maps back to a single tick at its native (widest fitting) precision, so the form keeps the exact range and adds to that same pool instead of quietly creating a new, finer-grained one. From there the user can still slide into neighbouring bins.

```typescript
import { suggestTickTypeForRange } from 'biatec-concentrated-liquidity-amm';

suggestTickTypeForRange(0.9, 1.0); // 'normal' (widest fit: exactly 1 tick of 0.1)
suggestTickTypeForRange(1, 1); // null (wall / single-price position)

// Tune how many ticks the range should represent:
suggestTickTypeForRange(0.9, 1.0, { minBins: 2, maxBins: 40 });
```

### `tickTypeForPrecision(precision)` / `precisionForTickType(tickType)` {#-precision-conversions}

Convert between a raw numeric precision (e.g. one derived from an asset's decimal count) and the named `TickType`. `tickTypeForPrecision` snaps precisions that don't map exactly onto `wide`/`normal`/`narrow` to the nearest one.

```typescript
import { tickTypeForPrecision, precisionForTickType } from 'biatec-concentrated-liquidity-amm';

tickTypeForPrecision(4); // 'narrow' (snapped to the nearest known precision)
tickTypeForPrecision(1); // 'normal' (exact match)
precisionForTickType('normal'); // 1
```

### `tickDecimals(tick)` {#-tickdecimals}

Number of decimal places needed to represent an already-computed tick value (as opposed to `getTickDecimals`, which computes decimals for a price + tick type in one step).

```typescript
import { tickDecimals } from 'biatec-concentrated-liquidity-amm';

tickDecimals(100); // 0
tickDecimals(0.000001); // 6
```

## Low-Level Primitives {#-low-level-primitives}

The functions above are built on lower-level, exported primitives. Use these directly only if you need to build a full price distribution or otherwise need the raw (non-"nice"-rounded) tick math.

- **`cleanLogTick(price, precisionOrType)`** — the underlying implementation of `getTickSize`; accepts either a `TickType` or a raw numeric precision.
- **`initPriceDecimals(price, precision?)`** — the lowest-level, `bigint`, fixed-point tick descriptor for a single price (returns `{ priceDecimals, tick, fitPrice }`, all scaled by `TICK_FIXED_SCALE = 10n ** 18n`). The raw tick from this function can be non-round for sub-1 prices (e.g. `0.9` → `0.09`); prefer `cleanLogTick`/`getTickSize` for anything user-facing.
- **`priceTickDecimals(price, precision?)`** — number of decimal places meaningful for a price at a raw numeric precision (default `4`).
- **`toFixedBigInt(value)` / `fromFixedBigInt(value)`** — convert a plain JS `number` price to/from the fixed-point `bigint` representation used by `initPriceDecimals`.

```typescript
import { initPriceDecimals, toFixedBigInt, fromFixedBigInt } from 'biatec-concentrated-liquidity-amm';

const { tick, fitPrice, priceDecimals } = initPriceDecimals(toFixedBigInt(0.9), 1n);
fromFixedBigInt(tick); // 0.09 (raw, not "nice" — compare with getTickSize(0.9, 'wide') === 0.1)
```

## Putting It Together {#-putting-it-together}

A typical UI flow for creating a concentrated liquidity position:

```typescript
import {
  TICK_TYPES,
  DEFAULT_TICK_TYPE,
  TickType,
  getTickSize,
  getTickDecimals,
  snapPriceToTick,
} from 'biatec-concentrated-liquidity-amm';

// 1) Render TICK_TYPES as a selector (e.g. three buttons), defaulting to DEFAULT_TICK_TYPE.
let tickType: TickType = DEFAULT_TICK_TYPE;

// 2) Use the current price to size the stepper and decide input precision.
const currentPrice = 0.94;
const step = getTickSize(currentPrice, tickType); // 0.1
const decimals = getTickDecimals(currentPrice, tickType); // 1

// 3) As the user types priceMin/priceMax, snap onto the shared grid before submitting.
const priceMin = snapPriceToTick(0.82, tickType, 'down');
const priceMax = snapPriceToTick(1.15, tickType, 'up');

// 4) Feed the snapped, base-scale values into clammCreateSender / an add-liquidity call
//    (see docs/basic-use-cases.md for the full pool creation and liquidity flows).
```

And for pre-filling an "add liquidity" form against an existing pool:

```typescript
import { suggestTickTypeForRange, snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

function prefillFromPool(poolPriceMin: number, poolPriceMax: number) {
  const tickType = suggestTickTypeForRange(poolPriceMin, poolPriceMax);
  if (!tickType) {
    // Wall / constant-price pool — no tick grid applies, keep the exact bounds.
    return { priceMin: poolPriceMin, priceMax: poolPriceMax, tickType: null };
  }
  return {
    priceMin: snapPriceToTick(poolPriceMin, tickType, 'down'),
    priceMax: snapPriceToTick(poolPriceMax, tickType, 'up'),
    tickType,
  };
}
```

## Recommended Reading {#-recommended-reading}

- `docs/basic-use-cases.md` for pool creation and liquidity flows that consume these snapped prices.
- `docs/liquidity-rounding.md` for how base-scale (1e9) rounding interacts with on-chain amounts.
- The [API reference](/docs/api) for the full generated signatures of every function in this module.
