# Staking Pools (Úročené Token Pools)

## Prehľad {#-prehlad}

BiatecCLAMM teraz podporuje staking pools, kde sú aktívum A a aktívum B rovnaký token. Toto umožňuje vytvorenie úročených tokenov ako B-ALGO, B-USDC, atď., kde môžu poskytovatelia likvidity získať odmeny zo staking odmien, transakčných poplatkov alebo iných príjmových zdrojov, ktoré sa hromadia v poole.

## Prípady použitia {#-pripady-pouzitia}

### 1. Native Token Staking (B-ALGO) {#-1-native-token-staking-b-algo}

Vytvorte pool, kde sú aktívum A aj aktívum B nastavené na 0 (nativny token). Toto vytvorí B-ALGO token, ktorý reprezentuje stakované ALGO. Akékoľvek ALGO, ktoré sa nahromadí v poole (napr. z konsenzuálnych odmien, governance odmien alebo priamych vkladov), môže byť distribuované držiteľom B-ALGO.

### 2. Asset Staking (B-USDC, B-TOKEN, atď.) {#-2-asset-staking-b-usdc-b-token-atd}

Vytvorte pool, kde sú aktívum A aj aktívum B nastavené na rovnaké ASA ID. Toto vytvorí B-\{TOKEN\} token, ktorý reprezentuje stakované tokeny. Toto je užitočné pre:

- Lending protokoly, kde vložené aktíva zarábajú úrok
- Mechanizmy zdieľania príjmov
- Stratégie agregácie výnosov

## Charakteristiky poolu {#-charakteristiky-poolu}

Keď sa aktívum A rovná aktívu B:

- **LP Token Name**: `B-{AssetName}` (napr. "B-ALGO", "B-USDC")
- **LP Token Symbol**: Názov jednotky aktíva (napr. "ALGO", "USDC")
- **Cenový rozsah**: Musí byť plochý na 1:1 (priceMin = priceMax = currentPrice = SCALE). Kontrakt teraz toto vynucuje počas bootstrap (chyba `E_STAKING_PRICE`).
- **Swapy**: Nemajú zmysel, keďže obe aktíva sú rovnaké
- **Hlavné operácie**: Pridať likviditu (stake), odobrať likviditu (unstake), distribuovať odmeny

## Ako to funguje {#-ako-to-funguje}

### 1. Vytvorenie poolu {#-1-vytvorenie-poolu}

```typescript
const { clientBiatecClammPoolProvider } = await setupPool({
  algod,
  assetA: 0n, // 0 pre ALGO, alebo ASA ID
  assetB: 0n, // Rovnaké ako assetA
  biatecFee: 0n, // Žiadny Biatec poplatok
  lpFee: BigInt(SCALE / 100), // 1% poplatok (voliteľné)
  p: BigInt(1 * SCALE), // Cena = 1:1
  p1: BigInt(1 * SCALE), // Min cena = 1
  p2: BigInt(1 * SCALE), // Max cena = 1
  nativeTokenName: 'ALGO', // Voliteľný pomocný parameter zabezpečuje zhodu globálneho stavu providera
});

// Pri manuálnom konštruovaní transakcií, nakonfigurujte provider raz cez:
// await poolProviderClient.send.setNativeTokenName({
//   args: { appBiatecConfigProvider: configAppId, nativeTokenName: 'ALGO' },
//   appReferences: [configAppId],
// });
```

### 2. Pridávanie likvidity (Staking) {#-2-pridavanie-likvidity-staking}

Používatelia pridávajú likviditu na staking svojich tokenov:

```typescript
const txId = await clammAddLiquiditySender({
  algod,
  account: userSigner,
  amountA: stakeAmount, // Množstvo na staking
  amountB: stakeAmount, // Rovnaké ako amountA
  assetA: 0n, // 0 pre ALGO
  assetB: 0n, // Rovnaké ako assetA
  assetLP: lpTokenId,
  clientBiatecClammPool,
  appBiatecConfigProvider,
  appBiatecIdentityProvider,
  appBiatecPoolProvider,
});
```

