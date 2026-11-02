# Function: suggestTickTypeForRange()

> **suggestTickTypeForRange**(`low`, `high`, `options`): [`TickType`](../type-aliases/TickType.md) \| `null`

Pick the tick width that represents a price range `[low, high]`.

**Widest-first** (coarsest ticks / lowest precision first): the widest width whose bin
at the range's geometric mid fits into the range at least `minBins` (and no more than
`maxBins`) times is returned. Because it defaults to `minBins: 1`, an existing
pool's `[min, max]` maps to a *single* bin at its native (widest fitting) width — so
pre-filling an "add liquidity" form with it keeps the exact range and adds to that
same pool instead of splitting it into finer, brand-new pools. Users can still slide
into neighbouring bins from there. Returns `null` for a degenerate range
(`high <= low`, a wall / single-price position) or when no width fits.

## Parameters

### low

`number`

### high

`number`

### options

[`SuggestTickTypeOptions`](../interfaces/SuggestTickTypeOptions.md) = `{}`

## Returns

[`TickType`](../type-aliases/TickType.md) \| `null`

## Example

```ts
suggestTickTypeForRange(1000, 2000); // 'wide'   (exactly one wide bin)
suggestTickTypeForRange(0.9, 1.0);   // 'normal' (two normal bins of 0.05)
suggestTickTypeForRange(1, 1);       // null     (wall / single price)
```
