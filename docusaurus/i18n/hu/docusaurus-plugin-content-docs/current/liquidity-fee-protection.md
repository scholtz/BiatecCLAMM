# Díjfelhalmozás védelme új LP-k belépésekor

Dátum: 2025-10-26, átdolgozva: 2026-09-26
Repository: BiatecCLAMM (projects/BiatecCLAMM)
Elsődleges fájl: `contracts/BiatecClammPool.algo.ts`

## Háttér {#-background}

Amint egy pool swap díjakat gyűjt, a láncon tárolt állapot ezeket kiegészítő likviditásként (`LiquidityUsersFromFees`, `Lu`) tartja nyilván, anélkül hogy további LP tokeneket bocsátana ki. Az eredeti likviditás-hozzáadási folyamat egyszerűen a nyers likviditáskülönbözetből (`newLiquidity - oldLiquidity`) mintelt új LP tokeneket. Ennek következtében egy új belépő likviditást adhatott hozzá, majd azonnal visszavonhatta, és így arányos részt arathatott le a korábban felhalmozott díjakból, amelyek valójában a meglévő LP-ket illetik.

A regresszió a „new liquidity provider does not scoop pre-existing fees” nevű pool tesztben bukkant fel, ahol a C számla egy swap-díjas forgatókönyv után likviditást ad hozzá, majd rögtön kivonja azt. Az elvárt viselkedés az, hogy a számla pontosan azt kapja vissza, amit befizetett (nettó nulla nyereség).

## Könyvelési invariáns {#-accounting-invariant}

A pool likviditásának minden egyes egységét birtokolnia kell valakinek:

```
Liquidity == distributedLp + LiquidityUsersFromFees + LiquidityBiatecFromFees
```

- a `distributedLp` (`D`) a pool számláján kívül forgó LP készlet, az alapléptékre skálázva,
- az `Lu` az összes LP token tulajdonos által arányosan (pro rata) birtokolt díjlikviditás (`removeLiquidity` fizeti ki),
- az `Lb` a Biatec által birtokolt díjlikviditás (`removeLiquidityAdmin` fizeti ki).

A `swap` megőrzi az invariánst, mivel a teljes likviditásnövekményt az `Lu` és `Lb` között osztja fel.

## A javítás összefoglalása {#-fix-summary}

Minden forgalomban lévő LP tokent `(D + Lu) / D` egységnyi likviditás fedez, mivel a felhasználói díjlikviditás (`Lu`) arányosan oszlik meg az összes LP token között a `removeLiquidity` során. Egy befizető, aki `delta` likviditást ad hozzá, ezért

```
X = delta * D / (D + Lu)
```

LP tokent kap (LP token tizedesjegyekre lefelé kerekítve), a `delta - X` díjhígulási rész pedig az `Lu` számlára kerül (ez pontosan 0, amíg a pool nem gyűjtött díjat). Az `Lu' = Lu + delta - X` értékkel:

- az új belépő követelése kilépéskor: `X * (D + Lu + delta) / (D + X) == delta` — pontosan a befizetett mennyiség, korábbi díjak nélkül,
- a meglévő LP-k követelése: `D * (D + Lu + delta) / (D + X) == D + Lu` — megtartják az összes korábbi díjat,
- invariáns: `D + X + Lu' == D + Lu + delta` — nem marad gazdátlan likviditás.

Amikor a poolban nincsenek felhalmozott díjak, a képlet visszaesik az eredeti „likviditás-delta mintelése” viselkedésre.

### Miért cseréltük le a másodfokú változatot {#-why-the-quadratic-variant-was-replaced}

2025-10-26 és 2026-09-26 között a szerződés `min(delta, root)` LP tokent mintelt, ahol a `root` az `X^2 + X(D + Lu - Q) - Q * D = 0` egyenlet gyöke volt, és `Q = depositA * newLiquidity / assetABalance` (vagy a B eszköz aránya, ha nem fizettek be A eszközt). Két probléma volt ezzel:

