# Referencia chybových kódov BiatecCLAMM

Tento dokument poskytuje komplexnú referenciu všetkých chybových kódov používaných v systéme smart kontraktov BiatecCLAMM. Pochopenie týchto chybových kódov pomôže vývojárom debugovať problémy a poskytovať lepšie používateľské skúsenosti.

## Formát chybového kódu {#-format-chyboveho-kodu}

Chybové kódy sledujú konzistentný formát:

- **Krátke kódy**: 3-4 znakové kódy s prefixom `E_` alebo `ERR-`
- **Príklad**: `E_CONFIG`, `ERR-LOW-VER`

## Chyby jadrových kontraktov {#-chyby-jadrovych-kontraktov}

### BiatecClammPool {#-biatecclammpool}

#### Chyby konfigurácie a inicializácie {#-chyby-konfiguracie-a-inicializacie}

| Kód              | Popis                        | Príčina                                               | Riešenie                                         |
| ----------------- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `E_CONFIG`        | Neshoda konfiguračnej app    | Poskytnuté config app ID nezodpovedá registrovanému config | Overte správnu config app referenciu             |
| `E_UPDATER`       | Neautorizovaný updater       | Odosielateľ nie je autorizovaná updater adresa        | Použite správny updater účet                     |
| `E_SENDER`        | Neautorizovaný odosielateľ   | Odosielateľ nie je autorizovaný pre túto operáciu     | Použite autorizovaný účet (tvorca, executive, atď.) |
| `E_PRICE_MAX`     | Bootstrap už bol zavolaný   | Nie je možné bootstrapovať dvakrát                    | Pool už je inicializovaný                        |
| `E_PRICE`         | Neplatná cena                | Cena musí byť väčšia ako nula                         | Nastavte platné cenové hodnoty                    |
| `E_FEE`           | Bootstrap už je dokončený   | Poplatok už je nastavený, nie je možné bootstrapovať znovu | Pool už je inicializovaný                        |
| `E_PAUSED`        | Služby pozastavené           | Protokol je momentálne pozastavený adminom            | Počkajte na unpause alebo kontaktujte admina     |
| `E_STAKING_PRICE` | Neplatná cena staking poolu  | Same-asset pooly vyžadujú plochý cenový rozsah        | Nastavte priceMin === priceMax pre staking pooly |
| `E_PRICE_RANGE`   | Neplatný cenový interval     | Štandardné pooly vyžadujú priceMin < priceMax         | Použite rozširujúce cenové hranice               |
| `E_ASSET_ORDER`   | Neplatné poradie aktív       | Asset A musí byť menšie ako Asset B                  | Zaistite assetA.id < assetB.id                   |

#### Chyby likvidity a bilancií {#-chyby-likvidity-a-bilancii}

| Kód                  | Popis                            | Príčina                                      | Riešenie                                        |
| --------------------- | -------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `E_ZERO_LIQ`          | Nulová likvidita                 | Likvidita je nula pred delením                | Zaistite, že pool má likviditu                  |
| `E_ZERO_DENOM`        | Nulový denominátor               | Denominátor v kalkulácii je nula             | Skontrolujte vstupné parametre                   |
| `ERR-LIQ-DROP`        | Prekročený pokles likvidity      | Likvidita klesla viac ako povolené           | Skontrolujte zaokrúhľovacie chyby alebo nekonzistenciu stavu |
| `ERR-TOO-MUCH`        | Nadmerný výber                   | Pokus o výber viac ako je dostupné           | Znížte množstvo výberu                          |
| `ERR-BALANCE-CHECK-1` | Kontrola bilancií zlyhala (Asset A) | Bilancia Asset A nekonzistentná               | Skontrolujte stav poolu                         |
| `ERR-BALANCE-CHECK-2` | Kontrola bilancií zlyhala (Asset B) | Bilancia Asset B nekonzistentná               | Skontrolujte stav poolu                         |

#### Chyby identity a verifikácie {#-chyby-identity-a-verifikacie}

| Kód                 | Popis                              | Príčina                                             | Riešenie                          |
| -------------------- | ---------------------------------- | --------------------------------------------------- | --------------------------------- |
| `ERR-INVALID-CONFIG` | Neplatná config app                | Config app nezodpovedá pool's registrovanému config | Použite správnu config app referenciu |
| `ERR-WRONG-IDENT`    | Nesprávny identity provider        | Identity provider nezodpovedá config                | Použite správny identity provider |
| `ERR-USER-LOCKED`    | Používateľský účet zamknutý        | Používateľský účet je zamknutý identity providerom  | Kontaktujte podporu na odomknutie |
| `ERR-LOW-VER`        | Verifikačná trieda príliš nízka    | Používateľská verifikačná trieda pod minimom        | Dokončite požadovanú KYC verifikáciu |
| `ERR-HIGH-VER`       | Verifikačná trieda mimo hraníc     | Verifikačná trieda presahuje maximum (4)            | Skontrolujte identity provider dáta |

