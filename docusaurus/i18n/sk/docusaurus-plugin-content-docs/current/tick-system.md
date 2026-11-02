# Logaritmický systém tickov

Biatec CLAMM používa **kanonickú logaritmickú mriežku tickov**: absolútnu množinu cenových hraníc, pevne stanovenú raz a navždy, na ktorú prichytáva ceny každý integrátor (aj frontend Biatec DEX). Šírka jedného pásma (bin) je približne pevným zlomkom ceny, takže zmysluplné pásma existujú pri akomkoľvek ráde veľkosti (pri cene `1000` aj pri `0.000001`). Namiesto toho, aby integrátori museli uvažovať o surovej číselnej presnosti (`precision`), SDK sprístupňuje tri pomenované šírky tickov — `wide`, `normal` a `narrow` — spolu s pomocnými funkciami na určenie veľkosti, prichytenie na mriežku (snapping), vymenovanie hraníc a výber medzi nimi.

## Prečo na tickoch záleží {#-why-ticks-matter}

Pozície koncentrovanej likvidity sú definované intervalom `[priceMin, priceMax]` (pozri `docs/basic-use-cases.md`). Ak by si každý integrátor volil ľubovoľné hranice, likvidita by sa roztrieštila medzi množstvo takmer rovnakých poolov namiesto toho, aby sa sústredila do zdieľaných poolov. Prichytenie cien na spoločnú mriežku tickov pred vytvorením poolu alebo nastavením rozsahu udržiava likviditu koncentrovanú a robí rozsahy kombinovateľnými naprieč rôznymi používateľskými rozhraniami.

Funguje to iba vtedy, ak je mriežka **absolútna**: hranice nesmú závisieť od aktuálnej trhovej ceny, od cenového okna, ktoré UI práve zobrazuje, ani od žiadnej predtým vypočítanej hranice. V opačnom prípade by tá istá pozícia vytvorená v dva rôzne dni skončila v dvoch rôznych pooloch. Kanonická mriežka uvedená nižšie zaručuje, že pásmo okolo danej ceny (napr. `[1000, 2000]` okolo `1500` pri `wide`) je vždy to isté.

## Mriežka {#-the-grid}

Mriežka je **dekádovo periodická**: jedna tabuľka mantís v intervale `[1, 10]` pre každú šírku ticku sa opakuje v každej dekáde `[10^k, 10^(k+1))`. Tabuľka sa riadi **pravidlom log10 tick** — tick pri danej cene je `10^-precision` ceny zaokrúhlenej na jednu platnú číslicu — takže pásmo predstavuje vždy približne rovnaký zlomok ceny:

| Typ ticku | Precision | Pravidlo                         | Hranice v jednej dekáde (× 10^k)                                                           |
| --------- | --------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `wide`    | 0         | kotvy `1, 2, 5` (kroky ~100 %)   | 1, 2, 5, 10                                                                                |
| `normal`  | 1         | tick ≈ 10 % ceny                 | 1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 4, 4.4, 5, 6, 7, 8, 9, 10 (21 pásiem) |
| `narrow`  | 2         | tick ≈ 1 % ceny                  | 1, 1.01, …, 1.49, 1.5, 1.52, …, 2.48, 2.52, 2.55, …, 10                                    |

Pre `precision ≥ 1` sa tabuľka generuje prechodom jednej dekády od jej začiatku: na hranici `b` je tick `round(b / 10^precision)` jednotiek mantisy (vedúca číslica ceny krát `10^-precision`); ďalší kandidát `b + tick` sa zarovná nadol na násobok ticku platného pre tohto kandidáta a kandidát, ktorý by zanechal pásmo užšie než tento tick, sa s ním zlúči (`0.9 → 1.0`, nie `0.9 → 0.99`). Keďže prechod vždy začína na `1 × 10^k`, každá dekáda a každý volajúci dostane rovnakú tabuľku — `0.9 → 1` je presne jeden `normal` tick, `1500` leží v `normal` pásme `[1400, 1600]` a vo `wide` pásme `[1000, 2000]` bez ohľadu na aktuálnu cenu. `wide` je jediný špeciálny prípad: ≈100 % tick nemôže byť dekádovo periodický, takže ho tvoria jednoducho kotvy `1, 2, 5`. Tabuľku vracia funkcia `tickGridDecadeMantissas(precision)`.

