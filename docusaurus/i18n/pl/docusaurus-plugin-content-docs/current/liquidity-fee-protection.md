# Ochrona akumulacji opłat gdy dołączają nowi LP

Data: 2025-10-26, zaktualizowano: 2026-09-26
Repozytorium: BiatecCLAMM (projects/BiatecCLAMM)
Główny plik: `contracts/BiatecClammPool.algo.ts`

## Tło {#-background}

Gdy pula zbiera opłaty ze swapów, stan on-chain śledzi je jako dodatkową płynność (`LiquidityUsersFromFees`, `Lu`) bez mintowania dodatkowych tokenów LP. Pierwotny przepływ dodawania płynności mintował nowe tokeny LP bezpośrednio z surowego przyrostu płynności (`newLiquidity - oldLiquidity`). W rezultacie nowy uczestnik mógł dodać płynność i natychmiast ją wycofać, przejmując proporcjonalny udział w historycznych opłatach, które powinny należeć do dotychczasowych dostawców płynności (LP).

Regresja ujawniła się w teście puli „new liquidity provider does not scoop pre-existing fees”, w którym konto C dodaje płynność po scenariuszu z opłatami swap i natychmiast ją wycofuje. Oczekiwanym zachowaniem jest to, że konto otrzymuje dokładnie tyle, ile wpłaciło (zerowy zysk netto).

## Niezmiennik księgowy {#-accounting-invariant}

Każda jednostka płynności puli musi mieć właściciela:

```
Liquidity == distributedLp + LiquidityUsersFromFees + LiquidityBiatecFromFees
```

- `distributedLp` (`D`) to podaż LP będąca w obiegu poza kontem puli, przeskalowana do precyzji bazowej,
- `Lu` to płynność z opłat należąca proporcjonalnie (pro rata) do wszystkich posiadaczy tokenów LP (wypłacana przez `removeLiquidity`),
- `Lb` to płynność z opłat należąca do Biatec (wypłacana przez `removeLiquidityAdmin`).

Metoda `swap` zachowuje ten niezmiennik, ponieważ cały przyrost płynności jest dzielony pomiędzy `Lu` oraz `Lb`.

## Podsumowanie poprawki {#-fix-summary}

Każdy będący w obiegu token LP ma pokrycie w `(D + Lu) / D` jednostkach płynności, ponieważ płynność opłat użytkowników `Lu` jest dzielona proporcjonalnie przez wszystkie tokeny LP przy wywołaniu `removeLiquidity`. Deponent dodający płynność `delta` otrzymuje zatem

```
X = delta * D / (D + Lu)
```

tokenów LP (zaokrąglonych w dół do miejsc dziesiętnych tokenu LP), a część odpowiadająca rozwodnieniu opłat `delta - X` zostaje zaksięgowana w `Lu` (wynosi ona dokładnie 0, dopóki pula nie zebrała żadnych opłat). Przy `Lu' = Lu + delta - X`:

- roszczenie nowego uczestnika przy wyjściu: `X * (D + Lu + delta) / (D + X) == delta` — dokładnie tyle, ile wpłacono, bez historycznych opłat,
- dotychczasowi LP: `D * (D + Lu + delta) / (D + X) == D + Lu` — zachowują wszystkie historyczne opłaty,
- niezmiennik: `D + X + Lu' == D + Lu + delta` — żadna płynność nie pozostaje bez właściciela.

Gdy pula nie ma naliczonych opłat, wzór redukuje się do pierwotnego zachowania „wymintuj przyrost płynności”.

### Dlaczego zastąpiono wariant kwadratowy {#-why-the-quadratic-variant-was-replaced}

Między 2025-10-26 a 2026-09-26 kontrakt mintował `min(delta, root)`, gdzie `root` był pierwiastkiem równania `X^2 + X(D + Lu - Q) - Q * D = 0`, a `Q = depositA * newLiquidity / assetABalance` (lub udział aktywa B, gdy nie wpłacono aktywa A). Powodowało to dwa problemy:

