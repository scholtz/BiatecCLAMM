---
sidebar_label: Network Fees
---

# Hálózati díjak

Ez a dokumentum ismerteti a BiatecCLAMM koncentrált likviditási poolok díjstruktúráját és működését.

## Áttekintés

A BiatecCLAMM több szintű díjrendszert alkalmaz, amely egyrészt kompenzálja a likviditásszolgáltatókat, másrészt fenntarthatóvá teszi a protokollt. A díjak swap műveletek során keletkeznek, és a likviditásszolgáltatók, valamint a protokoll között oszlanak meg.

A felhasználók kétféle díjat fizetnek:

1. **Protokolldíjak**: A kereskedési díjak, amelyek a likviditásszolgáltatóknál és a protokollnál landolnak (jelenleg az LP díjak 20%-a kerül a Biatechez)
2. **Hálózati díjak**: Az Algorand blokklánc tranzakciós díjai

## Algorand hálózati díjak

A protokoll díjakon felül a felhasználóknak minden tranzakcióhoz Algorand hálózati díjat kell fizetniük. Ezeket ALGO-ban számolják el, és a hálózaton végzett tranzakciók számítási költségét fedezik.

### Minimális tranzakciós díjak

- **Alapdíj**: 1 000 microAlgos (0,001 ALGO) tranzakciónként
- **Alkalmazáshívások**: További díjak a komplexitástól és erőforrás-használattól függően
- **Csoportos tranzakciók**: A csoport minden tranzakciója megfizeti a minimum díjat

### Pool létrehozási díjak

Új pool létrehozásakor több tranzakció fut le, ezért itt a legmagasabb a hálózati díj. A pool számla miatt Minimum Balance Requirement (MBR) is érvényesül. **Megjegyzés**: A pool létrehozásához körülbelül 5 ALGO előzetes befektetés szükséges az MBR teljesítéséhez.

**Tranzakciós bontás:**

- Pool telepítési tranzakció: 10 000 microAlgos (0,01 ALGO) fix díj
- Pool szolgáltató NOOP hívások: 2 × 1 000 microAlgos (0,002 ALGO)
- Minimum Balance Requirement (MBR): 5 000 000 microAlgos (5 ALGO) – a pool fiókhoz
- Bootstrap 2. lépés: 5 000 microAlgos (0,005 ALGO) extra díj

**Teljes hálózati díj**: ~5,018 ALGO (MBR-rel együtt)
**Tranzakciók száma**: 4-6 tranzakció csoportban

### Likviditás hozzáadási díjak

Likviditás növelése egy meglévő poolban:

**Tranzakciós bontás:**

- Fő add liquidity hívás: 8 000 microAlgos (0,008 ALGO) fix díj
- Eszköz átutalások: 1-2 × 1 000 microAlgos (0,001-0,002 ALGO)
- Pool szolgáltató NOOP hívás: 1 000 microAlgos (0,001 ALGO)
- LP token opt-in (ha szükséges): 1 000 microAlgos (0,001 ALGO)

**Teljes hálózati díj**: ~0,011-0,013 ALGO
**Tranzakciók száma**: 3-5 tranzakció csoportban

### Swap díjak

Token csere végrehajtása:

**Tranzakciós bontás:**

- Fő swap hívás: 12 000 microAlgos (0,012 ALGO) fix díj
- Eszköz átutalás: 1 000 microAlgos (0,001 ALGO)

**Teljes hálózati díj**: ~0,013 ALGO
**Tranzakciók száma**: 2-3 tranzakció csoportban

### Likviditás kivonási díjak

Likviditás visszavonása:

**Tranzakciós bontás:**

- Fő remove liquidity hívás: 12 000 microAlgos (0,012 ALGO) fix díj
- LP token átutalás: 1 000 microAlgos (0,001 ALGO)

**Teljes hálózati díj**: ~0,013 ALGO
**Tranzakciók száma**: 1-2 tranzakció csoportban

### Díjoptimalizálás

A protokoll tranzakció csoportosítással minimalizálja a hálózati díjakat:

- **Atomikus tranzakciók**: A csoport minden eleme együtt sikerül vagy bukik
- **Megosztott hivatkozások**: A box és app hivatkozásokat a csoport tranzakciói megosztják
- **Hatékony állapot-hozzáférés**: Minimális on-chain olvasás/írás

### Díjbecslés kódban

A teljes felhasználói költség becsléséhez vegye figyelembe a protokoll és hálózati díjakat is:

```typescript
// Protokoll díj becslése
const protocolFee = (swapAmount * lpFeeRate) / SCALE;

// Hálózati díj becslése (hozzávetőleges)
const networkFee = 13000; // microAlgos swap művelethez

// Teljes felhasználói költség
const totalCost = swapAmount + protocolFee + networkFee / 1_000_000; // ALGO-ban
```

## Díjtípusok

### 1. Likviditásszolgáltatói (LP) díjak

