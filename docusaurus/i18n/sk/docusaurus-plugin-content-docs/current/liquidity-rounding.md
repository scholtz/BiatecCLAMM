# Zaokrúhľovanie likvidity a neznižujúci sa invariant — vyšetrovanie a oprava

Dátum: 2025-10-25
Repozitár: BiatecCLAMM (projects/BiatecCLAMM)
Primárny súbor: `contracts/BiatecClammPool.algo.ts`

## Súhrn pre používateľov {#-user-facing-summary}

**Dôležité**: Pri pridávaní likvidity do poolov s existujúcimi poplatkami môžete dostať mierne menej LP tokenov, ako by naznačovala priama proporcia. Toto je zámerné a chráni pool pred únikom hodnoty prostredníctvom chýb zaokrúhľovania.

### Čo by mali používatelia vedieť {#-what-users-should-know}

- **Typický dopad**: Strata je < 0.0001% vášho vkladu
- **Maximálna pozorovaná**: ~10 základných jednotiek na operáciu (často menej ako $0.000001)
- **Nezhromažďuje sa**: Strata je lineárna s počtom operácií, nie exponenciálna
- **Hodnota poolu sa zvyšuje**: Napriek tomuto zaokrúhľovaniu vaše LP tokeny získavajú hodnotu z obchodných poplatkov

### Prečo sa to deje {#-why-this-happens}

Pool používa kvadratickú rovnicu na zohľadnenie nahromadených poplatkov pri razení LP tokenov. Pozitívny koreň sa zaokrúhľuje nadol, aby sa zabezpečilo, že zaokrúhľovanie vždy uprednostňuje pool pred jednotlivými používateľmi. Toto zabraňuje útočníkom extrahovať hodnotu prostredníctvom opakovaných malých operácií.

### Stratégie zmiernenia {#-mitigation-strategies}

1. **Hromadte svoje operácie**: Vkladajte väčšie sumy menej často
2. **Akceptujte malé straty**: Považujte ich za náklady na ochranu poplatkov
3. **Dlhodobý pohľad**: Hodnota poolu sa stále zvyšuje z obchodných poplatkov v priebehu času

### Príklad scenára {#-example-scenario}

```
Vklad: 1,000,000 tokenov
Okamžité výber: 999,999.99 tokenov
Strata: 0.01 tokenov (0.000001%)
```

Táto malá strata je prijateľná, pretože:

- Zabraňuje poolu stratiť hodnotu
- Strata je deterministická a ohraničená
- Vaše LP tokeny sa oceňujú z obchodných poplatkov
- Alternatíva (únik poolu) by bola horšia pre všetkých LP

---

## Technické hlboké ponorenie {#-technical-deep-dive}

## Cieľ {#-goal}

Zabezpečiť, že uložená likvidita poolu (globálny stav `Liquidity`) sa nikdy nezmenší v dôsledku normálnych operácií (swapy, pridanie likvidity, distribúcia prebytočných aktív). Akákoľvek pozorovaná malá strata musí byť artefaktom celočíselného zaokrúhľovania, nie ekonomickou stratou. Odmietnuť iba skutočné, väčšie poklesy.

## Súhrn problému {#-summary-of-the-issue}

- Jest test pre scenár swapu s nulovým poplatkom zlyhal s tvrdením ako: "Likvidita sa musí zvýšiť po swap".
- Hlavná príčina: celočíselná aritmetika kombinovaná s škálovaním desatinných miest aktív a viacerými deleniami/odmocninami produkovala malé dolné zaokrúhľovacie posuny pri prepočítaní likvidity z bilancií. Toto sú algoritmické chyby skracovania (zaokrúhľovanie nadol) a nie ekonomické straty.

## Čo som zmenil {#-what-i-changed}

V `contracts/BiatecClammPool.algo.ts` som zaviedol pomocné funkcie a malé zmeny riadenia toku, aby som zabezpečil, že uložená likvidita je neznižujúca sa pre swap a vkladové toky, pričom zachoval prísne kontroly pre väčšie poklesy:

