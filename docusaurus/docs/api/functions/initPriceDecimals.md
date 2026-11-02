# Function: initPriceDecimals()

> **initPriceDecimals**(`price`, `precision`): [`IInitPriceDecimalsReturn`](../interfaces/IInitPriceDecimalsReturn.md)

Low level tick descriptor for a single price on the **canonical** grid (see
`tickGrid.ts`): `fitPrice` is the start of the bin containing `price` and `tick` is
that bin's width, so `fitPrice + tick` is the next canonical boundary. Walking
`fitPrice + tick` repeatedly therefore reproduces the same absolute boundaries no
matter which price the walk started from.

Kept for integrators that already consume the fixed-point `bigint` form; new code
should prefer the number-based `tickGridBoundaries` / `snapPriceToTick` helpers.

## Parameters

### price

`bigint`

The price to describe, fixed-point scaled.

### precision

`bigint` = `4n`

Tick precision (see [TickType](../type-aliases/TickType.md)), a plain integer. Defaults to 4.

## Returns

[`IInitPriceDecimalsReturn`](../interfaces/IInitPriceDecimalsReturn.md)
