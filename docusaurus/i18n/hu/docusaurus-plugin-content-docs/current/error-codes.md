# BiatecCLAMM hibakód referencia

Ez a dokumentum a BiatecCLAMM okosszerződés-rendszerben használt összes hibakód részletes magyarázatát tartalmazza. A hibakódok megértése segít a fejlesztőknek a problémák gyorsabb elhárításában és a jobb felhasználói élmény biztosításában.

## Hibakód formátum {#-error-code-format}

A hibakódok egységes névkonvenciót követnek:

- **Rövid kódok**: 3-4 karakteres kódok `E_` vagy `ERR-` előtaggal
- **Példa**: `E_CONFIG`, `ERR-LOW-VER`

## Mag szerződés hibák {#-core-contract-errors}

### BiatecClammPool {#-biatecclammpool}

#### Konfiguráció és inicializálás hibák {#-configuration-and-initialization-errors}

| Kód               | Leírás                      | Ok                                                       | Megoldás                                          |
| ----------------- | --------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| `E_CONFIG`        | Konfigurációs app eltérés    | A megadott config app ID nem egyezik a regisztrálttal    | Ellenőrizze a megfelelő config app hivatkozást    |
| `E_UPDATER`       | Jogosulatlan frissítő        | A feladó nem az engedélyezett frissítő cím               | Használja a megfelelő frissítő fiókot             |
| `E_SENDER`        | Jogosulatlan feladó          | A feladó nem jogosult erre a műveletre                   | Használjon jogosult fiókot (creator, executive stb.) |
| `E_PRICE_MAX`     | Bootstrap már lefutott       | A bootstrappelés másodszor nem megengedett               | A pool már inicializálva van                      |
| `E_PRICE`         | Érvénytelen ár               | Az árnak nullánál nagyobbnak kell lennie                 | Adjon meg érvényes árértékeket                    |
| `E_FEE`           | Bootstrap már kész           | A díj már be van állítva, újra nem bootstrapelhető       | A pool már inicializálva van                      |
| `E_PAUSED`        | Szolgáltatások szüneteltetve | Az admin ideiglenesen szüneteltette a protokollt         | Várjon a folytatásig vagy keresse az admint        |
| `E_STAKING_PRICE` | Érvénytelen staking pool ár  | Azonos eszközű pool csak sík ársávval működhet           | Állítsa be a priceMin === priceMax feltételt       |
| `E_PRICE_RANGE`   | Érvénytelen ársáv            | Standard poolnál priceMin < priceMax szükséges           | Használjon táguló ársáv határokat                 |
| `E_ASSET_ORDER`   | Érvénytelen eszköz sorrend   | Az Asset A azonosítónak kisebbnek kell lennie Asset B-nél | Biztosítsa, hogy assetA.id < assetB.id            |

#### Likviditás és egyenleg hibák {#-liquidity-and-balance-errors}

| Kód                   | Leírás                        | Ok                                           | Megoldás                                           |
| --------------------- | ----------------------------- | -------------------------------------------- | -------------------------------------------------- |
| `E_ZERO_LIQ`          | Nulla likviditás              | A likviditás nullára csökkent osztás előtt   | Gondoskodjon likviditásról a poolban               |
| `E_ZERO_DENOM`        | Nulla nevező                  | A számítás nevezője nulla lenne              | Ellenőrizze a bemeneti paramétereket               |
| `ERR-LIQ-DROP`        | Likviditáscsökkenés túl nagy  | A likviditás a megengedettnél jobban csökkent | Vizsgálja meg a kerekítést vagy állapotot          |
| `ERR-TOO-MUCH`        | Túlzott kivonás               | Többet próbál kivenni, mint a rendelkezésre álló összeg | Csökkentse a kivonni kívánt mennyiséget           |
| `ERR-BALANCE-CHECK-1` | Egyenlegellenőrzés hiba (Asset A) | Az Asset A egyenlege eltér az elvárttól      | Vizsgálja meg a pool állapotát                    |
| `ERR-BALANCE-CHECK-2` | Egyenlegellenőrzés hiba (Asset B) | Az Asset B egyenlege eltér az elvárttól      | Vizsgálja meg a pool állapotát                    |

