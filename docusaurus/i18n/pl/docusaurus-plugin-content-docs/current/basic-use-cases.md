# Podstawowe przypadki użycia Biatec CLAMM

Ten przewodnik przeprowadzi Cię przez codzienne przepływy obsługiwane przez Biatec skoncentrowaną płynność AMM (CLAMM). Skupia się na instancjonowaniu klientów, finansowaniu płynności w zakresie cenowym lub przy stałej cenie, usuwaniu płynności, wykonywaniu swapów i konsumowaniu feedu orakulum pool-provider. Zaawansowane tematy takie jak zachowanie zaokrąglania i specyficzne przepływy stakingowe są pokryte w istniejących dokumentach w `docs/`.

## Wymagania wstępne {#-wymagania-wstepne}

- Dostęp do sieci Algorand (Sandbox LocalNet, TestNet lub MainNet) i endpoint RPC `Algodv2`.
- Wdrożone instancje kontraktów Biatec config provider, identity provider i pool provider. Poniższe przykłady zakładają, że ich app ID są już znane.
- Zawsze potwierdź, że globalny stan pool-provider (`key = 'B'`) odpowiada config app ID, do którego odwołujesz się w jakiejkolwiek grupie deploy przed podpisaniem. Jeśli ID się różnią, przerwij transakcję, aby uniknąć interakcji z fałszywym configiem.
- Sfinansowane konto reprezentowane jako `Algokit` `TransactionSignerAccount` do podpisywania transakcji.
- Znajomość skali bazowej 1e9 (`SCALE = 1_000_000_000n`) używanej przez kontrakty. Zobacz `docs/liquidity-rounding.md` dla szczegółów precyzji.
- Opcjonalne, ale zalecane: użyj `getConfig(genesisId)` do pobrania najnowszych produkcyjnych app ID dla obsługiwanych sieci zamiast hardkodowania.

## Wspólne ustawienia {#-wspolne-ustawienia}

```typescript
import algosdk from 'algosdk';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { mnemonicToSecretKey } from 'algosdk';
import { clientBiatecClammPool, BiatecPoolProviderClient, getConfig } from 'biatec-concentrated-liquidity-amm';

const ALGOD_URL = 'http://localhost:4001';
const ALGOD_TOKEN = 'a'.repeat(64);
const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');

const algorand = AlgorandClient.fromConfig({ algod });

const { addr, sk } = mnemonicToSecretKey(process.env.MNEMONIC!);
const signerAccount = {
  addr,
  signer: async (txs: algosdk.Transaction[], indexes: number[]) => {
    const signed = txs.map((tx) => tx.signTxn(sk));
    return indexes.map((i) => signed[i]);
  },
};

const { configAppId: configProviderAppId, identityAppId: identityProviderAppId, poolProviderAppId } = getConfig('testnet-v1.0');
const poolProviderClient = new BiatecPoolProviderClient({
  algorand,
  appId: poolProviderAppId,
});

// Skieruj klienta CLAMM na istniejącą pulę, gdy znasz jej app ID.
const poolAppId = 45678n;
const poolClient = clientBiatecClammPool({
  algorand,
  appId: poolAppId,
});
```

> **Wskazówka:** Użyj helpera w `src/biatecClamm/getPools.ts` do odkrywania pul zarządzanych przez pool provider, gdy znasz tylko asset ID lub klasę weryfikacji.

## Tworzenie puli (zakres cenowy vs stała cena) {#-tworzenie-puli-zakres-cenowy-vs-stala-cena}

Tworzenie puli jest obsługiwane przez `clammCreateSender`. Przekaż `priceMin`, `priceMax` i `currentPrice` w skali bazowej (1e9). Ustawienie `priceMin === priceMax` przypina pulę do stałej ceny, co jest tym, jak tworzy się pule stakingowe.

