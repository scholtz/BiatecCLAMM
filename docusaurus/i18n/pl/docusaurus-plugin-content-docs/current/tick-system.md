# Logarytmiczny system ticków

Biatec CLAMM wykorzystuje **kanoniczną logarytmiczną siatkę ticków**: bezwzględny zestaw granic cenowych, ustalony raz na zawsze, do którego przyciąga ceny każdy integrator (oraz interfejs Biatec DEX). Szerokość pojedynczego przedziału (bin) stanowi w przybliżeniu stały ułamek ceny, dzięki czemu sensowne przedziały istnieją dla każdego rzędu wielkości (zarówno przy cenie `1000`, jak i `0.000001`). Zamiast wymagać od integratorów operowania na surowej liczbowej precyzji (`precision`), SDK udostępnia trzy nazwane szerokości ticków — `wide`, `normal` oraz `narrow` — wraz z funkcjami pomocniczymi do wymiarowania, przyciągania do siatki (snapping), wyliczania granic i wyboru między nimi.

## Dlaczego ticki są ważne {#-why-ticks-matter}

Pozycje skoncentrowanej płynności są definiowane przez przedział `[priceMin, priceMax]` (zobacz `docs/basic-use-cases.md`). Gdyby każdy integrator wybierał dowolne granice, płynność uległaby rozdrobnieniu pomiędzy wiele niemal identycznych pul, zamiast koncentrować się we wspólnych pulach. Przyciąganie cen do wspólnej siatki ticków przed utworzeniem puli lub ustawieniem zakresu utrzymuje płynność skoncentrowaną i sprawia, że zakresy są kompatybilne pomiędzy różnymi interfejsami użytkownika.

Działa to tylko wtedy, gdy siatka jest **bezwzględna (absolutna)**: granice nie mogą zależeć od aktualnej ceny rynkowej, od okna cenowego aktualnie wyświetlanego przez UI ani od żadnej wcześniej obliczonej granicy. W przeciwnym razie ta sama pozycja utworzona w dwa różne dni trafiłaby do dwóch różnych pul. Poniższa kanoniczna siatka gwarantuje, że przedział wokół danej ceny (np. `[1000, 2000]` wokół `1500` dla `wide`) jest zawsze dokładnie tym samym przedziałem.

## Siatka {#-the-grid}

Siatka jest **okresowa względem dekad**: jedna tabela mantys w przedziale `[1, 10]` dla każdej szerokości ticka jest powtarzana w każdej dekadzie `[10^k, 10^(k+1))`. Tabela jest zgodna z **regułą log10 tick** — tick dla danej ceny wynosi `10^-precision` tej ceny zaokrąglonej do jednej cyfry znaczącej — dzięki czemu przedział stanowi zawsze w przybliżeniu ten sam ułamek ceny:

| Typ ticka | Precision | Reguła                             | Granice w jednej dekadzie (× 10^k)                                                          |
| --------- | --------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `wide`    | 0         | kotwice `1, 2, 5` (kroki ~100 %)   | 1, 2, 5, 10                                                                                 |
| `normal`  | 1         | tick ≈ 10 % ceny                   | 1, 1.1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 4, 4.4, 5, 6, 7, 8, 9, 10 (21 przedziałów) |
| `narrow`  | 2         | tick ≈ 1 % ceny                    | 1, 1.01, …, 1.49, 1.5, 1.52, …, 2.48, 2.52, 2.55, …, 10                                     |

Dla `precision ≥ 1` tabela jest generowana przez przejście jednej dekady od jej początku: na granicy `b` tick wynosi `round(b / 10^precision)` jednostek mantysy (wiodąca cyfra ceny pomnożona przez `10^-precision`); kolejny kandydat `b + tick` jest przyciągany w dół do wielokrotności ticka obowiązującego dla tego kandydata, a kandydat, który pozostawiłby przedział węższy niż ten tick, zostaje z nim scalony (`0.9 → 1.0`, a nie `0.9 → 0.99`). Ponieważ przejście zawsze zaczyna się od `1 × 10^k`, każda dekada i każde wywołanie otrzymuje identyczną tabelę — `0.9 → 1` to dokładnie jeden tick `normal`, `1500` leży w przedziale `normal` `[1400, 1600]` oraz w przedziale `wide` `[1000, 2000]`, niezależnie od bieżącej ceny. `wide` jest jedynym przypadkiem szczególnym: tick ≈100 % nie może być okresowy w dekadzie, więc składa się po prostu z kotwic `1, 2, 5`. Funkcja `tickGridDecadeMantissas(precision)` zwraca tę tabelę.

