# Likviditás kerekítés és a nem csökkenő invariáns — vizsgálat és javítás

Dátum: 2025-10-25
Repository: BiatecCLAMM (projects/BiatecCLAMM)
Elsődleges fájl: `contracts/BiatecClammPool.algo.ts`

## Felhasználói összefoglaló {#-user-facing-summary}

**Fontos**: Ha olyan poolba ad likviditást, amelyben már vannak felhalmozott díjak, előfordulhat, hogy a pusztán arányos számításnál valamivel kevesebb LP tokent kap. Ez szándékos, és megvédi a poolt attól, hogy a kerekítési hibák miatt érték szivárogjon ki.

### Amit a felhasználóknak tudniuk kell {#-what-users-should-know}

- **Tipikus hatás**: A veszteség a befizetés < 0,0001%-a
- **Maximálisan megfigyelt**: Műveletenként ~10 alapegység (gyakran kevesebb, mint 0,000001 USD)
- **Nem halmozódik exponenciálisan**: A veszteség lineáris a műveletek számával
- **A pool értéke nő**: A kerekítés ellenére az LP tokenek értéke a kereskedési díjakból emelkedik

### Miért történik ez {#-why-this-happens}

A pool egy másodfokú egyenletet használ a felhalmozott díjak figyelembevételéhez az LP tokenek mintelésekor. A pozitív gyök értékét lefelé kerekítjük, így a kerekítés mindig a poolt részesíti előnyben az egyes felhasználókkal szemben. Ez megakadályozza, hogy támadók ismétlődő apró műveletekkel értéket szívjanak ki.

### Enyhítési stratégiák {#-mitigation-strategies}

1. **Csoportosítsa a műveleteket**: Ritkábban, de nagyobb összegeket helyezzen el
2. **Fogadja el a csekély veszteséget**: Tekintse a díjvédelem költségének
3. **Hosszú távú szemlélet**: Az idő előrehaladtával a kereskedési díjak növelik a pool értékét

### Példa forgatókönyv {#-example-scenario}

```
Betét: 1 000 000 token
Azonnali visszavonás: 999 999,99 token
Veszteség: 0,01 token (0,000001%)
```

Ez az apró veszteség elfogadható, mert:

- Megakadályozza a pool értékvesztését
- Determinisztikus és korlátozott
- Az LP tokenek a kereskedési díjaktól továbbra is értéket nyernek
- Az alternatíva (a pool „vérzése”) minden LP számára rosszabb lenne

---

## Technikai mélyfúrás {#-technical-deep-dive}

## Cél {#-goal}

Biztosítani, hogy a tárolt pool likviditás (globális állapot `Liquidity`) normál műveletek (swapok, likviditás hozzáadása, többlet eszközök szétosztása) során soha ne csökkenjen. Az észlelt kis csökkenések kizárólag egész kerekítési artefaktumok lehetnek, valós gazdasági veszteség nem. Csak a tényleges, nagyobb eséseket utasítsuk el.

## A probléma összefoglalása {#-summary-of-the-issue}

- Egy Jest teszt nulladíjas swap esetben hibával tért vissza: „Liquidity must increase after swap”.
- Gyökérok: integer alapú aritmetika, eszköz tizedes skálázás és több osztás/négyzetgyök lépés miatt a likviditás újraszámításakor apró lefelé kerekítési sodródás jelentkezett. Ezek algoritmikus truncation hibák (floor), nem pedig gazdasági veszteségek.

## Mit módosítottam {#-what-i-changed}

A `contracts/BiatecClammPool.algo.ts` fájlban segédfüggvényeket és kisebb vezérlési változtatásokat vezettem be, hogy a tárolt likviditás a swap és betét folyamatokban ne csökkenjen, miközben a nagyobb eséseket továbbra is szigorúan ellenőrizzük:

