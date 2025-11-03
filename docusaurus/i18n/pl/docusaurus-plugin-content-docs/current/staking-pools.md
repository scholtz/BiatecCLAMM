# Staking Pools (Pule z oprocentowanymi tokenami)

## Przegląd

BiatecCLAMM teraz obsługuje pule stakingowe, gdzie aktywo A i aktywo B to ten sam token. Umożliwia to utworzenie oprocentowanych tokenów takich jak B-ALGO, B-USDC itp., gdzie dostawcy płynności mogą otrzymywać nagrody ze stakingu, opłat transakcyjnych lub innych źródeł dochodów, które gromadzą się w puli.

## Przypadki użycia

### 1. Native Token Staking (B-ALGO)

Utwórz pulę, gdzie aktywo A i aktywo B są ustawione na 0 (natywny token). To utworzy token B-ALGO reprezentujący stakowane ALGO. Jakiekolwiek ALGO, które zgromadzi się w puli (np. z nagród konsensusowych, nagród governance lub bezpośrednich depozytów), może być dystrybuowane posiadaczom B-ALGO.

### 2. Asset Staking (B-USDC, B-TOKEN, itp.)

Utwórz pulę, gdzie aktywo A i aktywo B są ustawione na ten sam ASA ID. To utworzy token B-\{TOKEN\} reprezentujący stakowane tokeny. Jest to przydatne dla:

- Protokołów pożyczkowych, gdzie zdeponowane aktywa zarabiają odsetki
- Mechanizmów dzielenia się dochodami
- Strategii agregacji dochodów

## Charakterystyki puli

Kiedy aktywo A równa się aktywowi B:

- **Nazwa tokenu LP**: `B-{AssetName}` (np. "B-ALGO", "B-USDC")
- **Symbol tokenu LP**: Nazwa jednostki aktywa (np. "ALGO", "USDC")
- **Zakres cenowy**: Musi być płaski na 1:1 (priceMin = priceMax = currentPrice = SCALE). Kontrakt teraz wymusza to podczas bootstrap (błąd E_STAKING_PRICE).
- **Swapy**: Nie mają sensu, ponieważ oba aktywa są identyczne
- **Główne operacje**: Dodać płynność (stake), usunąć płynność (unstake), dystrybuować nagrody

## Jak to działa

### 1. Tworzenie puli

```typescript
const { clientBiatecClammPoolProvider } = await setupPool({
  algod,
  assetA: 0n, // 0 dla ALGO, lub ASA ID
  assetB: 0n, // To samo co assetA
  biatecFee: 0n, // Brak opłaty Biatec
  lpFee: BigInt(SCALE / 100), // 1% opłata (opcjonalne)
  p: BigInt(1 * SCALE), // Cena = 1:1
  p1: BigInt(1 * SCALE), // Min cena = 1
  p2: BigInt(1 * SCALE), // Max cena = 1
  nativeTokenName: 'ALGO', // Opcjonalny parametr pomocniczy zapewnia zgodność globalnego stanu providera
});

// Przy ręcznym konstruowaniu transakcji, skonfiguruj provider raz przez:
// await poolProviderClient.send.setNativeTokenName({
//   args: { appBiatecConfigProvider: configAppId, nativeTokenName: 'ALGO' },
//   appReferences: [configAppId],
});
```

### 2. Dodawanie płynności (Staking)

Użytkownicy dodają płynność do stakingu swoich tokenów:

```typescript
const txId = await clammAddLiquiditySender({
  algod,
  account: userSigner,
  amountA: stakeAmount, // Kwota do stakingu
  amountB: stakeAmount, // To samo co amountA
  assetA: 0n, // 0 dla ALGO
  assetB: 0n, // To samo co assetA
  assetLP: lpTokenId,
  clientBiatecClammPool,
  appBiatecConfigProvider,
  appBiatecIdentityProvider,
  appBiatecPoolProvider,
});
```

Użytkownicy otrzymują tokeny LP B-\{TOKEN\} reprezentujące ich pozycję stakingową.

