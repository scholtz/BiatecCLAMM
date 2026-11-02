# Function: toFixedBigInt()

> **toFixedBigInt**(`value`): `bigint`

Converts a plain JS number price into the fixed-point `bigint` representation.
Goes through the number's shortest decimal representation (not `value * 1e18`,
which is inexact above 2^53 — `50000 * 1e18` is not representable as a double), so
every short decimal such as a grid boundary converts exactly. Rounds half up when
the value has more than 18 decimals.

## Parameters

### value

`number`

## Returns

`bigint`