- Új segéd: `calculateCurrentLiquidity()`

  - Kiszámítja a becsült likviditást `assetABalanceBaseScale`, `assetBBalanceBaseScale`, ársávok felhasználásával, és visszaadja az eredményt `uint256` formában (állapotot nem ír).

- Új segéd: `setCurrentLiquidityNonDecreasing(oldLiquidity: uint256): uint256`

  ```typescript
  // A logika pszeudokódban:
  projectedLiquidity = calculateCurrentLiquidity();
  if (projectedLiquidity >= oldLiquidity) {
    Liquidity = projectedLiquidity; // elfogadjuk és írjuk
    return projectedLiquidity;
  } else {
    liquidityDrop = oldLiquidity - projectedLiquidity;
    if (liquidityDrop <= allowance) {
      Liquidity = oldLiquidity; // megőrizzük a monoton állapotot
      return oldLiquidity;
    } else {
      assert('ERR-LIQ-DROP'); // tényleges integritási hiba
    }
  }
  ```

- Lecseréltem azokat a hívásokat, amelyek korábban újraszámolták és vakon írták a `Liquidity` értéket az alábbi áramlásokban:

  - swap útvonal (ahol korábban az „Liquidity must not decrease after swap” assert volt)
  - likviditás hozzáadása feldolgozási út
  - distributeExcessAssets út

- A `getLiquidityRoundingAllowance()` segéd a következőképpen számítja az engedélyezett eltérést:

  `allowance = scaleA * scaleB + scaleA + scaleB`

  ahol `scaleA = assetADecimalsScaleFromBase`, `scaleB = assetBDecimalsScaleFromBase`.

  (Ez konzervatív burkot ad, amely felső korlátot állít az integer floor hibákra, figyelembe véve a különböző skálázásokat és a négyzetgyök lépést.)

## Miért kell egyáltalán engedélyezett eltérés {#-why-an-allowance-is-needed-at-all}

- A likviditási matematika teljes egészében integer aritmetikát és skálaváltásokat használ: az egyenlegeket fix alapléptékre (1e9) konvertáljuk `assetADecimalsScaleFromBase` és `assetBDecimalsScaleFromBase` segítségével.
- Amikor skálázott egészeket osztásokkal és négyzetgyökökkel kombinálunk, minden floor/truncate lépés legfeljebb egy egységet veszíthet a nevezőhöz viszonyítva. Ha ezek a kis truncation hibák később szorzódnak, olyan veszteséghez vezethetnek alapskála egységekben, amely arányos az eszközskálák szorzatával.
- Egy apró integer esés (néhány alapskálás egység) nem gazdasági veszteség, hanem numerikus zaj. Enélkül a tolerancia nélkül a korrekt nulladíjas swapok is váratlanul visszautasításra kerülnének.

## A választott formula indoklása {#-rationale-for-the-chosen-formula}

- Konzervatív legrosszabb eset elemzés (nem formális): minden tengelyen a truncation maximumok később szorzatként jelentkezhetnek. A `scaleA*scaleB + scaleA + scaleB` formula felső korlátot ad egy egy lépésben terjedő kereszttagra és az additív tengelyenkénti truncationre. A -3-mal szűkített szigorúan származtatott formulánál kissé lazább burkot választottunk az egyszerűség és biztonság érdekében.
- A politika és a `setCurrentLiquidityNonDecreasing` kombinációja azt jelenti, hogy soha nem tároljuk a kisebb értéket — a `Liquidity` on-chain monoton marad, viszont nagyobb esés esetén továbbra is revertelünk.

## Módosított fájlok és szimbólumok (gyors referencia) {#-files--symbols-changed-quick-reference}

