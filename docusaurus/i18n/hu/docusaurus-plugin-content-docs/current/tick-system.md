# Logaritmikus tick-rendszer

A Biatec CLAMM egy **kanonikus logaritmikus tick-rácsot** használ: egy egyszer s mindenkorra rögzített, abszolút árhatár-halmazt, amelyhez minden integrátor (és a Biatec DEX frontend is) igazodik. Egy-egy sáv (bin) szélessége megközelítőleg az ár rögzített hányada, így bármilyen nagyságrendben értelmes sávok állnak rendelkezésre (mind `1000`, mind `0.000001` árfolyamnál). Ahelyett, hogy az integrátoroknak egy nyers numerikus `precision` értékkel kellene számolniuk, az SDK három elnevezett tick-szélességet kínál — `wide`, `normal` és `narrow` —, valamint segédfüggvényeket a méretezéshez, rácsra illesztéshez (snapping), felsoroláshoz és kiválasztáshoz.

## Miért fontosak a tickek {#-why-ticks-matter}

A koncentrált likviditási pozíciókat egy `[priceMin, priceMax]` ársáv határozza meg (lásd: `docs/basic-use-cases.md`). Ha minden integrátor tetszőleges határokat választana, a likviditás sok, egymáshoz nagyon hasonló pool között töredezne szét ahelyett, hogy közös poolokban koncentrálódna. Az árak közös tick-rácsra illesztése a pool létrehozása vagy az ársáv beállítása előtt koncentráltan tartja a likviditást, és átjárhatóvá teszi az ársávokat a különböző felhasználói felületek között.

Ez csak akkor működik, ha a rács **abszolút**: a határok nem függhetnek az aktuális piaci ártól, a felhasználói felület által éppen megjelenített árablaktól, sem bármilyen korábban kiszámított határtól. Ellenkező esetben ugyanaz a pozíció, amelyet két különböző napon hoznak létre, két különböző poolba kerülne. Az alábbi kanonikus rács garantálja, hogy egy adott ár körüli sáv (például az `1500` körüli `[1000, 2000]` sáv `wide` módban) mindig ugyanaz marad.

## A rács {#-the-grid}

A rács **dekád-periodikus**: tick-szélességenként egyetlen, az `[1, 10]` intervallumba eső mantisszatáblázatot használ, amely minden `[10^k, 10^(k+1))` dekádban megismétlődik. A táblázat a **log10 tick-szabályt** követi — az adott árhoz tartozó tick az ár egy értékes jegyre kerekített értékének `10^-precision`-szerese —, így egy sáv mindig megközelítőleg az ár azonos hányadát adja:

| Tick típusa | Precision | Szabály                          | Határok egy dekádban (× 10^k)                                                              |
| ----------- | --------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `wide`      | 0         | `1, 2, 5` horgonyok (~100% lépés) | 1, 2, 5, 10                                                                                |
| `normal`    | 1         | tick ≈ az ár 10%-a               | 1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 4, 4.4, 5, 6, 7, 8, 9, 10 (21 sáv) |
| `narrow`    | 2         | tick ≈ az ár 1%-a                | 1, 1.01, …, 1.49, 1.5, 1.52, …, 2.48, 2.52, 2.55, …, 10                                    |

`precision ≥ 1` esetén a táblázat úgy áll elő, hogy egy dekádot az elejétől végiglépkedünk: egy `b` határnál a tick `round(b / 10^precision)` mantissza-egység (az ár első értékes jegye szorozva `10^-precision`-nel); a következő `b + tick` jelöltet lefelé igazítjuk a jelöltnél érvényes tick többszörösére, és ha egy jelölt a ticknél keskenyebb sávot hagyna hátra, azt összevonjuk vele (`0.9 → 1.0`, nem `0.9 → 0.99`). Mivel a bejárás mindig `1 × 10^k`-tól indul, minden dekád és minden hívó pontosan ugyanazt a táblázatot kapja — a `0.9 → 1` pontosan egy `normal` tick, az `1500` a `[1400, 1600]` `normal` sávban és az `[1000, 2000]` `wide` sávban ül, bármekkora is legyen az aktuális ár. A `wide` az egyetlen speciális eset: egy ≈100%-os tick nem lehet dekád-periodikus, ezért egyszerűen az `1, 2, 5` horgonyokat használja. A `tickGridDecadeMantissas(precision)` visszaadja a táblázatot.

Minden határ rövid tizedestört, így pontosan, veszteség nélkül alakítható oda-vissza JavaScript számokká: a megvalósítás egész mantissza-egységekkel és tízes alapú kitevővel dolgozik, és soha nem halmoz fel lebegőpontos összeadási hibákat.

