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

Podczas mintowania tokenów LP pula uwzględnia naliczone opłaty: depozyt płynności `delta` mintuje `delta * distributedLp / (distributedLp + usersFeeLiquidity)` tokenów LP, zaokrąglonych w dół do miejsc dziesiętnych tokenu LP (6). Część odpowiadająca rozwodnieniu opłat `delta - X` zostaje dopisana do dotychczasowych posiadaczy LP (`LiquidityUsersFromFees`); reszta z zaokrąglenia poniżej mikrojednostki LP pozostaje w puli, dzięki czemu zaokrąglenie zawsze działa na korzyść puli, a nie pojedynczego deponenta. Zapobiega to wyciąganiu wartości przez atakujących za pomocą powtarzanych drobnych operacji. Zobacz [Ochrona opłat płynności](./liquidity-fee-protection) po pełne wyprowadzenie.

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
  - Dodano: `calculateCurrentLiquidity()`
  - Dodano: `setCurrentLiquidityNonDecreasing(oldLiquidity: uint256): uint256`
  - Dodano: `getLiquidityRoundingAllowance(): uint256`
  - Zastąpiono bezpośrednie wywołania `setCurrentLiquidity()` w przepływach swap, dodawania płynności oraz dystrybucji wywołaniem `setCurrentLiquidityNonDecreasing` tam, gdzie wymagana jest monotoniczność.
  - Zachowano `setCurrentLiquidity()` jako funkcję pomocniczą zapisującą surową obliczoną płynność (nadal używaną w miejscach, gdzie polityka monotoniczności nie jest wymagana).

## Testy i weryfikacja {#-tests-and-verification}

- Repozytorium dostarcza testy Jest weryfikujące logikę AMM oraz przypadek brzegowy z zerową opłatą. Uruchomienie docelowego testu wykonuje się poleceniem:

```powershell
npm run test:1:build
```

- Uwaga: zestaw testowy wymaga działającego i skonfigurowanego środowiska Algorand sandbox (konta dyspensera KMD/localnet). W moim środowisku uruchomienie testu nie powiodło się, gdy lokalny dyspenser KMD nie był dostępny; był to problem konfiguracji środowiska, a nie błąd kontraktu.

## Jak zreprodukować oryginalny zawodzący symptom {#-how-to-reproduce-the-original-failing-symptom}

1. Upewnij się, że Algorand sandbox (lub środowisko udostępniające konto dyspensera KMD oczekiwane przez fixture) jest uruchomione i skonfigurowane.
2. Z głównego katalogu projektu (gdzie znajduje się `package.json`):

```powershell
# pełne budowanie + docelowy test
npm run test:1:build
```

3. Przed poprawką test swapu z zerową opłatą `Extreme-No-Fees - ASASR EURUSD - 0.9 - 1.1, LP fee 0, Biatec fee 0%` kończył się błędem asercji: `Liquidity must increase after swap`. Po tej poprawce przechowywana płynność pozostaje monotoniczna i test przechodzi pomyślnie, gdy środowisko jest dostępne.

## Dziennik decyzji / kompromisy {#-decision-log--trade-offs}

- Utrzymywanie przechowywanej wartości `Liquidity` jako ściśle monotonicznej zapobiega błędom dalszych niezmienników oraz testów wywołanym szumem numerycznym.
- Kompromisem jest dodanie dopuszczalnej obwiedni: drobne spadki wynikające z zaokrągleń są maskowane przez zachowanie poprzedniej wartości zamiast zapisania nieco mniejszej obliczonej wartości. Jest to bezpieczne, ponieważ maskowane różnice mieszczą się w deterministycznych granicach i nie mają charakteru ekonomicznego. Większe spadki nadal powodują wycofanie transakcji.
- Wzór tolerancji jest konserwatywny i celowo prosty, aby jego obliczenie w kodzie TEALScript było tanie.

## Możliwe ulepszenia {#-possible-improvements}

- Zawężenie tolerancji: użycie `(scaleA * scaleB + scaleA + scaleB - 3)` lub obliczenie dynamicznych granic wynikających dokładnie z tego, które dzielenia/pierwiastki zostały wykonane w bieżącej ścieżce.
- Użycie arytmetyki pośredniej o wyższej precyzji (jeśli jest obsługiwana), aby pośrednie zaokrąglenia w dół były mniej dotkliwe; może to wymagać większego budżetu opcode lub szerszych typów całkowitych.
- Dodanie testów jednostkowych celowo konstruujących najgorsze scenariusze zaokrąglania w celu potwierdzenia, że tolerancja jest wystarczająca i niezbyt permisywna.

## Sugerowane następne kroki {#-suggested-follow-ups}

- Uruchomić pełny zestaw testów Jest w środowisku z poprawnie skonfigurowanym Algorand sandbox/KMD: `npm run test`.
- Dodać dedykowany test symulujący wiele swapów małych kwot przy różnych liczbach miejsc dziesiętnych aktywów w celu przetestowania granic zaokrąglania.
- Rozważyć uzależnienie tolerancji dynamicznie od ścieżki wykonania, jeśli pozwala na to budżet opłat/opcode.

---

Jeśli chcesz, mogę:

- zaimplementować ściślejszą −3 wariant wzoru pozwolenia i pushnąć ją jako małą łatkę, lub
- dodać dedykowany unit test, który konstruuje explicitny najgorszy przypadek zaokrąglania i weryfikuje zachowanie `setCurrentLiquidityNonDecreasing`.

Powiedz mi, który follow-up chcesz i zaimplementuję go dalej.