Používatelia dostávajú B-\{TOKEN\} LP tokeny reprezentujúce ich stakovanú pozíciu.

### 3. Distribúcia odmien {#-3-distribucia-odmien}

Keď sa odmeny nahromadia v poole (napr. staking odmeny, poplatky, priame vklady), executive fee adresa ich distribuuje:

```typescript
// 1. Odmeny sú vložené na adresu poolu
// (Toto sa môže stať automaticky cez konsenzuálne odmeny, alebo manuálne)

// 2. Executive fee adresa distribuuje prebytočné aktíva
const txId = await clammDistributeExcessAssetsSender({
  algod,
  account: executiveSigner,
  amountA: rewardsAmount * (SCALE / assetDecimals), // V základnej škále (9 desatinných miest)
  amountB: 0n, // Žiadne odmeny pre aktívum B
  assetA: 0n, // 0 pre ALGO
  assetB: 0n, // Rovnaké ako assetA
  clientBiatecClammPool,
  appBiatecConfigProvider,
});
```

Toto zvyšuje likviditu poolu proporcionálne, takže keď používatelia vyberajú, dostávajú viac tokenov ako vložili.

### 4. Odoberanie likvidity (Unstaking) {#-4-odoberanie-likvidity-unstaking}

Používatelia vyberajú svoj stake plus zarobené odmeny:

```typescript
const txId = await clammRemoveLiquiditySender({
  algod,
  account: userSigner,
  assetA: 0n,
  assetB: 0n,
  assetLP: lpTokenId,
  lpTokensToSend: lpBalance, // Všetky alebo čiastočné LP tokeny
  clientBiatecClammPool,
  appBiatecConfigProvider,
  appBiatecIdentityProvider,
  appBiatecPoolProvider,
});
```

Používatelia dostávajú späť svoje stakované tokeny plus proporcionálny podiel odmien.

## Technické detaily {#-technicke-detaily}

### Zmeny v kontrakte {#-zmeny-v-kontrakte}

1. **Globálny stav pool providera**: Pridaný `nativeTokenName` (`nt`) do globálneho stavu pool providera s admin-only `setNativeTokenName` metódou. CLAMM bootstrap číta túto hodnotu pri vytváraní LP tokenov.

2. **Validácia aktív**: Odstránené tvrdenie, ktoré bránilo `assetA.id === assetB.id`. Kontrakt teraz podporuje túto konfiguráciu pre staking pools.

3. **LP Token naming**:

   - Štandardné pools: `B-{AssetA}-{AssetB}` s názvom jednotky `BLP`
   - Staking pools: `B-{AssetName}` s názvom jednotky zodpovedajúcim základnému aktívu

4. **Opt-in logika**: Preskakuje duplicitné opt-in keď sa aktívum A rovná aktívu B.

### TypeScript API zmeny {#-typescript-api-zmeny}

1. **clammCreateTxs / clammCreateSender**: Už neprijímajú parameter `nativeTokenName`; nakonfigurujte pool provider raz cez `BiatecPoolProviderClient.send.setNativeTokenName`.

2. **setupPool**: Pridané voliteľné parametre `assetB` a `nativeTokenName` pre test scenáre

## Príklady {#-priklady}

### Príklad 1: B-ALGO Pool {#-priklad-1-b-algo-pool}

```typescript
// Vytvoriť B-ALGO pool
const pool = await setupPool({
  algod,
  assetA: 0n,
  assetB: 0n,
  biatecFee: 0n,
  lpFee: 0n,
  p: BigInt(SCALE),
  p1: BigInt(SCALE),
  p2: BigInt(SCALE),
  nativeTokenName: 'ALGO',
});

// Stakovať 100 ALGO
await clammAddLiquiditySender({
  amountA: 100n * BigInt(SCALE_ALGO),
  amountB: 100n * BigInt(SCALE_ALGO),
  // ... ostatné parametre
});

// Simulovať 10 ALGO odmien nahromadených v poole
// (Odoslané priamo na adresu poolu)

// Distribuovať odmeny
await clammDistributeExcessAssetsSender({
  amountA: 10n * BigInt(SCALE), // 10 ALGO v základnej škále
  amountB: 0n,
  // ... ostatné parametre
});

// Unstakovať (dostáva pôvodných 100 ALGO + proporcionálne odmeny)
await clammRemoveLiquiditySender({
  lpTokensToSend: lpBalance,
  // ... ostatné parametre
});
```