#### Identitás és verifikáció hibák {#-identity-and-verification-errors}

| Kód                  | Leírás                          | Ok                                                  | Megoldás                                |
| -------------------- | ------------------------------- | --------------------------------------------------- | --------------------------------------- |
| `ERR-INVALID-CONFIG` | Érvénytelen config app          | A config app nem egyezik a pool regisztrált configjával | Használja a megfelelő config appot     |
| `ERR-WRONG-IDENT`    | Téves identitásszolgáltató      | Az identitásszolgáltató nem egyezik a configgal     | Használjon helyes identitásszolgáltatót |
| `ERR-USER-LOCKED`    | Felhasználói fiók zárolva       | Az identitásszolgáltató zárolta a felhasználót      | Vegye fel a kapcsolatot a támogatással  |
| `ERR-LOW-VER`        | Alacsony verifikációs osztály   | A felhasználó osztálya a minimum alatt van          | Végezze el a szükséges KYC lépéseket    |
| `ERR-HIGH-VER`       | Verifikációs osztály túl magas  | A felhasználó osztálya meghaladja a maximumot (4)   | Ellenőrizze az identitásszolgáltató adatait |

#### Swap hibák {#-swap-errors}

| Kód                                  | Leírás                        | Ok                                   | Megoldás                                  |
| ------------------------------------ | ----------------------------- | ------------------------------------ | ----------------------------------------- |
| `E_ASSET_A`                          | Érvénytelen Asset A           | Az Asset A nem egyezik a pool Asset A-jával | Használja a megfelelő eszközt             |
| `E_ASSET_B`                          | Érvénytelen Asset B           | Az Asset B nem egyezik a pool Asset B-jával | Használja a megfelelő eszközt             |
| `Swaps not allowed in staking pools` | Swap staking poolban tiltott  | Azonos eszközű poolban nem engedélyezett swap | Helyette likviditást adjon/vegyen el      |
| `Minimum to receive is not met`      | Csúszásvédelem aktiválódott   | A kimenet kisebb, mint a minimumToReceive  | Növelje a csúszási toleranciát vagy próbálja újra |

### BiatecConfigProvider {#-biatecconfigprovider}

| Kód                                                             | Leírás                      | Ok                            | Megoldás                                |
| ---------------------------------------------------------------- | --------------------------- | ----------------------------- | --------------------------------------- |
| `Only addressUdpater setup in the config can update application` | Jogosulatlan frissítési kísérlet | A feladó nem a frissítő cím | Használja az engedélyezett frissítő címet |
| `E_PAUSED`                                                       | Szolgáltatások szüneteltetve | A protokoll globálisan szünetel | Várjon, amíg az admin feloldja          |

### BiatecIdentityProvider {#-biatecidentityprovider}

| Kód                                                             | Leírás                     | Ok                                            | Megoldás                                             |
| ---------------------------------------------------------------- | -------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| `Configuration app does not match`                               | Config eltérés             | A megadott config nem egyezik a regisztrálttal | Használjon megfelelő config appot                   |
| `Only addressUdpater setup in the config can update application` | Jogosulatlan frissítés     | A feladó nem az engedélyezett frissítő         | Használja a frissítő fiókot                         |
| `ERR_PAUSED`                                                     | Szolgáltatások szünetelnek | A protokoll jelenleg szünetel                  | Várjon a folytatásig                                |
| `FeeMultiplierBase must be set properly`                         | Hibás díjszorzó            | A díjszorzónak pontosan SCALE-nek kell lennie  | Állítsa a feeMultiplierBase értékét SCALE-re (1000000000) |
| `Verification class out of bounds`                               | Érvénytelen verifikációs osztály | Az osztálynak 0-4 között kell lennie     | Használjon érvényes verifikációs osztályt           |