```typescript
import { clammCreateSender } from 'biatec-concentrated-liquidity-amm';

const SCALE = 1_000_000_000n;

await poolProviderClient.send.setNativeTokenName({
  args: {
    appBiatecConfigProvider: configProviderAppId,
    nativeTokenName: 'Algo',
  },
  appReferences: [configProviderAppId],
});

const poolClient = await clammCreateSender({
  transactionSigner: signerAccount,
  clientBiatecPoolProvider: poolProviderClient,
  appBiatecConfigProvider: configProviderAppId,
  assetA: 9581n,
  assetB: 0n, // 0n wskazuje natywny token
  fee: 10_000_000n, // 1% opłata wyrażona w skali bazowej
  verificationClass: 0,
  priceMin: SCALE / 2n,
  priceMax: SCALE * 2n,
  currentPrice: SCALE,
});

// clammCreateSender automatycznie wywołuje bootstrapStep2, więc pula jest gotowa na depozyty.
```

Dla pul stakingowych o stałej cenie, ponownie użyj powyższego snippeta i ustaw `priceMin`, `priceMax` i `currentPrice` na tę samą wartość skali bazowej (zwykle `SCALE`). Zobacz `docs/staking-pools.md` dla dodatkowego prowadzenia specyficznego dla stakingu.

## Zapewnianie płynności {#-zapewnianie-plynności}

`clammAddLiquiditySender` opakowuje grupę transakcji potrzebną do depozytu obu aktywów i odniesienia do metadanych pool-provider.

```typescript
import { clammAddLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammAddLiquiditySender({
  clientBiatecClammPool: poolClient,
  clientBiatecPoolProvider: poolProviderClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  assetADeposit: 2_500_000n, // ilość w natywnych miejscach dziesiętnych aktywa
  assetBDeposit: 2_500_000n,
});
```

- Sender automatycznie optuje do tokenu LP, jeśli jest to konieczne.
- Wpłaty muszą respektować zakres cenowy puli. Podczas dodawania płynności do szerokiego zakresu, rozmiar obu wpłat zgodnie z proporcjami ujawnionymi przez kalkulatory off-chain w `contracts/clients/BiatecPoolProviderClient.ts` (zapytania `calculateAsset*`).
- Aby uzyskać szczegółowe oczekiwania dotyczące zaokrąglania, przeczytaj `docs/liquidity-rounding.md` i `docs/liquidity-fee-protection.md`.

## Wycofanie płynności {#-wycofanie-plynności}

`clammRemoveLiquiditySender` spala tokeny LP w zamian za aktywa bazowe plus nagromadzone opłaty.

```typescript
import { clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammRemoveLiquiditySender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  lpToSend: 3_000_000n,
});
```

Użyj pomocnika `clammRemoveLiquidityAdminSender`, jeśli potrzebujesz administracyjnego wycofania, które omija kontrole tożsamości (zarezerwowane dla przepływów zarządzania).

## Wymiana aktywów {#-wymiana-aktywow}

`clammSwapSender` wykonuje swap w obu kierunkach. Podaj aktywo, które wysyłasz, ilość oraz minimalną ilość, którą jesteś gotów przyjąć (po opłatach) w aktywie przeciwnym.

```typescript
import { clammSwapSender } from 'biatec-concentrated-liquidity-amm';

await clammSwapSender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  appBiatecPoolProvider: poolProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  fromAsset: 9581n,
  fromAmount: 10_000_000n,
  minimumToReceive: 9_800_000n,
});
```

Pomocnik swap dołącza referencje pool-provider i identity box automatycznie. Aby oszacować ilości wyjściowe przed wysłaniem swapu, wywołaj metody kalkulacyjne tylko do odczytu ujawnione na `BiatecPoolProviderClient` (na przykład `clientBiatecPoolProvider.getPrice` lub rodzinę metod `calculateAsset*`).

## Konsumpcja feedu orakulum pool-provider {#-konsumpcja-feedu-orakulum-pool-provider}

