# Staking poolok (kamatot termelő token poolok)

## Áttekintés {#-overview}

A BiatecCLAMM immár támogatja azokat a staking poolokat, ahol az A és B eszköz megegyezik. Így hozhatók létre olyan kamatozó tokenek, mint a B-ALGO, B-USDC stb., amelyek révén a likviditásszolgáltatók staking jutalmakat, tranzakciós díjakat vagy más, a poolba áramló bevételeket kaphatnak.

## Használati esetek {#-use-cases}

### 1. Natív token staking (B-ALGO) {#-1-native-token-staking-b-algo}

Hozzon létre poolt, ahol az A és B eszköz egyaránt 0 (natív token). Ez B-ALGO tokent generál, amely a stakelt ALGO-t képviseli. A poolhoz jutó bármilyen ALGO (konszenzus jutalom, governance jutalom, közvetlen befizetés) szétosztható a B-ALGO tulajdonosok között.

### 2. Eszköz staking (B-USDC, B-TOKEN stb.) {#-2-asset-staking-b-usdc-b-token-etc}

Állítsa az A és B eszközt azonos ASA ID-re. Így jön létre a B-{TOKEN} token, amely stakelt tokeneket reprezentál. Hasznos például:

- Hitelezési protokollokban, ahol a betétek kamatoznak
- Bevételmegosztó mechanizmusokban
- Hozam aggregációs stratégiákban

## Pool jellemzők {#-pool-characteristics}

Amikor asset A megegyezik asset B-vel:

- **LP token név**: `B-{AssetName}` (pl. "B-ALGO", "B-USDC")
- **LP token szimbólum**: Az eszköz unit neve (pl. "ALGO", "USDC")
- **Ársáv**: Rögzített 1:1 arány (priceMin = priceMax = currentPrice = SCALE). A szerződés bootstrap során ezt érvényesíti (`E_STAKING_PRICE` hibakód).
- **Swappok**: Nem értelmezhetők, mivel a két eszköz azonos
- **Fő műveletek**: Likviditás hozzáadása (stake), likviditás kivonása (unstake), jutalmak szétosztása

## Működés {#-how-it-works}

### 1. Pool létrehozása {#-1-pool-creation}

```typescript
const { clientBiatecClammPoolProvider } = await setupPool({
  algod,
  assetA: 0n, // 0 az ALGO-hoz, vagy bármely ASA ID
  assetB: 0n, // Megyezik az assetA-val
  biatecFee: 0n, // Nincs Biatec díj
  lpFee: BigInt(SCALE / 100), // 1% díj (opcionális)
  p: BigInt(1 * SCALE), // Ár = 1:1
  p1: BigInt(1 * SCALE), // Minimum ár = 1
  p2: BigInt(1 * SCALE), // Maximum ár = 1
  nativeTokenName: 'Algo', // Opcionális, a provider globális állapotához igazít
});

// Kézi tranzakció építésnél egyszer konfigurálja a providert:
// await poolProviderClient.send.setNativeTokenName({
//   args: { appBiatecConfigProvider: configAppId, nativeTokenName: 'Algo' },
//   appReferences: [configAppId],
// });
```

### 2. Likviditás hozzáadása (staking) {#-2-adding-liquidity-staking}

A felhasználók likviditást adnak a token stake-eléséhez:

```typescript
const txId = await clammAddLiquiditySender({
  algod,
  account: userSigner,
  amountA: stakeAmount, // Stakelni kívánt mennyiség
  amountB: stakeAmount, // Azonos amountA-val
  assetA: 0n, // 0 az ALGO-hoz
  assetB: 0n, // Megegyezik assetA-val
  assetLP: lpTokenId,
  clientBiatecClammPool,
  appBiatecConfigProvider,
  appBiatecIdentityProvider,
  appBiatecPoolProvider,
});
```

A felhasználók B-{TOKEN} LP tokeneket kapnak, amelyek a stakelt pozíciót jelölik.

