# Function: getTickSize()

> **getTickSize**(`price`, `tickType`): `number`

Tick size for a price and tick type — the developer-friendly entry point.
Alias of [cleanLogTick](cleanLogTick.md) keyed by [TickType](../type-aliases/TickType.md).

## Parameters

### price

`number`

### tickType

[`TickType`](../type-aliases/TickType.md)

## Returns

`number`

## Example

```ts
getTickSize(0.9, 'normal');   // 0.05  (bin [0.9, 0.95))
getTickSize(1500, 'wide');    // 1000  (bin [1000, 2000))
getTickSize(10000, 'normal'); // 1000  (bin [10000, 11000))
```