**Definíció**: Swap műveletek során levont díjak, amelyek a likviditásszolgáltatókat kompenzálják a tőkéjük biztosításáért.

**Konfiguráció**:

- Egyedileg állítható poolonként
- Tartomány: 0%-tól 100%-ig (9 tizedesjegyben tárolva)
- Példa: 10% díj = `100_000_000` (0,1 × 10^9)
- A pool szerződés állapotában `fee` mezőként tároljuk

**Számítás**: A swap bemeneti összegére alkalmazzuk, még a kimenet kiszámítása előtt.

```typescript
// Díj számítása a swap függvényben
const feesMultiplier = (s - ((this.fee.value as uint256) * (user.feeMultiplier as uint256)) / (user.base as uint256)) as uint256;
const inAssetAfterFee = (inAssetInBaseScale * feesMultiplier) / s;
```

### 2. Biatec protokoll díjak

**Definíció**: Az LP díjak egy százaléka, amely a protokoll fenntartását szolgálja.

**Konfiguráció**:

- Globálisan állítható a BiatecConfigProvider szerződésben
- **Aktuális arány**: Az LP díjak 20%-a
- Maximum: Az LP díjak 50%-a, minimum 0% (szerződésben rögzítve)
- `biatecFee` mezőben tárolva a config szerződésben
- Példa: Az LP díjak 10%-a = `100_000_000` (0,1 × 10^9)

**Elosztás**: Ha a Biatec díj engedélyezett, a díjak megoszlanak a felhasználók és a protokoll között:

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

### 3. Felhasználói díjszorzók

**Definíció**: Díjkedvezmények vagy pótdíjak a felhasználó identitás ellenőrzési szintje és aktivitása alapján.

**Konfiguráció**:

- Az identitás verifikációs osztály és aktivitási szint határozza meg
- **Tartomány**: 1,0-tól 2,0-ig (szorzó az alap LP díjra)
- **Alap szorzó**: 2,0 (anonim felhasználók dupla díjat fizetnek)
- Hitelesített felhasználók akár 1,0x szintig (nincs pótdíj) csökkenthetik
- Az alap LP díjra alkalmazott szorzó

**Aktivitás alapú példa:**

- **Anonim felhasználók**: 2,0x szorzó (dupla díj)
- **Verified Basic**: 1,5x szorzó (50% pótdíj)
- **Verified Advanced**: 1,2x szorzó (20% pótdíj)
- **Verified Premium**: 1,0x szorzó (nincs pótdíj)

**Forrás**: Swap műveletek során a BiatecIdentityProvider szerződésből kerül lekérdezésre.

## Díjbegyűjtés folyamata

### Swap közben

1. **Bemenet**: A felhasználó tokeneket küld swaphoz
2. **Díjlevonás**: Az LP díjakat levonjuk a bemeneti összegből
3. **Felhasználói szorzó**: Alkalmazzuk az identitás alapú szorzót
4. **Swap számítás**: A módosított bemenettel számítjuk a kimenetet
5. **Likviditás frissítés**: A pool likviditása a díj összegével nő
6. **Díj elosztás**: A díj a felhasználók és a Biatec között oszlik meg (ha konfigurálva van)

### Díj könyvelés

A díjakat a pool állapota kiegészítő likviditásként tartja nyilván:

- `LiquidityUsersFromFees`: A likviditásszolgáltatók díjai
- `LiquidityBiatecFromFees`: A protokoll által gyűjtött díjak

Ezek realizálatlan díj likviditást jelölnek, amelyek növelik az LP tokenek értékét.

## Díj kivonás

### Likviditásszolgáltatók esetén

Az LP díjak automatikusan beleszámítanak a likviditás visszavonásakor. A kivonási számítás figyelembe veszi a felhalmozott díjakat:

```typescript
// Díjjal korrigált visszavonási számítás
const percentageOfL = (lpAmount * s) / totalLpSupply;
const assetAOut = (assetABalance * percentageOfL) / s;
const assetBOut = (assetBBalance * percentageOfL) / s;
```

### Protokoll díjak esetén

A protokoll díjait a kijelölt executive fee cím vonhatja ki a `distributeExcessAssets` vagy `withdrawExcessAssets` metódusokkal.

## Díjvédelmi mechanizmusok

### Új LP védelem

Az új likviditásszolgáltatók ne tudják felvenni a korábbi díjakat, ezért a protokoll másodfokú formulát használ LP token minteléskor:

```
X^2 + X(sumDistributedAndFees − Q) − Q * distributedBefore = 0
```

Ez garantálja, hogy az új belépők ne vehessenek fel azonnal olyan díjakat, amelyek a meglévő szolgáltatókat illetik.

### Kerekítési viselkedés

- Az LP token számítások lefelé kerekítenek, így a régi szolgáltatók felé billen a mérleg
- Kisebb kerekítési eltérések (< az alaplépték 20%-a) előfordulhatnak, de a poolban maradnak
- A visszavonások a díjvédelem miatt kicsivel kevesebbet adhatnak vissza, mint a betét összege

