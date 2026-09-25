# Logarithmic Tick System

Biatec CLAMM uses a **canonical logarithmic tick grid**: an absolute set of price boundaries, fixed once and for all, that every integrator (and the Biatec DEX frontend) snaps to. A bin's width is roughly a fixed fraction of the price, so a sensible bin exists at any magnitude (both at `1000` and at `0.000001`). Rather than asking integrators to reason about a raw numeric `precision`, the SDK exposes three named tick widths — `wide`, `normal`, and `narrow` — plus helpers to size, snap, enumerate and select between them.

## Why Ticks Matter {#-why-ticks-matter}

Concentrated liquidity positions are defined by a `[priceMin, priceMax]` range (see `docs/basic-use-cases.md`). If every integrator picked arbitrary bounds, liquidity would fragment across many near-duplicate pools instead of concentrating into shared ones. Snapping prices to a shared tick grid before creating a pool or setting a range keeps liquidity concentrated and makes ranges composable across UIs.

That only works if the grid is **absolute**: the boundaries must not depend on the current market price, on the price window a UI happens to display, or on any previously computed boundary. Otherwise the same position created on two different days lands in two different pools. The canonical grid below guarantees that the bin around a price (say, `[1000, 2000]` around `1500` at `wide`) is always the same one.

## The Grid {#-the-grid}

Every decade `[10^k, 10^(k+1))` is anchored at the mantissas `1, 2, 5` — the familiar `…, 100, 200, 500, 1000, 2000, 5000, …` series (`TICK_GRID_ANCHORS`). Each anchor segment (`[1,2)`, `[2,5)`, `[5,10)`, times `10^k`) is then subdivided into bins according to the tick width:

| Tick type | Precision | Bins per decade | Bin width                          | Boundaries around 1500             |
| --------- | --------- | --------------- | ---------------------------------- | ---------------------------------- |
| `wide`    | 0         | 3               | one bin per anchor segment (~100%) | 1000, 2000, 5000                   |
| `normal`  | 1         | 35              | 4% – 10% of the price              | 1000, 1100, …, 1900, 2000, 2200, … |
| `narrow`  | 2         | 350             | 0.4% – 1% of the price             | 1000, 1010, …, 1990, 2000, 2020, … |

For precision ≥ 1 the bin width inside a segment is `anchor × 10^(k-precision)`, always a "nice" `1`, `2` or `5 × 10^n` number: the `[1,2)` segment is split into `10^precision` bins, `[2,5)` into `1.5 × 10^precision`, `[5,10)` into `10^precision`. `wide` (precision 0) is the one special case: a whole anchor segment is a single bin, so its bin widths are `1`, `3` and `5 × 10^k`.

Every boundary is a short decimal, so it round-trips exactly through JavaScript numbers: the implementation works on integer mantissa units and a decimal exponent and never accumulates floating point additions.

Lower precision → wider ticks. `normal` is the recommended default (`DEFAULT_TICK_TYPE`).

```typescript
import { TICK_TYPES, DEFAULT_TICK_TYPE, TickType } from 'biatec-concentrated-liquidity-amm';

TICK_TYPES; // ['wide', 'normal', 'narrow'] — build a selector/toggle from this
DEFAULT_TICK_TYPE; // 'normal'
```

## Core Functions {#-core-functions}

All of these are exported from the package root (`biatec-concentrated-liquidity-amm`).

### `getTickSize(price, tickType)` {#-gettticksize}

Width of the canonical bin containing `price` — the exact distance to the next boundary. This is the main entry point for sizing UI steppers.

