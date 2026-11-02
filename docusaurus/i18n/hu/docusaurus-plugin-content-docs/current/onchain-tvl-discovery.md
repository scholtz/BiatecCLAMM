# Poolok on-chain felderítése bizalommentes (trustless) TVL számításhoz

## Tartalomjegyzék {#-table-of-contents}

- [Miért ne hívjunk egyszerűen egy API-t](#-why-not-just-call-an-api)
- [1. lépés: poolok felsorolása a pool szolgáltató boxaiból](#-step-1-enumerate-pools)
- [2. lépés: a pool A / B eszközének kiolvasása a globális állapotból](#-step-2-read-pool-assets)
- [3. lépés: a valós egyenlegek összegzése a TVL-hez](#-step-3-sum-balances)
- [4. lépés: a TVL kifejezése USD-ben az on-chain 1 napos VWAP segítségével](#-step-4-usd-tvl)
- [Összerakva az egészet](#-putting-it-together)
- [Hálózati alkalmazásazonosítók (App ID-k)](#-network-app-ids)
- [Fontos szempontok és korlátok](#-caveats)

:::caution Nem USD párok
Az 1–3. lépések önmagukban **eszközönként** adják meg a TVL-t, nem pedig USD-ben. Egy két nem-USD eszköz közötti pool (pl. GoldDAO / ALGO) mindkét eszköz nyers egységeivel járul hozzá az összeghez, nem dollárértékkel. A [4. lépés](#-step-4-usd-tvl) bemutatja, hogyan válthatók át ezek az egyenlegek USD-re a pool szolgáltató saját on-chain VWAP árai alapján, ALGO-n keresztül láncolva, vagy — ha egy token nincs ALGO-val sem párban — a Biatec saját VoteCoin (`VOTE`) tokenjén, mint második hídeszközön keresztül.
:::

## Miért ne hívjunk egyszerűen egy API-t {#-why-not-just-call-an-api}

Minden Biatec CLAMM pool egyetlen `BiatecPoolProvider` alkalmazáson keresztül jön létre, és abban regisztrálja magát. Ez az alkalmazás minden általa valaha létrehozott poolhoz fenntart egy boxot, és már maga a box **neve** (nem csupán az értéke) ABI-kódolt rekordként tartalmazza a pool alkalmazásazonosítóját (`appId`), két eszközét, ársáv-határait, díját és LP token azonosítóját.

Mivel ez a rekord egy bárki által lekérdezhető alkalmazás boxában él, a TVL kiszámításához nem kell megbízni egy Biatec által üzemeltetett API-ban vagy indexerben: egyetlen `algod` kapcsolat önmagában elegendő ahhoz, hogy:

1. kilistázza a protokoll által valaha telepített összes poolt, és
2. kiolvassa minden pool A / B eszközét (valamint azok valós, on-chain egyenlegeit).

Ez az oldal dokumentálja az ehhez szükséges pontos box-elrendezést és globális állapotkulcsokat, referenciamegvalósításként a repozitórium által szállított TypeScript segédfüggvényekkel (`src/biatecClamm/getPools.ts`). Ugyanez az elrendezés bármely olyan SDK-val dekódolható, amely képes boxokat és alkalmazásállapotot olvasni — `py-algorand-sdk`, `go-algorand-sdk` vagy nyers `algod` REST hívások segítségével.

## 1. lépés: poolok felsorolása a pool szolgáltató boxaiból {#-step-1-enumerate-pools}

A `BiatecPoolProvider` (`contracts/BiatecPoolProvider.algo.ts`) több, különböző előtaggal ellátott `BoxMap` tárolót deklarál:

```ts
pools = BoxMap<uint64, AppPoolInfo>({ prefix: 'p' });
poolsByConfig = BoxMap<PoolConfig, uint64>({ prefix: 'pc' });
fullConfigs = BoxMap<FullConfig, uint64>({ prefix: 'fc' });
poolsAggregated = BoxMap<AssetsCombined, AppPoolInfo>({ prefix: 's' });
```

A felderítés szempontjából a `"fc"` előtagú `fullConfigs` a lényeges. Valahányszor létrejön egy pool, a `registerPool()` poolonként egy boxot ír:

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

A TEALScript a teljes `FullConfig` struktúrát a **box nevébe** kódolja, így önmagában a box neve mindent tartalmaz, ami a poolok felsorolásához szükséges — a box értékét (amely ismét csak az `appId`) még ki sem kell olvasni. Minden `fc` box neve pontosan 59 bájt:

| bájtok | mező | típus |
|---|---|---|
| 0–1 | `"fc"` előtag (ASCII) | 2 bájt |
| 2–9 | `appId` | uint64, big-endian |
| 10–17 | `assetA` | uint64 |
| 18–25 | `assetB` | uint64 |
| 26–33 | `min` (alsó árhatár) | uint64 |
| 34–41 | `max` (felső árhatár) | uint64 |
| 42–49 | `fee` | uint64 |
| 50–57 | `lpTokenId` | uint64 |
| 58 | `verificationClass` | uint8 (1 bájt) |

Ezen boxok lekérése és szűrése egyetlen `algod` hívást igényel — nincs szükség sem indexerre, sem API-ra:

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

Ez a repozitórium által ténylegesen szállított és exportált segédfüggvény kissé beágyazott változata: [`src/biatecClamm/getPools.ts`](https://github.com/scholtz/BiatecCLAMM/blob/main/src/biatecClamm/getPools.ts). Mivel az `assetA` / `assetB` / `min` / `max` / `fee` / `lpTokenId` / `verificationClass` már benne van a box nevében, ez az egyetlen hívás elegendő minden pool `appId`-jának **és** két eszközazonosítójának lekéréséhez — az egyes poolok saját globális állapotának kiolvasására (2. lépés) csak független keresztellenőrzésként van szükség, vagy ha nem kíván megbízni a pool szolgáltató könyvelésében.

Az `algod.getApplicationBoxes` csak a boxok *nevét* adja vissza, és alapértelmezetten korlátozza a hívásonként visszaadott boxok számát — sok poolt kezelő pool szolgáltató esetén lapozzon végig rajta (a JS SDK `max`, a REST végpont pedig `next` kurzort biztosít), ahelyett hogy feltételezné, hogy egyetlen hívás mindent visszaad.

## 2. lépés: a pool A / B eszközének kiolvasása a globális állapotból {#-step-2-read-pool-assets}

Minden `BiatecClammPool` alkalmazás (`contracts/BiatecClammPool.algo.ts`) egykarakteres globális állapotkulcsokban tárolja két eszközét:

```ts
assetA = GlobalStateKey<uint64>({ key: 'a' });
assetB = GlobalStateKey<uint64>({ key: 'b' });
assetABalanceBaseScale = GlobalStateKey<uint256>({ key: 'ab' });
assetBBalanceBaseScale = GlobalStateKey<uint256>({ key: 'bb' });
```

Láncon belül az `algod` a globális állapotkulcsokat base64-kódolva adja vissza. A generált ARC-56 specifikáció (`contracts/artifacts/BiatecClammPool.arc56.json`) megerősíti a pontos kódolást:

```json
"assetA": { "key": "YQ==", "keyType": "AVMBytes", "valueType": "uint64" },
"assetB": { "key": "Yg==", "keyType": "AVMBytes", "valueType": "uint64" }
```

Az `YQ==` a `base64("a")`, az `Yg==` pedig a `base64("b")`. Így egy pool eszközeinek kiolvasása kizárólag az `algod.getApplicationByID` használatával így néz ki:

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

Mivel ezek az értékek már szerepeltek az 1. lépés `fc` boxnevében, a legtöbb hívó teljesen kihagyhatja ezt a lépést, és hagyatkozhat a pool szolgáltató regisztrációjára — erre a lépésre csak akkor van szükség, ha kifejezetten ellenőrizni szeretné a szolgáltatót az egyes poolok saját állapotával szemben.

## 3. lépés: a valós egyenlegek összegzése a TVL-hez {#-step-3-sum-balances}

Miután megvan egy pool `appId`-ja és két eszközazonosítója, a TVL-t a pool **tényleges on-chain egyenlegeiből** kell számítani, nem pedig bármilyen könyvelési értékből, hogy egy esetleges hiba vagy egyeztetetlen szélső eset a szerződésben ne tudja észrevétlenül eltorzítani. Minden `BiatecClammPool` alkalmazásnak saját számlája van (az alkalmazáscíme), és ez a számla tartja a valós ASA/ALGO tartalékokat:

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

Ez poolonként egyetlen `algod.accountInformation` hívás — ismét csak indexer és API nélkül. A `balanceOf(assetA)` és `balanceOf(assetB)` értékek összegzése (árfolyam-feed segítségével közös egységre átszámítva) az 1. lépésből kapott összes poolra olyan TVL mutatót ad, amely teljes egészében on-chain olvasásokból származik.

Egy alternatíva, amely megtakarítja a külön számlainformációs hívást, a pool saját `assetABalanceBaseScale` / `assetBBalanceBaseScale` globális állapotkulcsainak (`"ab"` / `"bb"`, base64 `"YWI="` / `"YmI="`) kiolvasása — ezek ugyanazok a tartalékok fix alapléptékre skálázva, `uint256` típusként. Állandósult állapotban követik a számla valós ASA/ALGO állományát; a számlaegyenleg azonban defenzívebb választás a TVL-hez, mert a pool által ténylegesen őrzött eszközt mutatja, függetlenül a szerződés belső könyvelésétől.

## 4. lépés: a TVL kifejezése USD-ben az on-chain 1 napos VWAP segítségével {#-step-4-usd-tvl}

A nyers eszközegyenlegek összegzése (3. lépés) az egyes eszközök saját egységében adja meg a TVL-t, ami nem alkalmas egyetlen összesített USD szám előállítására, és hibás lenne feltételezni, hogy minden pool stabilcoinnal áll párban — a legtöbb nem. A pool szolgáltató minden olyan eszköz**párra**, amelyen valaha swap történt, konkrét pooltól függetlenül kereskedési volumennel súlyozott VWAP árat követ a `poolsAggregated` boxtérképben (`'s'` előtag). Pontosan ezt a boxot érdemes használni a nem-USD egyenlegek árazásához, mivel ugyanabból az on-chain forrásból származik, mint maguk az egyenlegek — nincs szükség külső árfolyam-feedre vagy API-ra.

### A `poolsAggregated` box

Box neve: 1 bájtos `'s'` előtag + 16 bájtos ABI-kódolt `AssetsCombined` kulcs:

| bájtok | mező | típus |
|---|---|---|
| 0 | `"s"` előtag (ASCII) | 1 bájt |
| 1–8 | `assetA` | uint64, big-endian |
| 9–16 | `assetB` | uint64, big-endian |

Az `assetA` és `assetB` sorrendje meg kell egyezzen a pár regisztrált sorrendjével (lásd a `getPrice()` dokumentációs megjegyzését és az `updatePriceBoxAggregated` assertjeit a `contracts/BiatecPoolProvider.algo.ts` fájlban).

A box értéke egy `AppPoolInfo` struktúra. Az árazás szempontjából releváns mezők:

```ts
type AppPoolInfo = {
  assetA: uint64;
  assetB: uint64;
  verificationClass: uint64;
  latestPrice: uint64;

  period1Duration: uint64; // 60 (másodperc)
  period1NowVolumeA: uint64;
  period1NowVolumeB: uint64;
  period1NowVWAP: uint64;
  period1NowTime: uint64;
  period1PrevVolumeA: uint64;
  period1PrevVolumeB: uint64;
  period1PrevVWAP: uint64;
  period1PrevTime: uint64;
  // ...period1NowFeeA/B, period1PrevFeeA/B a rövidség kedvéért elhagyva

  period2Duration: uint64; // 3600 * 24 = 1 nap  <-- ezt az időablakot használja a TVL-hez
  period2NowVolumeA: uint64;
  period2NowVolumeB: uint64;
  period2NowVWAP: uint64;
  period2NowTime: uint64;
  period2PrevVolumeA: uint64;
  period2PrevVolumeB: uint64;
  period2PrevVWAP: uint64;
  period2PrevTime: uint64;

  // a period3* (1 hét) és period4* (1 év) ugyanezt a szerkezetet követi
};
```

A szerződés páronként 4 párhuzamos időablakot tart fenn — 60 másodperc (`period1`), **1 nap** (`period2`), 1 hét (`period3`) és 1 év (`period4`) —, mindegyiket egy `Now` (még gyűlő) és egy `Prev` (az utolsó teljesen lezárt) vödörre bontva. A `periodNNowVWAP` a swap középárának (`(priceFrom + priceTo) / 2`) B-volumennel súlyozott futó átlaga az aktuális vödörben; a vödrök akkor fordulnak át (`Now` → `Prev`, `Now` nullázódik), amikor a `floor(timestamp / periodDuration)` megváltozik, vagyis az ablakok korszakhoz (epoch) igazítottak, nem gördülő ablakosak. Ez azt jelenti, hogy **a `period2NowVWAP` önmagában alulreprezentálja a valódi visszatekintő 1 napos átlagot**, valahányszor az adott UTC nap még fiatal — közvetlenül éjfél után lehet, hogy csak néhány percnyi kereskedést tükröz. Elszámolási célokra keverje (blend) a `Now` értéket a `Prev` végével, hogy az eredmény mindig egy teljes visszatekintő 24 órás ablakot fedjen le:

```ts
function trailing1DayVwap(info: AppPoolInfo, nowSeconds: bigint): bigint {
  const duration = info.period2Duration; // 86400
  const elapsedInNow = nowSeconds - info.period2NowTime; // a mai vödörből eltelt másodpercek
  const remainingFromPrev = duration - elapsedInNow; // a tegnapból még "hiányzó" másodpercek

  if (remainingFromPrev <= 0n || info.period2PrevVolumeB === 0n) {
    // a mai vödör önmagában már lefedi (vagy meghaladja) az egész napot, vagy nincs korábbi adat
    return info.period2NowVWAP;
  }

  // a Prev volumenének súlyozása a visszatekintő 24 órás ablakból még általa lefedett aránnyal
  const prevWeight = (info.period2PrevVolumeB * remainingFromPrev) / duration;
  const nowWeight = info.period2NowVolumeB;

  if (nowWeight + prevWeight === 0n) return info.period2PrevVWAP; // ma még egyáltalán nem volt kereskedés

  return (info.period2NowVWAP * nowWeight + info.period2PrevVWAP * prevWeight) / (nowWeight + prevWeight);
}
```

Ez minden vödör VWAP értékét azzal súlyozza, hogy mennyivel járul hozzá a visszatekintő 24 órás ablakhoz — röviddel a naphatár után a `Prev` dominál a keverékben (ahogy kell is, hiszen az elmúlt 24 óra szinte egésze még a tegnapi vödör); egy teljes nap elteltével a `Now`-n belül a `Prev` hozzájárulása természetes módon nullára csökken. Nincs olyan on-chain metódus, amely ezt a kevert értéket adná vissza — a `getPrice()` csak a nyers boxot adja vissza —, ezért ezt a keverést off-chain, olvasási időben kell elvégezni páronként egyszer.

Egy pár árának kiolvasása kizárólag `algod` segítségével:

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
  const info = decodeAppPoolInfo(box.value); // ABI-dekódolás a contracts/artifacts/BiatecPoolProvider.arc56.json szerint
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  return trailing1DayVwap(info, nowSeconds);
}
```

(A `decodeAppPoolInfo` egy egyszerű ABI tuple dekódolás a `contracts/artifacts/BiatecPoolProvider.arc56.json` mezősorrendje alapján; a generált `BiatecPoolProviderClient` ehhez elérhetővé teszi az `AppPoolInfo` ABI típust.)

### Láncolás hídeszközön (bridge asset) keresztül, ha nincs közvetlen USD pár

A legtöbb Biatec pár nem közvetlenül egy USD stabilcoin ellenében forog, és nem minden token áll párban ALGO-val sem — számos token kizárólag a Biatec saját irányítási tokenjével, a VoteCoinnal (mainnet asset ID `452399768`, lásd `voteAssetId` a `.env.example` fájlban) van poolban. Maga a `VOTE` mély, aktívan kereskedett likviditással rendelkezik (ez képezi a Biatec saját protokolldíj-útválasztásának eszközoldalát, és a [Élő poolok javítása az LP-mintelési javítás után](./live-pool-reconciliation) dokumentumban felsorolt poolok nagy részében párosító eszközként szerepel), ami az ALGO mellett második természetes hídeszközzé teszi azon tokenek számára, amelyeknek nincs közvetlen USD vagy ALGO útvonaluk.

Egy tetszőleges eszköz USD-ben történő árazásához próbálja meg az útvonalakat ebben a sorrendben, és használja az elsőt, amelyik feloldható:

1. **Közvetlen**: `(asset, usdAssetId)` vagy `(usdAssetId, asset)` — ha ez a box létezik, a visszatekintő 1 napos VWAP értéke már maga az USD ár, ügyelve az invertálásra (`1 / vwap`), amikor az USD eszköz az `assetA` (a VWAP a pool saját konvenciója szerint B/A alakban van jegyezve).
2. **ALGO-n keresztül**: `asset ↔ ALGO` kombinálva az `ALGO ↔ usdAssetId` párral:
   `priceInUsd = priceInAlgo * algoPriceInUsd`.
3. **VoteCoinon keresztül**: `asset ↔ VOTE` kombinálva a `VOTE ↔ usdAssetId` párral (ugyanúgy kikeresve, mint a közvetlen USD útvonal — ha magának a VoteCoinnak sincs közvetlen USD párja, oldja fel először a `voteInUsd` értéket a saját ALGO útvonalán keresztül: `VOTE ↔ ALGO` kombinálva az `ALGO ↔ usdAssetId` párral).

Egyetlen hídeszköz-lista általánoson tartja ezt a logikát két külön beégetett kódútvonal helyett:

```ts
async function getUsdPrice(
  algod: Algodv2,
  poolProviderAppId: number | bigint,
  assetId: bigint,
  usdAssetId: bigint,
  bridgeAssetIds: bigint[] = [0n, 452399768n] // ALGO, majd VoteCoin (mainnet asset id)
): Promise<bigint | undefined> {
  if (assetId === usdAssetId) return 1n; // már USD

  const direct = await tryGetPairVwap(algod, poolProviderAppId, assetId, usdAssetId);
  if (direct !== undefined) return direct;

  for (const bridgeAssetId of bridgeAssetIds) {
    if (bridgeAssetId === assetId) continue; // maga az eszköz egy hídeszköz, önmagán keresztüli útvonal kihagyása

    const assetInBridge = await tryGetPairVwap(algod, poolProviderAppId, assetId, bridgeAssetId);
    if (assetInBridge === undefined) continue; // nincs pár ezzel a hídeszközzel, próbálja a következőt

    // a hídeszköz saját USD árának rekurzív feloldása (lefedi pl. a VOTE -> ALGO -> USD útvonalat)
    const bridgeInUsd = await getUsdPrice(algod, poolProviderAppId, bridgeAssetId, usdAssetId, bridgeAssetIds);
    if (bridgeInUsd === undefined) continue;

    return assetInBridge * bridgeInUsd; // kombinálás előtt igazítsa az egyes eszközök tizedes skálájához
  }

  return undefined; // egyik konfigurált hídeszközön keresztül sem található USD útvonal
}
```

A `tryGetPairVwap` a fenti `getPairVwap` függvény olyan burkolója, amely kivétel dobása helyett `undefined` értéket ad vissza, ha a `poolsAggregated(...).exists` hamis az adott párra (nincs box → nincs regisztrált kereskedés, így az útvonal nem használható). Az ALGO (asset ID `0`) a hálózat natív eszköze, és bármely ASA-hoz hasonlóan szerepel az `AssetsCombined` kulcsban; a VoteCoin eszközazonosítója protokollspecifikus és hálózatonként eltérő (ebben a repozitóriumban csak a mainnet azonosító, a `452399768` szerepel a `.env.example` fájlban — használat előtt ellenőrizze a testnet és a Voi saját VOTE eszközazonosítóját, ha van ilyen). Jelenleg nincs beégetett USD-referencia eszközazonosító sem a repozitóriumban, ezért válassza ki a megfelelő USD-hez kötött ASA-t (pl. a hálózat USDC asset ID-ját), és adja át explicit módon `usdAssetId` paraméterként. Bővítse a `bridgeAssetIds` listát bármely más, tartósan mély és aktívan kereskedett eszközzel, amelyre az adott telepítés árazási központként támaszkodik.

A valós VWAP értékek egész számok, az alaplépték (`1e9`) szerint skálázva, ezért az `assetInAlgo * algoPriceInUsd` kombinálása vagy a 3. lépésből származó egyenleggel való szorzás előtt normalizálja mindkét operandust ugyanarra a tizedes alapra az egyes eszközök ismert `decimals` értéke (`algod.getAssetByID`) alapján.

## Összerakva az egészet {#-putting-it-together}

```ts
const algod = new algosdk.Algodv2(token, server, port);
const poolProviderAppId = 3074197785n; // mainnet, lásd alább
const usdAssetId = 31566704n; // pl. USDC mainneten — válassza ki a saját USD-hez kötött ASA-t

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
  if (priceUsd === undefined) continue; // nem található USD útvonal ehhez az eszközhöz — jelentse külön
  tvlUsd += Number(balance) * Number(priceUsd); // szorzás előtt normalizálja a tizedesjegyeket, lásd fent
}
```

A `tvlByAsset` eszközazonosítónként tartalmazza az adott eszköz valós egyenlegének összegét a protokoll által valaha regisztrált összes poolban, a `tvlUsd` pedig ugyanezt az értéket USD-re átszámítva, kizárólag on-chain VWAP adatok alapján — tisztán `algod` hívásokkal kiszámítva a pool szolgáltató és az egyes poolok saját alkalmazásszámlái ellenében.

## Hálózati alkalmazásazonosítók (App ID-k) {#-network-app-ids}

A pool szolgáltató hálózatonkénti alkalmazásazonosítója a [`src/getConfig.ts`](https://github.com/scholtz/BiatecCLAMM/blob/main/src/getConfig.ts) fájlban található:

| Hálózat (`genesisId`) | Pool szolgáltató app ID |
|---|---|
| `mainnet-v1.0` | `3074197785` |
| `testnet-v1.0` | `741107916` |
| `voimain-v1.0` | `40133595` |

## Fontos szempontok és korlátok {#-caveats}

- Az `fc` box neve egyszer, a pool létrehozásakor íródik, és utána soha nem frissül — poolonként biztonságosan megváltoztathatatlannak (immutable) tekinthető, így az eredmények `appId` alapján gyorsítótárazhatók.
- A pool LP token azonosítója és díja szintén be van ágyazva az `fc` box nevébe, ha egy TVL műszerfal külön olvasások nélkül szeretné megjeleníteni őket.
- A `poolsAggregated` boxok csak olyan eszközpárokhoz léteznek, amelyeken legalább egyszer ténylegesen történt kereskedés; egy vadonatúj, még swap nélküli poolnak az első kereskedésig nincs árútvonala. A hiányzó boxot kezelje úgy, hogy „még nem áll rendelkezésre USD ár”, ne pedig hibaként.
- A `period2NowVWAP`/`period2PrevVWAP` a kereskedési árakat tükrözi, nem a likviditási mélységet — egy nagyon ritkán kereskedett pár esetén a VWAP elavult lehet, vagy egyetlen kis üzlettel könnyen elmozdítható. Fontolja meg azon eszközök kizárását vagy külön megjelölését, amelyek egyetlen árútvonala nagyon alacsony `period2NowVolumeB` / `period2PrevVolumeB` értékkel rendelkezik.
- A dokumentumban szereplő VWAP-keverési logika a szerződés olvasásából származtatott off-chain iránymutatás; maga a szerződés csak a nyers `Now`/`Prev` vödröket teszi elérhetővé a `getPrice()` metóduson keresztül, ezért bármely két integrátornak ugyanabban a keverési képletben kell megállapodnia az összehasonlítható TVL számok érdekében.
- Lásd az [Élő poolok javítása az LP-mintelési javítás után](./live-pool-reconciliation) dokumentumot egy kidolgozott példáért (`scripts/survey-orphaned-liquidity.ts`), amely a pool szolgáltatón keresztül végigjárja az összes mainnet poolt, és keresztellenőrzi minden pool belső likviditási könyvelését — pontosan az itt dokumentált box-felsorolási technikát alkalmazva.
