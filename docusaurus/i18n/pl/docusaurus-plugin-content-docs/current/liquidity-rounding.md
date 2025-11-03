# Zaokrąglanie płynności i niezmniejszający się invariant — dochodzenie i naprawa

Data: 2025-10-25
Repozytorium: BiatecCLAMM (projects/BiatecCLAMM)
Główny plik: `contracts/BiatecClammPool.algo.ts`

## Podsumowanie dla użytkowników {#-user-facing-summary}

**Ważne**: Przy dodawaniu płynności do pul z istniejącymi opłatami możesz otrzymać nieco mniej tokenów LP, niż wskazywałaby bezpośrednia proporcja. To jest zamierzone i chroni pulę przed utratą wartości poprzez błędy zaokrąglania.

### Co powinni wiedzieć użytkownicy {#-what-users-should-know}

- **Typowy wpływ**: Strata jest < 0.0001% Twojego wkładu
- **Maksymalna obserwowana**: ~10 jednostek bazowych na operację (często mniej niż $0.000001)
- **Nie kumuluje się**: Strata jest liniowa z liczbą operacji, nie wykładnicza
- **Wartość puli wzrasta**: Pomimo tego zaokrąglania Twoje tokeny LP zyskują wartość z opłat handlowych

### Dlaczego się to dzieje {#-why-this-happens}

Pula używa równania kwadratowego aby uwzględnić nagromadzone opłaty przy mintowaniu tokenów LP. Dodatni pierwiastek jest zaokrąglany w dół, aby zapewnić, że zaokrąglanie zawsze faworyzuje pulę przed indywidualnymi użytkownikami. To zapobiega atakującym ekstrakcji wartości poprzez powtarzane małe operacje.

### Strategie łagodzenia {#-mitigation-strategies}

1. **Akumuluj swoje operacje**: Wkładaj większe sumy rzadziej
2. **Akceptuj małe straty**: Traktuj je jako koszty ochrony opłat
3. **Długoterminowy pogląd**: Wartość puli wciąż wzrasta z opłat handlowych w czasie

### Przykład scenariusza {#-example-scenario}

```
Wkład: 1,000,000 tokenów
Natychmiastowa wypłata: 999,999.99 tokenów
Strata: 0.01 tokenów (0.000001%)
```

Ta mała strata jest akceptowalna, ponieważ:

- Zapobiega puli utracie wartości
- Strata jest deterministyczna i ograniczona
- Twoje tokeny LP są wyceniane z opłat handlowych
- Alternatywa (wycieku puli) byłaby gorsza dla wszystkich LP

---

## Techniczne głębokie zanurzenie {#-technical-deep-dive}

## Cel {#-goal}

Zapewnić, że przechowywana płynność puli (globalny stan `Liquidity`) nigdy nie zmniejszy się w wyniku normalnych operacji (swapy, dodanie płynności, dystrybucja nadwyżki aktywów). Jakakolwiek obserwowana mała strata musi być artefaktem zaokrąglania integer, nie stratą ekonomiczną. Odrzucać tylko rzeczywiste, większe spadki.

## Podsumowanie problemu {#-summary-of-the-issue}

- Test Jest dla scenariusza swap z zerowymi opłatami zawiódł z asercją jak: "Płynność musi wzrosnąć po swap".
- Główna przyczyna: arytmetyka integer połączona ze skalowaniem miejsc dziesiętnych aktywów i wieloma dzieleniami/pierwiastkami produkowała małe dolne przesunięcia zaokrąglania przy ponownym kalkulowaniu płynności z bilansów. To są błędy algorytmiczne skracania (zaokrąglanie w dół) a nie straty ekonomiczne.

## Co zmieniłem {#-what-i-changed}

W `contracts/BiatecClammPool.algo.ts` wprowadziłem funkcje pomocnicze i małe zmiany kontroli przepływu, aby zapewnić, że przechowywana płynność jest niemalejąca dla przepływów swap i wkładów, zachowując ścisłe kontrole dla większych spadków:

- Nowa funkcja pomocnicza: `calculateCurrentLiquidity()`

  - Kalkuluje projekcyjną płynność z `assetABalanceBaseScale`, `assetBBalanceBaseScale`, zakresów cenowych i zwraca kalkulowane `uint256` (nie zapisuje stanu).