### 3. Jutalmak szétosztása {#-3-distributing-rewards}

Amikor a pool jutalmakat kap (staking jutalom, díjak, közvetlen befizetés), az executive fee cím osztja szét őket:

```typescript
// 1. A jutalmakat a pool címére utalják
// (Ez megtörténhet automatikusan vagy manuálisan)

// 2. Az executive fee cím szétosztja a többlet eszközöket
const txId = await clammDistributeExcessAssetsSender({
  algod,
  account: executiveSigner,
  amountA: rewardsAmount * (SCALE / assetDecimals), // Alapléptékben (9 tizedes)
  amountB: 0n, // Asset B-re nincs jutalom
  assetA: 0n, // 0 az ALGO-hoz
  assetB: 0n, // Megegyezik assetA-val
  clientBiatecClammPool,
  appBiatecConfigProvider,
});
```

Ez arányosan növeli a pool likviditását, így a kivonáskor a felhasználók több tokent kapnak vissza, mint amennyit befizettek.

### 4. Likviditás kivonása (unstaking) {#-4-removing-liquidity-unstaking}

A felhasználók a tőkéjüket és a díjakkal növelt jutalmakat veszik fel:

```typescript
const txId = await clammRemoveLiquiditySender({
  algod,
  account: userSigner,
  assetA: 0n,
  assetB: 0n,
  assetLP: lpTokenId,
  lpTokensToSend: lpBalance, // Teljes vagy részleges LP token
  clientBiatecClammPool,
  appBiatecConfigProvider,
  appBiatecIdentityProvider,
  appBiatecPoolProvider,
});
```

A felhasználók visszakapják betétjüket plusz az arányos jutalmat.

## Technikai részletek {#-technical-details}

### Szerződés módosítások {#-contract-changes}

1. **Pool provider globális állapot**: Hozzáadtuk a `nativeTokenName` (`nt`) mezőt admin-only `setNativeTokenName` metódussal. A CLAMM bootstrap a LP token létrehozáskor ezt olvassa.
2. **Eszköz validáció**: Eltávolítottuk azt az assertet, amely megakadályozta az `assetA.id === assetB.id` konfigurációt. A szerződés most támogatja ezt a staking poolokhoz.
3. **LP token elnevezés**:
   - Standard poolok: `B-{AssetA}-{AssetB}` névvel, `BLP` unit névvel
   - Staking poolok: `B-{AssetName}` névvel, az alapeszköz unit nevét megtartva
4. **Opt-in logika**: Elhagyja a duplikált opt-int, ha assetA megegyezik assetB-vel.

### TypeScript API változások {#-typescript-api-changes}

1. **clammCreateTxs / clammCreateSender**: Nem fogad `nativeTokenName` paramétert; helyette egyszer konfigurálja a poolt a `BiatecPoolProviderClient.send.setNativeTokenName` hívással.
2. **setupPool**: Opcionális `assetB` és `nativeTokenName` paramétereket kapott a teszt szcenáriókhoz.

## Példák {#-examples}

### 1. példa: B-ALGO pool {#-example-1-b-algo-pool}

```typescript
// B-ALGO pool létrehozása
const pool = await setupPool({
  algod,
  assetA: 0n,
  assetB: 0n,
  biatecFee: 0n,
  lpFee: 0n,
  p: BigInt(SCALE),
  p1: BigInt(SCALE),
  p2: BigInt(SCALE),
  nativeTokenName: 'Algo',
});

// 100 ALGO stake
await clammAddLiquiditySender({
  amountA: 100n * BigInt(SCALE_ALGO),
  amountB: 100n * BigInt(SCALE_ALGO),
  // ... további paraméterek
});

// Szimuláljunk 10 ALGO jutalmat a poolnak
// (Közvetlenül a pool címére utalva)

// Jutalmak szétosztása
await clammDistributeExcessAssetsSender({
  amountA: 10n * BigInt(SCALE), // 10 ALGO alapléptékben
  amountB: 0n,
  // ... további paraméterek
});

// Unstake (eredeti 100 ALGO + arányos jutalom)
await clammRemoveLiquiditySender({
  lpTokensToSend: lpBalance,
  // ... további paraméterek
});
```