Każda granica jest krótkim ułamkiem dziesiętnym, dzięki czemu konwertuje się bezstratnie do i z liczb JavaScript (`number`): implementacja operuje na całkowitych jednostkach mantysy oraz wykładniku dziesiętnym i nigdy nie kumuluje błędów dodawania zmiennoprzecinkowego.

Niższa wartość `precision` → szersze ticki. `normal` jest zalecaną wartością domyślną (`DEFAULT_TICK_TYPE`).

```typescript
import { TICK_TYPES, DEFAULT_TICK_TYPE, TickType } from 'biatec-concentrated-liquidity-amm';

TICK_TYPES; // ['wide', 'normal', 'narrow'] — zbuduj z tego selektor/przełącznik
DEFAULT_TICK_TYPE; // 'normal'
```

## Główne funkcje {#-core-functions}

Wszystkie poniższe funkcje są eksportowane bezpośrednio z głównego modułu pakietu (`biatec-concentrated-liquidity-amm`).

### `getTickSize(price, tickType)` {#-gettticksize}

Szerokość kanonicznego przedziału zawierającego cenę `price` — dokładna odległość do kolejnej granicy. Jest to główny punkt wejścia do ustalania kroku kontrolek (stepperów) w UI.

```typescript
import { getTickSize } from 'biatec-concentrated-liquidity-amm';

getTickSize(1500, 'wide'); // 1000  (przedział [1000, 2000))
getTickSize(3000, 'wide'); // 3000  (przedział [2000, 5000))
getTickSize(0.9, 'normal'); // 0.1  (przedział [0.9, 1))
getTickSize(1500, 'normal'); // 200  (przedział [1400, 1600))
getTickSize(10000, 'normal'); // 1000
getTickSize(0.001, 'narrow'); // 0.00001
```

### `getTickDecimals(price, tickType)` {#-gettickdecimals}

Liczba miejsc dziesiętnych do wyświetlenia dla ceny przy danym typie ticka — użyj tej funkcji do spójnego formatowania pól wejściowych i etykiet zgodnie z siatką ticków.

```typescript
import { getTickDecimals } from 'biatec-concentrated-liquidity-amm';

getTickDecimals(0.001, 'narrow'); // 5
getTickDecimals(10000, 'normal'); // 0
```

### `snapPriceToTick(price, tickType, rounding?)` {#-snappricetotick}

Przyciąga dowolną cenę do kanonicznej siatki. Wywołuj tę funkcję zawsze, gdy użytkownik wpisuje cenę ręcznie oraz przed utworzeniem puli, aby wynikowe granice trafiły na ticki współdzielone w całym ekosystemie zamiast na jednorazową wartość. Cena znajdująca się już na siatce jest zwracana bez zmian w każdym trybie zaokrąglania.

Parametr `rounding` przyjmuje wartości `'nearest'` (domyślnie, wartości środkowe zaokrąglane w górę), `'down'` lub `'up'`.

```typescript
import { snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

snapPriceToTick(0.94, 'normal'); // 0.9  (najbliższy)
snapPriceToTick(0.96, 'normal'); // 1
snapPriceToTick(1500, 'wide'); // 2000  (najbliższy z 1000 / 2000)
snapPriceToTick(1500, 'wide', 'down'); // 1000
snapPriceToTick(10123, 'normal', 'up'); // 11000
snapPriceToTick(10123, 'normal', 'down'); // 10000
```

Używaj `'down'` dla dolnej granicy zakresu i `'up'` dla górnej granicy, aby wynikowy przedział zawsze obejmował oryginalną wartość wpisaną przez użytkownika:

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

Wszystkie kanoniczne granice pokrywające przedział `[from, to]`: pierwsza to granica mniejsza lub równa `from`, a ostatnia to granica większa lub równa `to`. Ponieważ siatka jest bezwzględna, to samo okno zawsze zwraca te same granice, szersze okno zwraca nadzbiór, a dwa nakładające się okna są zgodne na każdej wspólnej granicy. Użyj tej funkcji do budowy rozkładu cen, wykresu głębokości rynku lub suwaka zakresu. Zwraca `[]` dla nieprawidłowego okna i nigdy nie zwraca więcej niż `maxCount` (domyślnie `1000`) granic.