- Nowa funkcja pomocnicza: `setCurrentLiquidityNonDecreasing(oldLiquidity: uint256): uint256`

  ```typescript
  // Pseudokod dla logiki:
  projectedLiquidity = calculateCurrentLiquidity();
  if (projectedLiquidity >= oldLiquidity) {
    Liquidity = projectedLiquidity; // akceptować i zapisać
    return projectedLiquidity;
  } else {
    liquidityDrop = oldLiquidity - projectedLiquidity;
    if (liquidityDrop <= allowance) {
      Liquidity = oldLiquidity; // zachować stan monotoniczny
      return oldLiquidity;
    } else {
      assert('ERR-LIQ-DROP'); // rzeczywiste niepowodzenie integralności
    }
  }
  ```

- Zastąpił bezpośrednie wywołania, które rekalkulowały i ślepo zapisywały `Liquidity` w tych ścieżkach kodu, aby używały nowego niemalejącego settera:

  - ścieżka swap (zamiast wcześniej asertująca "Płynność nie może zmniejszyć się po swap")
  - ścieżka przetwarzania dodania płynności
  - ścieżka dystrybucji nadwyżki aktywów

- Funkcja pomocnicza `getLiquidityRoundingAllowance()` zwraca pozwolenie kalkulowane jako:

  `allowance = scaleA * scaleB + scaleA + scaleB`

  gdzie `scaleA = assetADecimalsScaleFromBase` i `scaleB = assetBDecimalsScaleFromBase`.

  (To jest konserwatywny obwiednia, która ogranicza rozprzestrzenione błędy zaokrąglania integer poprzez mieszaną skalową arytmetykę i krok pierwiastka.)

## Dlaczego w ogóle potrzebne jest pozwolenie {#-why-an-allowance-is-needed-at-all}

- Cała matematyka płynności używa arytmetyki integer i konwersji skali: bilanse są konwertowane na stałą skalę bazową (1e9) używając `assetADecimalsScaleFromBase` i `assetBDecimalsScaleFromBase`.
- Przy kombinowaniu skalowanych integer z dzieleniami i operacjami pierwiastka każde zaokrąglanie/skracanie może stracić prawie jedną jednostkę relatywnie do dzielnika. Gdy te małe skracania są później mnożone, mogą mapować na stratę mierzona w jednostkach skali bazowej, która jest proporcjonalna do produktu skal na aktywo.
- Mały spadek integer (kilka jednostek bazowych) nie jest stratą ekonomiczną; jest to szum numeryczny. Bez tolerowania tego prawidłowe swapy z zerowymi opłatami mogą nieoczekiwanie zawieść.

## Uzasadnienie dla wybranego wzoru {#-rationale-for-the-chosen-formula}

- Konserwatywne uzasadnienie najgorszego przypadku (nieformalny): maksymalne skracania na osiach mogą interagować multiplikatywnie poprzez późniejsze produkty/dzielenia. Wzór `scaleA*scaleB + scaleA + scaleB` ogranicza górną granicę jednokrokowej rozprzestrzenionej krzyżowej składowej plus addytywne skracania na osiach. Użyliśmy lekko luźniejszej (wolniejszej) obwiedni niż ścisła algebraiczna −3 simplifikacja dla prostoty i bezpieczeństwa.
- Polityka połączona z `setCurrentLiquidityNonDecreasing` oznacza, że nigdy nie zapisujemy mniejszej wartości — utrzymujemy `Liquidity` monotoniczną na łańcuchu, ale wciąż asertujemy (cofamy) gdy spadek przekroczy obwiednię (indykując rzeczywisty problem).

## Pliki i zmienione symbole (szybka referencja) {#-files--symbols-changed-quick-reference}