Biatec pool provider utrzymuje dane orakulum on-chain dla każdej pary aktywów. Wywołaj wygenerowaną metodę `getPrice` z `appPoolId = 0n`, aby uzyskać zagregowane metryki. Wartość zwrotna jest już zdekodowana do pól camelCase.

```typescript
const priceInfo = await poolProviderClient.appClient.getPrice({
  args: {
    assetA: 0n,
    assetB: 9581n,
    appPoolId: 0n, // zero => zagregowane przez wszystkie pule dla pary
  },
});

console.log('najnowsza cena (skala bazowa):', priceInfo.latestPrice);
console.log('period1 VWAP (skala bazowa):', priceInfo.period1NowVwap);
console.log('najnowszy opłata transakcyjna (aktywo A):', priceInfo.period1NowFeeA);
```

Gdy potrzebujesz danych orakulum specyficznych dla puli, przekaż CLAMM app ID jako `appPoolId` zamiast zera. Metoda zwraca tę samą strukturę `AppPoolInfo` w obu przypadkach.

## Dodatkowe operacje {#-dodatkowe-operacje}

- **Dystrybuować nagrody:** `clammDistributeExcessAssetsSender` przypisuje nagrody stakingowe lub opłaty posiadaczom LP. Ilości muszą być wyrażone w skali bazowej 1e9.
- **Wycofać opłaty protokołu:** `clammWithdrawExcessAssetsSender` umożliwia wykonawcy opłat uzyskanie nagromadzonego dochodu protokołu.
- **Przełączyć stan walidatora:** `clammSendOnlineKeyRegistrationSender` i `clammSendOfflineKeyRegistrationSender` opakowują przepływy rejestracji klucza AVM, gdy konto puli stakuje w sieciach konsensusu.
- **Odkrywanie puli i wycena:** `getPools` (z `src/biatecClamm/getPools.ts`) enumeruje rekordy rejestru; wygenerowany klient pool-provider ujawnia czyste funkcje do wymiarowania wpłat i wypłat (np. `calculateAssetADepositOnAssetBDeposit`).

## Zalecane czytanie {#-zalecane-czytanie}

- `docs/liquidity-rounding.md` dla zasad zaokrąglania i precyzji.
- `docs/liquidity-fee-protection.md` dla gwarancji rachunkowości opłat.
- `docs/staking-pools.md` dla scenariuszy stakingu o stałej cenie (te same aktywa).

Te bloki konstrukcyjne pokrywają standardową ścieżkę użytkownika: utwórz lub odkryj pulę, zapewnij płynność z właściwymi granicami cenowymi, zarabiaj opłaty, wykonaj swapy i polegaj na pool provider dla danych cenowych klasy orakulum.

## Wspólne ustawienia {#-wspolne-ustawienia}

```typescript
import algosdk from 'algosdk';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { mnemonicToSecretKey } from 'algosdk';
import { clientBiatecClammPool, BiatecPoolProviderClient, getConfig } from 'biatec-concentrated-liquidity-amm';

const ALGOD_URL = 'http://localhost:4001';
const ALGOD_TOKEN = 'a'.repeat(64);
const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');

const algorand = AlgorandClient.fromConfig({ algod });

const { addr, sk } = mnemonicToSecretKey(process.env.MNEMONIC!);
const signerAccount = {
  addr,
  signer: async (txs: algosdk.Transaction[], indexes: number[]) => {
    const signed = txs.map((tx) => tx.signTxn(sk));
    return indexes.map((i) => signed[i]);
  },
};

const { configAppId: configProviderAppId, identityAppId: identityProviderAppId, poolProviderAppId } = getConfig('testnet-v1.0');
const poolProviderClient = new BiatecPoolProviderClient({
  algorand,
  appId: poolProviderAppId,
});

// Skieruj klienta CLAMM na istniejącą pulę, gdy znasz jej app ID.
const poolAppId = 45678n;
const poolClient = clientBiatecClammPool({
  algorand,
  appId: poolAppId,
});
```