Každá hranica je krátke desatinné číslo, takže sa presne prevádza do a z JavaScript čísel (`number`): implementácia pracuje s celočíselnými jednotkami mantisy a desiatkovým exponentom a nikdy nekumuluje chyby sčítania v pohyblivej rádovej čiarke.

Nižšia `precision` → širšie ticky. `normal` je odporúčaná predvolená hodnota (`DEFAULT_TICK_TYPE`).

```typescript
import { TICK_TYPES, DEFAULT_TICK_TYPE, TickType } from 'biatec-concentrated-liquidity-amm';

TICK_TYPES; // ['wide', 'normal', 'narrow'] — vytvorte z toho prepínač/selektor
DEFAULT_TICK_TYPE; // 'normal'
```

## Základné funkcie {#-core-functions}

Všetky tieto funkcie sú exportované priamo z koreňa balíka (`biatec-concentrated-liquidity-amm`).

### `getTickSize(price, tickType)` {#-gettticksize}

Šírka kanonického pásma obsahujúceho cenu `price` — presná vzdialenosť k nasledujúcej hranici. Toto je hlavný vstupný bod pre nastavenie kroku ovládacích prvkov (stepperov) v UI.

```typescript
import { getTickSize } from 'biatec-concentrated-liquidity-amm';

getTickSize(1500, 'wide'); // 1000  (pásmo [1000, 2000))
getTickSize(3000, 'wide'); // 3000  (pásmo [2000, 5000))
getTickSize(0.9, 'normal'); // 0.1  (pásmo [0.9, 1))
getTickSize(1500, 'normal'); // 200  (pásmo [1400, 1600))
getTickSize(10000, 'normal'); // 1000
getTickSize(0.001, 'narrow'); // 0.00001
```

### `getTickDecimals(price, tickType)` {#-gettickdecimals}

Počet desatinných miest na zobrazenie pre cenu pri danom type ticku — použite na konzistentné formátovanie vstupných polí a popisov v súlade s mriežkou tickov.

```typescript
import { getTickDecimals } from 'biatec-concentrated-liquidity-amm';

getTickDecimals(0.001, 'narrow'); // 5
getTickDecimals(10000, 'normal'); // 0
```

### `snapPriceToTick(price, tickType, rounding?)` {#-snappricetotick}

Prichytí ľubovoľnú cenu na kanonickú mriežku. Volajte túto funkciu vždy, keď používateľ zadá voľnú cenu a pred vytvorením poolu, aby výsledné hranice padli na ticky zdieľané celým ekosystémom namiesto jednorazovej hodnoty. Cena, ktorá už leží na mriežke, sa v každom režime zaokrúhľovania vráti nezmenená.

Parameter `rounding` prijíma `'nearest'` (predvolené, pri rovnosti zaokrúhľuje nahor), `'down'` alebo `'up'`.

```typescript
import { snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

snapPriceToTick(0.94, 'normal'); // 0.9  (najbližší)
snapPriceToTick(0.96, 'normal'); // 1
snapPriceToTick(1500, 'wide'); // 2000  (najbližší z 1000 / 2000)
snapPriceToTick(1500, 'wide', 'down'); // 1000
snapPriceToTick(10123, 'normal', 'up'); // 11000
snapPriceToTick(10123, 'normal', 'down'); // 10000
```

Použite `'down'` pre dolnú hranicu rozsahu a `'up'` pre hornú hranicu, aby výsledný rozsah vždy obsahoval pôvodný vstup používateľa:

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

Všetky kanonické hranice pokrývajúce interval `[from, to]`: prvá je hranica na úrovni alebo pod `from`, posledná je hranica na úrovni alebo nad `to`. Keďže mriežka je absolútna, rovnaké okno vždy vráti rovnaké hranice, širšie okno vráti nadmnožinu a dve prekrývajúce sa okná sa zhodujú na každej spoločnej hranici. Použite ju na zostavenie cenovej distribúcie, grafu hĺbky trhu alebo posuvníka rozsahu. Pre nepoužiteľné okno vráti `[]` a nikdy nevráti viac ako `maxCount` (predvolene `1000`) hraníc.

