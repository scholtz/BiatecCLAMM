# Function: tickGridBoundaries()

> **tickGridBoundaries**(`from`, `to`, `precision`, `maxCount`): `number`[]

All canonical boundaries covering `[from, to]`: the first is the boundary at or
below `from`, the last the boundary at or above `to`. Independent of any anchor —
the same window always yields the same boundaries, and a wider window yields a
superset. Empty for an unusable window (`from <= 0`, `to <= from`, NaN, Infinity).
Never returns more than `maxCount` boundaries.

## Parameters

### from

`number`

### to

`number`

### precision

`number`

### maxCount

`number` = `MAX_TICK_GRID_BOUNDARIES`

## Returns

`number`[]
