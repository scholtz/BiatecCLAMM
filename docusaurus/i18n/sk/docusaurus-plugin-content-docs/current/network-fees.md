---
sidebar_label: Sieťové Poplatky
---

# Sieťové Poplatky

Tento dokument vysvetľuje štruktúru poplatkov a mechaniku v koncentrovaných likviditných pooloch BiatecCLAMM.

## Prehľad

BiatecCLAMM implementuje viacúrovňový systém poplatkov navrhnutý na kompenzáciu poskytovateľov likvidity pri zachovaní udržateľnosti protokolu. Poplatky sa zbierajú počas swap operácií a distribuujú sa medzi poskytovateľov likvidity a protokol.

Používatelia platia dva typy poplatkov:

1. **Protokolové Poplatky**: Obchodné poplatky, ktoré idú poskytovateľom likvidity a protokolu (momentálne 20% z LP poplatkov ide Biatec)
2. **Sieťové Poplatky**: Poplatky blockchainu Algorand potrebné na spracovanie transakcií

## Algorand Sieťové Poplatky

Okrem protokolových poplatkov musia používatelia platiť sieťové poplatky blockchainu Algorand za každú transakciu. Tieto sa platia v ALGO a pokrývajú výpočtové náklady na spracovanie transakcií v sieti.

### Minimálne Transakčné Poplatky

- **Základný Poplatok**: 1,000 microAlgos (0.001 ALGO) za transakciu
- **Volania Aplikácií**: Dodatočné poplatky na základe zložitosti a využitia zdrojov
- **Zoskupené Transakcie**: Každá transakcia v skupine platí minimálny poplatok

### Poplatky za Vytvorenie Poolu

Vytvorenie nového likviditného poolu vyžaduje viacero transakcií a má najvyššie sieťové poplatky kvôli Minimálnym Požiadavkám na Zostatok (MBR) pre nový pool účet. **Poznámka**: Vytvorenie poolu vyžaduje značnú počiatočnú investíciu ~5 ALGO na dodržanie MBR.

**Rozpis Transakcií:**

- Transakcia nasadenia poolu: 10,000 microAlgos (0.01 ALGO) statický poplatok
- NOOP volania pool providera: 2 × 1,000 microAlgos (0.002 ALGO)
- Minimálna Požiadavka na Zostatok (MBR): 5,000,000 microAlgos (5 ALGO) - potrebné pre pool účet
- Bootstrap krok 2: 5,000 microAlgos (0.005 ALGO) extra poplatok

**Celkový Sieťový Poplatok**: ~5.018 ALGO (vrátane požiadavky MBR)
**Celkový Počet Transakcií**: 4-6 transakcií v skupine

### Poplatky za Pridanie Likvidity

Pridanie likvidity do existujúceho poolu:

**Rozpis Transakcií:**

- Hlavné volanie pridania likvidity: 8,000 microAlgos (0.008 ALGO) statický poplatok
- Transakcie transferu aktív: 1-2 × 1,000 microAlgos (0.001-0.002 ALGO)
- NOOP volanie pool providera: 1,000 microAlgos (0.001 ALGO)
- Opt-in LP tokenov (ak potrebné): 1,000 microAlgos (0.001 ALGO)