```typescript
import { getTickSize } from 'biatec-concentrated-liquidity-amm';

getTickSize(1500, 'wide'); // 1000  (bin [1000, 2000))
getTickSize(3000, 'wide'); // 3000  (bin [2000, 5000))
getTickSize(0.9, 'normal'); // 0.05 (bin [0.9, 0.95))
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

Snaps an arbitrary price onto the canonical grid. Call this whenever a user types a free-form price, and before creating a pool, so the resulting bounds land on ticks shared across the whole ecosystem instead of a one-off value. A price already on the grid is returned unchanged in every rounding mode.

`rounding` accepts `'nearest'` (default, ties round up), `'down'`, or `'up'`.

```typescript
import { snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

snapPriceToTick(0.94, 'normal'); // 0.95  (nearest)
snapPriceToTick(0.91, 'normal'); // 0.9
snapPriceToTick(1500, 'wide'); // 2000  (nearest of 1000 / 2000)
snapPriceToTick(1500, 'wide', 'down'); // 1000
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
buildRange(1200, 1800, 'wide'); // { priceMin: 1000, priceMax: 2000 }
```

### `tickGridBoundaries(from, to, precision, maxCount?)` {#-tickgridboundaries}

All canonical boundaries covering `[from, to]`: the first is the boundary at or below `from`, the last the boundary at or above `to`. Because the grid is absolute, the same window always yields the same boundaries, a wider window yields a superset, and two overlapping windows agree on every shared boundary. Use it to build a price distribution, a depth chart, or a range slider. Returns `[]` for an unusable window and never more than `maxCount` (default `1000`) boundaries.

```typescript
import { tickGridBoundaries, precisionForTickType } from 'biatec-concentrated-liquidity-amm';

tickGridBoundaries(536, 2140, precisionForTickType('wide')); // [500, 1000, 2000, 5000]
tickGridBoundaries(1080, 2160, precisionForTickType('wide')); // [1000, 2000, 5000]
tickGridBoundaries(0.9, 1.0, precisionForTickType('normal')); // [0.9, 0.95, 1]
tickGridBoundaries(2, 3, precisionForTickType('normal')); // [2, 2.2, 2.4, 2.6, 2.8, 3]
```

### `suggestTickTypeForRange(low, high, options?)` {#-suggesttickttypeforrange}

Given an existing `[low, high]` price range (for example a pool's `priceMin`/`priceMax`), picks the **widest** tick type on whose grid the (snapped) range still spans between `minBins` (default `1`) and `maxBins` (default `40`) bins. Returns `null` for a degenerate range (`high <= low`, i.e. a single-price "wall" position) or when no tick width fits within the bin bounds.

This is the right helper for pre-filling an "add liquidity" form from an existing pool: because the default `minBins` is `1`, a pool's exact `[min, max]` maps back to a single bin at its native (widest fitting) width, so the form keeps the exact range and adds to that same pool instead of quietly creating a new, finer-grained one. From there the user can still slide into neighbouring bins.

```typescript
import { suggestTickTypeForRange } from 'biatec-concentrated-liquidity-amm';

suggestTickTypeForRange(1000, 2000); // 'wide'   (exactly one wide bin)
suggestTickTypeForRange(0.9, 1.0); // 'normal' (two normal bins of 0.05)
suggestTickTypeForRange(1, 1); // null (wall / single-price position)

// Tune how many bins the range should represent:
suggestTickTypeForRange(1000, 2000, { minBins: 2, maxBins: 40 }); // 'normal'
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
tickDecimals(0.05); // 2
tickDecimals(0.000001); // 6
```

## Grid Primitives {#-grid-primitives}

The functions above are built on lower-level, exported primitives that walk the canonical grid directly. All of them accept a raw numeric precision and return `0` for an unusable (non-finite or non-positive) price.

- **`tickGridBoundaryBelow(price, precision)`** — start of the bin containing `price` (the largest boundary `<= price`).
- **`tickGridBoundaryAbove(price, precision)`** — end of the bin containing `price` (the smallest boundary `> price`).
- **`nextTickGridBoundary(boundary, precision)` / `prevTickGridBoundary(boundary, precision)`** — step one boundary up or down the grid (crossing decades correctly).
- **`tickGridWidthAt(price, precision)`** — the bin's exact width (`above - below`); `cleanLogTick`/`getTickSize` are aliases keyed by tick type.
- **`TICK_GRID_ANCHORS`** (`[1, 2, 5]`) and **`MAX_TICK_GRID_BOUNDARIES`** (`1000`, the default walk cap).
- **`initPriceDecimals(price, precision?)`** — fixed-point `bigint` descriptor of the bin containing a price: `fitPrice` is the bin start and `tick` its width (both scaled by `TICK_FIXED_SCALE = 10n ** 18n`), so walking `fitPrice + tick` reproduces the canonical boundaries from any starting price. Kept for integrators already consuming the `bigint` form; prefer the number-based helpers in new code.
- **`priceTickDecimals(price, precision?)`** — number of decimal places meaningful for a price at a raw numeric precision (default `4`), for formatting.
- **`toFixedBigInt(value)` / `fromFixedBigInt(value)`** — convert a plain JS `number` price to/from the fixed-point `bigint` representation, exactly for short decimals.

```typescript
import {
  tickGridBoundaryBelow,
  tickGridBoundaryAbove,
  initPriceDecimals,
  toFixedBigInt,
  fromFixedBigInt,
} from 'biatec-concentrated-liquidity-amm';

tickGridBoundaryBelow(1500, 0); // 1000
tickGridBoundaryAbove(1500, 0); // 2000

const { tick, fitPrice } = initPriceDecimals(toFixedBigInt(1500), 0n);
fromFixedBigInt(fitPrice); // 1000
fromFixedBigInt(tick); // 1000
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
const step = getTickSize(currentPrice, tickType); // 0.05
const decimals = getTickDecimals(currentPrice, tickType); // 2

// 3) As the user types priceMin/priceMax, snap onto the shared grid before submitting.
const priceMin = snapPriceToTick(0.82, tickType, 'down'); // 0.8
const priceMax = snapPriceToTick(1.15, tickType, 'up'); // 1.2

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