#### Swap chyby {#-swap-chyby}

| Kód                                 | Popis                           | Príčina                                | Riešenie                            |
| ------------------------------------ | ------------------------------- | -------------------------------------- | ----------------------------------- |
| `E_ASSET_A`                          | Neplatné Asset A                | Asset A nezodpovedá pool's Asset A     | Použite správne aktívum             |
| `E_ASSET_B`                          | Neplatné Asset B                | Asset B nezodpovedá pool's Asset B     | Použite správne aktívum             |
| `Swaps not allowed in staking pools` | Pokus o swap v staking pool     | Nie je možné swapovať v same-asset pooloch | Použite add/remove liquidity namiesto |
| `Minimum to receive is not met`      | Spustená ochrana pred slippage  | Výstup menej ako minimumToReceive      | Zvýšte toleranciu slippage alebo skúste znovu |

### BiatecConfigProvider {#-biatecconfigprovider}

| Kód                                                             | Popis                         | Príčina                     | Riešenie                      |
| ---------------------------------------------------------------- | ----------------------------- | --------------------------- | ----------------------------- |
| `Only addressUdpater setup in the config can update application` | Neautorizovaný pokus o update | Odosielateľ nie je updater  | Použite autorizovanú updater adresu |
| `E_PAUSED`                                                       | Služby pozastavené            | Protokol pozastavený globálne | Počkajte na admina na unpause |

### BiatecIdentityProvider {#-biatecidentityprovider}

| Kód                                                             | Popis                        | Príčina                                    | Riešenie                                   |
| ---------------------------------------------------------------- | ---------------------------- | ------------------------------------------ | ------------------------------------------ |
| `Configuration app does not match`                               | Neshoda config               | Poskytnutý config nezodpovedá registrovanému | Použite správnu config app                 |
| `Only addressUdpater setup in the config can update application` | Neautorizovaný update        | Nie je autorizovaný updater                 | Použite updater účet                       |
| `ERR_PAUSED`                                                     | Služby pozastavené           | Protokol momentálne pozastavený             | Počkajte na unpause                        |
| `FeeMultiplierBase must be set properly`                         | Neplatný fee multiplier      | Fee multiplier musí rovnať SCALE            | Nastavte feeMultiplierBase na SCALE (1000000000) |
| `Verification class out of bounds`                               | Neplatná verifikačná trieda  | Trieda musí byť 0-4                        | Použite platnú verifikačnú triedu          |

### BiatecPoolProvider {#-biatecpoolprovider}

| Kód                                                             | Popis                         | Príčina                                    | Riešenie                 |
| ---------------------------------------------------------------- | ----------------------------- | ------------------------------------------ | ------------------------ |
| `E_CONFIG`                                                       | Neshoda config                | Poskytnutý config nezodpovedá registrovanému | Použite registrovanú config app |
| `Configuration app does not match`                               | Neshoda config app            | Poskytnutá nesprávna config app            | Overte config app ID     |
| `Only addressUdpater setup in the config can update application` | Neautorizovaný update         | Odosielateľ nie je autorizovaný updater    | Použite updater účet     |
| `ERR_PAUSED`                                                     | Služby pozastavené            | Protokol je pozastavený                    | Počkajte na admin akciu  |
| `Pool already registered`                                        | Duplicitná registrácia poolu  | Pool alebo config už existuje              | Skontrolujte existujúce pooly |

## Bežné chybové scenáre {#-bezne-chybove-scenare}

### Zlyhania vytvorenia poolu {#-zlyhania-vytvorenia-poolu}

**Chyba**: `E_STAKING_PRICE`

```
Príčina: Vytváranie staking poolu (assetA === assetB) s priceMin !== priceMax
Riešenie: Pre staking pooly nastavte priceMin = priceMax = 1000000000 (SCALE)
```

**Chyba**: `E_CONFIG` v deployPool

```
Príčina: Pokus o deploy poolu s neregistrovanou config app
Riešenie: Použite kanonickú config app registrovanú s pool providerom
```

### Swap zlyhania {#-swap-zlyhania}

**Chyba**: `ERR-LOW-VER`

```
Príčina: Verifikačná trieda používateľa nedostatočná pre požiadavky poolu
Riešenie: Dokončite dodatočnú KYC/identity verifikáciu na zvýšenie triedy
```

**Chyba**: `Swaps not allowed in staking pools`

```
Príčina: Pokus o swap v B-ALGO alebo B-USDC staking pool
Riešenie: Použite distributeExcessAssets pre odmeny, iba add/remove liquidity
```

**Chyba**: `Minimum to receive is not met`

