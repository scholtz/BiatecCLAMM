# Naprawa działających pul po poprawce mintowania LP

Data: 2026-09-26
Wersja kontraktu z poprawką: `BIATEC-CLAMM-01-06-05`
Powiązane: [Ochrona opłat płynności](./liquidity-fee-protection)

## Co jest nie tak w działających pulach {#-what-is-wrong}

Pule działające w wersji `BIATEC-CLAMM-01-06-04` oraz wcześniejszych mintowały mniej tokenów LP niż płynność dodana przez depozyt i nigdzie nie księgowały tej różnicy. Ta płynność nadal znajduje się w pulach, jest śledzona w `Liquidity`, `assetABalanceBaseScale` oraz `assetBBalanceBaseScale`, ale nie należy do nikogo:

```
unowned = Liquidity - distributedLp - LiquidityUsersFromFees - LiquidityBiatecFromFees
```

`distributedLp` wynosi `(18e18 - tokeny LP posiadane przez pulę) * 1000`. Nikt nie może wypłacić `unowned`: `removeLiquidity` wypłaca `distributedLp + Lu`, natomiast `removeLiquidityAdmin` wypłaca `Lb`.

Przegląd sieci mainnet (dostawca pul `3074197785`, 46 pul, 2026-09-26, `scripts/survey-orphaned-liquidity.ts`):

| Pula | Aktywa | Wersja | unowned (jednostki bazowe) | udział w L | Tokeny LP w obiegu |
|---|---|---|---|---|---|
| 3720188642 | Gold / GoldDAO | 01-06-04 | 57,256,214,042 (57.26 L ≈ 1.04 Gold + 61.6 GoldDAO) | 99.9% | brak |
| 3720804577 | Gold / ALGO | 01-06-04 | 9,536,681,071 (9.54 L) | 2.12% | tak |
| 3136517663 | 452399768 / ALGO | 01-06-03 | 1,402,037,905,848 (1402 L) | 0.01% | tak |
| 3132508926 | GoldDAO / USDC | 01-06-03 | 169,578,005 (0.17 L) | 0.04% | tak |
| 3355130627, 3720188812, 3720628473, 3720188475 | różne | – | 82 … 573 (pył, < 1e-6 L) | 100% (puste pule) | brak |
| wszystkie pozostałe pule | – | – | od -2,238 do +2,675 (wyłącznie zaokrąglenia) | 0.00% | – |

Wartości ujemne oznaczają zaokrąglenie na korzyść dostawców płynności (LP) i nie wymagają żadnych działań.

## Jak poprawka je naprawia {#-how-the-fix-repairs-them}

Wersja `BIATEC-CLAMM-01-06-05` dodaje metodę `reconcileLiquidity(appBiatecConfigProvider, assetA, assetB, assetLp)`, którą może wywołać wyłącznie `addressExecutiveFee`. Oblicza ona wartość `unowned` oraz:

- dopisuje ją do `LiquidityUsersFromFees`, gdy tokeny LP są w obiegu, dzięki czemu obecni posiadacze LP otrzymają ją proporcjonalnie (pro rata) przy kolejnym wywołaniu `removeLiquidity` (bez konieczności wykonywania transferów), albo
- dopisuje ją do `LiquidityBiatecFromFees`, gdy w obiegu nie ma żadnych tokenów LP, dzięki czemu Biatec może wypłacić ją za pomocą `removeLiquidityAdmin` i zwrócić poszkodowanemu dostawcy płynności poza łańcuchem (off-chain).

Metoda jest idempotentna: na spójnej puli zwraca `0` i niczego nie zmienia.

## Kroki {#-steps}