```typescript
import { tickGridBoundaries, precisionForTickType } from 'biatec-concentrated-liquidity-amm';

tickGridBoundaries(536, 2140, precisionForTickType('wide')); // [500, 1000, 2000, 5000]
tickGridBoundaries(1080, 2160, precisionForTickType('wide')); // [1000, 2000, 5000]
tickGridBoundaries(0.9, 1.0, precisionForTickType('normal')); // [0.9, 1]
tickGridBoundaries(2, 3, precisionForTickType('normal')); // [2, 2.2, 2.4, 2.7, 3]
```

### `suggestTickTypeForRange(low, high, options?)` {#-suggesttickttypeforrange}

Dla istniejącego przedziału cenowego `[low, high]` (na przykład `priceMin`/`priceMax` puli) wybiera **najszerszy** typ ticka, na którego siatce (przyciągnięty) zakres nadal obejmuje od `minBins` (domyślnie `1`) do `maxBins` (domyślnie `40`) przedziałów. Zwraca `null` dla zdegenerowanego zakresu (`high <= low`, tj. pozycji jednolitej ceny typu „ściana”) lub gdy żadna szerokość ticka nie mieści się w zadanych limitach liczby przedziałów.

Jest to właściwa funkcja pomocnicza do wstępnego wypełniania formularza „dodaj płynność” na podstawie istniejącej puli: ponieważ domyślne `minBins` wynosi `1`, dokładny zakres `[min, max]` puli odwzorowuje się z powrotem na pojedynczy przedział przy swojej natywnej (najszerszej pasującej) szerokości, dzięki czemu formularz zachowuje dokładny zakres i dodaje płynność do tej samej puli, zamiast po cichu tworzyć nową, drobniejszą pulę. Z tego miejsca użytkownik nadal może przesuwać zakres na sąsiednie przedziały.

```typescript
import { suggestTickTypeForRange } from 'biatec-concentrated-liquidity-amm';

suggestTickTypeForRange(1000, 2000); // 'wide'   (dokładnie jeden przedział wide)
suggestTickTypeForRange(0.9, 1.0); // 'normal' (dokładnie jeden tick normal o szerokości 0.1)
suggestTickTypeForRange(1, 1); // null (pozycja typu ściana / pojedyncza cena)

// Dostosuj liczbę przedziałów, jaką powinien reprezentować zakres:
suggestTickTypeForRange(1000, 2000, { minBins: 2, maxBins: 40 }); // 'normal'
```

### `tickTypeForPrecision(precision)` / `precisionForTickType(tickType)` {#-precision-conversions}

Konwersja pomiędzy surową precyzją liczbową (np. wyznaczoną z liczby miejsc dziesiętnych aktywa) a nazwanym typem `TickType`. Funkcja `tickTypeForPrecision` przyciąga precyzje, które nie odpowiadają dokładnie `wide`/`normal`/`narrow`, do najbliższego z nich.

```typescript
import { tickTypeForPrecision, precisionForTickType } from 'biatec-concentrated-liquidity-amm';

tickTypeForPrecision(4); // 'narrow' (przyciągnięte do najbliższej znanej precyzji)
tickTypeForPrecision(1); // 'normal' (dokładne dopasowanie)
precisionForTickType('normal'); // 1
```

### `tickDecimals(tick)` {#-tickdecimals}

Liczba miejsc dziesiętnych potrzebnych do zapisania już obliczonej wartości ticka (w przeciwieństwie do `getTickDecimals`, która oblicza miejsca dziesiętne dla pary cena + typ ticka w jednym kroku).

```typescript
import { tickDecimals } from 'biatec-concentrated-liquidity-amm';

tickDecimals(100); // 0
tickDecimals(0.05); // 2
tickDecimals(0.000001); // 6
```

## Prymitywy siatki {#-grid-primitives}

Powyższe funkcje są zbudowane na niskopoziomowych, eksportowanych prymitywach, które poruszają się bezpośrednio po kanonicznej siatce. Wszystkie przyjmują surową precyzję liczbową i zwracają `0` dla nieprawidłowej (nieskończonej lub niedodatniej) ceny.