```typescript
import { tickGridBoundaries, precisionForTickType } from 'biatec-concentrated-liquidity-amm';

tickGridBoundaries(536, 2140, precisionForTickType('wide')); // [500, 1000, 2000, 5000]
tickGridBoundaries(1080, 2160, precisionForTickType('wide')); // [1000, 2000, 5000]
tickGridBoundaries(0.9, 1.0, precisionForTickType('normal')); // [0.9, 1]
tickGridBoundaries(2, 3, precisionForTickType('normal')); // [2, 2.2, 2.4, 2.7, 3]
```

### `suggestTickTypeForRange(low, high, options?)` {#-suggesttickttypeforrange}

Pre existujúci cenový rozsah `[low, high]` (napríklad `priceMin`/`priceMax` poolu) vyberie **najširší** typ ticku, na ktorého mriežke (prichytený) rozsah stále pokrýva medzi `minBins` (predvolene `1`) a `maxBins` (predvolene `40`) pásmami. Vráti `null` pre degenerovaný rozsah (`high <= low`, t. j. jednocenovú „wall“ pozíciu) alebo ak žiadna šírka ticku nevyhovuje limitom počtu pásiem.

Toto je správna pomocná funkcia na predvyplnenie formulára „pridať likviditu“ z existujúceho poolu: keďže predvolené `minBins` je `1`, presný rozsah `[min, max]` poolu sa namapuje späť na jedno pásmo pri svojej natívnej (najširšej vyhovujúcej) šírke, takže formulár zachová presný rozsah a pridá likviditu do toho istého poolu namiesto tichého vytvorenia nového, jemnejšieho poolu. Odtiaľ sa používateľ stále môže posunúť do susedných pásiem.

```typescript
import { suggestTickTypeForRange } from 'biatec-concentrated-liquidity-amm';

suggestTickTypeForRange(1000, 2000); // 'wide'   (presne jedno wide pásmo)
suggestTickTypeForRange(0.9, 1.0); // 'normal' (presne jeden normal tick so šírkou 0.1)
suggestTickTypeForRange(1, 1); // null (wall / jednocenová pozícia)

// Upravte, koľko pásiem má rozsah reprezentovať:
suggestTickTypeForRange(1000, 2000, { minBins: 2, maxBins: 40 }); // 'normal'
```

### `tickTypeForPrecision(precision)` / `precisionForTickType(tickType)` {#-precision-conversions}

Konverzia medzi surovou číselnou presnosťou (napr. odvodenou z počtu desatinných miest aktíva) a pomenovaným typom `TickType`. Funkcia `tickTypeForPrecision` prichytí presnosti, ktoré sa nezhodujú presne s `wide`/`normal`/`narrow`, na najbližší z nich.

```typescript
import { tickTypeForPrecision, precisionForTickType } from 'biatec-concentrated-liquidity-amm';

tickTypeForPrecision(4); // 'narrow' (prichytené na najbližšiu známu presnosť)
tickTypeForPrecision(1); // 'normal' (presná zhoda)
precisionForTickType('normal'); // 1
```

### `tickDecimals(tick)` {#-tickdecimals}

Počet desatinných miest potrebných na reprezentáciu už vypočítanej hodnoty ticku (na rozdiel od `getTickDecimals`, ktorá počíta desatinné miesta pre cenu + typ ticku v jednom kroku).

```typescript
import { tickDecimals } from 'biatec-concentrated-liquidity-amm';

tickDecimals(100); // 0
tickDecimals(0.05); // 2
tickDecimals(0.000001); // 6
```

## Primitívy mriežky {#-grid-primitives}

Funkcie vyššie sú postavené na nízkoúrovňových exportovaných primitívach, ktoré priamo prechádzajú kanonickou mriežkou. Všetky prijímajú surovú číselnú presnosť a pre nepoužiteľnú (nekonečnú alebo nekladnú) cenu vracajú `0`.