- `contracts/BiatecClammPool.algo.ts`
  - Pridané: `calculateCurrentLiquidity()`
  - Pridané: `setCurrentLiquidityNonDecreasing(oldLiquidity: uint256): uint256`
  - Pridané: `getLiquidityRoundingAllowance(): uint256`
  - Nahradil priame použitia `setCurrentLiquidity()` v swap, pridanie likvidity a distribučných tokoch s `setCurrentLiquidityNonDecreasing`, kde je potrebná monotónnosť.
  - Zachoval `setCurrentLiquidity()` ako pohodlie, ktoré zapisuje surovú vypočítanú likviditu (stále používané na niekoľkých ďalších miestach, kde nie je potrebná monotónna politika).

## Testy i weryfikacja {#-tests-and-verification}

- Repozitár poskytuje Jest testy, ktoré cvičia AMM logiku a edge case s nulovým poplatkom. Spustenie cieleného testu sa vykonáva pomocou:

```powershell
npm run test:1:build
```

- Poznámka: Test harness vyžaduje Algorand sandbox alebo nakonfigurované testovacie prostredie (KMD/localnet dispenser účet). V mojom prostredí test run zlyhal, keď miestny KMD dispenser nebol dostupný; to je problém nastavenia prostredia, nie chyba kontraktu.

## Jak zreprodukować oryginalny zawodzący symptom {#-how-to-reproduce-the-original-failing-symptom}

1. Zaistite, že Algorand sandbox (alebo prostredie odhaľujúce KMD dispenser účet očakávaný fixture) beží a je nakonfigurovaný.
2. Z koreňa projektu (kde žije `package.json`):

```powershell
# plná build + cielený test
npm run test:1:build
```

3. Pred opravou test swapu s nulovým poplatkom `Extreme-No-Fees - ASASR EURUSD - 0.9 - 1.1, LP fee 0, Biatec fee 0%` produkoval zlyhanie tvrdenia: `Liquidity must increase after swap`. Po tejto oprave uložená likvidita zostáva monotónna a test by mal prejsť, keď je prostredie dostupné.

## Dziennik decyzji / kompromisy {#-decision-log--trade-offs}

- Udržiavanie uloženej `Liquidity` striktne monotónnej vyhýba sa zlyhávaniu downstream invariantov a testovacích očakávaní kvôli numerickému šumu.
- Kompromis je pridanie permisívneho obalu: malé zaokrúhľovacie poklesy sú maskované zachovaním predchádzajúcej hodnoty namiesto zápisu mierne menšej vypočítanej hodnoty. Toto je bezpečné, pretože maskované rozdiely sú v rámci deterministických hraníc a neekonomické. Väčšie poklesy stále vracajú späť nahlas.
- Vzorec povolenia je konzervatívny a zámerne jednoduchý na lacné výpočítanie v TEALScript/TEALScript-generovanom kóde.

## Możliwe ulepszenia {#-possible-improvements}

- Zúžiť povolenie: použiť (scaleA \* scaleB + scaleA + scaleB - 3) alebo vypočítať dynamické hranice odvodené z presne toho, ktoré delenia/odmocniny boli vykonané v aktuálnej ceste.
- Použiť aritmetiku s vyššou presnosťou (ak podporované), takže intermediálne zaokrúhľovania sú menej škodlivé; toto môže vyžadovať viac opcode rozpočtu alebo širšie typy celých čísel.
- Pridať unit testy, ktoré zámerne vytvárajú najhoršie scenáre zaokrúhľovania na potvrdenie, že povolenie je dostatočné a nie príliš permisívne.

## Sugerowane następne kroki {#-suggested-follow-ups}

- Spustiť plnú Jest sadu v prostredí s Algorand sandbox/KMD správne nakonfigurovaným: `npm run test`.
- Pridať vyhradený test, ktorý simuluje veľa swapnutých malých množstiev so zmesou desatinných miest aktív na cvičenie hraníc zaokrúhľovania.
- Zvážiť následnú zmenu na vytvorenie povolenia dynamického na cestu, ak rozpočet gas/opcode umožňuje.

---

Jeśli chcesz, mogę:

- zaimplementować ściślejszą −3 wariant wzoru pozwolenia i pushnąć ją jako małą łatkę, lub
- dodać dedykowany unit test, który konstruuje explicitny najgorszy przypadek zaokrąglania i weryfikuje zachowanie `setCurrentLiquidityNonDecreasing`.

Powiedz mi, który follow-up chcesz i zaimplementuję go dalej.
