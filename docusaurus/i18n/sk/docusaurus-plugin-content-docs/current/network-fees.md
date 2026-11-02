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

**Celkový Sieťový Poplatok**: ~0.011-0.013 ALGO
**Celkový Počet Transakcií**: 3-5 transakcií v skupine

### Swap Poplatky

Vykonanie výmeny (swapu) tokenov:

**Rozpis Transakcií:**

- Hlavné swap volanie: 12,000 microAlgos (0.012 ALGO) statický poplatok
- Transakcia transferu aktíva: 1,000 microAlgos (0.001 ALGO)

**Celkový Sieťový Poplatok**: ~0.013 ALGO
**Celkový Počet Transakcií**: 2-3 transakcie v skupine

### Poplatky za Odobratie Likvidity

Výber likvidity z poolu:

**Rozpis Transakcií:**

- Hlavné volanie odobratia likvidity: 12,000 microAlgos (0.012 ALGO) statický poplatok
- Transfer LP tokenu: 1,000 microAlgos (0.001 ALGO)

**Celkový Sieťový Poplatok**: ~0.013 ALGO
**Celkový Počet Transakcií**: 1-2 transakcie v skupine

### Optimalizácia Poplatkov

Protokol používa zoskupovanie transakcií na minimalizáciu sieťových poplatkov:

- **Atomické Transakcie**: Všetky operácie v skupine buď uspejú, alebo zlyhajú spoločne
- **Zdieľané Referencie**: Box a app referencie sú zdieľané naprieč zoskupenými transakciami
- **Efektívny Prístup k Stavu**: Minimálny počet on-chain čítaní a zápisov stavu

### Odhad Poplatkov v Kóde

Pri odhadovaní celkových nákladov používateľa zahrňte protokolové aj sieťové poplatky:

```typescript
// Odhad protokolového poplatku
const protocolFee = (swapAmount * lpFeeRate) / SCALE;

// Odhad sieťového poplatku (približný)
const networkFee = 13000; // microAlgos pre swap operácie

// Celkové náklady používateľa
const totalCost = swapAmount + protocolFee + networkFee / 1_000_000; // Konverzia na ALGO
```

## Typy Poplatkov

### 1. Poplatky Poskytovateľov Likvidity (LP)

**Definícia**: Poplatky účtované pri swap transakciách, ktoré kompenzujú poskytovateľov likvidity za poskytnutie kapitálu do poolu.

**Konfigurácia**:

- Nastavuje sa pre každý jednotlivý pool (nie globálne)
- Rozsah: 0 % až 100 % (reprezentované na 9 desatinných miest)
- Príklad: 10 % poplatok = `100_000_000` (0.1 \* 10^9)
- Uložené v stave kontraktu poolu ako `fee`

**Výpočet**: Aplikuje sa na prichádzajúcu sumu swapu pred výpočtom výstupu swapu.

```typescript
// Výpočet poplatku vo funkcii swap
const feesMultiplier = (s - ((this.fee.value as uint256) * (user.feeMultiplier as uint256)) / (user.base as uint256)) as uint256;
const inAssetAfterFee = (inAssetInBaseScale * feesMultiplier) / s;
```

### 2. Protokolové Poplatky Biatec

**Definícia**: Percento z LP poplatkov, ktoré protokol vyberá na prevádzkovú udržateľnosť.

**Konfigurácia**:

- Nastavuje sa globálne v kontrakte `BiatecConfigProvider`
- **Aktuálna sadzba**: 20 % z LP poplatkov
- Maximum: 50 % z LP poplatkov, Minimum: 0 % z LP poplatkov (vynútené kontraktom)
- Uložené ako `biatecFee` v konfiguračnom kontrakte
- Príklad: 10 % z LP poplatkov = `100_000_000` (0.1 \* 10^9)

**Distribúcia**: Keď sú Biatec poplatky povolené, vyzbierané poplatky sa rozdeľujú medzi používateľov a protokol:

```typescript
if (biatecFee === 0n) {
  const usersLiquidityFromFeeIncrement = diff;
  this.LiquidityUsersFromFees.value = this.LiquidityUsersFromFees.value + usersLiquidityFromFeeIncrement;
} else {
  const usersLiquidityFromFeeIncrement = (diff * (s - biatecFee)) / s;
  const biatecLiquidityFromFeeIncrement = diff - usersLiquidityFromFeeIncrement;
  this.LiquidityUsersFromFees.value = this.LiquidityUsersFromFees.value + usersLiquidityFromFeeIncrement;
  this.LiquidityBiatecFromFees.value = this.LiquidityBiatecFromFees.value + biatecLiquidityFromFeeIncrement;
}
```

### 3. Používateľské Násobitele Poplatkov

**Definícia**: Zľavy alebo prirážky na poplatkoch na základe úrovne overenia identity používateľa a jeho aktivity.