- **`tickGridBoundaryBelow(price, precision)`** — początek przedziału zawierającego `price` (największa granica `<= price`).
- **`tickGridBoundaryAbove(price, precision)`** — koniec przedziału zawierającego `price` (najmniejsza granica `> price`).
- **`nextTickGridBoundary(boundary, precision)` / `prevTickGridBoundary(boundary, precision)`** — krok o jedną granicę w górę lub w dół siatki (poprawnie przechodząc między dekadami).
- **`tickGridDecadeMantissas(precision)`** — tabela dekady (`[1, 1.1, …, 9, 10]` dla precyzji 1).
- **`tickGridWidthAt(price, precision)`** — dokładna szerokość przedziału (`above - below`); `cleanLogTick`/`getTickSize` to jej aliasy przyjmujące typ ticka.
- **`TICK_GRID_ANCHORS`** (`[1, 2, 5]`) oraz **`MAX_TICK_GRID_BOUNDARIES`** (`1000`, domyślny limit kroków).
- **`initPriceDecimals(price, precision?)`** — stałoprzecinkowy deskryptor `bigint` przedziału zawierającego cenę: `fitPrice` to początek przedziału, a `tick` to jego szerokość (obie wartości przeskalowane przez `TICK_FIXED_SCALE = 10n ** 18n`), dzięki czemu krok `fitPrice + tick` odtwarza kanoniczne granice od dowolnej ceny początkowej. Zachowane dla integratorów korzystających już z postaci `bigint`; w nowym kodzie zaleca się funkcje oparte na `number`.
- **`priceTickDecimals(price, precision?)`** — liczba znaczących miejsc dziesiętnych dla ceny przy surowej precyzji liczbowej (domyślnie `4`), do formatowania.
- **`toFixedBigInt(value)` / `fromFixedBigInt(value)`** — dokładna dla krótkich ułamków dziesiętnych konwersja zwykłej liczby JS `number` do/z reprezentacji stałoprzecinkowej `bigint`.

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

## Łączenie wszystkiego w całość {#-putting-it-together}

Typowy przepływ w UI podczas tworzenia pozycji skoncentrowanej płynności:

```typescript
import {
  TICK_TYPES,
  DEFAULT_TICK_TYPE,
  TickType,
  getTickSize,
  getTickDecimals,
  snapPriceToTick,
} from 'biatec-concentrated-liquidity-amm';

// 1) Wyrenderuj TICK_TYPES jako selektor (np. trzy przyciski), z wartością domyślną DEFAULT_TICK_TYPE.
let tickType: TickType = DEFAULT_TICK_TYPE;

// 2) Użyj bieżącej ceny do dobrania kroku steppera i precyzji pola wejściowego.
const currentPrice = 0.94;
const step = getTickSize(currentPrice, tickType); // 0.1
const decimals = getTickDecimals(currentPrice, tickType); // 1

// 3) Gdy użytkownik wpisze priceMin/priceMax, przyciągnij wartości do wspólnej siatki przed wysłaniem.
const priceMin = snapPriceToTick(0.82, tickType, 'down'); // 0.8
const priceMax = snapPriceToTick(1.15, tickType, 'up'); // 1.2

// 4) Przekaż przyciągnięte wartości w skali bazowej do clammCreateSender / wywołania add-liquidity
//    (zobacz docs/basic-use-cases.md po pełny opis tworzenia puli i dodawania płynności).
```

Oraz wstępne wypełnianie formularza „dodaj płynność” dla istniejącej puli:

```typescript
import { suggestTickTypeForRange, snapPriceToTick } from 'biatec-concentrated-liquidity-amm';

function prefillFromPool(poolPriceMin: number, poolPriceMax: number) {
  const tickType = suggestTickTypeForRange(poolPriceMin, poolPriceMax);
  if (!tickType) {
    // Pula typu ściana / stała cena — siatka ticków nie ma zastosowania, zachowaj dokładne granice.
    return { priceMin: poolPriceMin, priceMax: poolPriceMax, tickType: null };
  }
  return {
    priceMin: snapPriceToTick(poolPriceMin, tickType, 'down'),
    priceMax: snapPriceToTick(poolPriceMax, tickType, 'up'),
    tickType,
  };
}
```

## Zalecana lektura {#-recommended-reading}

- `docs/basic-use-cases.md` — przepływy tworzenia pul i zarządzania płynnością wykorzystujące przyciągnięte ceny.
- `docs/liquidity-rounding.md` — jak zaokrąglanie w skali bazowej (1e9) współdziała z kwotami on-chain.
- [Dokumentacja API](/docs/api) — pełne wygenerowane sygnatury wszystkich funkcji w tym module.