Alacsonyabb `precision` → szélesebb tickek. A `normal` az ajánlott alapértelmezett érték (`DEFAULT_TICK_TYPE`).

```typescript
import { TICK_TYPES, DEFAULT_TICK_TYPE, TickType } from 'biatec-concentrated-liquidity-amm';

TICK_TYPES; // ['wide', 'normal', 'narrow'] — építsen választót/kapcsolót ebből
DEFAULT_TICK_TYPE; // 'normal'
```

## Alapfüggvények {#-core-functions}

Az alábbi függvények mindegyike közvetlenül a csomag gyökeréből (`biatec-concentrated-liquidity-amm`) van exportálva.

### `getTickSize(price, tickType)` {#-gettticksize}

A `price` értéket tartalmazó kanonikus sáv szélessége — a pontos távolság a következő határig. Ez a fő belépési pont a felhasználói felület léptetőgombjainak (stepper) méretezéséhez.

```typescript
import { getTickSize } from 'biatec-concentrated-liquidity-amm';

getTickSize(1500, 'wide'); // 1000  (sáv [1000, 2000))
getTickSize(3000, 'wide'); // 3000  (sáv [2000, 5000))
getTickSize(0.9, 'normal'); // 0.1  (sáv [0.9, 1))
getTickSize(1500, 'normal'); // 200  (sáv [1400, 1600))
getTickSize(10000, 'normal'); // 1000
getTickSize(0.001, 'narrow'); // 0.00001
```

### `getTickDecimals(price, tickType)` {#-gettickdecimals}

A megjelenítendő tizedesjegyek száma egy adott árhoz és tick-típushoz — ezzel formázhatja a beviteli mezőket és címkéket a tick-ráccsal összhangban.

```typescript
import { getTickDecimals } from 'biatec-concentrated-liquidity-amm';

getTickDecimals(0.001, 'narrow'); // 5
getTickDecimals(10000, 'normal'); // 0
```

### `snapPriceToTick(price, tickType, rounding?)` {#-snappricetotick}

Egy tetszőleges árat a kanonikus rácsra illeszt. Hívja meg mindig, amikor a felhasználó szabad szöveges árat ír be, valamint pool létrehozása előtt, hogy az eredményül kapott határok az egész ökoszisztéma által megosztott tickekre essenek egyedi értékek helyett. A már rácson lévő árat minden kerekítési módban változatlanul adja vissza.

A `rounding` elfogadja a `'nearest'` (alapértelmezett, holtversenyben felfelé kerekít), `'down'` vagy `'up'` értékeket.

```typescript
import { snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

snapPriceToTick(0.94, 'normal'); // 0.9  (legközelebbi)
snapPriceToTick(0.96, 'normal'); // 1
snapPriceToTick(1500, 'wide'); // 2000  (1000 / 2000 közül a legközelebbi)
snapPriceToTick(1500, 'wide', 'down'); // 1000
snapPriceToTick(10123, 'normal', 'up'); // 11000
snapPriceToTick(10123, 'normal', 'down'); // 10000
```

Használja a `'down'` módot a tartomány alsó határához és az `'up'` módot a felső határához, hogy a kapott tartomány mindig tartalmazza a felhasználó eredeti bevitelét:

```typescript
import { snapPriceToTick, TickType } from 'biatec-concentrated-liquidity-amm';

function buildRange(priceLow: number, priceHigh: number, tickType: TickType) {
  return {
    priceMin: snapPriceToTick(priceLow, tickType, 'down'),
    priceMax: snapPriceToTick(priceHigh, tickType, 'up'),
  };
}

buildRange(0.91, 1.02, 'narrow'); // { priceMin: 0.91, priceMax: 1.02 }
buildRange(1200, 1800, 'wide'); // { priceMin: 1000, priceMax: 2000 }
```

### `tickGridBoundaries(from, to, precision, maxCount?)` {#-tickgridboundaries}

A `[from, to]` intervallumot lefedő összes kanonikus határ: az első a `from` alatti vagy azzal egyenlő határ, az utolsó pedig a `to` feletti vagy azzal egyenlő határ. Mivel a rács abszolút, ugyanaz az ablak mindig ugyanazokat a határokat adja, egy szélesebb ablak részhalmazként tartalmazza a szűkebbet, és két átfedő ablak minden közös határon megegyezik. Használható áreloszlás, mélységi diagram vagy tartománycsúszka építéséhez. Használhatatlan ablak esetén `[]`-t ad vissza, és soha nem ad vissza `maxCount`-nál (alapértelmezetten `1000`) több határt.