- **`tickGridBoundaryBelow(price, precision)`** — začiatok pásma obsahujúceho `price` (najväčšia hranica `<= price`).
- **`tickGridBoundaryAbove(price, precision)`** — koniec pásma obsahujúceho `price` (najmenšia hranica `> price`).
- **`nextTickGridBoundary(boundary, precision)` / `prevTickGridBoundary(boundary, precision)`** — posun o jednu hranicu nahor alebo nadol po mriežke (správne prechádza medzi dekádami).
- **`tickGridDecadeMantissas(precision)`** — dekádová tabuľka (`[1, 1.1, …, 9, 10]` pri presnosti 1).
- **`tickGridWidthAt(price, precision)`** — presná šírka pásma (`above - below`); `cleanLogTick`/`getTickSize` sú jej aliasy kľúčované typom ticku.
- **`TICK_GRID_ANCHORS`** (`[1, 2, 5]`) a **`MAX_TICK_GRID_BOUNDARIES`** (`1000`, predvolený limit prechodu).
- **`initPriceDecimals(price, precision?)`** — pevno-desatinný `bigint` deskriptor pásma obsahujúceho cenu: `fitPrice` je začiatok pásma a `tick` jeho šírka (obe hodnoty škálované `TICK_FIXED_SCALE = 10n ** 18n`), takže posun `fitPrice + tick` reprodukuje kanonické hranice od akejkoľvek počiatočnej ceny. Ponechané pre integrátorov, ktorí už používajú `bigint` tvar; v novom kóde uprednostnite pomocné funkcie založené na `number`.
- **`priceTickDecimals(price, precision?)`** — počet zmysluplných desatinných miest pre cenu pri surovej číselnej presnosti (predvolene `4`), na formátovanie.
- **`toFixedBigInt(value)` / `fromFixedBigInt(value)`** — presná konverzia obyčajného JS čísla `number` do/z pevno-desatinnej `bigint` reprezentácie pre krátke desatinné čísla.

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

## Spojenie všetkého dokopy {#-putting-it-together}

Typický UI tok pre vytvorenie pozície koncentrovanej likvidity:

```typescript
import {
  TICK_TYPES,
  DEFAULT_TICK_TYPE,
  TickType,
  getTickSize,
  getTickDecimals,
  snapPriceToTick,
} from 'biatec-concentrated-liquidity-amm';

// 1) Vykreslite TICK_TYPES ako prepínač (napr. tri tlačidlá), predvolene DEFAULT_TICK_TYPE.
let tickType: TickType = DEFAULT_TICK_TYPE;

// 2) Použite aktuálnu cenu na určenie kroku steppera a vstupnej presnosti.
const currentPrice = 0.94;
const step = getTickSize(currentPrice, tickType); // 0.1
const decimals = getTickDecimals(currentPrice, tickType); // 1

// 3) Keď používateľ zadá priceMin/priceMax, pred odoslaním ich prichyťte na spoločnú mriežku.
const priceMin = snapPriceToTick(0.82, tickType, 'down'); // 0.8
const priceMax = snapPriceToTick(1.15, tickType, 'up'); // 1.2

// 4) Odovzdajte prichytené hodnoty v základnej škále do clammCreateSender / add-liquidity volania
//    (pozri docs/basic-use-cases.md pre kompletné toky vytvorenia poolu a likvidity).
```

A pre predvyplnenie formulára „pridať likviditu“ podľa existujúceho poolu:

```typescript
import { suggestTickTypeForRange, snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

function prefillFromPool(poolPriceMin: number, poolPriceMax: number) {
  const tickType = suggestTickTypeForRange(poolPriceMin, poolPriceMax);
  if (!tickType) {
    // Wall / konštantno-cenový pool — nepoužije sa žiadna mriežka tickov, ponechajte presné hranice.
    return { priceMin: poolPriceMin, priceMax: poolPriceMax, tickType: null };
  }
  return {
    priceMin: snapPriceToTick(poolPriceMin, tickType, 'down'),
    priceMax: snapPriceToTick(poolPriceMax, tickType, 'up'),
    tickType,
  };
}
```

## Odporúčané čítanie {#-recommended-reading}

- `docs/basic-use-cases.md` pre toky vytvárania poolov a likvidity, ktoré tieto prichytené ceny využívajú.
- `docs/liquidity-rounding.md` o tom, ako zaokrúhľovanie v základnej škále (1e9) interaguje s on-chain sumami.
- [API referencia](/docs/api) pre kompletné vygenerované signatúry každej funkcie v tomto module.