## Díj példák

### 1. példa: 1% LP díj, Biatec díj nélkül

```
Swap bemenet: 100 USDC
LP díj: 1% = 1 USDC
Hatásos bemenet: 99 USDC
Kimenet: 99 USDC alapján számítva
Poolba kerülő díj: 1 USDC értékű likviditás
Elosztás: 100% a likviditásszolgáltatóknak
```

### 2. példa: 1% LP díj, 20% Biatec díj

```
Swap bemenet: 100 USDC
LP díj: 1% = 1 USDC
Biatec díj: az LP díj 20%-a = 0,2 USDC
Felhasználói díj: az LP díj 80%-a = 0,8 USDC
Hatásos bemenet: 99 USDC
Kimenet: 99 USDC alapján számítva
Elosztás: 0,8 USDC az LP-knek, 0,2 USDC a protokollnak
```

### 3. példa: Felhasználói díjszorzóval (anonim felhasználó)

```
Alap LP díj: 1% = 1 USDC
Felhasználói szorzó: 2,0 (anonim felhasználó — dupla díj)
Hatásos díj: 2,0 USDC
Biatec díj: az effektív díj 20%-a = 0,4 USDC
Felhasználói díj: az effektív díj 80%-a = 1,6 USDC
Hatásos bemenet: 98 USDC
Kimenet: 98 USDC alapján számítva
Elosztás: 1,6 USDC az LP-knek, 0,4 USDC a protokollnak
```

### 4. példa: Felhasználói díjszorzóval (Verified Premium felhasználó)

```
Alap LP díj: 1% = 1 USDC
Felhasználói szorzó: 1,0 (verified premium — pótdíj nélkül)
Hatásos díj: 1,0 USDC
Biatec díj: az effektív díj 20%-a = 0,2 USDC
Felhasználói díj: az effektív díj 80%-a = 0,8 USDC
Hatásos bemenet: 99 USDC
Kimenet: 99 USDC alapján számítva
Elosztás: 0,8 USDC az LP-knek, 0,2 USDC a protokollnak
```

## Konfiguráció

### LP díjak beállítása

Az LP díjak poolonként konfigurálhatók a pool szolgáltató szerződésen keresztül a létrehozáskor.

### Biatec díjak beállítása

A Biatec díjakat globálisan az executive cím állítja be:

```typescript
// Csak az addressExecutive állíthatja a Biatec díjakat
bootstrap(biatecFee: uint256, ...): void
```

### Díjkorlátok

- **LP díjak**: 0%-tól 100%-ig
- **Biatec díjak**: Az LP díjak 0%-50%-a (jelenleg 20%)
- **Felhasználói szorzók**: 1,0-tól 2,0-ig (identitás és aktivitás alapján)

## Díjak monitorozása

### Pool státusz

A `status()` metódussal figyelheti a díjak felhalmozását:

```typescript
const poolStatus = await poolClient.status({
  appBiatecConfigProvider,
  assetA,
  assetB,
  assetLp,
});

console.log('LP díjak:', poolStatus.liquidityUsersFromFees);
console.log('Biatec díjak:', poolStatus.liquidityBiatecFromFees);
console.log('Aktuális díj ráta:', poolStatus.fee);
console.log('Biatec díj ráta:', poolStatus.biatecFee);
```

### Díjkövetés

A pool szolgáltató szerződés több perióduson át követi a díj statisztikákat analitikához.

## Biztonsági szempontok

### Díj manipuláció

- A díjak utólag nem módosíthatók
- A beállított díjak a pool létrejötte után változatlanok
- A protokoll díjak módosítása executive multisig jóváhagyást igényel

### Díj elosztás

- Díj felvétele megfelelő jogosultságot kíván
- A többlet eszközök elosztása csak executive címeknek engedélyezett
- Minden díjművelet naplózott és ellenőrizhető

## Integrációs iránymutatások

### Díjbecslés

Felhasználói felületen mindig számolja ki a várható díjakat:

```typescript
const estimatedFee = (inputAmount * lpFee) / SCALE;
const effectiveInput = inputAmount - estimatedFee;
```

### Csúszás számítás

A csúszás kalkulációnál vegye figyelembe a díjakat is:

```typescript
const minimumOutput = expectedOutput * (1 - slippageTolerance - feeRate);
```

### Díj megjelenítés

Tüntessen fel minden releváns díjat:

- LP díj ráta
- Biatec díj ráta (ha van)
- Felhasználói díjszorzó hatása
- Teljes effektív díj
- Becsült hálózati díjak ALGO-ban

## Tesztelés

A protokoll átfogó díj teszt forgatókönyveket tartalmaz:

- Különböző LP díj ráták (0%, 1%, 10%)
- Biatec díj kombinációk (0%, 50%)
- Felhasználói díjszorzók
- Díj kivonási szcenáriók
- Díjvédelmi mechanizmusok

Validáláshoz a `__test__/test-data/` könyvtárban találhatóak teszt adatok.