**Konfigurácia**:

- Určené verifikačnou triedou identity a úrovňou aktivity používateľa
- **Rozsah**: 1.0 až 2.0 (násobiteľ aplikovaný na základné LP poplatky)
- **Základný násobiteľ**: 2.0 (anonymní používatelia platia 2x základný LP poplatok)
- Overení používatelia môžu získať zľavy až na 1.0x (bez prirážky)
- Aplikuje sa ako násobiteľ na základné LP poplatky

**Určenie na základe aktivity**:

- **Anonymní používatelia**: 2.0x násobiteľ (dvojnásobné poplatky)
- **Overený Basic**: 1.5x násobiteľ (50 % prirážka)
- **Overený Advanced**: 1.2x násobiteľ (20 % prirážka)
- **Overený Premium**: 1.0x násobiteľ (bez prirážky)

**Zdroj**: Získavané z kontraktu `BiatecIdentityProvider` počas swap operácií.

## Proces Zberu Poplatkov

### Počas Swapov

1. **Vstupná Suma**: Používateľ odošle tokeny na swap
2. **Odpočítanie Poplatku**: LP poplatky sa odpočítajú zo vstupnej sumy
3. **Používateľský Násobiteľ**: Aplikuje sa násobiteľ poplatkov podľa identity
4. **Výpočet Swapu**: Výstupná suma sa vypočíta z upraveného vstupu
5. **Aktualizácia Likvidity**: Likvidita poolu sa zvýši o sumu poplatku
6. **Distribúcia Poplatku**: Poplatky sa rozdelia medzi používateľov a Biatec (ak je nakonfigurované)

### Účtovanie Poplatkov

Poplatky sa evidujú v stave poolu ako dodatočná likvidita:

- `LiquidityUsersFromFees`: Poplatky patriace poskytovateľom likvidity
- `LiquidityBiatecFromFees`: Poplatky vyzbierané protokolom

Tieto hodnoty predstavujú nerealizovanú poplatkovú likviditu, ktorá zvyšuje hodnotu LP tokenov.

## Výber Poplatkov

### Pre Poskytovateľov Likvidity

LP poplatky sú automaticky zahrnuté pri výbere likvidity. Výpočet výberu zohľadňuje narastanie poplatkov:

```typescript
// Výpočet výberu upravený o poplatky
const percentageOfL = (lpAmount * s) / totalLpSupply;
const assetAOut = (assetABalance * percentageOfL) / s;
const assetBOut = (assetBBalance * percentageOfL) / s;
```

### Pre Protokolové Poplatky

Protokolové poplatky môže vybrať určená výkonná adresa poplatkov (`addressExecutiveFee`) pomocou metód `removeLiquidityAdmin`, `distributeExcessAssets` alebo `withdrawExcessAssets`.

## Mechanizmy Ochrany Poplatkov

### Ochrana Pred Novými LP

Aby sa zabránilo novým poskytovateľom likvidity nárokovať si historické poplatky, protokol pri mintovaní LP tokenov diskontuje prírastok likvidity existujúcim pomerom poplatkov a rozdiel pripisuje do `LiquidityUsersFromFees`:

```
X = delta * distributedLp / (distributedLp + LiquidityUsersFromFees)
```

Tým sa zaručuje, že noví LP nemôžu okamžite vybrať historické poplatky, ktoré patria existujúcim poskytovateľom (pozri [Ochrana likviditných poplatkov](./liquidity-fee-protection) a [Agregácia poplatkov viacerých strán](./multi-party-fee-aggregation)).

### Správanie Zaokrúhľovania

- Výpočty LP tokenov používajú zaokrúhľovanie nadol (flooring) v prospech existujúcich poskytovateľov likvidity
- Malé rozdiely zo zaokrúhľovania zostávajú v poole
- Výbery môžu vrátiť o niekoľko základných jednotiek menej ako vklad kvôli ochrane poplatkov

## Príklady Poplatkov

### Príklad 1: 1 % LP Poplatok, Bez Biatec Poplatku

```
Vstup swapu: 100 USDC
LP poplatok: 1 % = 1 USDC
Efektívny vstup: 99 USDC
Výstup: Vypočítaný na základe 99 USDC
Poplatok pridaný do poolu: likvidita v hodnote 1 USDC
Distribúcia: 100 % pre poskytovateľov likvidity
```

### Príklad 2: 1 % LP Poplatok, 20 % Biatec Poplatok

```
Vstup swapu: 100 USDC
LP poplatok: 1 % = 1 USDC
Biatec poplatok: 20 % z LP poplatku = 0.2 USDC
Používateľský poplatok: 80 % z LP poplatku = 0.8 USDC
Efektívny vstup: 99 USDC
Výstup: Vypočítaný na základe 99 USDC
Distribúcia: 0.8 USDC pre LP, 0.2 USDC pre protokol
```