```typescript
import { tickGridBoundaries, precisionForTickType } from 'biatec-concentrated-liquidity-amm';

tickGridBoundaries(536, 2140, precisionForTickType('wide')); // [500, 1000, 2000, 5000]
tickGridBoundaries(1080, 2160, precisionForTickType('wide')); // [1000, 2000, 5000]
tickGridBoundaries(0.9, 1.0, precisionForTickType('normal')); // [0.9, 1]
tickGridBoundaries(2, 3, precisionForTickType('normal')); // [2, 2.2, 2.4, 2.7, 3]
```

### `suggestTickTypeForRange(low, high, options?)` {#-suggesttickttypeforrange}

Egy meglévő `[low, high]` ártartományhoz (például egy pool `priceMin`/`priceMax` értékeihez) kiválasztja a **legszélesebb** olyan tick-típust, amelynek rácsán a (rácsra illesztett) tartomány még `minBins` (alapértelmezetten `1`) és `maxBins` (alapértelmezetten `40`) sáv közé esik. Elfajult tartomány (`high <= low`, azaz egyetlen áras „fal” pozíció) esetén, vagy ha egyik tick-szélesség sem fér bele a sávkorlátokba, `null` értéket ad vissza.

Ez a megfelelő segédfüggvény egy „likviditás hozzáadása” űrlap előtöltéséhez egy meglévő pool alapján: mivel az alapértelmezett `minBins` értéke `1`, a pool pontos `[min, max]` tartománya egyetlen sávra képeződik le a saját (legszélesebb illeszkedő) szélességén, így az űrlap megtartja a pontos tartományt, és ugyanahhoz a poolhoz ad likviditást ahelyett, hogy észrevétlenül egy új, finomabb felbontású poolt hozna létre. Innen a felhasználó továbbra is elmozdulhat a szomszédos sávokba.

```typescript
import { suggestTickTypeForRange } from 'biatec-concentrated-liquidity-amm';

suggestTickTypeForRange(1000, 2000); // 'wide'   (pontosan egy wide sáv)
suggestTickTypeForRange(0.9, 1.0); // 'normal' (pontosan egy 0.1-es normal tick)
suggestTickTypeForRange(1, 1); // null (fal / egyetlen áras pozíció)

// Szabályozza, hány sávot képviseljen a tartomány:
suggestTickTypeForRange(1000, 2000, { minBins: 2, maxBins: 40 }); // 'normal'
```

### `tickTypeForPrecision(precision)` / `precisionForTickType(tickType)` {#-precision-conversions}

Átváltás a nyers numerikus `precision` (pl. egy eszköz tizedesjegyeinek számából származtatott érték) és az elnevezett `TickType` között. A `tickTypeForPrecision` a `wide`/`normal`/`narrow` értékekre pontosan nem illeszkedő pontosságokat a legközelebbire kerekíti.

```typescript
import { tickTypeForPrecision, precisionForTickType } from 'biatec-concentrated-liquidity-amm';

tickTypeForPrecision(4); // 'narrow' (a legközelebbi ismert precisionre igazítva)
tickTypeForPrecision(1); // 'normal' (pontos egyezés)
precisionForTickType('normal'); // 1
```

### `tickDecimals(tick)` {#-tickdecimals}

Egy már kiszámított tick érték ábrázolásához szükséges tizedesjegyek száma (szemben a `getTickDecimals` függvénnyel, amely egyetlen lépésben számítja ki a tizedesjegyeket egy ár + tick-típus pároshoz).

```typescript
import { tickDecimals } from 'biatec-concentrated-liquidity-amm';

tickDecimals(100); // 0
tickDecimals(0.05); // 2
tickDecimals(0.000001); // 6
```

## Rács-alapműveletek {#-grid-primitives}

A fenti függvények alacsonyabb szintű, szintén exportált alapműveletekre épülnek, amelyek közvetlenül a kanonikus rácson lépkednek. Mindegyik nyers numerikus `precision` értéket vár, és használhatatlan (nem véges vagy nem pozitív) ár esetén `0`-t ad vissza.

