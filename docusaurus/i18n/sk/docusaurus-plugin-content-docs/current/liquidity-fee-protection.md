# Ochrana akumulácie poplatkov keď sa pripoja noví LP

Dátum: 2025-10-26, revidované: 2026-09-26
Repozitár: BiatecCLAMM (projects/BiatecCLAMM)
Primárny súbor: `contracts/BiatecClammPool.algo.ts`

## Pozadie {#-background}

Keď pool nazbiera swap poplatky, on-chain stav ich sleduje ako dodatočnú likviditu (`LiquidityUsersFromFees`, `Lu`) bez mintovania extra LP tokenov. Pôvodný add-liquidity tok mintoval nové LP tokeny zo surového prírastku likvidity (`newLiquidity - oldLiquidity`). Výsledkom bolo, že nový účastník mohol pridať likviditu a okamžite ju vybrať, čím získal pomerný (pro-rata) podiel z historických poplatkov, ktoré mali patriť pôvodným poskytovateľom likvidity (LP).

Regresia sa objavila v pool teste „new liquidity provider does not scoop pre-existing fees“, kde účet C pridá likviditu po scenári so swap poplatkami a okamžite ju vyberie. Očakávané správanie je, že účet dostane presne to, čo vložil (čistý nulový zisk).

## Účtovný invariant {#-accounting-invariant}

Každá jednotka likvidity poolu musí niekomu patriť:

```
Liquidity == distributedLp + LiquidityUsersFromFees + LiquidityBiatecFromFees
```

- `distributedLp` (`D`) je ponuka LP v obehu mimo účtu poolu, preškálovaná na základnú presnosť,
- `Lu` je poplatková likvidita vlastnená pomerne (pro rata) všetkými držiteľmi LP tokenov (vyplácaná cez `removeLiquidity`),
- `Lb` je poplatková likvidita vlastnená spoločnosťou Biatec (vyplácaná cez `removeLiquidityAdmin`).

Metóda `swap` zachováva tento invariant, pretože celý prírastok likvidity sa rozdelí medzi `Lu` a `Lb`.

## Súhrn opravy {#-fix-summary}

Každý LP token v obehu je krytý `(D + Lu) / D` jednotkami likvidity, pretože používateľská poplatková likvidita `Lu` je zdieľaná pomerne všetkými LP tokenmi pri `removeLiquidity`. Vkladateľ, ktorý pridá likviditu `delta`, preto dostane

```
X = delta * D / (D + Lu)
```

LP tokenov (zaokrúhlených nadol na desatinné miesta LP tokenu) a podiel riedenia poplatkov `delta - X` sa zaúčtuje do `Lu` (je presne 0, kým pool nevyzbieral žiadny poplatok). S hodnotou `Lu' = Lu + delta - X`:

- nárok nového účastníka pri výstupe: `X * (D + Lu + delta) / (D + X) == delta` — presne to, čo bolo vložené, žiadne historické poplatky,
- pôvodní LP: `D * (D + Lu + delta) / (D + X) == D + Lu` — ponechajú si všetky historické poplatky,
- invariant: `D + X + Lu' == D + Lu + delta` — žiadna likvidita nezostane bez vlastníka.

Keď pool nemá žiadne nahromadené poplatky, vzorec sa zredukuje na pôvodné správanie „namintuj prírastok likvidity“.

### Prečo bol kvadratický variant nahradený {#-why-the-quadratic-variant-was-replaced}

Medzi 2025-10-26 a 2026-09-26 kontrakt mintoval `min(delta, root)`, kde `root` riešil rovnicu `X^2 + X(D + Lu - Q) - Q * D = 0` a `Q = depositA * newLiquidity / assetABalance` (alebo podiel aktíva B, keď sa nevložilo žiadne aktívum A). Malo to dva problémy:

1. `Q` je jednostranný odhad. Pre vklad, ktorý nie je v aktuálnom pomere poolu (čo je povolené a posúva cenu poolu), je `Q` nižšie ako skutočne pridaná likvidita, takže vkladateľovi bolo namintovaných menej LP tokenov, než bola likvidita, ktorou prispel.
2. Rozdiel `delta - X` nebol nikde zaúčtovaný. Zvýšil `Liquidity`, ale nepatril ani držiteľom LP, ani spoločnosti Biatec, takže ho nikdy nebolo možné vybrať.

Mainnet pool `3720188642` (Gold/GoldDAO, rozsah 128–256, LP poplatok 0,1 %, podiel Biatec 20 %) to demonštruje: tri vklady, 238 swapov a výber 100 % LP tokenov zanechali v poole `L = 57.3` (približne 1.04 Gold a 61.6 GoldDAO), zatiaľ čo podiel Biatec na poplatkoch bol iba `Lb = 0.045`. Kompletná história je prehratá v `__test__/pool/mainnet-replay-3720188642.test.ts` zo súboru `__test__/test-data/mainnet-pool-3720188642.json`; s opraveným vzorcom výber vráti celú pozíciu a v poole zostane iba `Lb`.

### Ďalšie zmeny vo verzii 01-06-05 {#-further-changes}

- Vklad, ktorý nedosiahne jednu mikrojednotku LP (`1e-6` LP), sa odmietne s chybou `LP-ZERO-ERR`. Predtým sa zaokrúhľoval nahor na jeden LP token, čo umožňovalo vkladateľovi 1 základnej jednotky vybrať viac, ako vložil (audit 2026-09-07, H-01).
- Metóda `reconcileLiquidity` (iba pre exekútora poplatkov) zaúčtuje likviditu, ktorú staršie pooly ponechali bez vlastníka; pozri [Oprava živých poolov](./live-pool-reconciliation).
- Metódy `removeLiquidity` a `removeLiquidityAdmin` zdieľajú jednu výplatnú rutinu (`payOutLiquidity`); správanie sa nezmenilo.

## Očakávania zaokrúhľovania {#-rounding-expectations}

- LP tokeny sa zaokrúhľujú nadol na 6 desatinných miest; zvyšok pod úrovňou mikro-LP (`< 1e-6` LP na vklad) zostáva v poole ako zaokrúhlenie v prospech poolu. Zámerne sa neúčtuje ako výnos z poplatkov, takže `liquidityUsersFromFees` zostáva 0 až do prvého swapu; `reconcileLiquidity` dokáže nahromadené zaokrúhlenia pripísať držiteľom LP.
- Metóda `removeLiquidity` naďalej zaokrúhľuje nadol vyplácané sumy aktív, takže výbery môžu zaostávať za vkladmi o niekoľko základných jednotiek, ktoré zostávajú v poole.
- Testovacia sada Jest kontroluje, že zostatok nového účastníka sa nikdy nezvýši a toleruje iba nepatrný deficit, a prehratie mainnet histórie overuje invariant po každej likviditnej operácii s toleranciou jednej mikrojednotky LP na operáciu.

## Prevádzkové poznámky {#-operational-notes}

- Akákoľvek zmena kontraktu vyžaduje prepočítanie TEAL artefaktov (`npm run compile-contract`) a pregenerovanie klientov (`npm run generate-client` alebo `npm run build`) pred publikovaním balíkov.
- Off-chain pomocné funkcie alebo simulácie, ktoré odhadujú namintované LP tokeny, musia používať vzorec `delta * D / (D + Lu)`, aby zostali v súlade s reťazcom.
- Pooly nasadené s verziou `BIATEC-CLAMM-01-06-04` alebo staršou by mali byť aktualizované; likvidita už osirelá v takýchto pooloch sa samotnou aktualizáciou automaticky neobnoví.
- Pre kompletný viacepochový matematický dôkaz, konkrétne číselné príklady a pokrytie v testovacej sade pre viacero strán (`__test__/pool/multi-party-fee-aggregation.test.ts`) pozri [Agregácia likvidity viacerých strán a dôkaz spravodlivosti poplatkov](./multi-party-fee-aggregation).