### 3. Dystrybucja nagród

Kiedy nagrody zgromadzą się w puli (np. nagrody stakingowe, opłaty, bezpośrednie depozyty), adres opłaty wykonawczej je dystrybuuje:

```typescript
// 1. Nagrody są deponowane na adres puli
// (To może nastąpić automatycznie przez nagrody konsensusowe, lub ręcznie)

// 2. Adres opłaty wykonawczej dystrybuuje nadwyżkowe aktywa
const txId = await clammDistributeExcessAssetsSender({
  algod,
  account: executiveSigner,
  amountA: rewardsAmount * (SCALE / assetDecimals), // W skali podstawowej (9 miejsc dziesiętnych)
  amountB: 0n, // Brak nagród dla aktywa B
  assetA: 0n, // 0 dla ALGO
  assetB: 0n, // To samo co assetA
  clientBiatecClammPool,
  appBiatecConfigProvider,
});
```

To zwiększa płynność puli proporcjonalnie, więc kiedy użytkownicy wypłacają, otrzymują więcej tokenów niż wpłacili.

### 4. Usuwanie płynności (Unstaking)

Użytkownicy wypłacają swój stake plus zarobione nagrody:

```typescript
const txId = await clammRemoveLiquiditySender({
  algod,
  account: userSigner,
  assetA: 0n,
  assetB: 0n,
  assetLP: lpTokenId,
  lpTokensToSend: lpBalance, // Wszystkie lub częściowe tokeny LP
  clientBiatecClammPool,
  appBiatecConfigProvider,
  appBiatecIdentityProvider,
  appBiatecPoolProvider,
});
```

Użytkownicy otrzymują z powrotem swoje stakowane tokeny plus proporcjonalny udział w nagrodach.

## Szczegóły techniczne

### Zmiany w kontrakcie

1. **Stan globalny pool providera**: Dodany `nativeTokenName` (`nt`) do stanu globalnego pool providera z metodą admin-only `setNativeTokenName`. CLAMM bootstrap czyta tę wartość podczas tworzenia tokenów LP.

2. **Walidacja aktywów**: Usunięte twierdzenie, które uniemożliwiało `assetA.id === assetB.id`. Kontrakt teraz obsługuje tę konfigurację dla pul stakingowych.

3. **LP Token naming**:

   - Pule standardowe: `B-{AssetA}-{AssetB}` z nazwą jednostki `BLP`
   - Pule stakingowe: `B-{AssetName}` z nazwą jednostki odpowiadającą podstawowemu aktywowi

4. **Logika opt-in**: Pomija duplikowane opt-in kiedy aktywo A równa się aktywowi B.

### Zmiany API TypeScript

1. **clammCreateTxs / clammCreateSender**: Nie przyjmują już parametru `nativeTokenName`; skonfiguruj pool provider raz przez `BiatecPoolProviderClient.send.setNativeTokenName`.

2. **setupPool**: Dodane opcjonalne parametry `assetB` i `nativeTokenName` dla scenariuszy testowych

## Przykłady

### Przykład 1: Pula B-ALGO

```typescript
// Utwórz pulę B-ALGO
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

// Stakuj 100 ALGO
await clammAddLiquiditySender({
  amountA: 100n * BigInt(SCALE_ALGO),
  amountB: 100n * BigInt(SCALE_ALGO),
  // ... pozostałe parametry
});

// Symuluj 10 ALGO nagród zgromadzonych w puli
// (Wysłane bezpośrednio na adres puli)

// Dystrybuuj nagrody
await clammDistributeExcessAssetsSender({
  amountA: 10n * BigInt(SCALE), // 10 ALGO w skali podstawowej
  amountB: 0n,
  // ... pozostałe parametry
});

// Unstakuj (otrzymuje oryginalne 100 ALGO + proporcjonalne nagrody)
await clammRemoveLiquiditySender({
  lpTokensToSend: lpBalance,
  // ... pozostałe parametry
});
```