> **Wskazówka:** Użyj helpera w `src/biatecClamm/getPools.ts` do odkrywania pul zarządzanych przez pool provider, gdy znasz tylko asset ID lub klasę weryfikacji.

## Tworzenie puli (zakres cenowy vs stała cena) {#-tworzenie-puli-zakres-cenowy-vs-stala-cena}

Tworzenie puli jest obsługiwane przez `clammCreateSender`. Przekaż `priceMin`, `priceMax` i `currentPrice` w skali bazowej (1e9). Ustawienie `priceMin === priceMax` przypina pulę do stałej ceny, co jest tym, jak tworzy się pule stakingowe.

```typescript
import { clammCreateSender } from 'biatec-concentrated-liquidity-amm';

const SCALE = 1_000_000_000n;

await poolProviderClient.send.setNativeTokenName({
  args: {
    appBiatecConfigProvider: configProviderAppId,
    nativeTokenName: 'Algo',
  },
  appReferences: [configProviderAppId],
});

const poolClient = await clammCreateSender({
  transactionSigner: signerAccount,
  clientBiatecPoolProvider: poolProviderClient,
  appBiatecConfigProvider: configProviderAppId,
  assetA: 9581n,
  assetB: 0n, // 0n wskazuje natywny token
  fee: 10_000_000n, // 1% opłata wyrażona w skali bazowej
  verificationClass: 0,
  priceMin: SCALE / 2n,
  priceMax: SCALE * 2n,
  currentPrice: SCALE,
});

// clammCreateSender automatycznie wywołuje bootstrapStep2, więc pula jest gotowa na depozyty.
```

Dla pul stakingowych o stałej cenie, ponownie użyj powyższego snippeta i ustaw `priceMin`, `priceMax` i `currentPrice` na tę samą wartość skali bazowej (zwykle `SCALE`). Zobacz `docs/staking-pools.md` dla dodatkowego prowadzenia specyficznego dla stakingu.

## Zapewnianie płynności {#-zapewnianie-plynności}

`clammAddLiquiditySender` opakowuje grupę transakcji potrzebną do depozytu obu aktywów i odniesienia do metadanych pool-provider.

```typescript
import { clammAddLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammAddLiquiditySender({
  clientBiatecClammPool: poolClient,
  clientBiatecPoolProvider: poolProviderClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  assetADeposit: 2_500_000n, // ilość w natywnych miejscach dziesiętnych aktywa
  assetBDeposit: 2_500_000n,
});
```

- Sender automatycznie optuje do tokenu LP, jeśli jest to konieczne.
- Wpłaty muszą respektować zakres cenowy puli. Podczas dodawania płynności do szerokiego zakresu, rozmiar obu wpłat zgodnie z proporcjami ujawnionymi przez kalkulatory off-chain w `contracts/clients/BiatecPoolProviderClient.ts` (zapytania `calculateAsset*`).
- Aby uzyskać szczegółowe oczekiwania dotyczące zaokrąglania, przeczytaj `docs/liquidity-rounding.md` i `docs/liquidity-fee-protection.md`.

## Wycofanie płynności {#-wycofanie-plynności}

`clammRemoveLiquiditySender` spala tokeny LP w zamian za aktywa bazowe plus nagromadzone opłaty.

```typescript
import { clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammRemoveLiquiditySender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  lpToSend: 3_000_000n,
});
```

Użyj pomocnika `clammRemoveLiquidityAdminSender`, jeśli potrzebujesz administracyjnego wycofania, które omija kontrole tożsamości (zarezerwowane dla przepływów zarządzania).

## Wymiana aktywów {#-wymiana-aktywow}

`clammSwapSender` wykonuje swap w obu kierunkach. Podaj aktywo, które wysyłasz, ilość oraz minimalną ilość, którą jesteś gotów przyjąć (po opłatach) w aktywie przeciwnym.

```typescript
import { clammSwapSender } from 'biatec-concentrated-liquidity-amm';

await clammSwapSender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  appBiatecPoolProvider: poolProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  fromAsset: 9581n,
  fromAmount: 10_000_000n,
  minimumToReceive: 9_800_000n,
});
```