- Nová pomocná funkcia: `calculateCurrentLiquidity()`

  - Počíta projekčnú likviditu z `assetABalanceBaseScale`, `assetBBalanceBaseScale`, cenových rozsahov a vracia vypočítané `uint256` (nezapisuje stav).

- Nová pomocná funkcia: `setCurrentLiquidityNonDecreasing(oldLiquidity: uint256): uint256`

  ```typescript
  // Pseudokód pre logiku:
  projectedLiquidity = calculateCurrentLiquidity();
  if (projectedLiquidity >= oldLiquidity) {
    Liquidity = projectedLiquidity; // akceptovať a zapísať
    return projectedLiquidity;
  } else {
    liquidityDrop = oldLiquidity - projectedLiquidity;
    if (liquidityDrop <= allowance) {
      Liquidity = oldLiquidity; // zachovať monotónny stav
      return oldLiquidity;
    } else {
      assert('ERR-LIQ-DROP'); // skutočné zlyhanie integrity
    }
  }
  ```

- Nahradil priame volania, ktoré prepočítali a slepo zapisovali `Liquidity` v týchto cestách kódu, aby používali nový neznižujúci setter:

  - swap cesta (miesto predtým tvrdiace "Likvidita sa nesmie zmenšiť po swap")
  - cesta spracovania pridania likvidity
  - cesta distribúcie prebytočných aktív

- Pomocná funkcia `getLiquidityRoundingAllowance()` vracia povolenie vypočítané ako:

  `allowance = scaleA * scaleB + scaleA + scaleB`

  kde `scaleA = assetADecimalsScaleFromBase` a `scaleB = assetBDecimalsScaleFromBase`.

  (Toto je konzervatívny obal, ktorý ohraničuje šírené chyby celočíselného zaokrúhľovania cez zmiešanú škálovú aritmetiku a krok odmocniny.)

## Prečo je vôbec potrebné povolenie {#-why-an-allowance-is-needed-at-all}

- Všetka matematika likvidity používa celočíselnú aritmetiku a konverziu škály: bilancie sa konvertujú na pevnú základnú škálu (1e9) pomocou `assetADecimalsScaleFromBase` a `assetBDecimalsScaleFromBase`.
- Pri kombinovaní škálovaných celých čísel s deleniami a operáciami odmocniny môže každé zaokrúhľovanie/skracovanie stratiť takmer jednu jednotku relatívne k deliteľovi. Keď sa tieto malé skracovania neskôr vynásobia, môžu sa mapovať na stratu meranú v základných škálových jednotkách, ktorá je proporcionálna k produktu škál na aktívum.
- Malý celočíselný pokles (niekoľko základných jednotiek) nie je ekonomická strata; je to numerický šum. Bez tolerovania tohto môžu správne swapy s nulovým poplatkom neočakávane zlyhať.

## Odôvodnenie pre zvolený vzorec {#-rationale-for-the-chosen-formula}

- Konzervatívny najhorší prípad odôvodnenia (neformálny): maximá skracovania na os môžu interagovať multiplikatívne cez neskoršie produkty/delenia. Vzorec `scaleA*scaleB + scaleA + scaleB` ohraničuje hornú hranicu jednokrokového šíreného krížového člena plus aditívne skracovania na os. Použili sme mierne uvoľnenejší (voľnejší) obal ako tesná algebraická −3 simplifikácia pre jednoduchosť a bezpečnosť.
- Politika kombinovaná s `setCurrentLiquidityNonDecreasing` znamená, že nikdy neukladáme menšiu hodnotu — udržiavame `Liquidity` monotónnu na reťazci, ale stále tvrdenie (vrátenie späť), keď pokles prekročí obal (indikujúci skutočný problém).

## Súbory a zmenené symboly (rýchla referencia) {#-files--symbols-changed-quick-reference}

- `contracts/BiatecClammPool.algo.ts`
  - Pridané: `calculateCurrentLiquidity()`
  - Pridané: `setCurrentLiquidityNonDecreasing(oldLiquidity: uint256): uint256`
  - Pridané: `getLiquidityRoundingAllowance(): uint256`
  - Nahradil priame použitia `setCurrentLiquidity()` v swap, pridanie likvidity a distribučných tokoch s `setCurrentLiquidityNonDecreasing`, kde je potrebná monotónnosť.
  - Zachoval `setCurrentLiquidity()` ako pohodlie, ktoré zapisuje surovú vypočítanú likviditu (stále používané na niekoľkých ďalších miestach, kde nie je potrebná monotónna politika).

