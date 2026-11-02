# Type Alias: TickType

> **TickType** = `"wide"` \| `"normal"` \| `"narrow"`

Human friendly tick selection.

The Biatec CLAMM uses a logarithmic tick grid (see `tickGrid.ts`): boundaries are an
absolute, canonical set of "nice" prices (`1, 2, 5 × 10^k`, subdivided per precision),
so a bin's width is roughly a fixed fraction of the price. Instead of asking
integrators to reason about the raw numeric `precision`, expose a small set of named
tick widths. Lower precision → wider ticks.

- `wide`   – one bin per anchor segment: `[1,2)`, `[2,5)`, `[5,10)` × 10^k (≈100% steps, precision 0).
- `normal` – 35 bins per decade, 4%–10% of the price (precision 1). Good default.
- `narrow` – 350 bins per decade, 0.4%–1% of the price (precision 2).
