# Élő poolok javítása az LP-mintelési javítás után

Dátum: 2026-09-26
A javítást tartalmazó szerződésverzió: `BIATEC-CLAMM-01-06-05`
Kapcsolódó dokumentum: [Likviditási díjak védelme](./liquidity-fee-protection)

## Mi a hiba az élő poolokban {#-what-is-wrong}

A `BIATEC-CLAMM-01-06-04` és korábbi verziójú poolok kevesebb LP tokent minteltek, mint amennyi likviditást a betét ténylegesen hozzáadott, és a különbözetet sehol sem könyvelték el. Ez a likviditás továbbra is a poolokban van, szerepel a `Liquidity`, `assetABalanceBaseScale` és `assetBBalanceBaseScale` értékekben, de senki sem birtokolja:

```
unowned = Liquidity - distributedLp - LiquidityUsersFromFees - LiquidityBiatecFromFees
```

A `distributedLp` értéke `(18e18 - a pool által tartott LP tokenek) * 1000`. Az `unowned` mennyiséget senki sem tudja kivonni: a `removeLiquidity` a `distributedLp + Lu` összeget fizeti ki, a `removeLiquidityAdmin` pedig az `Lb` összeget.

Mainnet felmérés (pool szolgáltató `3074197785`, 46 pool, 2026-09-26, `scripts/survey-orphaned-liquidity.ts`):

| Pool | Eszközök | Verzió | unowned (alapegység) | L aránya | Forgalomban lévő LP tokenek |
|---|---|---|---|---|---|
| 3720188642 | Gold / GoldDAO | 01-06-04 | 57,256,214,042 (57.26 L ≈ 1.04 Gold + 61.6 GoldDAO) | 99.9% | nincs |
| 3720804577 | Gold / ALGO | 01-06-04 | 9,536,681,071 (9.54 L) | 2.12% | van |
| 3136517663 | 452399768 / ALGO | 01-06-03 | 1,402,037,905,848 (1402 L) | 0.01% | van |
| 3132508926 | GoldDAO / USDC | 01-06-03 | 169,578,005 (0.17 L) | 0.04% | van |
| 3355130627, 3720188812, 3720628473, 3720188475 | vegyes | – | 82 … 573 (por, < 1e-6 L) | 100% (üres poolok) | nincs |
| minden egyéb pool | – | – | -2,238 és +2,675 között (csak kerekítés) | 0.00% | – |

A negatív értékek az LP-k javára történő kerekítésből adódnak, és nem igényelnek beavatkozást.

## Hogyan javítja őket az új verzió {#-how-the-fix-repairs-them}

A `BIATEC-CLAMM-01-06-05` bevezeti a `reconcileLiquidity(appBiatecConfigProvider, assetA, assetB, assetLp)` metódust, amelyet kizárólag az `addressExecutiveFee` hívhat meg. A metódus kiszámítja az `unowned` értéket, és:

- jóváírja a `LiquidityUsersFromFees` számlán, ha vannak forgalomban LP tokenek, így a jelenlegi LP-tulajdonosok arányosan (pro rata) megkapják a következő `removeLiquidity` hívásukkor (külön átutalás nélkül), vagy
- jóváírja a `LiquidityBiatecFromFees` számlán, ha nincs forgalomban LP token, így a Biatec kivonhatja azt a `removeLiquidityAdmin` segítségével, és láncon kívül (off-chain) visszajuttathatja az érintett likviditásszolgáltatónak.

A művelet idempotens: egy konzisztens poolon `0`-t ad vissza, és nem módosít semmit.

## Lépések {#-steps}