### BiatecPoolProvider {#-biatecpoolprovider}

| Kód                                                             | Leírás                     | Ok                                             | Megoldás                         |
| ---------------------------------------------------------------- | -------------------------- | --------------------------------------------- | -------------------------------- |
| `E_CONFIG`                                                       | Config eltérés             | A megadott config nem egyezik a regisztrálttal | Használja a regisztrált config appot |
| `Configuration app does not match`                               | Config app eltérés         | Rossz konfigurációs appot adott meg           | Ellenőrizze a config app ID-t      |
| `Only addressUdpater setup in the config can update application` | Jogosulatlan frissítő      | A feladó nem az engedélyezett frissítő        | Használja a frissítő fiókot        |
| `ERR_PAUSED`                                                     | Szolgáltatások szünetelnek | A protokoll szünetel                          | Várjon az admin döntésére         |
| `Pool already registered`                                        | Pool már regisztrálva      | A pool vagy a config már létezik              | Ellenőrizze a meglévő poolokat    |

## Gyakori hibaforgatókönyvek {#-common-error-scenarios}

### Pool létrehozási hibák {#-pool-creation-failures}

**Hiba**: `E_STAKING_PRICE`

```
Ok: Staking pool létrehozása (assetA === assetB), ahol priceMin !== priceMax
Megoldás: Staking pool esetén állítsa priceMin = priceMax = 1000000000 (SCALE)
```

**Hiba**: `E_CONFIG` a deployPool folyamatban

```
Ok: Nem regisztrált config appal próbál poolt telepíteni
Megoldás: Használja a pool szolgáltató által regisztrált kanonikus config appot
```

### Swap hibák {#-swap-failures}

**Hiba**: `ERR-LOW-VER`

```
Ok: A felhasználó verifikációs osztálya nem éri el a pool követelményeit
Megoldás: Végezze el a szükséges KYC/identitás ellenőrzést az osztály növeléséhez
```

**Hiba**: `Swaps not allowed in staking pools`

```
Ok: Swap kísérlete B-ALGO vagy B-USDC staking poolban
Megoldás: Használja a distributeExcessAssets műveletet a jutalmakhoz, illetve csak likviditást adjon vagy vonjon ki
```

**Hiba**: `Minimum to receive is not met`

```
Ok: Az árfolyam kedvezőtlenül változott a tranzakció során, a csúszásvédelem aktiválódott
Megoldás: Növelje a minimumToReceive toleranciát vagy várjon kedvezőbb árra
```

### Likviditás biztosítási hibák {#-liquidity-provision-failures}

**Hiba**: `E_ZERO_LIQ`

```
Ok: Művelet kísérlete, amikor a pool likviditása nulla
Megoldás: Töltsön fel likviditást a poolba
```

**Hiba**: `ERR-LIQ-DROP`

```
Ok: A likviditás számítása a megengedettnél nagyobb csökkenést eredményezett
Megoldás: Ellenőrizze a számításokat vagy a kerekítési beállításokat
```

### Adminisztratív művelet hibák {#-administrative-operation-failures}

**Hiba**: `E_UPDATER` vagy `E_SENDER`

```
Ok: Admin funkció végrehajtása megfelelő jogosultság nélkül
Megoldás: Használja a kijelölt admin fiókot (addressUpdater, addressExecutiveFee stb.)
```

**Hiba**: `E_PAUSED`

```
Ok: A protokoll globálisan szünetel
Megoldás: Várjon a szolgáltatások újraindításáig, vagy lépjen kapcsolatba a protokoll irányításával
```

## Hibakezelési bevált gyakorlatok {#-error-handling-best-practices}

### Fejlesztők számára {#-for-developers}