1. `Q` jest oszacowaniem jednostronnym. Dla depozytu, który nie jest w bieżącej proporcji puli (co jest dozwolone i przesuwa cenę puli), wartość `Q` jest mniejsza od faktycznie dodanej płynności, przez co deponent otrzymywał mniej tokenów LP niż wniesiona przez niego płynność.
2. Różnica `delta - X` nie była nigdzie księgowana. Zwiększała ona `Liquidity`, ale nie należała ani do posiadaczy LP, ani do Biatec, przez co nigdy nie mogła zostać wypłacona.

Pokazuje to pula mainnetowa `3720188642` (Gold/GoldDAO, zakres 128–256, opłata LP 0,1%, udział Biatec 20%): po trzech depozytach, 238 swapach i umorzeniu 100% tokenów LP w puli pozostało `L = 57.3` (około 1.04 Gold i 61.6 GoldDAO), podczas gdy udział opłat Biatec wynosił zaledwie `Lb = 0.045`. Pełna historia jest odtwarzana w `__test__/pool/mainnet-replay-3720188642.test.ts` z pliku `__test__/test-data/mainnet-pool-3720188642.json`; po zastosowaniu poprawionego wzoru umorzenie zwraca całą pozycję, a w puli pozostaje wyłącznie `Lb`.

### Dalsze zmiany w wersji 01-06-05 {#-further-changes}

- Depozyt, który nie osiąga jednej mikrojednostki LP (`1e-6` LP), jest odrzucany z błędem `LP-ZERO-ERR`. Wcześniej był zaokrąglany w górę do jednego tokenu LP, co pozwalało wpłacającemu 1 jednostkę bazową wypłacić więcej niż wpłacił (audyt 2026-09-07, H-01).
- Metoda `reconcileLiquidity` (tylko dla wykonawcy opłat) księguje płynność, którą starsze pule pozostawiły bez właściciela; zobacz [Naprawa działających pul](./live-pool-reconciliation).
- Metody `removeLiquidity` oraz `removeLiquidityAdmin` współdzielą jedną procedurę wypłaty (`payOutLiquidity`); ich zachowanie nie uległo zmianie.

## Oczekiwania dotyczące zaokrąglania {#-rounding-expectations}

- Tokeny LP są zaokrąglane w dół do 6 miejsc dziesiętnych; reszta poniżej mikro-LP (`< 1e-6` LP na depozyt) pozostaje w puli jako zaokrąglenie na korzyść puli. Celowo nie jest ona księgowana jako przychód z opłat, dzięki czemu `liquidityUsersFromFees` pozostaje równe 0 aż do pierwszego swapu; metoda `reconcileLiquidity` może przekazać zakumulowane reszty zaokrągleń posiadaczom LP.
- Metoda `removeLiquidity` nadal zaokrągla w dół wysyłane kwoty aktywów, więc wypłaty mogą być mniejsze od wpłat o kilka jednostek bazowych, które pozostają w puli.
- Zestaw testów Jest weryfikuje, że saldo nowego uczestnika nigdy nie wzrasta i toleruje jedynie minimalny deficyt, a odtworzenie historii z mainnetu sprawdza niezmiennik po każdej operacji płynnościowej z tolerancją jednej mikrojednostki LP na operację.

## Uwagi operacyjne {#-operational-notes}

- Każda zmiana kontraktu wymaga ponownej kompilacji artefaktów TEAL (`npm run compile-contract`) i wygenerowania klientów (`npm run generate-client` lub `npm run build`) przed publikacją pakietów.
- Funkcje pomocnicze off-chain lub symulacje szacujące liczbę mintowanych tokenów LP muszą używać wzoru `delta * D / (D + Lu)`, aby zachować zgodność z łańcuchem.
- Pule wdrożone w wersji `BIATEC-CLAMM-01-06-04` lub wcześniejszej powinny zostać zaktualizowane; płynność osierocona wcześniej w takich pulach nie jest odzyskiwana automatycznie przez samą aktualizację.
- Pełny wieloepokowy dowód matematyczny, konkretne przykłady liczbowe oraz pokrycie w zestawach testów dla wielu podmiotów (`__test__/pool/multi-party-fee-aggregation.test.ts`) znajdują się w dokumencie [Agregacja płynności wielu podmiotów i dowód uczciwości opłat](./multi-party-fee-aggregation).