### Przykład 2: Pula B-USDC (Protokół pożyczkowy)

```typescript
// Utwórz pulę B-USDC
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

// Użytkownik wpłaca 1000 USDC
await clammAddLiquiditySender({
  amountA: 1000n * BigInt(USDC_DECIMALS),
  amountB: 1000n * BigInt(USDC_DECIMALS),
  // ... pozostałe parametry
});

// Stopniowo gromadzą się odsetki pożyczkowe w puli
// Adres wykonawczy dystrybuuje odsetki posiadaczom LP
await clammDistributeExcessAssetsSender({
  amountA: interestAmount,
  amountB: 0n,
  // ... pozostałe parametry
});

// Użytkownik wypłaca swój depozyt + zarobione odsetki
await clammRemoveLiquiditySender({
  lpTokensToSend: lpBalance,
  // ... pozostałe parametry
});
```

## Uwagi bezpieczeństwa

### Model zaufania

Pule stakingowe (B-ALGO, B-USDC, itp.) wymagają zaufania do specyficznych adresów i procesów:

1. **Kontrola adresu opłaty wykonawczej**: Tylko konto `addressExecutiveFee` skonfigurowane w Biatec Config Provider może dystrybuować nagrody przez `distributeExcessAssets`. Ten adres ma znaczną władzę:

   - Może dystrybuować nagrody wszystkim posiadaczom LP
   - Może wpływać na czasowanie dystrybucji nagród
   - Musi dokładnie kalkulować ilości nagród
   - **Zalecenie**: Użyj konta multi-signature dla tego adresu

2. **Integralność config providera**: Kontrakt config provider kontroluje krytyczne parametry:
   - Referencja identity providera
   - Struktura opłat
   - Adresy wykonawcze
   - **Zalecenie**: Zapewnij, aby config provider był immutable lub kontrolowany przez DAO

### Różnice od pul płynności

Pule stakingowe mają unikalne charakterystyki:

- **Brak impermanent loss**: Ponieważ oba aktywa są identyczne, nie ma ryzyka cenowego
- **Brak swap price discovery**: Nagrody pochodzą z zewnętrznych źródeł, nie z transakcji
- **Prostszy model cenowy**: Zawsze 1:1 w skali podstawowej
- **Stawka nagród zewnętrznie ustawiona**: Dochody zależą od dystrybucji nagród przez adres wykonawczy
- **Operacje swap zablokowane**: Kontrakt jawnie blokuje swapy z błędem "Swaps not allowed in staking pools"

### Czynniki ryzyka

1. **Brak nagród**: Jeśli nagrody nie są dystrybuowane zgodnie z oczekiwaniami, staking nie przynosi korzyści

   - Łagodzenie: Monitoruj aktywność adresu wykonawczego i plan dystrybucji nagród

2. **Błędy księgowe**: Nieprawidłowe wywołania `distributeExcessAssets` mogą zablokować środki lub dystrybuować niesprawiedliwie

   - Łagodzenie: Dokładnie testuj kalkulacje dystrybucji nagród off-chain najpierw
   - Łagodzenie: Użyj skali podstawowej (9 miejsc dziesiętnych) dla wszystkich kalkulacji

3. **Zmiany governance**: Zmiana adresu opłaty wykonawczej wpływa na kontrolę

   - Łagodzenie: Wymagaj timelock dla zmian adresów
   - Łagodzenie: Multi-sig governance dla aktualizacji config

4. **Walidacja cenowa**: Pule stakingowe wymagają `priceMin === priceMax === currentPrice`

   - Kontrakt teraz wymusza tę walidację w funkcji `bootstrap`
   - Kod błędu: `E_STAKING_PRICE` jeśli zakres cenowy nie jest płaski

5. **Walidacja kolejności aktywów**: Pule standardowe teraz wymuszają `assetA.id < assetB.id` dla pul non-staking
   - Pule stakingowe omijają tę kontrolę kiedy `assetA.id === assetB.id`
   - Kod błędu: `E_ASSET_ORDER` jeśli kolejność jest nieprawidłowa w pulach standardowych