1. **Mindig ellenőrizze a configot**: Győződjön meg róla, hogy minden app hivatkozás (config, identity, pool provider) helyes
2. **Validálja a bemeneteket**: Ellenőrizze az eszközazonosítókat, összegeket és csúszási paramétereket beküldés előtt
3. **Figyelje a szüneteltetést**: Ellenőrizze, hogy a protokoll nincs-e szüneteltetve a művelet előtt
4. **Használjon try-catch blokkokat**: Burkolja az okosszerződés hívásokat try-catch-be, és dolgozza fel a hibaüzeneteket
5. **Naplózza a hibákat**: Jegyezze fel a teljes hiba kontextust a hibakereséshez

### Felhasználók számára {#-for-users}

1. **Identitás ellenőrzés**: Győződjön meg róla, hogy a számla verifikációs osztálya elegendő
2. **Csúszási tolerancia**: Állítson be megfelelő csúszásvédelmet a volatilis piacokon
3. **Pool típusának megértése**: Tegyen különbséget a likviditási és a staking poolok között
4. **Számla állapota**: Ellenőrizze, hogy a fiókja nincs-e zárolva tranzakció előtt

## Hibakeresési tippek {#-debugging-tips}

### Hiba kontextusának feltárása {#-finding-error-context}

Hiba esetén a következő lépéseket kövesse:

1. **Tranzakciós napló ellenőrzése**: Nézze meg a tranzakció részleteit az Algorand indexerrel
2. **App hivatkozások ellenőrzése**: Győződjön meg róla, hogy minden alkalmazásazonosító megfelel az elvárásoknak
3. **Globális állapot vizsgálata**: Olvassa ki a config/identity/pool alkalmazások globális állapotát
4. **Box tárolás ellenőrzése**: Vizsgálja meg, hogy a szükséges box hivatkozások bekerültek-e a tranzakcióba
5. **Legutóbbi változások áttekintése**: Ellenőrizze, történt-e frissítés vagy szüneteltetés a protokollban

### Gyakori hibás konfigurációk {#-common-misconfigurations}

- **Rossz config app**: Testnet config használata mainneten vagy fordítva
- **Hiányzó box hivatkozások**: Elfelejtette hozzáadni a kötelező boxokat
- **Helytelen app sorrend**: Az alkalmazásokat a foreign apps tömbben a megfelelő sorrendben kell feltüntetni
- **Elégtelen díjak**: A bonyolult műveletekhez szükséges opcode költségekre nem biztosított elegendő díj

## Hibából való felépülés {#-error-recovery}

### Helyrehozható hibák esetén {#-for-recoverable-errors}

A legtöbb hiba kijavítható a probléma elhárításával és az újbóli próbálkozással:

- Identitás ellenőrzés: Végezze el a szükséges KYC lépéseket
- Config hibák: Használja a megfelelő alkalmazás hivatkozásokat
- Csúszás: Igazítsa a toleranciát és próbálja újra
- Szünet: Várjon a szolgáltatás folytatására

### Nem helyrehozható hibák esetén {#-for-unrecoverable-errors}

Egyes hibák adminisztratív beavatkozást igényelnek:

- Fiók zárolva: Lépjen kapcsolatba az identitásszolgáltatóval
- Protokoll szünetel: Várjon a kormányzati döntésre
- Szerződés hiba: Jelentse a fejlesztőknek

## Támogatás {#-support}

Ha olyan hibával találkozik, amelyet itt nem dokumentáltunk, vagy segítségre van szüksége:

1. **GitHub Issues**: Nyisson hibajegyet a hiba részleteivel
2. **Dokumentáció**: Böngéssze a docs/ könyvtár útmutatóit
3. **Audit jelentések**: Tekintse át az audits/ könyvtár ismert problémáit
4. **Közösség**: Csatlakozzon a közösségi csatornákhoz támogatásért

---

**Utolsó frissítés**: 2025-10-28
**Verzió**: 1.0
**Karbantartó**: BiatecCLAMM csapat
