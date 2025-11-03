# Ochrona akumulacji opłat gdy dołączają nowi LP

Data: 2025-10-26
Repozytorium: BiatecCLAMM (projects/BiatecCLAMM)
Główny plik: `contracts/BiatecClammPool.algo.ts`

## Tło {#-tlo}

Gdy pula zbiera opłaty swap, stan on-chain śledzi je jako dodatkową płynność (`LiquidityUsersFromFees`) bez mintowania dodatkowych tokenów LP. Poprzedni flow add-liquidity mintował nowe tokeny LP z surowego delty płynności (`newLiquidity - oldLiquidity`). Rezultatem było to, że nowicjusz mógł dodać płynność i natychmiast ją usunąć, aby zebrać proporcjonalny udział z historycznych opłat, które powinny należeć do incumbent LP.

Regresja pojawiła się w teście puli "new liquidity provider does not scoop pre-existing fees" gdzie konto C dodaje płynność po scenariuszu opłat swap i usuwa ją bezpośrednio. Oczekiwane zachowanie to, że konto otrzyma dokładnie to, co wpłaciło (net zero profit).

## Podsumowanie naprawy {#-podsumowanie-naprawy}

`processAddLiquidity` teraz rozwiązuje równanie kwadratyczne wymuszone przez natychmiastową parzystość wypłaty i flooruje dodatni pierwiastek przed mintowaniem tokenów LP:

```
X^2 + X(sumDistributedAndFees − Q) − Q * distributedBefore = 0
```

gdzie:

- `distributedBefore` to wcześniej dystrybuowany supply LP (skalowany na precyzję bazową),
- `LiquidityUsersFromFees` wychwytuje historyczną płynność opłat wciąż własności incumbents,
- `Q = depositShare * newLiquidity` z `depositShare` wyprowadzonym z wkładu bazowej skali wywołującego,
- `X` to delta LP bazowej skali, którą rozwiązujemy.

Floorowaniem pierwiastka (a tym samym zaokrąglaniem na korzyść puli) zapewniamy, że nowicjusze nigdy nie mintują wystarczająco LP aby odblokować pre-istniejące opłaty. Gdy pula nie ma nagromadzonych opłat, równanie kwadratowe rozpada się na oryginalne zachowanie "mint the liquidity delta".

Ta sama proporcjonalna arytmetyka jest ponownie używana na wyjście: udziały opłat są kalkulowane z pojedynczym przejściem mnożenia/dzielenia tak że drift zaokrąglania pozostaje przewidywalny i zawsze benefituje kontrakt.

## Oczekiwania zaokrąglania {#-oczekiwania-zaokraglania}

- Wypłaty mogą trailować wpłaty o kilka jednostek bazowych z powodu obowiązkowego kroku floorowania. Różnica jest ograniczona frakcją skali aktywa (≤ 20% z bazowej skali w obecnych testach) i pozostaje w puli, faworyzując istniejących LP.
- Suita Jest teraz assertuje, że saldo nowicjusza nigdy nie wzrośnie i toleruje tylko tiny deficit. Jakiekolwiek rozszerzenie gapu zawiedzie test, dając wczesne ostrzeżenie jeśli matematyka zregreduje.

## Obserwowalne efekty {#-obserwowalne-efekty}

- Śwież LP kto doda i natychmiast usunie płynność teraz otrzyma dokładne ilości wpłacone (aż do oczekiwanego zaokrąglania integer), więc już nie dziedziczy historycznych opłat.
- Incumbent LP zachowują pełne własności `LiquidityUsersFromFees`. Opłaty nagromadzone po tym, jak nowicjusz dołączy są wciąż dzielone fair, ponieważ rozwiązanie kwadratowe tylko neutralizuje pre-istniejącą komponentę.

## Pokrycie testami {#-pokrycie-testami}

- `npm run test:1:build` (i skupiony przypadek Jest "new liquidity provider does not scoop pre-existing fees") teraz przechodzi z zaktualizowanym kontraktem i relaksowaną tolerancją zaokrąglania.
- Inne testy płynności pozostają zielone ponieważ adjustment zachowuje oryginalne zachowanie gdy pula nie ma accrued user fees.

## Notatki operacyjne {#-notatki-operacyjne}

- Jakakolwiek zmiana kontraktu wymaga recomputing artefaktów TEAL (`npm run compile-contract`) i regenerating klientów (`npm run generate-client` lub `npm run build`) przed publikowaniem pakietów.
- Helpery off-chain lub symulacje, które polegały na surowej formule mint `newLiquidity - oldLiquidity` muszą być updated aby mirrorować rozwiązanie kwadratowe, aby uniknąć drift między estymatami client-side a wynikami on-chain.
- Deployments pul muszą teraz używać zarejestrowanego ID aplikacji config dostawcy puli. Dostawca puli to wymusza on-chain, więc double-checknij klucz globalnego stanu `B` przed inicjowaniem deploy.

## Następne kroki {#-nastepne-kroki}

- Rozszerzyć narzędzia matematyczne off-chain w `src/biatecClamm/` aby expose tego samego kalkulacji tokenów LP tak żeby podglądy front-end pozostały accurate.
- Dodać testy regresji aby cover asymetryczne wpłaty i scenariusze z non-zero `LiquidityBiatecFromFees` aby ensure, że formula generalizuje.
