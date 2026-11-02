# Function: tickTypeForPrecision()

> **tickTypeForPrecision**(`precision`): [`TickType`](../type-aliases/TickType.md)

Tick type for a numeric precision. Precisions that are not an exact level are
snapped to the nearest one (e.g. an asset-derived precision of 4 → `narrow`).

## Parameters

### precision

`number`

## Returns

[`TickType`](../type-aliases/TickType.md)
