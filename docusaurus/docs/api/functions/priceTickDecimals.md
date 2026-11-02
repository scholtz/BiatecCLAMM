# Function: priceTickDecimals()

> **priceTickDecimals**(`price`, `precision`): `number`

Number of decimal places that are meaningful for a price at a given precision.

The Biatec CLAMM uses a *logarithmic* tick system: a tick is a fixed fraction of
the price, so the number of decimals needed grows as the price shrinks. This helper
returns how many decimals should be shown/kept for `price` at the requested
`precision` (higher precision → finer ticks → more decimals).

## Parameters

### price

The price (asset A denominated in asset B). `0` returns 3.

`number` | `bigint`

### precision

`number` = `4`

Tick precision (see [TickType](../type-aliases/TickType.md)). Defaults to 4.

## Returns

`number`

Non-negative integer count of decimal places.

## Example

```ts
priceTickDecimals(1000, 4); // 0  -> tick 1
priceTickDecimals(0.001, 4); // 6 -> tick 1e-6
```