### Príklad 2: B-USDC Pool (Lending protokol) {#-priklad-2-b-usdc-pool-lending-protokol}

```typescript
// Vytvoriť B-USDC pool
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

// Používateľ vloží 1000 USDC
await clammAddLiquiditySender({
  amountA: 1000n * BigInt(USDC_DECIMALS),
  amountB: 1000n * BigInt(USDC_DECIMALS),
  // ... ostatné parametre
});

// Postupne sa v poole hromadia lending úroky
// Executive adresa distribuuje úrok držiteľom LP
await clammDistributeExcessAssetsSender({
  amountA: interestAmount,
  amountB: 0n,
  // ... ostatné parametre
});

// Používateľ vyberie svoj vklad + zarobený úrok
await clammRemoveLiquiditySender({
  lpTokensToSend: lpBalance,
  // ... ostatné parametre
});
```

## Bezpečnostné úvahy {#-bezpecnostne-uvahy}

### Trust model {#-trust-model}

Staking pools (B-ALGO, B-USDC, atď.) vyžadujú dôveru v špecifické adresy a procesy:

1. **Kontrola executive fee adresy**: Iba `addressExecutiveFee` účet nakonfigurovaný v Biatec Config Provider môže distribuovať odmeny cez `distributeExcessAssets`. Táto adresa má značnú moc:

   - Môže distribuovať odmeny všetkým LP držiteľom
   - Môže ovplyvniť časovanie distribúcie odmien
   - Musí presne kalkulovať množstvá odmien
   - **Odporúčanie**: Použite multi-signature účet pre túto adresu

2. **Integrita config providera**: Config provider kontrakt kontroluje kritické parametre:
   - Referencia identity providera
   - Štruktúra poplatkov
   - Executive adresy
   - **Odporúčanie**: Zaistite, aby bol config provider immutable alebo riadený DAO

### Rozdiely od liquidity pools {#-rozdiely-od-liquidity-pools}

Staking pools majú unikátne charakteristiky:

- **Žiadny impermanent loss**: Keďže obe aktíva sú identické, nie je tam cenové riziko
- **Žiadne swap price discovery**: Odmeny pochádzajú z externých zdrojov, nie z obchodov
- **Jednoduchší cenový model**: Vždy 1:1 v základnej škále
- **Reward rate externe nastavený**: Výnosy závisia od distribúcie odmien executive adresou
- **Swap operácie blokované**: Kontrakt explicitne bráni swapom s chybou "Swaps not allowed in staking pools"

### Rizikové faktory {#-rizikove-faktory}

1. **Nedostatok odmien**: Ak sa odmeny nedistribuujú podľa očakávania, staking neprináša nič

   - Zmiernenie: Monitorujte aktivitu executive adresy a plán distribúcie odmien

2. **Účtovné chyby**: Nesprávne `distributeExcessAssets` volania môžu zamknúť prostriedky alebo distribuovať nespravodlivo

   - Zmiernenie: Dôkladne testujte kalkulácie distribúcie odmien off-chain najprv
   - Zmiernenie: Použite základnú škálu (9 desatinných miest) pre všetky kalkulácie

3. **Governance zmeny**: Zmena executive fee adresy ovplyvňuje kontrolu

   - Zmiernenie: Vyžadujte timelock pre zmeny adries
   - Zmiernenie: Multi-sig governance pre config aktualizácie

4. **Cenová validácia**: Staking pools vyžadujú `priceMin === priceMax === currentPrice`

   - Kontrakt teraz vynucuje túto validáciu v `bootstrap` funkcii
   - Kód chyby: `E_STAKING_PRICE` ak cenový rozsah nie je plochý

