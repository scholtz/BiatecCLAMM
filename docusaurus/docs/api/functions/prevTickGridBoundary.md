# Function: prevTickGridBoundary()

> **prevTickGridBoundary**(`boundary`, `precision`): `number`

The canonical boundary right before `boundary` (an off-grid value is first snapped
down, so this is the start of the bin below the one containing it). Returns `0`
for an unusable input.

## Parameters

### boundary

`number`

### precision

`number`

## Returns

`number`