### Sprawdzone praktyki dystrybucji nagród

1. **Kalkuluj w skali podstawowej**: Zawsze konwertuj ilości nagród do skali podstawowej (pomnóż przez 1e9) przed wywołaniem `distributeExcessAssets`
2. **Zweryfikuj bilans puli**: Zapewnij, że pula rzeczywiście otrzymała tokeny nagród przed dystrybucją
3. **Testuj najpierw**: Uruchom dystrybucję nagród na testnecie z małymi ilościami najpierw
4. **Dokumentuj plan**: Jasno komunikuj częstotliwość i ilości dystrybucji nagród
5. **Monitoruj stan**: Śledź płynność puli przed i po dystrybucji w celu weryfikacji poprawności

### Przykład bezpiecznej dystrybucji nagród

```typescript
// 1. Kalkuluj nagrodę w skali podstawowej
const rewardInTokenUnits = 1000n; // 1000 tokenów
const tokenDecimals = 6n; // USDC ma 6 miejsc dziesiętnych
const baseScale = 1_000_000_000n;
const rewardInBaseScale = rewardInTokenUnits * (baseScale / 10n ** tokenDecimals);

// 2. Najpierw wyślij tokeny do puli
await algod.sendPaymentTransaction({
  from: executiveAddress,
  to: poolAddress,
  amount: rewardInTokenUnits * 10n ** tokenDecimals, // W jednostkach natywnych
});

// 3. Dystrybuuj przez kontrakt
await clammDistributeExcessAssetsSender({
  appBiatecClammPool: poolAppId,
  appBiatecConfigProvider: configAppId,
  assetA: usdcAssetId,
  assetB: usdcAssetId,
  amountA: rewardInBaseScale,
  amountB: 0n,
  // ... pozostałe parametry
});
```

### Audyty bezpieczeństwa

Wykonano wiele audytów bezpieczeństwa opartych na AI dla implementacji pul stakingowych. Kluczowe ustalenia rozwiązane:

- **[M-02]** Dodano walidację dla zakresów cenowych pul same-asset (muszą być płaskie)
- **[M-06]** Zalecane dodanie dowodu depozytu do `distributeExcessAssets` dla bezpieczeństwa
- **Ogólne** Pule stakingowe są teraz jawnie walidowane podczas bootstrap

Zobacz folder `audits/` dla szczegółowych raportów audytów bezpieczeństwa.

### Ochrona użytkowników

1. **Kalkulacja nagród**: Metoda `distributeExcessAssets` zwiększa płynność puli proporcjonalnie. Zapewnij, że parametr `amountA` jest kalkulowany poprawnie w skali podstawowej (9 miejsc dziesiętnych).

2. **Stabilność cenowa**: Ponieważ pule stakingowe używają stosunku cenowego 1:1, cena powinna pozostać stała. Jakakolwiek znacząca odchylka może wskazywać na problem.

3. **Zaokrąglanie**: Podobnie jak w przypadku pul standardowych, małe ilości mogą być utracone przy zaokrąglaniu. Jest to zamierzone w celu ochrony puli przed krwawieniem.

## Testowanie

Zobacz `__test__/pool/staking.test.ts` dla kompleksowych przykładów testów włączając:

- Tworzenie puli B-ALGO
- Tworzenie puli B-TOKEN z ASA
- Dystrybucja nagród i weryfikacja zysku LP

## Konfiguracja specyficzna dla łańcucha

Różne sieci blockchain mogą używać różnych nazw tokenów natywnych:

- **Algorand Mainnet/Testnet**: 'ALGO'
- **Voi Network**: 'VOI'
- **Aramid Network**: 'ARAMID'

Użyj `setNativeTokenName` do skonfigurowania providera przed deployowaniem pul, aby zapewnić, że nazewnictwo tokenów LP odpowiada docelowej sieci.