Pomocnik swap dołącza referencje pool-provider i identity box automatycznie. Aby oszacować ilości wyjściowe przed wysłaniem swapu, wywołaj metody kalkulacyjne tylko do odczytu ujawnione na `BiatecPoolProviderClient` (na przykład `clientBiatecPoolProvider.getPrice` lub rodzinę metod `calculateAsset*`).

## Konsumpcja feedu orakulum pool-provider {#-konsumpcja-feedu-orakulum-pool-provider}

Biatec pool provider utrzymuje dane orakulum on-chain dla każdej pary aktywów. Wywołaj wygenerowaną metodę `getPrice` z `appPoolId = 0n`, aby uzyskać zagregowane metryki. Wartość zwrotna jest już zdekodowana do pól camelCase.

```typescript
const priceInfo = await poolProviderClient.appClient.getPrice({
  args: {
    assetA: 0n,
    assetB: 9581n,
    appPoolId: 0n, // zero => zagregowane przez wszystkie pule dla pary
  },
});

console.log('najnowsza cena (skala bazowa):', priceInfo.latestPrice);
console.log('period1 VWAP (skala bazowa):', priceInfo.period1NowVwap);
console.log('najnowszy opłata transakcyjna (aktywo A):', priceInfo.period1NowFeeA);
```

Gdy potrzebujesz danych orakulum specyficznych dla puli, przekaż CLAMM app ID jako `appPoolId` zamiast zera. Metoda zwraca tę samą strukturę `AppPoolInfo` w obu przypadkach.

## Dodatkowe operacje {#-dodatkowe-operacje}

- **Dystrybuować nagrody:** `clammDistributeExcessAssetsSender` przypisuje nagrody stakingowe lub opłaty posiadaczom LP. Ilości muszą być wyrażone w skali bazowej 1e9.
- **Wycofać opłaty protokołu:** `clammWithdrawExcessAssetsSender` umożliwia wykonawcy opłat uzyskanie nagromadzonego dochodu protokołu.
- **Przełączyć stan walidatora:** `clammSendOnlineKeyRegistrationSender` i `clammSendOfflineKeyRegistrationSender` opakowują przepływy rejestracji klucza AVM, gdy konto puli stakuje w sieciach konsensusu.
- **Odkrywanie puli i wycena:** `getPools` (z `src/biatecClamm/getPools.ts`) enumeruje rekordy rejestru; wygenerowany klient pool-provider ujawnia czyste funkcje do wymiarowania wpłat i wypłat (np. `calculateAssetADepositOnAssetBDeposit`).

## Zalecane czytanie {#-zalecane-czytanie}

- `docs/liquidity-rounding.md` dla zasad zaokrąglania i precyzji.
- `docs/liquidity-fee-protection.md` dla gwarancji rachunkowości opłat.
- `docs/staking-pools.md` dla scenariuszy stakingu o stałej cenie (te same aktywa).

Te bloki konstrukcyjne pokrywają standardową ścieżkę użytkownika: utwórz lub odkryj pulę, zapewnij płynność z właściwymi granicami cenowymi, zarabiaj opłaty, wykonaj swapy i polegaj na pool provider dla danych cenowych klasy orakulum.

## Wspólne ustawienia {#-wspolne-ustawienia}

```typescript
import algosdk from 'algosdk';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { mnemonicToSecretKey } from 'algosdk';
import { clientBiatecClammPool, BiatecPoolProviderClient, getConfig } from 'biatec-concentrated-liquidity-amm';

const ALGOD_URL = 'http://localhost:4001';
const ALGOD_TOKEN = 'a'.repeat(64);
const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');

const algorand = AlgorandClient.fromConfig({ algod });

const { addr, sk } = mnemonicToSecretKey(process.env.MNEMONIC!);
const signerAccount = {
  addr,
  signer: async (txs: algosdk.Transaction[], indexes: number[]) => {
    const signed = txs.map((tx) => tx.signTxn(sk));
    return indexes.map((i) => signed[i]);
  },
};

const { configAppId: configProviderAppId, identityAppId: identityProviderAppId, poolProviderAppId } = getConfig('testnet-v1.0');
const poolProviderClient = new BiatecPoolProviderClient({
  algorand,
  appId: poolProviderAppId,
});

// Skieruj klienta CLAMM na istniejącą pulę, gdy znasz jej app ID.
const poolAppId = 45678n;
const poolClient = clientBiatecClammPool({
  algorand,
  appId: poolAppId,
});
```