1. **Wdróż kontrakt.** Scal (merge) tę zmianę, uruchom `npm test` (wszystkie zestawy testów muszą przejść, w tym `__test__/pool/mainnet-replay-3720188642.test.ts`), podbij wersję pakietu i opublikuj pakiet npm (`npm run build-package && npm run publish-package`), aby integratorzy otrzymali wygenerowanego na nowo klienta z metodą `reconcileLiquidity`.
2. **Załaduj nowy kod bajtowy puli do dostawcy pul** (`upgrade-clamm-template.sh`), aby nowo tworzone pule startowały z wersją `01-06-05`. Przelicz ponownie skróty kodu bajtowego (`npm run compute-bytecode-hashes`) i zaktualizuj indeks audytów.
3. **Wstrzymaj usługę** (ustawienie globalne `BiatecConfigProvider` `s = 1`) na czas trwania kroków 4–6. Zapobiega to wpłatom i wypłatom pomiędzy aktualizacją a uzgodnieniem (rekoncyliacją), które mogłyby zmienić to, kto otrzyma dopisaną płynność. Swapy również są wstrzymane; ogłoś wcześniej okno serwisowe.
4. **Zaktualizuj każdą istniejącą pulę** do wersji `01-06-05` za pomocą `upgrade-clamm-pools.sh` (`src/bin/upgrade-all-pools.ts`, podpisanego przez multisig `addressUdpater`). Zweryfikuj skryptem przeglądowym, że każda pula zwraca `scver = BIATEC-CLAMM-01-06-05`.
5. **Uzgodnij każdą pulę.** Uruchom ponownie skrypt przeglądowy i wywołaj `reconcileLiquidity` z adresu `addressExecutiveFee` na każdej puli, w której `unowned > 0` (wywołanie na wszystkich pulach jest bezpieczne). Z użyciem wygenerowanego klienta:

   ```ts
   await clientBiatecClammPool.send.reconcileLiquidity({
     args: { appBiatecConfigProvider, assetA, assetB, assetLp },
     appReferences: [appBiatecConfigProvider],
     assetReferences: [assetA, assetB, assetLp].filter((a) => a > 0n),
   });
   ```

   Oczekiwany efekt dla poszczególnych pul:
   - `3720804577`, `3136517663`, `3132508926`: `Lu` wzrasta o kwotę `unowned`; obecni posiadacze LP otrzymają ją automatycznie podczas wypłaty. Nie trzeba robić nic więcej.
   - `3720188642` oraz cztery pule pyłowe (dust): `Lb` wzrasta o kwotę `unowned` (brak tokenów LP w obiegu).
6. **Zwróć pozycję Gold/GoldDAO.** Na puli `3720188642` wywołaj `removeLiquidityAdmin(amount = 0)` z adresu `addressExecutiveFee`; wypłaci to całe `Lb` (około 1.04 Gold oraz 61.6 GoldDAO). Rzeczywisty udział Biatec w opłatach to `Lb` zapisane *przed* rekoncyliacją (45,326,961 z 57,307,353,500 = 0.08%); resztę wyślij dostawcy płynności `6WKNXOXAVK5NEGPLMJ5MT6QA4EC2W2MAEW5FOWMD6URHTWPVB4BGIUCR2A`, który umorzył 100% tokenów LP w rundzie 65393080. Dla porównania: odtworzenie historii na poprawionym kontrakcie pokazuje, że wypłata powinna była zwrócić o 0.946874 Gold i 76.638355 GoldDAO więcej; od tego czasu skład puli przesunął się wskutek 7 swapów wykonanych przeciwko nieprzypisanej płynności, więc wartość jest obecnie przechowywana jako 1.044 Gold + 61.6 GoldDAO. Pule pyłowe przechowują mniej niż jedną jednostkę aktywa i mogą pozostać bez zmian.
7. **Wznowienie działania** (`s = 0`), uruchomienie przeglądu po raz ostatni i zarchiwizowanie pliku CSV obok raportu z audytu. Każda pula musi wykazywać `unowned` w granicach kilku tysięcy jednostek bazowych (zaokrąglenie) od zera.
8. **Utrzymanie stanu.** Uruchamiaj okresowo `scripts/survey-orphaned-liquidity.ts` (lub w CI przeciwko sieci mainnet) i ustaw alert, gdy którakolwiek pula zgłosi `unowned` powyżej `1,000,000` jednostek bazowych (0.001 L).

## Uwagi dla operatorów {#-notes-for-operators}

- Transakcja aktualizacji puli wykonuje jeszcze *stary* program zatwierdzający (approval program), dlatego rekoncyliacji nie można połączyć bezpośrednio z `updateApplication`; musi to być osobne wywołanie po aktualizacji.
- Wpłaty mniejsze niż jedna mikrojednostka LP (`1e-6` LP) są teraz odrzucane z błędem `LP-ZERO-ERR`, zamiast być zaokrąglane w górę do jednego tokenu LP (audyt 2026-09-07, ustalenie H-01). Interfejsy front-end powinny odpowiednio wyceniać minimalny depozyt.
- Ilość LP mintowana dla depozytu wynosi `delta * D / (D + Lu)`; podglądy off-chain, które nadal korzystają ze starego równania kwadratowego, będą pokazywać nieznacznie inne wartości.