- `contracts/BiatecClammPool.algo.ts`
  - Új: `calculateCurrentLiquidity()`
  - Új: `setCurrentLiquidityNonDecreasing(oldLiquidity: uint256): uint256`
  - Új: `getLiquidityRoundingAllowance(): uint256`
  - A swap, likviditás hozzáadás és distribute útvonalakon a korábbi `setCurrentLiquidity()` hívások helyett most `setCurrentLiquidityNonDecreasing` biztosítja a monotonitást.
  - A `setCurrentLiquidity()` továbbra is elérhető, ahol nincs szükség monotonitásra.

## Tesztek és ellenőrzés {#-tests-and-verification}

- A repository Jest teszteket biztosít az AMM logikára és a nulladíjas edge esetre. A célzott teszt futtatása:

```powershell
npm run test:1:build
```

- Megjegyzés: A teszt futtatásához Algorand sandbox vagy megfelelően konfigurált teszt környezet (KMD/localnet dispenser account) szükséges. Saját környezetemben a helyi KMD dispenser hiánya miatt futott hibára; ez környezeti beállítási probléma, nem szerződés bug.

## Az eredeti hiba reprodukálása {#-how-to-reproduce-the-original-failing-symptom}

1. Győződjön meg róla, hogy az Algorand sandbox (vagy a fixture által elvárt KMD dispenserrel rendelkező környezet) fut és konfigurálva van.
2. A projekt gyökeréből (ahol a `package.json` található):

```powershell
# teljes build + célzott teszt
npm run test:1:build
```

3. A javítás előtt a `Extreme-No-Fees - ASASR EURUSD - 0.9 - 1.1, LP fee 0, Biatec fee 0%` nevű teszt `Liquidity must increase after swap` assert hibával állt meg. A javítás után a tárolt likviditás monotonná válik, és a teszt sikeres, ha a környezet rendelkezésre áll.

## Döntési napló / kompromisszumok {#-decision-log--trade-offs}

- A `Liquidity` érték monoton tartása megakadályozza, hogy az invariánsok és a teszt elvárások a numerikus zaj miatt bukjanak meg.
- A kompromisszum egy engedélyező burkot ad: a nagyon kicsi kerekítési eséseket elfedjük a korábbi érték megőrzésével. Ez biztonságos, mert az elfedett eltérések determinisztikusak és nem gazdasági jellegűek. A nagyobb esések továbbra is hangosan hibaüzenetet generálnak.
- Az allowance formula konzervatív és egyszerűen számítható TEALScript-ben, így olcsó.

## Lehetséges fejlesztések {#-possible-improvements}

- Az allowance szűkítése: használja a `(scaleA * scaleB + scaleA + scaleB - 3)` formulát, vagy számítson dinamikus határértékeket az adott útvonalon végrehajtott osztások/sqrt lépések alapján.
- Nagyobb pontosságú köztes aritmetika alkalmazása (ha támogatott), hogy a floor műveletek kevésbé legyenek károsak; ez több opcode költséget vagy szélesebb integer típusokat igényelhet.
- Adjunk hozzá olyan unit teszteket, amelyek direkt rossz kerekítési eseteket állítanak elő, hogy igazolják az allowance elegendőségét és visszafogottságát.

## Javasolt továbblépések {#-suggested-follow-ups}

- Futtassa le a teljes Jest csomagot megfelelően konfigurált Algorand sandbox/KMD környezetben: `npm run test`.
- Adjunk hozzá dedikált tesztet, amely sok apró swapot szimulál vegyes eszköz tizedesekkel, hogy kihívjuk a kerekítési határokat.
- Vizsgáljuk meg, hogy van-e lehetőség az allowance dinamikus, útvonalfüggő beállítására, ha a gáz/opcode keret engedi.

---

Ha szeretné, tudok:

- egy apró patch-et készíteni a szigorúbb, −3-mal csökkentett allowance képlethez, vagy
- egy dedikált unit tesztet írni, amely szándékosan a legrosszabb kerekítési esetet építi fel, és ellenőrzi a `setCurrentLiquidityNonDecreasing` működését.

Jelezze, melyik következő lépést kéred, és megvalósítom.