> **Wskazówka:** Użyj helpera w `src/biatecClamm/getPools.ts` do odkrywania pul zarządzanych przez pool provider, gdy znasz tylko asset ID lub klasę weryfikacji.

## Tworzenie puli (zakres cenowy vs stała cena) {#-tworzenie-puli-zakres-cenowy-vs-stala-cena}

Tworzenie puli jest obsługiwane przez `clammCreateSender`. Przekaż `priceMin`, `priceMax` i `currentPrice` w skali bazowej (1e9). Ustawienie `priceMin === priceMax` przypina pulę do stałej ceny, co jest tym, jak tworzy się pule stakingowe.

```typescript
import { clammCreateSender } from 'biatec-concentrated-liquidity-amm';

const SCALE = 1_000_000_000n;

await poolProviderClient.send.setNativeTokenName({
  args: {
    appBiatecConfigProvider: configProviderAppId,
    nativeTokenName: 'Algo',
  },
  appReferences: [configProviderAppId],
});

const poolClient = await clammCreateSender({
  transactionSigner: signerAccount,
  clientBiatecPoolProvider: poolProviderClient,
  appBiatecConfigProvider: configProviderAppId,
  assetA: 9581n,
  assetB: 0n, // 0n wskazuje natywny token
  fee: 10_000_000n, // 1% opłata wyrażona w skali bazowej
  verificationClass: 0,
  priceMin: SCALE / 2n,
  priceMax: SCALE * 2n,
  currentPrice: SCALE,
});

// clammCreateSender automatycznie wywołuje bootstrapStep2, więc pula jest gotowa na depozyty.
```

Dla pul stakingowych o stałej cenie, ponownie użyj powyższego snippeta i ustaw `priceMin`, `priceMax` i `currentPrice` na tę samą wartość skali bazowej (zwykle `SCALE`). Zobacz `docs/staking-pools.md` dla dodatkowego prowadzenia specyficznego dla stakingu.

## Zapewnianie płynności {#-zapewnianie-plynności}

`clammAddLiquiditySender` opakowuje grupę transakcji potrzebną do depozytu obu aktywów i odniesienia do metadanych pool-provider.

```typescript
import { clammAddLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammAddLiquiditySender({
  clientBiatecClammPool: poolClient,
  clientBiatecPoolProvider: poolProviderClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  assetADeposit: 2_500_000n, // množstvo v natívnych desatinných miestach aktíva
  assetBDeposit: 2_500_000n,
});
```

- Sender automatycznie optuje do tokenu LP, jeśli jest to konieczne.
- Wpłaty muszą respektować zakres cenowy puli. Podczas dodawania płynności do szerokiego zakresu, rozmiar obu wpłat zgodnie z proporcjami ujawnionymi przez kalkulatory off-chain w `contracts/clients/BiatecPoolProviderClient.ts` (zapytania `calculateAsset*`).
- Aby uzyskać szczegółowe oczekiwania dotyczące zaokrąglania, przeczytaj `docs/liquidity-rounding.md` i `docs/liquidity-fee-protection.md`.

## Wycofanie płynności {#-wycofanie-plynności}

`clammRemoveLiquiditySender` spala tokeny LP w zamian za aktywa bazowe plus nagromadzone opłaty.

```typescript
import { clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammRemoveLiquiditySender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  lpToSend: 3_000_000n,
});
```