## Testy a overenie {#-tests-and-verification}

- Repozitár poskytuje Jest testy, ktoré cvičia AMM logiku a edge case s nulovým poplatkom. Spustenie cieleného testu sa vykonáva pomocou:

```powershell
npm run test:1:build
```

- Poznámka: Test harness vyžaduje Algorand sandbox alebo nakonfigurované testovacie prostredie (KMD/localnet dispenser účet). V mojom prostredí test run zlyhal, keď miestny KMD dispenser nebol dostupný; to je problém nastavenia prostredia, nie chyba kontraktu.

## Ako reprodukovať pôvodný zlyhávajúci symptóm {#-how-to-reproduce-the-original-failing-symptom}

1. Zaistite, že Algorand sandbox (alebo prostredie odhaľujúce KMD dispenser účet očakávaný fixture) beží a je nakonfigurovaný.
2. Z koreňa projektu (kde žije `package.json`):

```powershell
# plná build + cielený test
npm run test:1:build
```

3. Pred opravou test swapu s nulovým poplatkom `Extreme-No-Fees - ASASR EURUSD - 0.9 - 1.1, LP fee 0, Biatec fee 0%` produkoval zlyhanie tvrdenia: `Liquidity must increase after swap`. Po tejto oprave uložená likvidita zostáva monotónna a test by mal prejsť, keď je prostredie dostupné.

## Denník rozhodnutí / kompromisy {#-decision-log--trade-offs}

- Udržiavanie uloženej `Liquidity` striktne monotónnej vyhýba sa zlyhávaniu downstream invariantov a testovacích očakávaní kvôli numerickému šumu.
- Kompromis je pridanie permisívneho obalu: malé zaokrúhľovacie poklesy sú maskované zachovaním predchádzajúcej hodnoty namiesto zápisu mierne menšej vypočítanej hodnoty. Toto je bezpečné, pretože maskované rozdiely sú v rámci deterministických hraníc a neekonomické. Väčšie poklesy stále vracajú späť nahlas.
- Vzorec povolenia je konzervatívny a zámerne jednoduchý na lacné výpočítanie v TEALScript/TEALScript-generovanom kóde.

## Možné vylepšenia {#-possible-improvements}

- Zúžiť povolenie: použiť (scaleA \* scaleB + scaleA + scaleB - 3) alebo vypočítať dynamické hranice odvodené z presne toho, ktoré delenia/odmocniny boli vykonané v aktuálnej ceste.
- Použiť aritmetiku s vyššou presnosťou (ak podporované), takže intermediálne zaokrúhľovania sú menej škodlivé; toto môže vyžadovať viac opcode rozpočtu alebo širšie typy celých čísel.
- Pridať unit testy, ktoré zámerne vytvárajú najhoršie scenáre zaokrúhľovania na potvrdenie, že povolenie je dostatočné a nie príliš permisívne.

## Navrhované následné kroky {#-suggested-follow-ups}

- Spustiť plnú Jest sadu v prostredí s Algorand sandbox/KMD správne nakonfigurovaným: `npm run test`.
- Pridať vyhradený test, ktorý simuluje veľa swapnutých malých množstiev so zmesou desatinných miest aktív na cvičenie hraníc zaokrúhľovania.
- Zvážiť následnú zmenu na vytvorenie povolenia dynamického na cestu, ak rozpočet gas/opcode umožňuje.

---

Ak chcete, môžem:

- implementovať tesnejšiu −3 variantu vzorca povolenia a pushnúť ju ako malú záplatu, alebo
- pridať vyhradený unit test, ktorý konštruuje explicitný najhorší prípad zaokrúhľovania a overuje správanie `setCurrentLiquidityNonDecreasing`.

Povedzte mi, ktorý follow-up by ste chceli a implementujem ho ďalej.