```
Príčina: Cena sa pohybovala nepriaznivo počas transakcie, spustená slippage ochrana
Riešenie: Zvýšte minimumToReceive toleranciu alebo počkajte na lepšiu cenu
```

### Zlyhania poskytovania likvidity {#-zlyhania-poskytovania-likvidity}

**Chyba**: `E_ZERO_LIQ`

```
Príčina: Pokus o operáciu keď pool má nulovú likviditu
Riešenie: Najprv inicializujte pool s likviditou
```

**Chyba**: `ERR-LIQ-DROP`

```
Príčina: Kalkulácia likvidity viedla k neprijateľnému poklesu
Riešenie: Skontrolujte kalkulačné chyby alebo zaokrúhľovacie problémy
```

### Zlyhania administratívnych operácií {#-zlyhania-administrativnych-operacii}

**Chyba**: `E_UPDATER` alebo `E_SENDER`

```
Príčina: Pokus o vykonanie admin funkcie bez správnej autorizácie
Riešenie: Použite určený admin účet (addressUpdater, addressExecutiveFee, atď.)
```

**Chyba**: `E_PAUSED`

```
Príčina: Protokol-wide pause je aktívny
Riešenie: Počkajte na admina na unpause služieb, alebo kontaktujte protokol governance
```

## Osvedčené postupy spracovania chýb {#-osvedcene-postupy-spracovania-chyb}

### Pre vývojárov {#-pre-vyvojárov}

1. **Vždy skontrolujte Config**: Zaistite, že všetky app referencie (config, identity, pool provider) sú správne
2. **Validujte vstupy**: Skontrolujte asset ID, množstvá a slippage parametre pred odoslaním
3. **Spracujte pause stav**: Skontrolujte, či je protokol pozastavený pred pokusom o operácie
4. **Použite Try-Catch**: Obalte contract volania v try-catch a parsujte chybové správy
5. **Logujte chyby**: Logujte plný chybový kontext pre debugging

### Pre používateľov {#-pre-pouzivatelov}

1. **Identity verifikácia**: Zaistite, že váš účet má dostatočnú verifikačnú triedu
2. **Slippage tolerancia**: Nastavte vhodnú slippage ochranu pre volatilné trhy
3. **Typ poolu**: Pochopte rozdiel medzi liquidity poolmi a staking poolmi
4. **Stav účtu**: Overte, že váš účet nie je zamknutý pred transakciami

## Debugging tipy {#-debugging-tipy}

### Nájdenie chybového kontextu {#-najdenie-chyboveho-kontextu}

Keď nastane chyba:

1. **Skontrolujte transakčné logy**: Použite Algorand indexer na zobrazenie detailov transakcie
2. **Overte app referencie**: Zaistite, že všetky application ID zodpovedajú očakávaným hodnotám
3. **Skontrolujte globálny stav**: Prečítajte globálny stav config/identity/pool apps
4. **Inšpekujte box storage**: Overte, že box referencie sú zahrnuté v transakcii
5. **Prezrite nedávne zmeny**: Skontrolujte, či bol protokol nedávno aktualizovaný alebo pozastavený

### Bežné mis-konfigurácie {#-bezne-mis-konfiguracie}

- **Nesprávna Config App**: Použitie testnet config na mainnet alebo naopak
- **Chýbajúce Box referencie**: Zabudnutie zahrnúť požadované box referencie
- **Nesprávne app poradie**: App musia byť v správnom poradí vo foreign apps array
- **Nedostatočné fees**: Nedostatočné fees pre komplexné operácie vyžadujúce zvýšenie opcode budget

## Obnova z chýb {#-obnova-z-chyb}

### Pre obnoviteľné chyby {#-pre-obnovitelne-chyby}

Väčšina chýb je obnoviteľná opravou problému a opakovaním:

- Identity verifikácia: Dokončite požadované KYC
- Config chyby: Použite správne app referencie
- Slippage: Upravte toleranciu a skúste znovu
- Pause: Počkajte na obnovenie služieb

### Pre neobnoviteľné chyby {#-pre-neobnovitelne-chyby}

Niektoré chyby vyžadujú admin intervenciu:

- Účet zamknutý: Kontaktujte identity providera
- Protokol pozastavený: Počkajte na governance rozhodnutie
- Contract bugy: Nahláste vývojárom

## Podpora {#-podpora}

Ak narazíte na chybu, ktorá nie je dokumentovaná tu alebo potrebujete pomoc:

1. **GitHub Issues**: Otvorte issue s plnými detailmi chyby
2. **Dokumentácia**: Skontrolujte docs/ priečinok pre príručky
3. **Audit správy**: Prezrite audits/ priečinok pre známe problémy
4. **Komunita**: Pripojte sa ku komunite kanálom pre podporu

---

**Posledná aktualizácia**: 2025-10-28
**Verzia**: 1.0
**Spravované**: BiatecCLAMM tím
