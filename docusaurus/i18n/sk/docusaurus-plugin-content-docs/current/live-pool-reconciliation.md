# Oprava živých poolov po oprave mintovania LP

Dátum: 2026-09-26
Verzia kontraktu s opravou: `BIATEC-CLAMM-01-06-05`
Súvisiace: [Ochrana likviditných poplatkov](./liquidity-fee-protection)

## Čo je v živých pooloch nesprávne {#-what-is-wrong}

Pooly bežiace na verzii `BIATEC-CLAMM-01-06-04` a starších mintovali menej LP tokenov, než bola likvidita pridaná vkladom, a rozdiel nikde nezaúčtovali. Táto likvidita je stále v pooloch, evidovaná v `Liquidity`, `assetABalanceBaseScale` a `assetBBalanceBaseScale`, ale nikomu nepatrí:

```
unowned = Liquidity - distributedLp - LiquidityUsersFromFees - LiquidityBiatecFromFees
```

`distributedLp` je `(18e18 - LP tokeny držané poolom) * 1000`. Nikto nemôže vybrať `unowned`: `removeLiquidity` vypláca `distributedLp + Lu` a `removeLiquidityAdmin` vypláca `Lb`.

Prieskum na mainnete (pool provider `3074197785`, 46 poolov, 2026-09-26, `scripts/survey-orphaned-liquidity.ts`):

| Pool | Aktíva | Verzia | unowned (základné jednotky) | podiel na L | LP tokeny v obehu |
|---|---|---|---|---|---|
| 3720188642 | Gold / GoldDAO | 01-06-04 | 57,256,214,042 (57.26 L ≈ 1.04 Gold + 61.6 GoldDAO) | 99.9% | žiadne |
| 3720804577 | Gold / ALGO | 01-06-04 | 9,536,681,071 (9.54 L) | 2.12% | áno |
| 3136517663 | 452399768 / ALGO | 01-06-03 | 1,402,037,905,848 (1402 L) | 0.01% | áno |
| 3132508926 | GoldDAO / USDC | 01-06-03 | 169,578,005 (0.17 L) | 0.04% | áno |
| 3355130627, 3720188812, 3720628473, 3720188475 | rôzne | – | 82 … 573 (prach, < 1e-6 L) | 100% (prázdne pooly) | žiadne |
| všetky ostatné pooly | – | – | medzi -2,238 a +2,675 (iba zaokrúhľovanie) | 0.00% | – |

Záporné hodnoty predstavujú zaokrúhľovanie v prospech LP a nevyžadujú žiadny zásah.

## Ako ich oprava napraví {#-how-the-fix-repairs-them}

Verzia `BIATEC-CLAMM-01-06-05` pridáva metódu `reconcileLiquidity(appBiatecConfigProvider, assetA, assetB, assetLp)`, ktorú môže volať iba `addressExecutiveFee`. Vypočíta hodnotu `unowned` a:

- pripíše ju do `LiquidityUsersFromFees`, keď sú LP tokeny v obehu, takže aktuálni držitelia LP ju dostanú pomerne (pro rata) pri svojom ďalšom volaní `removeLiquidity` (bez potreby prevodov), alebo
- pripíše ju do `LiquidityBiatecFromFees`, keď v obehu nie je žiadny LP token, takže Biatec ju môže vybrať pomocou `removeLiquidityAdmin` a vrátiť dotknutému poskytovateľovi likvidity mimo reťazca (off-chain).

Metóda je idempotentná: na konzistentnom poole vráti `0` a nič nezmení.

## Kroky {#-steps}

