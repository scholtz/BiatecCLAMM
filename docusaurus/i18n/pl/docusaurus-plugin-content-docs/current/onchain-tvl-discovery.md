# Odkrywanie pul on-chain na potrzeby niewymagającego zaufania (trustless) TVL

## Spis treści {#-table-of-contents}

- [Dlaczego nie wywołać po prostu API](#-why-not-just-call-an-api)
- [Krok 1: wyliczenie pul z boxów dostawcy pul](#-step-1-enumerate-pools)
- [Krok 2: odczytanie aktywa A / aktywa B puli z jej stanu globalnego](#-step-2-read-pool-assets)
- [Krok 3: zsumowanie rzeczywistych sald na potrzeby TVL](#-step-3-sum-balances)
- [Krok 4: wyrażenie TVL w USD przy użyciu 1-dniowego VWAP on-chain](#-step-4-usd-tvl)
- [Łączenie wszystkiego w całość](#-putting-it-together)
- [Identyfikatory aplikacji sieciowych (App ID)](#-network-app-ids)
- [Zastrzeżenia i uwagi](#-caveats)

:::caution Pary inne niż USD
Kroki 1–3 same w sobie dają wartość TVL **dla każdego aktywa z osobna**, a nie w USD. Pula pomiędzy dwoma aktywami innymi niż USD (np. GoldDAO / ALGO) wnosi surowe jednostki obu tych aktywów, a nie kwotę w dolarach. [Krok 4](#-step-4-usd-tvl) opisuje przeliczanie tych sald na USD za pomocą własnych cen VWAP on-chain dostawcy pul, łącząc ścieżki przez ALGO lub — gdy dany token nie jest sparowany również z ALGO — przez własny token Biatec VoteCoin (`VOTE`) jako drugie aktywo pomostowe (bridge asset).
:::

## Dlaczego nie wywołać po prostu API {#-why-not-just-call-an-api}

Każda pula Biatec CLAMM jest tworzona za pośrednictwem pojedynczej aplikacji `BiatecPoolProvider` i w niej się rejestruje. Aplikacja ta przechowuje box dla każdej puli, jaką kiedykolwiek utworzyła, a sama **nazwa** boxa (nie tylko jego wartość) stanowi zakodowany w ABI rekord zawierający identyfikator aplikacji puli (`appId`), jej dwa aktywa, granice cenowe, opłatę oraz identyfikator tokenu LP.

Ponieważ rekord ten znajduje się w boxie aplikacji, którą każdy może odpytać, obliczenie TVL nie wymaga zaufania do hostowanego przez Biatec API ani indeksatora: sam węzeł `algod` wystarczy, aby:

1. wylistować każdą pulę, jaką protokół kiedykolwiek wdrożył, oraz
2. odczytać aktywo A / aktywo B każdej puli (wraz z ich rzeczywistymi saldami on-chain).

Niniejsza strona dokumentuje dokładny układ boxów oraz klucze stanu globalnego niezbędne do wykonania tych operacji, wykorzystując dostarczane w tym repozytorium funkcje pomocnicze TypeScript (`src/biatecClamm/getPools.ts`) jako implementację referencyjną. Ten sam układ można zdekodować za pomocą dowolnego SDK potrafiącego odczytywać boxy i stan aplikacji — `py-algorand-sdk`, `go-algorand-sdk` lub surowych wywołań REST `algod`.

## Krok 1: wyliczenie pul z boxów dostawcy pul {#-step-1-enumerate-pools}

Kontrakt `BiatecPoolProvider` (`contracts/BiatecPoolProvider.algo.ts`) deklaruje kilka map `BoxMap` z różnymi prefiksami:

```ts
pools = BoxMap<uint64, AppPoolInfo>({ prefix: 'p' });
poolsByConfig = BoxMap<PoolConfig, uint64>({ prefix: 'pc' });
fullConfigs = BoxMap<FullConfig, uint64>({ prefix: 'fc' });
poolsAggregated = BoxMap<AssetsCombined, AppPoolInfo>({ prefix: 's' });
```

Mapą kluczową dla odkrywania pul jest `fullConfigs`, oznaczona prefiksem `"fc"`. Za każdym razem, gdy tworzona jest pula, metoda `registerPool()` zapisuje jeden box na pulę:

```ts
const fullConfig: FullConfig = {
  appId: appClammPool.id,
  assetA: assetA.id,
  assetB: assetB.id,
  lpTokenId: lpToken,
  min: pMin,
  max: pMax,
  fee: fee,
  verificationClass: verificationClass as uint8,
};
this.fullConfigs(fullConfig).value = appClammPool.id;
```

TEALScript koduje całą strukturę `FullConfig` w **nazwie boxa**, dzięki czemu sama nazwa boxa niesie wszystkie informacje potrzebne do wyliczenia pul — wartości boxa (czyli ponownie `appId`) nie trzeba nawet odczytywać. Każda nazwa boxa `fc` ma dokładnie 59 bajtów:

| bajty | pole | typ |
|---|---|---|
| 0–1 | prefiks `"fc"` (ASCII) | 2 bajty |
| 2–9 | `appId` | uint64, big-endian |
| 10–17 | `assetA` | uint64 |
| 18–25 | `assetB` | uint64 |
| 26–33 | `min` (dolna granica ceny) | uint64 |
| 34–41 | `max` (górna granica ceny) | uint64 |
| 42–49 | `fee` | uint64 |
| 50–57 | `lpTokenId` | uint64 |
| 58 | `verificationClass` | uint8 (1 bajt) |

Wylistowanie i przefiltrowanie tych boxów wymaga pojedynczego wywołania `algod` — bez indeksatora i bez zewnętrznego API:

```ts
import algosdk, { Algodv2 } from 'algosdk';

interface FullConfig {
  appId: bigint;
  assetA: bigint;
  assetB: bigint;
  min: bigint;
  max: bigint;
  fee: bigint;
  lpTokenId: bigint;
  verificationClass: bigint;
}

async function getPools(algod: Algodv2, poolProviderAppId: number | bigint): Promise<FullConfig[]> {
  const ret: FullConfig[] = [];
  const { boxes } = await algod.getApplicationBoxes(poolProviderAppId).do();

  for (const box of boxes) {
    if (box.name.length !== 59) continue;
    if (Buffer.from(box.name.subarray(0, 2)).toString('ascii') !== 'fc') continue;

    ret.push({
      appId: BigInt(algosdk.decodeUint64(box.name.subarray(2, 10))),
      assetA: BigInt(algosdk.decodeUint64(box.name.subarray(10, 18))),
      assetB: BigInt(algosdk.decodeUint64(box.name.subarray(18, 26))),
      min: BigInt(algosdk.decodeUint64(box.name.subarray(26, 34))),
      max: BigInt(algosdk.decodeUint64(box.name.subarray(34, 42))),
      fee: BigInt(algosdk.decodeUint64(box.name.subarray(42, 50))),
      lpTokenId: BigInt(algosdk.decodeUint64(box.name.subarray(50, 58))),
      verificationClass: BigInt(box.name[58]),
    });
  }
  return ret;
}
```

Jest to lekko rozwinięta wersja funkcji pomocniczej dostarczanej i eksportowanej przez to repozytorium: [`src/biatecClamm/getPools.ts`](https://github.com/scholtz/BiatecCLAMM/blob/main/src/biatecClamm/getPools.ts). Ponieważ pola `assetA` / `assetB` / `min` / `max` / `fee` / `lpTokenId` / `verificationClass` znajdują się już w nazwie boxa, to jedno wywołanie wystarcza do pobrania `appId` każdej puli **oraz** identyfikatorów jej dwóch aktywów — odczytywanie własnego stanu globalnego każdej puli (krok 2) jest potrzebne jedynie jako niezależne sprawdzenie krzyżowe lub wtedy, gdy nie ufasz księgowości dostawcy pul.

Metoda `algod.getApplicationBoxes` zwraca wyłącznie *nazwy* boxów i domyślnie ogranicza liczbę boxów zwracanych w jednym wywołaniu — w przypadku dostawców pul z dużą liczbą pul należy stronicować wyniki (SDK JS udostępnia parametr `max`, a punkt końcowy REST kursor `next`), zamiast zakładać, że jedno wywołanie zwróci wszystko.

## Krok 2: odczytanie aktywa A / aktywa B puli z jej stanu globalnego {#-step-2-read-pool-assets}

Każda aplikacja `BiatecClammPool` (`contracts/BiatecClammPool.algo.ts`) przechowuje swoje dwa aktywa w jednoznakowych kluczach stanu globalnego:

```ts
assetA = GlobalStateKey<uint64>({ key: 'a' });
assetB = GlobalStateKey<uint64>({ key: 'b' });
assetABalanceBaseScale = GlobalStateKey<uint256>({ key: 'ab' });
assetBBalanceBaseScale = GlobalStateKey<uint256>({ key: 'bb' });
```

W łańcuchu `algod` zwraca klucze stanu globalnego zakodowane w base64. Wygenerowana specyfikacja ARC-56 (`contracts/artifacts/BiatecClammPool.arc56.json`) potwierdza dokładne kodowanie:

```json
"assetA": { "key": "YQ==", "keyType": "AVMBytes", "valueType": "uint64" },
"assetB": { "key": "Yg==", "keyType": "AVMBytes", "valueType": "uint64" }
```

`YQ==` to `base64("a")`, a `Yg==` to `base64("b")`. Odczytanie aktywów puli wyłącznie za pomocą `algod.getApplicationByID` wygląda więc następująco:

```ts
async function getPoolAssets(algod: Algodv2, poolAppId: number | bigint) {
  const app = await algod.getApplicationByID(poolAppId).do();
  const kv = app.params['global-state'] as { key: string; value: { uint: number; bytes: string; type: number } }[];

  const byKey = Object.fromEntries(kv.map((e) => [e.key, e.value]));
  const assetA = BigInt(byKey['YQ=='].uint); // base64("a")
  const assetB = BigInt(byKey['Yg=='].uint); // base64("b")
  return { assetA, assetB };
}
```

Ponieważ wartości te były już obecne w nazwie boxa `fc` z kroku 1, większość wywołujących może całkowicie pominąć ten krok i zaufać rejestracji u dostawcy pul — krok ten jest potrzebny tylko wtedy, gdy chcesz niezależnie zweryfikować dane dostawcy względem własnego stanu każdej puli.

## Krok 3: zsumowanie rzeczywistych sald na potrzeby TVL {#-step-3-sum-balances}

Gdy znasz już `appId` puli oraz identyfikatory jej dwóch aktywów, wartość TVL powinna pochodzić z **rzeczywistych sald on-chain** puli, a nie z wewnętrznych zmiennych księgowych, tak aby żaden błąd ani nieuzgodniony przypadek brzegowy w kontrakcie nie mógł po cichu zafałszować wyniku. Każda aplikacja `BiatecClammPool` posiada własne konto (swój adres aplikacji), na którym przechowuje rzeczywiste rezerwy ASA/ALGO:

```ts
async function getPoolBalances(algod: Algodv2, poolAppId: number | bigint) {
  const poolAddress = algosdk.getApplicationAddress(poolAppId);
  const info = await algod.accountInformation(poolAddress).do();

  const balanceOf = (assetId: bigint) => {
    if (assetId === 0n) return BigInt(info.amount); // ALGO
    const holding = (info.assets as { 'asset-id': number; amount: number }[]).find(
      (a) => BigInt(a['asset-id']) === assetId
    );
    return holding ? BigInt(holding.amount) : 0n;
  };

  return balanceOf;
}
```

Wymaga to jednego wywołania `algod.accountInformation` na pulę — ponownie bez indeksatora i bez API. Zsumowanie `balanceOf(assetA)` oraz `balanceOf(assetB)` (przeliczonych na wspólną jednostkę za pomocą źródła cen) dla wszystkich pul z kroku 1 daje wartość TVL wyprowadzoną w całości z odczytów on-chain.

Alternatywą pozwalającą uniknąć dodatkowego zapytania o konto jest odczytanie kluczy stanu globalnego `assetABalanceBaseScale` / `assetBBalanceBaseScale` (`"ab"` / `"bb"`, w base64 `"YWI="` / `"YmI="`) samej puli — są to te same rezerwy przeskalowane do stałej bazy, zapisane jako `uint256`. W stanie ustalonym odpowiadają one rzeczywistym zasobom ASA/ALGO konta; saldo konta jest jednak bezpieczniejszym wyborem dla TVL, ponieważ reprezentuje fizyczne aktywa przechowywane przez pulę, niezależnie od wewnętrznej księgowości kontraktu.

## Krok 4: wyrażenie TVL w USD przy użyciu 1-dniowego VWAP on-chain {#-step-4-usd-tvl}

Zsumowanie surowych sald aktywów (krok 3) daje TVL denominowane w każdym aktywie z osobna, co nie wystarcza do uzyskania jednej kwoty w USD; błędem byłoby też założenie, że każda pula jest sparowana ze stablecoinem — większość nie jest. Dostawca pul śledzi ważoną wolumenem cenę VWAP dla każdej **pary** aktywów, na której kiedykolwiek odbył się swap (niezależnie od konkretnej puli), w mapie boxów `poolsAggregated` (prefiks `'s'`). Box ten doskonale nadaje się do wyceny sald innych niż USD, ponieważ pochodzi z tego samego źródła on-chain co same salda — bez zewnętrznego źródła cen ani API.

### Box `poolsAggregated`

Nazwa boxa: 1-bajtowy prefiks `'s'` + 16-bajtowy klucz `AssetsCombined` zakodowany w ABI:

| bajty | pole | typ |
|---|---|---|
| 0 | prefiks `"s"` (ASCII) | 1 bajt |
| 1–8 | `assetA` | uint64, big-endian |
| 9–16 | `assetB` | uint64, big-endian |

Kolejność `assetA` i `assetB` odpowiada kolejności, w jakiej para została zarejestrowana (zobacz komentarz dokumentacyjny `getPrice()` oraz instrukcje `assert` w `updatePriceBoxAggregated` w pliku `contracts/BiatecPoolProvider.algo.ts`).

Wartością boxa jest struktura `AppPoolInfo`. Pola istotne dla wyceny to:

```ts
type AppPoolInfo = {
  assetA: uint64;
  assetB: uint64;
  verificationClass: uint64;
  latestPrice: uint64;

  period1Duration: uint64; // 60 (sekund)
  period1NowVolumeA: uint64;
  period1NowVolumeB: uint64;
  period1NowVWAP: uint64;
  period1NowTime: uint64;
  period1PrevVolumeA: uint64;
  period1PrevVolumeB: uint64;
  period1PrevVWAP: uint64;
  period1PrevTime: uint64;
  // ...period1NowFeeA/B, period1PrevFeeA/B pominięto dla zwięzłości

  period2Duration: uint64; // 3600 * 24 = 1 dzień  <-- ten przedział należy wykorzystać do TVL
  period2NowVolumeA: uint64;
  period2NowVolumeB: uint64;
  period2NowVWAP: uint64;
  period2NowTime: uint64;
  period2PrevVolumeA: uint64;
  period2PrevVolumeB: uint64;
  period2PrevVWAP: uint64;
  period2PrevTime: uint64;

  // period3* (1 tydzień) oraz period4* (1 rok) mają identyczną strukturę
};
```

Kontrakt utrzymuje 4 równoległe przedziały czasowe dla każdej pary — 60 sekund (`period1`), **1 dzień** (`period2`), 1 tydzień (`period3`) oraz 1 rok (`period4`) — z których każdy dzieli się na kubełek `Now` (nadal akumulujący) oraz kubełek `Prev` (ostatni w pełni zamknięty kubełek danego rozmiaru). `periodNNowVWAP` to bieżąca, ważona wolumenem aktywa B średnia ze średniej ceny swapu `(priceFrom + priceTo) / 2` wewnątrz bieżącego kubełka; kubełki przełączają się (`Now` → `Prev`, wyzerowanie `Now`) w chwili zmiany `floor(timestamp / periodDuration)`, tzn. są wyrównane do epok czasowych, a nie kroczące. Oznacza to, że **samo `period2NowVWAP` nie oddaje pełnej średniej z ostatnich 24 godzin**, gdy bieżąca doba UTC dopiero się rozpoczęła — tuż po północy może odzwierciedlać zaledwie kilka minut handlu. Do celów księgowych należy połączyć (blendować) `Now` z końcówką `Prev`, tak aby wynik zawsze obejmował pełne kroczące 24-godzinne okno:

```ts
function trailing1DayVwap(info: AppPoolInfo, nowSeconds: bigint): bigint {
  const duration = info.period2Duration; // 86400
  const elapsedInNow = nowSeconds - info.period2NowTime; // sekundy, które upłynęły w dzisiejszym kubełku
  const remainingFromPrev = duration - elapsedInNow; // sekundy nadal "należne" z wczoraj

  if (remainingFromPrev <= 0n || info.period2PrevVolumeB === 0n) {
    // dzisiejszy kubełek sam obejmuje już (lub przekracza) pełną dobę albo brak wcześniejszych danych
    return info.period2NowVWAP;
  }

  // przeważ wolumen Prev ułamkiem kroczącego 24-godzinnego okna, który nadal pokrywa
  const prevWeight = (info.period2PrevVolumeB * remainingFromPrev) / duration;
  const nowWeight = info.period2NowVolumeB;

  if (nowWeight + prevWeight === 0n) return info.period2PrevVWAP; // brak jakichkolwiek transakcji dzisiaj

  return (info.period2NowVWAP * nowWeight + info.period2PrevVWAP * prevWeight) / (nowWeight + prevWeight);
}
```

W ten sposób VWAP każdego kubełka jest ważony tym, jaką część kroczącego 24-godzinnego okna faktycznie reprezentuje — krótko po północy w mieszance dominuje `Prev` (zgodnie z intuicją, bo niemal całe ostatnie 24 godziny należą do wczorajszego kubełka); po upływie pełnej doby wewnątrz `Now` udział `Prev` naturalnie spada do zera. Kontrakt nie udostępnia metody on-chain zwracającej tę uśrednioną wartość — `getPrice()` zwraca jedynie surowy box — dlatego łączenie to należy wykonać off-chain, raz dla każdej pary podczas odczytu.

Odczytanie ceny pary za pomocą samego `algod`:

```ts
function getAggregatedPriceBoxName(assetA: bigint, assetB: bigint): Uint8Array {
  if (assetA >= assetB) throw new Error('assetA must be the lower asset id');
  const name = new Uint8Array(17);
  name.set(Buffer.from('s', 'ascii'), 0);
  name.set(algosdk.encodeUint64(assetA), 1);
  name.set(algosdk.encodeUint64(assetB), 9);
  return name;
}

async function getPairVwap(algod: Algodv2, poolProviderAppId: number | bigint, assetA: bigint, assetB: bigint) {
  const boxName = getAggregatedPriceBoxName(assetA, assetB);
  const box = await algod.getApplicationBoxByName(poolProviderAppId, boxName).do();
  const info = decodeAppPoolInfo(box.value); // dekodowanie ABI zgodnie z contracts/artifacts/BiatecPoolProvider.arc56.json
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  return trailing1DayVwap(info, nowSeconds);
}
```

(`decodeAppPoolInfo` to proste dekodowanie krotki ABI zgodnie z kolejnością pól w `contracts/artifacts/BiatecPoolProvider.arc56.json`; wygenerowany klient `BiatecPoolProviderClient` udostępnia w tym celu typ ABI `AppPoolInfo`.)

### Łączenie przez aktywo pomostowe (bridge asset), gdy brak bezpośredniej pary z USD

Większość par Biatec nie jest notowana bezpośrednio względem stablecoina USD, a nie każdy token jest sparowany również z ALGO — wiele tokenów posiada pule wyłącznie względem własnego tokenu zarządzania Biatec, VoteCoin (mainnet asset ID `452399768`, zobacz `voteAssetId` w `.env.example`). Sam `VOTE` charakteryzuje się głęboką, aktywnie handlowaną płynnością (stanowi połowę aktywów w routingu opłat protokołu Biatec i występuje jako aktywo bazowe w dużej części pul wymienionych w dokumencie [Naprawa działających pul po poprawce mintowania LP](./live-pool-reconciliation)), co czyni go drugim naturalnym aktywem pomostowym obok ALGO dla tokenów nieposiadających bezpośredniej ścieżki do USD ani ALGO.

Aby wycenić dowolne aktywo w USD, wypróbuj ścieżki w poniższej kolejności, wybierając pierwszą, która zostanie rozwiązana:

1. **Bezpośrednia**: `(asset, usdAssetId)` lub `(usdAssetId, asset)` — jeśli ten box istnieje, jego kroczący 1-dniowy VWAP jest już ceną w USD, przy czym należy pamiętać o jej odwróceniu (`1 / vwap`), gdy aktywo USD występuje jako `assetA` (VWAP jest wyrażany jako B/A zgodnie z konwencją puli).
2. **Przez ALGO**: `asset ↔ ALGO` połączone z `ALGO ↔ usdAssetId`:
   `priceInUsd = priceInAlgo * algoPriceInUsd`.
3. **Przez VoteCoin**: `asset ↔ VOTE` połączone z `VOTE ↔ usdAssetId` (wyszukiwane tak samo jak bezpośrednia ścieżka USD — jeśli sam VoteCoin nie ma bezpośredniej pary z USD, wyznacz najpierw `voteInUsd` przez jego własną ścieżkę ALGO: `VOTE ↔ ALGO` połączone z `ALGO ↔ usdAssetId`).

Pojedyncza lista aktywów pomostowych pozwala zachować ogólność rozwiązania zamiast zaszywania dwóch osobnych ścieżek w kodzie:

```ts
async function getUsdPrice(
  algod: Algodv2,
  poolProviderAppId: number | bigint,
  assetId: bigint,
  usdAssetId: bigint,
  bridgeAssetIds: bigint[] = [0n, 452399768n] // ALGO, następnie VoteCoin (mainnet asset id)
): Promise<bigint | undefined> {
  if (assetId === usdAssetId) return 1n; // już w USD

  const direct = await tryGetPairVwap(algod, poolProviderAppId, assetId, usdAssetId);
  if (direct !== undefined) return direct;

  for (const bridgeAssetId of bridgeAssetIds) {
    if (bridgeAssetId === assetId) continue; // aktywo samo jest aktywem pomostowym, pomiń ścieżkę do samego siebie

    const assetInBridge = await tryGetPairVwap(algod, poolProviderAppId, assetId, bridgeAssetId);
    if (assetInBridge === undefined) continue; // brak pary z tym aktywem pomostowym, wypróbuj kolejne

    // rozwiąż rekurencyjnie cenę USD samego aktywa pomostowego (obsługuje np. VOTE -> ALGO -> USD)
    const bridgeInUsd = await getUsdPrice(algod, poolProviderAppId, bridgeAssetId, usdAssetId, bridgeAssetIds);
    if (bridgeInUsd === undefined) continue;

    return assetInBridge * bridgeInUsd; // dostosuj do skali dziesiętnej każdego aktywa przed połączeniem
  }

  return undefined; // nie znaleziono ścieżki do USD przez żadne skonfigurowane aktywo pomostowe
}
```

`tryGetPairVwap` to powyższa funkcja `getPairVwap` opakowana tak, aby zwracała `undefined` zamiast rzucać wyjątek, gdy `poolsAggregated(...).exists` ma wartość false dla danej pary (brak boxa → brak zarejestrowanych transakcji, więc nie można użyć tej ścieżki). ALGO (asset ID `0`) jest natywnym aktywem sieci i występuje w `AssetsCombined` tak jak każde ASA; identyfikator aktywa VoteCoin zależy od protokołu i sieci (w pliku `.env.example` tego repozytorium udokumentowano tylko identyfikator mainnetowy `452399768` — przed użyciem tej listy na testnecie lub w sieci Voi należy potwierdzić właściwy identyfikator VOTE). W repozytorium nie ma też na stałe zaszytego identyfikatora aktywa referencyjnego USD, należy więc wybrać odpowiednie ASA powiązane z USD (np. identyfikator USDC w danej sieci) i przekazać je jawnie jako `usdAssetId`. Listę `bridgeAssetIds` można rozszerzyć o dowolne inne aktywo o trwale głębokiej płynności, które w danym wdrożeniu pełni rolę hubu wyceny.

Rzeczywiste wartości VWAP są liczbami całkowitymi przeskalowanymi w skali bazowej (`1e9`), dlatego przed pomnożeniem `assetInAlgo * algoPriceInUsd` lub pomnożeniem przez saldo z kroku 3 należy znormalizować oba operandy do tej samej bazy dziesiętnej przy użyciu znanej liczby `decimals` każdego aktywa (z `algod.getAssetByID`).

## Łączenie wszystkiego w całość {#-putting-it-together}

```ts
const algod = new algosdk.Algodv2(token, server, port);
const poolProviderAppId = 3074197785n; // mainnet, zobacz poniżej
const usdAssetId = 31566704n; // np. USDC na mainnecie — wybierz swoje ASA powiązane z USD

const pools = await getPools(algod, poolProviderAppId);

let tvlByAsset = new Map<bigint, bigint>();
for (const pool of pools) {
  const balanceOf = await getPoolBalances(algod, pool.appId);
  for (const assetId of [pool.assetA, pool.assetB]) {
    tvlByAsset.set(assetId, (tvlByAsset.get(assetId) ?? 0n) + balanceOf(assetId));
  }
}

let tvlUsd = 0;
for (const [assetId, balance] of tvlByAsset) {
  const priceUsd = await getUsdPrice(algod, poolProviderAppId, assetId, usdAssetId);
  if (priceUsd === undefined) continue; // nie znaleziono ścieżki USD dla tego aktywa — zaraportuj osobno
  tvlUsd += Number(balance) * Number(priceUsd); // znormalizuj miejsca dziesiętne przed mnożeniem, zobacz wyżej
}
```

Mapa `tvlByAsset` zawiera dla każdego identyfikatora aktywa sumę jego rzeczywistych sald we wszystkich pulach zarejestrowanych kiedykolwiek w protokole, a `tvlUsd` to ta sama wartość przeliczona na USD wyłącznie na podstawie danych VWAP on-chain — obliczona przy użyciu samych wywołań `algod` skierowanych do dostawcy pul oraz kont aplikacji poszczególnych pul.

## Identyfikatory aplikacji sieciowych (App ID) {#-network-app-ids}

Identyfikator aplikacji dostawcy pul dla poszczególnych sieci znajduje się w pliku [`src/getConfig.ts`](https://github.com/scholtz/BiatecCLAMM/blob/main/src/getConfig.ts):

| Sieć (`genesisId`) | App ID dostawcy pul |
|---|---|
| `mainnet-v1.0` | `3074197785` |
| `testnet-v1.0` | `741107916` |
| `voimain-v1.0` | `40133595` |

## Zastrzeżenia i uwagi {#-caveats}

- Nazwa boxa `fc` jest zapisywana jednorazowo podczas tworzenia puli i nigdy później nie ulega zmianie — można ją bezpiecznie traktować jako niemutowalną dla danej puli i buforować wyniki według `appId`.
- Identyfikator tokenu LP oraz opłata puli są również osadzone w nazwie boxa `fc`, dzięki czemu panel TVL może je wyświetlać bez dodatkowych odczytów.
- Boxy `poolsAggregated` istnieją tylko dla par aktywów, na których faktycznie odbyła się co najmniej jedna transakcja; zupełnie nowa pula bez żadnych swapów nie posiada ścieżki cenowej aż do pierwszego handlu. Brakujący box należy traktować jako „brak dostępnej ceny USD”, a nie jako błąd.
- Pola `period2NowVWAP`/`period2PrevVWAP` odzwierciedlają ceny transakcyjne, a nie głębokość płynności — dla bardzo rzadko handlowanej pary wartość VWAP może być nieaktualna lub łatwa do przesunięcia niewielką transakcją. Warto rozważyć wykluczenie lub osobne oznaczenie aktywów, których jedyna ścieżka cenowa ma bardzo niski wolumen `period2NowVolumeB` / `period2PrevVolumeB`.
- Przedstawiona w tym dokumencie logika łączenia VWAP stanowi wskazówkę off-chain wynikającą z analizy kontraktu; sam kontrakt udostępnia przez `getPrice()` jedynie surowe kubełki `Now`/`Prev`, dlatego dwaj integratorzy muszą stosować ten sam wzór łączenia, aby uzyskać porównywalne wartości TVL.
- Zobacz dokument [Naprawa działających pul po poprawce mintowania LP](./live-pool-reconciliation), w którym znajduje się praktyczny przykład (`scripts/survey-orphaned-liquidity.ts`) przeglądający wszystkie pule mainnetowe za pośrednictwem dostawcy pul i weryfikujący wewnętrzną księgowość płynności każdej z nich — przy użyciu dokładnie tej samej techniki wyliczania boxów, którą opisano tutaj.