5. **Validácia poradia aktív**: Štandardné pools teraz vynucujú `assetA.id < assetB.id` pre non-staking pools
   - Staking pools obchádzajú túto kontrolu keď `assetA.id === assetB.id`
   - Kód chyby: `E_ASSET_ORDER` ak je poradie nesprávne v štandardných pooloch

### Osvedčené postupy distribúcie odmien {#-osvedcene-postupy-distribucie-odmien}

1. **Kalkulujte v základnej škále**: Vždy konvertujte množstvá odmien do základnej škály (vynásobte 1e9) pred volaním `distributeExcessAssets`
2. **Overte bilanciu poolu**: Zaistite, že pool skutočne dostal reward tokeny pred distribúciou
3. **Testujte najprv**: Spustite distribúciu odmien na testnete s malými množstvami najprv
4. **Dokumentujte plán**: Jasne komunikujte frekvenciu a množstvá distribúcie odmien
5. **Monitorujte stav**: Sledujte likviditu poolu pred a po distribúcii na overenie správnosti

### Príklad bezpečnej distribúcie odmien {#-priklad-bezpecnej-distribucie-odmien}

```typescript
// 1. Kalkulujte odmenu v základnej škále
const rewardInTokenUnits = 1000n; // 1000 tokenov
const tokenDecimals = 6n; // USDC má 6 desatinných miest
const baseScale = 1_000_000_000n;
const rewardInBaseScale = rewardInTokenUnits * (baseScale / 10n ** tokenDecimals);

// 2. Najprv odošlite tokeny do poolu
await algod.sendPaymentTransaction({
  from: executiveAddress,
  to: poolAddress,
  amount: rewardInTokenUnits * 10n ** tokenDecimals, // V natívnych jednotkách
});

// 3. Distribuujte cez kontrakt
await clammDistributeExcessAssetsSender({
  appBiatecClammPool: poolAppId,
  appBiatecConfigProvider: configAppId,
  assetA: usdcAssetId,
  assetB: usdcAssetId,
  amountA: rewardInBaseScale,
  amountB: 0n,
  // ... ostatné parametre
});
```

### Bezpečnostné audity {#-bezpecnostne-audity}

Boli vykonané viaceré AI-powered bezpečnostné audity implementácie staking pools. Kľúčové zistenia riešené:

- **[M-02]** Pridaná validácia pre cenové rozsahy same-asset poolov (musia byť ploché)
- **[M-06]** Odporúčané pridanie deposit proof do `distributeExcessAssets` pre bezpečnosť
- **Všeobecné** Staking pools sú teraz explicitne validované počas bootstrap

Pozrite si `audits/` priečinok pre detailné správy bezpečnostných auditov.

### Ochrana používateľov {#-ochrana-pouzivatelov}

1. **Kalkulácia odmien**: Metóda `distributeExcessAssets` zvyšuje likviditu poolu proporcionálne. Zaistite, že parameter `amountA` je kalkulovaný správne v základnej škále (9 desatinných miest).

2. **Cenová stabilita**: Keďže staking pools používajú 1:1 cenový pomer, cena by mala zostať konštantná. Akákoľvek značná odchýlka môže indikovať problém.

3. **Zaokrúhľovanie**: Rovnako ako pri štandardných pooloch, malé množstvá môžu byť stratené pri zaokrúhľovaní. Toto je zámerom na ochranu poolu pred krvácaním.

## Testovanie {#-testovanie}

Pozrite si `__test__/pool/staking.test.ts` pre komplexné test príklady vrátane:

- Vytvorenie B-ALGO poolu
- Vytvorenie B-TOKEN poolu s ASA
- Distribúcia odmien a verifikácia LP profitu

## Chain-specific konfigurácia {#-chain-specific-konfiguracia}

Rôzne blockchain siete môžu používať rôzne názvy natívnych tokenov:

- **Algorand Mainnet/Testnet**: 'ALGO'
- **Voi Network**: 'VOI'
- **Aramid Network**: 'ARAMID'

Použite `setNativeTokenName` na konfiguráciu providera pred deployovaním poolov, aby ste zaistili, že LP token naming zodpovedá cieľovej sieti.