1. A `Q` egyoldalas becslés. Olyan befizetésnél, amely nem a pool aktuális arányában történik (ami megengedett, és elmozdítja a pool árát), a `Q` kisebb a ténylegesen hozzáadott likviditásnál, így a befizető kevesebb LP tokent kapott, mint amennyi likviditással hozzájárult a poolhoz.
2. A `delta - X` különbözetet sehol sem könyvelték el. Növelte a `Liquidity` értékét, de sem az LP-tulajdonosok, sem a Biatec nem birtokolta, így soha nem lehetett kivonni.

A `3720188642` mainnet pool (Gold/GoldDAO, 128–256 sáv, LP díj 0,1%, Biatec részesedés 20%) ezt szemlélteti: három befizetés, 238 swap és az LP tokenek 100%-ának visszaváltása után `L = 57.3` (körülbelül 1.04 Gold és 61.6 GoldDAO) maradt a poolban, miközben a Biatec díjrészesedése csak `Lb = 0.045` volt. A teljes történetet a `__test__/pool/mainnet-replay-3720188642.test.ts` játssza vissza a `__test__/test-data/mainnet-pool-3720188642.json` fájlból; a javított képlettel a visszaváltás a teljes pozíciót visszaadja, és csak az `Lb` marad bent.

### További változások a 01-06-05 verzióban {#-further-changes}

- Az egy LP mikro-egységet (`1e-6` LP) el nem érő betéteket a szerződés `LP-ZERO-ERR` hibával elutasítja. Korábban felfelé, egy LP tokenre kerekítette őket, ami lehetővé tette, hogy 1 alapegység befizetője a befizetettnél többet váltson vissza (2026-09-07 audit, H-01).
- A `reconcileLiquidity` (csak díjvégrehajtó által hívható) elkönyveli a régebbi poolokban gazdátlanul maradt likviditást; lásd: [Élő poolok javítása](./live-pool-reconciliation).
- A `removeLiquidity` és a `removeLiquidityAdmin` közös kifizetési rutint (`payOutLiquidity`) használ; a működés változatlan.

## Kerekítési elvárások {#-rounding-expectations}

- Az LP tokenek 6 tizedesjegyre lefelé kerekítődnek; a mikro-LP alatti maradék (`< 1e-6` LP betétenként) a poolban marad a pool javára történő kerekítésként. Szándékosan nem kerül díjbevételként elkönyvelésre, így a `liquidityUsersFromFees` az első swapig 0 marad; a `reconcileLiquidity` a felhalmozódott kerekítést az LP-tulajdonosok javára tudja jóváírni.
- A `removeLiquidity` továbbra is lefelé kerekíti a kiküldött eszközmennyiségeket, így a kivonások néhány alapegységgel elmaradhatnak a befizetéstől, ami a poolban marad.
- A Jest tesztcsomag ellenőrzi, hogy az új belépő egyenlege soha nem nő, és csak apró hiányt enged meg, a mainnet visszajátszás pedig minden likviditási művelet után ellenőrzi az invariánst műveletenként egy LP mikro-egységnyi tűréshatárral.

## Üzemeltetési megjegyzések {#-operational-notes}

- Bármely szerződésmódosítás megköveteli a TEAL artefaktumok újraszámítását (`npm run compile-contract`) és a kliensek újragenerálását (`npm run generate-client` vagy `npm run build`) a csomagok publikálása előtt.
- A mintelt LP tokeneket becslő off-chain segédeknek vagy szimulációknak a `delta * D / (D + Lu)` képletet kell használniuk, hogy szinkronban maradjanak a lánccal.
- A `BIATEC-CLAMM-01-06-04` vagy korábbi verzióval telepített poolokat frissíteni kell; az ilyen poolokban már árván maradt likviditást maga a frissítés nem állítja helyre automatikusan.
- A teljes többkorszakos matematikai bizonyításhoz, a konkrét számszerű példákhoz és a több szereplős tesztcsomag-lefedettséghez (`__test__/pool/multi-party-fee-aggregation.test.ts`) lásd: [Több szereplős likviditás-aggregáció és díjméltányossági bizonyítás](./multi-party-fee-aggregation).
