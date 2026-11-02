# Function: snapPriceToTick()

> **snapPriceToTick**(`price`, `tickType`, `rounding`): `number`

Snap a price onto the canonical tick grid for the given tick type.

This is what a UI should call when a user types an arbitrary price, and what an
integrator should call before creating a pool so its bounds land on canonical ticks
shared across the whole ecosystem. A price already on the grid is returned as is,
whatever the rounding mode.

## Parameters

### price

`number`

Arbitrary price to snap.

### tickType

[`TickType`](../type-aliases/TickType.md)

Desired tick width.

### rounding

[`TickRounding`](../type-aliases/TickRounding.md) = `'nearest'`

`nearest` (default; ties round up), `down`, or `up`.

## Returns

`number`

The snapped price (never negative). `0` for an unusable price.

## Example

```ts
snapPriceToTick(0.94, 'normal');        // 0.95
snapPriceToTick(0.91, 'normal');        // 0.9
snapPriceToTick(1500, 'wide');          // 2000  (nearest of 1000 / 2000)
snapPriceToTick(1500, 'wide', 'down');  // 1000
snapPriceToTick(10123, 'normal', 'up'); // 11000
```
