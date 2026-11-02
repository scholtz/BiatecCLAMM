# Function: cleanLogTick()

> **cleanLogTick**(`price`, `precisionOrType`): `number`

Width of the canonical grid bin containing `price` — the tick size at that price.

Correct at any magnitude (`10000` at `normal` → `1000`, `0.001` at `normal` →
`0.0001`). Because the grid is absolute, this is the exact distance to the next
boundary, not an approximation of "some fraction of the price".

## Parameters

### price

`number`

The price to compute a tick for.

### precisionOrType

A [TickType](../type-aliases/TickType.md) or a raw numeric precision.

`number` | [`TickType`](../type-aliases/TickType.md)

## Returns

`number`