1. **A szerződés kiadása.** Olvassza be (merge) a módosítást, futtassa az `npm test` parancsot (minden tesztcsomagnak sikeresnek kell lennie, beleértve a `__test__/pool/mainnet-replay-3720188642.test.ts` tesztet is), növelje a csomagverziót, és publikálja az npm csomagot (`npm run build-package && npm run publish-package`), hogy az integrátorok megkapják a `reconcileLiquidity` metódust tartalmazó újragenerált klienst.
2. **Az új pool bájtkód betöltése a pool szolgáltatóba** (`upgrade-clamm-template.sh`), hogy az újonnan létrehozott poolok már a `01-06-05` verzióval induljanak. Számítsa újra a bájtkód hash-eket (`npm run compute-bytecode-hashes`), és frissítse az audit indexet.
3. **A szolgáltatás szüneteltetése** (`BiatecConfigProvider` globális `s = 1`) a 4–6. lépések idejére. Ez megakadályozza a befizetéseket és kivonásokat a frissítés és az egyeztetés között, amelyek megváltoztatnák, hogy ki kapja a jóváírt likviditást. A swapok is szünetelnek; előzetesen jelentse be a karbantartási ablakot.
4. **Minden meglévő pool frissítése** a `01-06-05` verzióra az `upgrade-clamm-pools.sh` szkripttel (`src/bin/upgrade-all-pools.ts`, az `addressUdpater` multisig aláírásával). Ellenőrizze a felmérő szkripttel, hogy minden pool `scver = BIATEC-CLAMM-01-06-05` verziót jelent-e.
5. **Minden pool egyeztetése.** Futtassa újra a felmérést, és hívja meg a `reconcileLiquidity` metódust az `addressExecutiveFee` címről minden olyan poolon, ahol `unowned > 0` (az összes poolon biztonságosan meghívható). A generált klienssel:

   ```ts
   await clientBiatecClammPool.send.reconcileLiquidity({
     args: { appBiatecConfigProvider, assetA, assetB, assetLp },
     appReferences: [appBiatecConfigProvider],
     assetReferences: [assetA, assetB, assetLp].filter((a) => a > 0n),
   });
   ```

   Várható hatás poolonként:
   - `3720804577`, `3136517663`, `3132508926`: az `Lu` növekszik az `unowned` összeggel; az aktuális LP-tulajdonosok automatikusan megkapják kivonáskor. Nincs további teendő.
   - `3720188642` és a négy por (dust) pool: az `Lb` növekszik az `unowned` összeggel (nincs forgalomban LP token).
6. **A Gold/GoldDAO pozíció visszaszolgáltatása.** A `3720188642` poolon hívja meg a `removeLiquidityAdmin(amount = 0)` metódust az `addressExecutiveFee` címről; ez kifizeti a teljes `Lb` összeget (körülbelül 1.04 Gold és 61.6 GoldDAO). A Biatec valódi díjrészesedése az egyeztetés *előtt* rögzített `Lb` (45,326,961 a 57,307,353,500-ból = 0.08%); a fennmaradó részt küldje vissza a `6WKNXOXAVK5NEGPLMJ5MT6QA4EC2W2MAEW5FOWMD6URHTWPVB4BGIUCR2A` likviditásszolgáltatónak, aki a 65393080. körben (round) váltotta vissza az LP tokenek 100%-át. Referenciaként: a javított szerződéssel végzett visszajátszás (replay) szerint a visszaváltásnak 0.946874 Golddal és 76.638355 GoldDAO-val többet kellett volna fizetnie; a pool összetétele azóta 7, a gazdátlan likviditás ellenében végrehajtott swap miatt eltolódott, így az érték jelenleg 1.044 Gold + 61.6 GoldDAO formájában áll rendelkezésre. A por poolok egyetlen eszközegységnél kevesebbet tartalmaznak, így változatlanul hagyhatók.
7. **Szüneteltetés feloldása** (`s = 0`), a felmérés utolsó futtatása, és a CSV archiválása az auditjelentés mellé. Minden poolnak néhány ezer alapegységen (kerekítésen) belüli `unowned` értéket kell mutatnia a nullához képest.
8. **Folyamatos felügyelet.** Futtassa rendszeresen a `scripts/survey-orphaned-liquidity.ts` szkriptet (vagy CI-ben a mainnet ellen), és állítson be riasztást, ha bármelyik pool `1,000,000` alapegység (0.001 L) feletti `unowned` értéket jelent.

## Megjegyzések üzemeltetőknek {#-notes-for-operators}

- Egy pool frissítési tranzakciója még a *régi* jóváhagyó programot (approval program) hajtja végre, ezért az egyeztetés nem vonható össze az `updateApplication` hívással; a frissítés után külön tranzakcióban kell meghívni.
- Az egy LP mikro-egységet (`1e-6` LP) el nem érő betéteket a szerződés mostantól `LP-ZERO-ERR` hibával elutasítja, ahelyett hogy felfelé, egy LP tokenre kerekítené őket (2026-09-07 audit, H-01 megállapítás). A front-endeknek ennek megfelelően kell meghatározniuk a minimális betétet.
- A betétért mintelt LP mennyiség `delta * D / (D + Lu)`; a régi másodfokú képletet használó off-chain előnézetek ettől kissé eltérő számokat mutathatnak.