- **`tickGridBoundaryBelow(price, precision)`** — a `price` értéket tartalmazó sáv kezdete (a legnagyobb `<= price` határ).
- **`tickGridBoundaryAbove(price, precision)`** — a `price` értéket tartalmazó sáv vége (a legkisebb `> price` határ).
- **`nextTickGridBoundary(boundary, precision)` / `prevTickGridBoundary(boundary, precision)`** — egy határral feljebb vagy lejjebb lép a rácson (a dekádhatárokat helyesen átlépve).
- **`tickGridDecadeMantissas(precision)`** — a dekádtáblázat (`[1, 1.1, …, 9, 10]` 1-es pontosságnál).
- **`tickGridWidthAt(price, precision)`** — a sáv pontos szélessége (`above - below`); a `cleanLogTick`/`getTickSize` ennek a tick-típussal paraméterezett megfelelői.
- **`TICK_GRID_ANCHORS`** (`[1, 2, 5]`) és **`MAX_TICK_GRID_BOUNDARIES`** (`1000`, az alapértelmezett bejárási korlát).
- **`initPriceDecimals(price, precision?)`** — egy árat tartalmazó sáv fixpontos `bigint` leírója: a `fitPrice` a sáv kezdete, a `tick` pedig a szélessége (mindkettő `TICK_FIXED_SCALE = 10n ** 18n` értékkel skálázva), így a `fitPrice + tick` léptetése bármely kezdőárból reprodukálja a kanonikus határokat. A `bigint` formátumot már használó integrátorok számára maradt meg; új kódban részesítse előnyben a `number`-alapú segédfüggvényeket.
- **`priceTickDecimals(price, precision?)`** — az értékes tizedesjegyek száma egy árhoz nyers numerikus `precision` mellett (alapértelmezetten `4`), formázáshoz.
- **`toFixedBigInt(value)` / `fromFixedBigInt(value)`** — sima JS `number` ár oda-vissza konvertálása fixpontos `bigint` ábrázolásra, rövid tizedestörtek esetén egzaktul.

```typescript
import {
  tickGridBoundaryBelow,
  tickGridBoundaryAbove,
  initPriceDecimals,
  toFixedBigInt,
  fromFixedBigInt,
} from 'biatec-concentrated-liquidity-amm';

tickGridBoundaryBelow(1500, 0); // 1000
tickGridBoundaryAbove(1500, 0); // 2000

const { tick, fitPrice } = initPriceDecimals(toFixedBigInt(1500), 0n);
fromFixedBigInt(fitPrice); // 1000
fromFixedBigInt(tick); // 1000
```

## Összegzés a gyakorlatban {#-putting-it-together}

Tipikus felhasználói felületi folyamat koncentrált likviditási pozíció létrehozásához:

```typescript
import {
  TICK_TYPES,
  DEFAULT_TICK_TYPE,
  TickType,
  getTickSize,
  getTickDecimals,
  snapPriceToTick,
} from 'biatec-concentrated-liquidity-amm';

// 1) Jelenítse meg a TICK_TYPES értékeket választóként (pl. három gomb), alapértelmezetten DEFAULT_TICK_TYPE értékkel.
let tickType: TickType = DEFAULT_TICK_TYPE;

// 2) Az aktuális ár alapján méretezze a léptetőt és határozza meg a beviteli pontosságot.
const currentPrice = 0.94;
const step = getTickSize(currentPrice, tickType); // 0.1
const decimals = getTickDecimals(currentPrice, tickType); // 1

// 3) Amikor a felhasználó beírja a priceMin/priceMax értékeket, beküldés előtt illessze őket a közös rácsra.
const priceMin = snapPriceToTick(0.82, tickType, 'down'); // 0.8
const priceMax = snapPriceToTick(1.15, tickType, 'up'); // 1.2

// 4) Adja át a rácsra illesztett, alapléptékű értékeket a clammCreateSender / add-liquidity hívásnak
//    (a teljes pool-létrehozási és likviditási folyamatokhoz lásd: docs/basic-use-cases.md).
```

Valamint egy „likviditás hozzáadása” űrlap előtöltése egy meglévő pool alapján:

```typescript
import { suggestTickTypeForRange, snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

function prefillFromPool(poolPriceMin: number, poolPriceMax: number) {
  const tickType = suggestTickTypeForRange(poolPriceMin, poolPriceMax);
  if (!tickType) {
    // Fal / konstans áras pool — nem vonatkozik rá tick-rács, tartsa meg a pontos határokat.
    return { priceMin: poolPriceMin, priceMax: poolPriceMax, tickType: null };
  }
  return {
    priceMin: snapPriceToTick(poolPriceMin, tickType, 'down'),
    priceMax: snapPriceToTick(poolPriceMax, tickType, 'up'),
    tickType,
  };
}
```

## Ajánlott olvasmányok {#-recommended-reading}

- `docs/basic-use-cases.md` a rácsra illesztett árakat használó pool-létrehozási és likviditási folyamatokhoz.
- `docs/liquidity-rounding.md` arról, hogyan hat az alapléptékű (1e9) kerekítés az on-chain összegekre.
- Az [API referencia](/docs/api) a modul összes függvényének teljes, generált típusdefinícióihoz.