### 2. példa: B-USDC pool (hitelezési protokoll) {#-example-2-b-usdc-pool-lending-protocol}

```typescript
// B-USDC pool létrehozása
const pool = await setupPool({
  algod,
  assetA: USDC_ASSET_ID,
  assetB: USDC_ASSET_ID,
  biatecFee: 0n,
  lpFee: 0n,
  p: BigInt(SCALE),
  p1: BigInt(SCALE),
  p2: BigInt(SCALE),
});

// Felhasználó 1000 USDC-t helyez el
await clammAddLiquiditySender({
  amountA: 1000n * BigInt(USDC_DECIMALS),
  amountB: 1000n * BigInt(USDC_DECIMALS),
  // ... további paraméterek
});

// Idővel kamat gyűlik a poolban
// Az executive cím szétosztja a kamatot az LP-k között
await clammDistributeExcessAssetsSender({
  amountA: interestAmount,
  amountB: 0n,
  // ... további paraméterek
});

// Felhasználó felveszi a betétet + kamatot
await clammRemoveLiquiditySender({
  lpTokensToSend: lpBalance,
  // ... további paraméterek
});
```

## Biztonsági szempontok {#-security-considerations}

### Bizalmi modell {#-trust-model}

A staking poolok (B-ALGO, B-USDC stb.) meghatározott címekben és folyamatokban való bizalmat igényelnek:

1. **Executive fee cím felügyelete**: Csak a Biatec Config Provider által beállított `addressExecutiveFee` hívhatja a `distributeExcessAssets` függvényt. Ez a cím nagy hatalommal bír:
   - Jutalmakat oszt az összes LP-nek
   - Meghatározza a kifizetések időzítését
   - Pontosan kell számolnia a jutalmak összegét
   - **Ajánlás**: Használjon multisig fiókot ehhez a címhez

2. **Config provider integritása**: A config provider szerződés szabályozza a kritikus paramétereket:
   - Identitásszolgáltató hivatkozás
   - Díjstruktúra
   - Executive címek
   - **Ajánlás**: Tegye a config providert immutálissá vagy DAO által felügyelté

### Eltérés a likviditási pooloktól {#-differences-from-liquidity-pools}

A staking poolok sajátosságai:

- **Nincs impermanent loss**: Azonos eszközök miatt nincs árfolyam kockázat
- **Nincs swap ár felfedezés**: A jutalmak külső forrásból érkeznek, nem kereskedésből
  str>- **Egyszerű ár modell**: Mindig 1:1 az alapléptéken
- **Jutalom ráta külső**: A hozam attól függ, miként osztja szét az executive cím
- **Swap műveletek tiltva**: A szerződés „Swaps not allowed in staking pools” hibával blokkolja

### Kockázati tényezők {#-risk-factors}

1. **Jutalom elmaradása**: Ha nem osztják szét a jutalmakat, a staking nem hoz eredményt
   - Enyhítés: Monitorozza az executive cím aktivitását és az ütemezést

2. **Elszámolási hiba**: Hibás `distributeExcessAssets` hívások lezárhatják a pénzt vagy igazságtalan elosztást okozhatnak
   - Enyhítés: Off-chain alaposan tesztelje a számításokat
   - Enyhítés: Használja az alapléptéket (9 tizedes) minden számításhoz

3. **Governance változás**: Az executive fee cím módosítása hatással van az irányításra
   - Enyhítés: Időzár (timelock) bevezetése címcseréhez
   - Enyhítés: Multisig governance a config frissítésekhez