1. **Vydajte kontrakt.** Zlúčte (merge) túto zmenu, spustite `npm test` (všetky testovacie sady musia prejsť, vrátane `__test__/pool/mainnet-replay-3720188642.test.ts`), zvýšte verziu balíka a publikujte npm balík (`npm run build-package && npm run publish-package`), aby integrátori dostali pregenerovaného klienta s `reconcileLiquidity`.
2. **Nahrajte nový bajtkód poolu do pool providera** (`upgrade-clamm-template.sh`), aby novo vytvorené pooly začínali s verziou `01-06-05`. Prepočítajte hashe bajtkódu (`npm run compute-bytecode-hashes`) a aktualizujte index auditov.
3. **Pozastavte službu** (globálny stav `BiatecConfigProvider` `s = 1`) počas trvania krokov 4–6. Zabráni sa tým vkladom a výberom medzi aktualizáciou a rekonciliáciou, ktoré by zmenili to, kto dostane pripísanú likviditu. Swapy sú takisto pozastavené; vopred oznámte servisné okno.
4. **Aktualizujte každý existujúci pool** na verziu `01-06-05` pomocou `upgrade-clamm-pools.sh` (`src/bin/upgrade-all-pools.ts`, podpísaného multisigom `addressUdpater`). Overte pomocou prieskumného skriptu, že každý pool hlási `scver = BIATEC-CLAMM-01-06-05`.
5. **Zosúlaďte každý pool.** Znova spustite prieskum a zavolajte `reconcileLiquidity` z účtu `addressExecutiveFee` na každom poole s `unowned > 0` (zavolanie na všetkých pooloch je bezpečné). S vygenerovaným klientom:

   ```ts
   await clientBiatecClammPool.send.reconcileLiquidity({
     args: { appBiatecConfigProvider, assetA, assetB, assetLp },
     appReferences: [appBiatecConfigProvider],
     assetReferences: [assetA, assetB, assetLp].filter((a) => a > 0n),
   });
   ```

   Očakávaný efekt pre jednotlivé pooly:
   - `3720804577`, `3136517663`, `3132508926`: `Lu` sa zvýši o hodnotu `unowned`; aktuálni držitelia LP ju dostanú automaticky pri výbere. Nie je potrebné robiť nič ďalšie.
   - `3720188642` a štyri prachové (dust) pooly: `Lb` sa zvýši o hodnotu `unowned` (žiadne LP tokeny v obehu).
6. **Vráťte pozíciu Gold/GoldDAO.** Na poole `3720188642` zavolajte `removeLiquidityAdmin(amount = 0)` z účtu `addressExecutiveFee`; vyplatí sa celé `Lb` (približne 1.04 Gold a 61.6 GoldDAO). Skutočný podiel Biatec na poplatkoch je `Lb` zaznamenané *pred* rekonciliáciou (45,326,961 z 57,307,353,500 = 0.08%); zvyšok odošlite poskytovateľovi likvidity `6WKNXOXAVK5NEGPLMJ5MT6QA4EC2W2MAEW5FOWMD6URHTWPVB4BGIUCR2A`, ktorý v kole (round) 65393080 vybral 100% LP tokenov. Pre porovnanie: prehratie histórie s opraveným kontraktom ukazuje, že výber mal vyplatiť o 0.946874 Gold a 76.638355 GoldDAO viac; zloženie poolu sa odvtedy posunulo cez 7 swapov voči nevlastnenej likvidite, takže hodnota je teraz držaná ako 1.044 Gold + 61.6 GoldDAO. Prachové pooly držia menej ako jednu jednotku aktíva a môžu zostať tak, ako sú.
7. **Zrušte pozastavenie** (`s = 0`), spustite prieskum poslednýkrát a archivujte CSV vedľa auditnej správy. Každý pool musí vykazovať `unowned` v rozmedzí niekoľkých tisíc základných jednotiek (zaokrúhľovanie) od nuly.
8. **Udržujte tento stav.** Pravidelne spúšťajte `scripts/survey-orphaned-liquidity.ts` (alebo v CI voči mainnetu) a nastavte upozornenie, ak ktorýkoľvek pool nahlási `unowned` nad `1,000,000` základných jednotiek (0.001 L).

## Poznámky pre operátorov {#-notes-for-operators}

- Aktualizačná transakcia poolu vykonáva ešte *starý* schvaľovací program (approval program), takže rekonciliáciu nie je možné spojiť priamo s `updateApplication`; musí ísť o samostatné volanie po aktualizácii.
- Vklady menšie ako jedna mikrojednotka LP (`1e-6` LP) sú teraz odmietnuté s chybou `LP-ZERO-ERR` namiesto zaokrúhlenia nahor na jeden LP token (audit 2026-09-07, zistenie H-01). Front-endy by mali podľa toho kótovať minimálny vklad.
- Množstvo LP namintované pre vklad je `delta * D / (D + Lu)`; off-chain náhľady, ktoré stále používajú starú kvadratickú rovnicu, budú zobrazovať mierne odlišné čísla.
