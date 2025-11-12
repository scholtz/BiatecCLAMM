# Díjfelhalmozás védelme új LP-k belépésekor

Dátum: 2025-10-26
Repository: BiatecCLAMM (projects/BiatecCLAMM)
Elsődleges fájl: `contracts/BiatecClammPool.algo.ts`

## Háttér {#-background}

Amint egy pool swap díjakat gyűjt, a láncon tárolt állapot ezeket kiegészítő likviditásként (`LiquidityUsersFromFees`) tartja nyilván, anélkül hogy további LP tokeneket bocsátana ki. A korábbi likviditás-hozzáadási folyamat egyszerűen a nyers likviditás különbözetből (`newLiquidity - oldLiquidity`) mintelt LP tokeneket. Ennek következtében egy új belépő likviditást adhatott hozzá, majd azonnal visszavonhatta, és így arányos részt arathatott le a korábban felhalmozott díjakból, amelyek valójában a régi LP-ket illetik.

A regresszió a „new liquidity provider does not scoop pre-existing fees” nevű pool tesztben bukkant fel, ahol a C számla swap díjjal terhelt helyzet után belép a poolba, majd rögtön kivonja a likviditást. Az elvárt viselkedés az, hogy pontosan azt kapja vissza, amit betett (nettó nulla nyereség).

## Javítás összefoglaló {#-fix-summary}

A `processAddLiquidity` most megoldja azt a másodfokú egyenletet, amely az azonnali visszavonás paritását kényszeríti ki, majd a pozitív gyököt lefelé kerekíti, mielőtt LP tokeneket mintelne:

```
X^2 + X(sumDistributedAndFees − Q) − Q * distributedBefore = 0
```

ahol:

- a `distributedBefore` a korábban kiosztott LP készlet (alapléptékre skálázva),
- a `LiquidityUsersFromFees` azokat a történeti díj likviditásokat rögzíti, amelyek továbbra is a régi LP-k tulajdonát képezik,
- `Q = depositShare * newLiquidity`, ahol a `depositShare` a hívó alapléptékű hozzájárulásából származik,
- `X` az a kimenő LP delta alapléptékben, amelyet meg akarunk határozni.

A gyök lefelé kerekítésével (ami a poolt részesíti előnyben) biztosítjuk, hogy az újoncok sosem mintelnek annyi LP tokent, hogy hozzáférjenek a korábban felhalmozott díjakhoz. Ha a poolban nincsenek felhalmozott díjak, a másodfokú egyenlet visszaesik az eredeti „likviditás delta mintelése” viselkedésre.

Ugyanezt az arányos aritmetikát használjuk kilépéskor is: a díjrészesedés egyetlen szorzás/osztás lépéssel számolódik, így a kerekítési eltérés kiszámítható marad, és mindig a szerződésnek kedvez.

## Kerekítési elvárások {#-rounding-expectations}

- A visszavont összeg néhány alapegységgel elmaradhat a betéttől a kötelező lefelé kerekítés miatt. A különbség az eszköz skálájának töredékére korlátozódik (a jelenlegi tesztekben ≤ az alaplépték 20%-a), és a poolban marad, így a meglévő LP-ket részesíti előnyben.
- A Jest tesztcsomag most ellenőrzi, hogy az új belépő egyenlege soha nem nő, és csak minimális hiányt enged. Ha a rés tágulni kezd, a teszt meghiúsul, így korán jelzi, ha a matematika ismét hibás irányba mozdulna.

## Érzékelhető hatások {#-observable-effects}

- Az új LP, aki azonnal kiveszi a frissen betett likviditást, most pontosan a befizetett összeget kapja vissza (a várható egész kerekítés mellett), így nem örökli a korábbi díjakat.
- A régi LP-k továbbra is maradéktalanul birtokolják a `LiquidityUsersFromFees` egyenlegeket. Az újonc belépése után keletkező díjak méltányosan oszlanak el, mivel a másodfokú megoldás csak a korábban felhalmozott komponens semlegesítését célozza.

## Teszt lefedettség {#-test-coverage}

- A `npm run test:1:build` (és a fókuszált Jest eset „new liquidity provider does not scoop pre-existing fees”) sikeresen lefut a frissített szerződéssel és a lazított kerekítési toleranciával.
- A többi likviditási teszt zöld maradt, mert a módosítás megőrzi az eredeti viselkedést akkor, ha a poolnak nincs felhalmozott felhasználói díja.

## Üzemeltetési megjegyzések {#-operational-notes}

- Bármely szerződés változtatás megköveteli a TEAL artefaktumok újragenerálását (`npm run compile-contract`) és a kliensek regenerálását (`npm run generate-client` vagy `npm run build`) a csomagolás előtt.
- Az off-chain segédeknek vagy szimulációknak, amelyek a nyers `newLiquidity - oldLiquidity` mint formula alapján működtek, követniük kell az új másodfokú megoldást, különben eltérés lesz a kliens oldali előrejelzés és az on-chain eredmény között.
- A pool telepítésekor most már a pool szolgáltató által regisztrált konfigurációs app ID-t kötelező használni. A pool szolgáltató ezt láncon kényszeríti, ezért telepítés előtt mindig ellenőrizze a `B` globális állapot kulcsot.

## Következő lépések {#-next-steps}

- Bővítse a `src/biatecClamm/` könyvtár off-chain matematikai segédeit, hogy ugyanazt az LP token számítást tegye elérhetővé, így a front-end előnézetek pontosak maradnak.
- Vegyen fel regressziós teszteket az aszimmetrikus betétekre és a nem nulla `LiquidityBiatecFromFees` esetre, hogy igazolja: a formula általánosítható.
