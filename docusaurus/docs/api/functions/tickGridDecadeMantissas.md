# Function: tickGridDecadeMantissas()

> **tickGridDecadeMantissas**(`precision`): `number`[]

Mantissas (`1 … 10`) of one decade of the grid, e.g. `[1, 1.1, 1.2, …, 9, 10]` at
precision 1. Meant for documentation, tests and UIs at the named precisions — a
decade at precision 5 already has ~230k bins; the result is capped at 1,000,000.

## Parameters

### precision

`number`

## Returns

`number`[]