Użyj pomocnika `clammRemoveLiquidityAdminSender`, jeśli potrzebujesz administracyjnego wycofania, które omija kontrole tożsamości (zarezerwowane dla przepływów zarządzania).

## Wymiana aktywów {#-wymiana-aktywow}

`clammSwapSender` wykonuje swap w obu kierunkach. Podaj aktywo, które wysyłasz, ilość oraz minimalną ilość, którą jesteś gotów przyjąć (po opłatach) w aktywie przeciwnym.

```typescript
import { clammSwapSender } from 'biatec-concentrated-liquidity-amm';

await clammSwapSender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  appBiatecPoolProvider: poolProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  fromAsset: 9581n,
  fromAmount: 10_000_000n,
  minimumToReceive: 9_800_000n,
});
```

Pomocnik swap dołącza referencje pool-provider i identity box automatycznie. Aby oszacować ilości wyjściowe przed wysłaniem swapu, wywołaj metody kalkulacyjne tylko do odczytu ujawnione na `BiatecPoolProviderClient` (na przykład `clientBiatecPoolProvider.getPrice` lub rodzinę metod `calculateAsset*`).

## Konsumpcja feedu orakulum pool-provider {#-konsumpcja-feedu-orakulum-pool-provider}

Biatec pool provider utrzymuje dane orakulum on-chain dla każdej pary aktywów. Wywołaj wygenerowaną metodę `getPrice` z `appPoolId = 0n`, aby uzyskać zagregowane metryki. Wartość zwrotna jest już zdekodowana do pól camelCase.

```typescript
const priceInfo = await poolProviderClient.appClient.getPrice({
  args: {
    assetA: 0n,
    assetB: 9581n,
    appPoolId: 0n, // zero => zagregowane przez wszystkie pule dla pary
  },
});

console.log('najnowsza cena (skala bazowa):', priceInfo.latestPrice);
console.log('period1 VWAP (skala bazowa):', priceInfo.period1NowVwap);
console.log('najnowszy opłata transakcyjna (aktywo A):', priceInfo.period1NowFeeA);
```

Gdy potrzebujesz danych orakulum specyficznych dla puli, przekaż CLAMM app ID jako `appPoolId` zamiast zera. Metoda zwraca tę samą strukturę `AppPoolInfo` w obu przypadkach.

## Dodatkowe operacje {#-dodatkowe-operacje}

- **Dystrybuować nagrody:** `clammDistributeExcessAssetsSender` przypisuje nagrody stakingowe lub opłaty posiadaczom LP. Ilości muszą być wyrażone w skali bazowej 1e9.
- **Wycofać opłaty protokołu:** `clammWithdrawExcessAssetsSender` umożliwia wykonawcy opłat uzyskanie nagromadzonego dochodu protokołu.
- **Przełączyć stan walidatora:** `clammSendOnlineKeyRegistrationSender` i `clammSendOfflineKeyRegistrationSender` opakowują przepływy rejestracji klucza AVM, gdy konto puli stakuje w sieciach konsensusu.
- **Odkrywanie puli i wycena:** `getPools` (z `src/biatecClamm/getPools.ts`) enumeruje rekordy rejestru; wygenerowany klient pool-provider ujawnia czyste funkcje do wymiarowania wpłat i wypłat (np. `calculateAssetADepositOnAssetBDeposit`).

## Zalecane czytanie {#-zalecane-czytanie}

- `docs/liquidity-rounding.md` dla zasad zaokrąglania i precyzji.
- `docs/liquidity-fee-protection.md` dla gwarancji rachunkowości opłat.
- `docs/staking-pools.md` dla scenariuszy stakingu o stałej cenie (te same aktywa).

Te bloki konstrukcyjne pokrywają standardową ścieżkę użytkownika: utwórz lub odkryj pulę, zapewnij płynność z właściwymi granicami cenowymi, zarabiaj opłaty, wykonaj swapy i polegaj na pool provider dla danych cenowych klasy orakulum.
