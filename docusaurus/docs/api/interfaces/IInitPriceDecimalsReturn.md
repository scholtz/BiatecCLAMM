# Interface: IInitPriceDecimalsReturn

## Properties

### priceDecimals

> **priceDecimals**: `bigint`

Number of decimal places that represent the tick size.

***

### tick

> **tick**: `bigint`

Width of the canonical grid bin containing the price, fixed-point scaled by TICK\_FIXED\_SCALE.

***

### fitPrice

> **fitPrice**: `bigint`

`price` snapped down onto the canonical grid (start of its bin), fixed-point scaled by TICK\_FIXED\_SCALE.