4. **Ár validáció**: Staking poolban kötelező a priceMin === priceMax === currentPrice
   - A bootstrap függvény most ezt ellenőrzi
   - Hibakód: `E_STAKING_PRICE` eltérés esetén

5. **Eszköz sorrend validáció**: Standard pooloknál `assetA.id < assetB.id` elvárás
   - Staking pooloknál elengedjük, ha `assetA.id === assetB.id`
   - Hibakód: `E_ASSET_ORDER` standard pooloknál helytelen sorrend esetén

### Jutalomszétosztás bevált gyakorlatok {#-reward-distribution-best-practices}

1. **Alaplépték használata**: Minden jutalom összeget konvertáljon 1e9 alapléptékre a `distributeExcessAssets` hívás előtt
2. **Pool egyenleg ellenőrzése**: Győződjön meg róla, hogy a pool ténylegesen megkapta a jutalmakat
3. **Előzetes tesztelés**: Teszteljen testneten kis összegekkel
4. **Ütemezés dokumentálása**: Kommunikálja a jutalom szétosztás gyakoriságát és mértékét
5. **Állapot monitorozása**: Kövesse a pool likviditását a szétosztás előtt és után

### Példa biztonságos jutalomszétosztásra {#-example-safe-reward-distribution}

```typescript
// 1. Jutalom számítása alapléptékben
const rewardInTokenUnits = 1000n; // 1000 token
const tokenDecimals = 6n; // USDC 6 tizedes
const baseScale = 1_000_000_000n;
const rewardInBaseScale = rewardInTokenUnits * (baseScale / 10n ** tokenDecimals);

// 2. Először utaljuk a tokeneket a poolnak
await algod.sendPaymentTransaction({
  from: executiveAddress,
  to: poolAddress,
  amount: rewardInTokenUnits * 10n ** tokenDecimals, // Natív egységben
});

// 3. Szétosztás szerződésen keresztül
await clammDistributeExcessAssetsSender({
  appBiatecClammPool: poolAppId,
  appBiatecConfigProvider: configAppId,
  assetA: usdcAssetId,
  assetB: usdcAssetId,
  amountA: rewardInBaseScale,
  amountB: 0n,
  // ... további paraméterek
});
```

### Biztonsági auditok {#-security-audits}

A staking pool megvalósítás több AI alapú auditon esett át. A főbb megállapítások megoldva:

- **[M-02]** Validáció hozzáadása az azonos eszközű pool ár tartományához (sík ársáv)
- **[M-06]** Javaslat letét bizonylat hozzáadására a `distributeExcessAssets` híváshoz
- **Általános**: A staking poolok bootstrap során explicit ellenőrzést kaptak

Részletekért lásd az `audits/` könyvtárat.

### Felhasználóvédelem {#-user-protection}

1. **Jutalom számítás**: A `distributeExcessAssets` arányosan növeli a pool likviditását. Biztosítsa, hogy az `amountA` alapléptékben (9 tizedes) legyen számolva.
2. **Ár stabilitás**: A staking pool árfolyama 1:1; bármilyen nagy eltérés problémát jelezhet.
3. **Kerekítés**: Az apró kerekítési veszteségek, ahogy standard pooloknál is, a védelem részei.

## Tesztelés {#-testing}

Lásd a `__test__/pool/staking.test.ts` fájlt a részletes példákhoz, többek között:

- B-ALGO pool létrehozása
- B-TOKEN pool ASA-val
- Jutalomszétosztás és LP profit ellenőrzés

## Hálózat specifikus beállítás {#-chain-specific-configuration}

Különböző hálózatok eltérő natív token nevet használhatnak:

- **Algorand Mainnet/Testnet**: "ALGO"
- **Voi Network**: "VOI"
- **Aramid Network**: "ARAMID"

A pool telepítése előtt használja a `setNativeTokenName` hívást, hogy a provider LP token elnevezése megfeleljen a célhálózatnak.
