# On-chain vyhľadávanie poolov pre bezdôverové (trustless) TVL

## Obsah {#-table-of-contents}

- [Prečo jednoducho nezavolať API](#-why-not-just-call-an-api)
- [Krok 1: vymenovanie poolov z boxov pool providera](#-step-1-enumerate-pools)
- [Krok 2: prečítanie aktíva A / aktíva B poolu z jeho globálneho stavu](#-step-2-read-pool-assets)
- [Krok 3: sčítanie skutočných zostatkov pre TVL](#-step-3-sum-balances)
- [Krok 4: vyjadrenie TVL v USD pomocou on-chain 1-dňového VWAP](#-step-4-usd-tvl)
- [Spojenie všetkého dokopy](#-putting-it-together)
- [ID aplikácií pre jednotlivé siete](#-network-app-ids)
- [Upozornenia a obmedzenia](#-caveats)

:::caution Páry mimo USD
Kroky 1–3 samy osebe poskytujú TVL **pre každé aktívum zvlášť**, nie v USD. Pool medzi dvoma ne-USD aktívami (napr. GoldDAO / ALGO) prispieva surovými jednotkami oboch aktív, nie dolárovou sumou. [Krok 4](#-step-4-usd-tvl) opisuje konverziu týchto zostatkov na USD pomocou vlastných on-chain VWAP cien pool providera, reťazením cez ALGO alebo — ak token nie je spárovaný ani s ALGO — cez vlastný token Biatec VoteCoin (`VOTE`) ako druhé premostovacie aktívum (bridge asset).
:::

## Prečo jednoducho nezavolať API {#-why-not-just-call-an-api}

Každý Biatec CLAMM pool je vytvorený prostredníctvom jedinej aplikácie `BiatecPoolProvider` a v nej sa aj registruje. Táto aplikácia udržiava box pre každý pool, ktorý kedy vytvorila, a samotný **názov** boxu (nielen jeho hodnota) je ABI-kódovaným záznamom obsahujúcim ID aplikácie poolu (`appId`), jeho dve aktíva, cenové hranice, poplatok a ID jeho LP tokenu.

Keďže tento záznam žije v boxe aplikácie, ktorú môže ktokoľvek dopytovať, výpočet TVL nemusí dôverovať žiadnemu API ani indexeru prevádzkovanému spoločnosťou Biatec: samotný uzol `algod` stačí na to, aby:

1. vypísal každý pool, ktorý protokol kedy nasadil, a
2. prečítal aktívum A / aktívum B každého poolu (a jeho skutočné on-chain zostatky týchto aktív).

Táto stránka dokumentuje presné rozloženie boxov a kľúče globálneho stavu potrebné na tento účel, pričom referenčnou implementáciou sú TypeScript pomocné funkcie dodávané v tomto repozitári (`src/biatecClamm/getPools.ts`). Rovnaké rozloženie je možné dekódovať pomocou ľubovoľného SDK, ktoré dokáže čítať boxy a stav aplikácií — `py-algorand-sdk`, `go-algorand-sdk` alebo priamych `algod` REST volaní.

## Krok 1: vymenovanie poolov z boxov pool providera {#-step-1-enumerate-pools}

`BiatecPoolProvider` (`contracts/BiatecPoolProvider.algo.ts`) deklaruje niekoľko `BoxMap` úložísk s rôznymi prefixami:

```ts
pools = BoxMap<uint64, AppPoolInfo>({ prefix: 'p' });
poolsByConfig = BoxMap<PoolConfig, uint64>({ prefix: 'pc' });
fullConfigs = BoxMap<FullConfig, uint64>({ prefix: 'fc' });
poolsAggregated = BoxMap<AssetsCombined, AppPoolInfo>({ prefix: 's' });
```

Pre vyhľadávanie je rozhodujúca mapa `fullConfigs` s prefixom `"fc"`. Vždy, keď sa vytvorí pool, `registerPool()` zapíše jeden box pre daný pool:

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

TEALScript zakóduje celú štruktúru `FullConfig` priamo do **názvu boxu**, takže samotný názov boxu nesie všetko potrebné na vymenovanie poolov — hodnotu boxu (opäť `appId`) nie je potrebné ani čítať. Každý názov `fc` boxu má presne 59 bajtov:

| bajty | pole | typ |
|---|---|---|
| 0–1 | prefix `"fc"` (ASCII) | 2 bajty |
| 2–9 | `appId` | uint64, big-endian |
| 10–17 | `assetA` | uint64 |
| 18–25 | `assetB` | uint64 |
| 26–33 | `min` (dolná hranica ceny) | uint64 |
| 34–41 | `max` (horná hranica ceny) | uint64 |
| 42–49 | `fee` | uint64 |
| 50–57 | `lpTokenId` | uint64 |
| 58 | `verificationClass` | uint8 (1 bajt) |

Vypísanie a vyfiltrovanie týchto boxov vyžaduje jediné volanie `algod` — bez indexera a bez API:

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

Toto je mierne vložená (inlined) verzia pomocnej funkcie, ktorú tento repozitár skutočne dodáva a exportuje: [`src/biatecClamm/getPools.ts`](https://github.com/scholtz/BiatecCLAMM/blob/main/src/biatecClamm/getPools.ts). Keďže `assetA` / `assetB` / `min` / `max` / `fee` / `lpTokenId` / `verificationClass` sú už v názve boxu, toto jediné volanie stačí na získanie `appId` každého poolu **aj** jeho dvoch ID aktív — čítanie vlastného globálneho stavu každého poolu (krok 2) je potrebné iba ako nezávislá krížová kontrola alebo vtedy, keď účtovníctvu pool providera vopred nedôverujete.

`algod.getApplicationBoxes` vracia iba *názvy* boxov a predvolene obmedzuje počet vrátených boxov na jedno volanie — pri pool provideroch s množstvom poolov výsledky stránkujte (JS SDK sprístupňuje parameter `max` a REST endpoint kurzor `next`) namiesto predpokladu, že jedno volanie vráti všetko.

## Krok 2: prečítanie aktíva A / aktíva B poolu z jeho globálneho stavu {#-step-2-read-pool-assets}

Každá aplikácia `BiatecClammPool` (`contracts/BiatecClammPool.algo.ts`) ukladá svoje dve aktíva do jednoznakových kľúčov globálneho stavu:

```ts
assetA = GlobalStateKey<uint64>({ key: 'a' });
assetB = GlobalStateKey<uint64>({ key: 'b' });
assetABalanceBaseScale = GlobalStateKey<uint256>({ key: 'ab' });
assetBBalanceBaseScale = GlobalStateKey<uint256>({ key: 'bb' });
```

On-chain vracia `algod` kľúče globálneho stavu zakódované v base64. Vygenerovaná ARC-56 špecifikácia (`contracts/artifacts/BiatecClammPool.arc56.json`) potvrdzuje presné kódovanie:

```json
"assetA": { "key": "YQ==", "keyType": "AVMBytes", "valueType": "uint64" },
"assetB": { "key": "Yg==", "keyType": "AVMBytes", "valueType": "uint64" }
```

`YQ==` je `base64("a")` a `Yg==` je `base64("b")`. Prečítanie aktív poolu iba pomocou `algod.getApplicationByID` teda vyzerá takto:

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

Keďže tieto hodnoty boli už prítomné v názve `fc` boxu z kroku 1, väčšina volajúcich môže tento krok úplne preskočiť a spoľahnúť sa na registráciu v pool provideri — tento krok je potrebný iba vtedy, ak chcete explicitne overiť údaje providera voči vlastnému stavu každého poolu.

## Krok 3: sčítanie skutočných zostatkov pre TVL {#-step-3-sum-balances}

Keď máte `appId` poolu a jeho dve ID aktív, TVL by malo vychádzať zo **skutočných on-chain zostatkov** poolu, nie z účtovnej premennej, aby prípadná chyba alebo nezosúladený hraničný prípad v kontrakte nemohol potichu skresliť výsledok. Každá aplikácia `BiatecClammPool` má vlastný účet (svoju adresu aplikácie) a tento účet drží skutočné ASA/ALGO rezervy:

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

Ide o jedno volanie `algod.accountInformation` na pool — opäť bez indexera a bez API. Sčítanie `balanceOf(assetA)` a `balanceOf(assetB)` (prevedených na spoločnú jednotku cez cenový feed) naprieč všetkými poolmi z kroku 1 poskytuje hodnotu TVL odvodenú výlučne z on-chain čítaní.

Alternatívou, ktorá ušetrí extra volanie pre informácie o účte, je prečítanie kľúčov globálneho stavu `assetABalanceBaseScale` / `assetBBalanceBaseScale` (`"ab"` / `"bb"`, base64 `"YWI="` / `"YmI="`) samotného poolu — ide o tie isté rezervy preškálované na pevnú základnú škálu ako `uint256`. V ustálenom stave kopírujú skutočné držby ASA/ALGO na účte; zostatok na účte je však pre TVL defenzívnejšou voľbou, pretože predstavuje skutočné aktívum v úschove poolu bez ohľadu na interné účtovníctvo kontraktu.

## Krok 4: vyjadrenie TVL v USD pomocou on-chain 1-dňového VWAP {#-step-4-usd-tvl}

Sčítanie surových zostatkov aktív (krok 3) dáva TVL denominované v každom aktíve zvlášť, čo nestačí pre jedno súhrnné číslo v USD, a bolo by nesprávne predpokladať, že každý pool je spárovaný so stablecoinom — väčšina nie je. Pool provider sleduje objemovo váženú VWAP cenu pre každý **pár** aktív, na ktorom kedy prebehol swap (nezávisle od konkrétneho poolu), v mape boxov `poolsAggregated` (prefix `'s'`). Práve tento box by sa mal použiť na ocenenie ne-USD zostatkov, pretože pochádza z rovnakého on-chain zdroja ako samotné zostatky — nie je potrebný žiadny externý cenový feed ani API.

### Box `poolsAggregated`

Názov boxu: 1-bajtový prefix `'s'` + 16-bajtový ABI-kódovaný kľúč `AssetsCombined`:

| bajty | pole | typ |
|---|---|---|
| 0 | prefix `"s"` (ASCII) | 1 bajt |
| 1–8 | `assetA` | uint64, big-endian |
| 9–16 | `assetB` | uint64, big-endian |

Poradie `assetA` a `assetB` zodpovedá poradiu, v akom bol pár registrovaný (pozri dokumentačný komentár `getPrice()` a `assert` príkazy v `updatePriceBoxAggregated` v súbore `contracts/BiatecPoolProvider.algo.ts`).

Hodnotou boxu je štruktúra `AppPoolInfo`. Polia relevantné pre oceňovanie sú:

```ts
type AppPoolInfo = {
  assetA: uint64;
  assetB: uint64;
  verificationClass: uint64;
  latestPrice: uint64;

  period1Duration: uint64; // 60 (sekúnd)
  period1NowVolumeA: uint64;
  period1NowVolumeB: uint64;
  period1NowVWAP: uint64;
  period1NowTime: uint64;
  period1PrevVolumeA: uint64;
  period1PrevVolumeB: uint64;
  period1PrevVWAP: uint64;
  period1PrevTime: uint64;
  // ...period1NowFeeA/B, period1PrevFeeA/B vynechané pre stručnosť

  period2Duration: uint64; // 3600 * 24 = 1 deň  <-- tento interval použite pre TVL
  period2NowVolumeA: uint64;
  period2NowVolumeB: uint64;
  period2NowVWAP: uint64;
  period2NowTime: uint64;
  period2PrevVolumeA: uint64;
  period2PrevVolumeB: uint64;
  period2PrevVWAP: uint64;
  period2PrevTime: uint64;

  // period3* (1 týždeň) a period4* (1 rok) majú rovnaký tvar
};
```

Kontrakt udržiava 4 paralelné časové intervaly pre každý pár — 60 sekúnd (`period1`), **1 deň** (`period2`), 1 týždeň (`period3`) a 1 rok (`period4`) — pričom každý je rozdelený na priehradku `Now` (stále sa akumulujúcu) a priehradku `Prev` (poslednú úplne uzavretú priehradku danej veľkosti). `periodNNowVWAP` je priebežný, objemom aktíva B vážený priemer strednej ceny swapu `(priceFrom + priceTo) / 2` vo vnútri aktuálnej priehradky; priehradky sa preklopia (`Now` → `Prev`, `Now` sa vynuluje) v okamihu, keď sa zmení `floor(timestamp / periodDuration)`, t. j. priehradky sú zarovnané na epochy, nie kĺzavé okná. To znamená, že **samotné `period2NowVWAP` podhodnocuje skutočný spätný 1-dňový priemer**, kedykoľvek je aktuálny UTC deň ešte na začiatku — tesne po polnoci môže odrážať len niekoľko minút obchodov. Pre účtovné účely skombinujte (blendujte) `Now` s koncom `Prev`, aby výsledok vždy pokrýval celé spätné 24-hodinové okno:

```ts
function trailing1DayVwap(info: AppPoolInfo, nowSeconds: bigint): bigint {
  const duration = info.period2Duration; // 86400
  const elapsedInNow = nowSeconds - info.period2NowTime; // sekundy uplynuté v dnešnej priehradke
  const remainingFromPrev = duration - elapsedInNow; // sekundy stále "dlžné" zo včera

  if (remainingFromPrev <= 0n || info.period2PrevVolumeB === 0n) {
    // dnešná priehradka sama osebe už pokrýva (alebo presahuje) celý deň, alebo neexistujú predchádzajúce dáta
    return info.period2NowVWAP;
  }

  // navážte objem Prev časťou spätného 24h okna, ktorú stále pokrýva
  const prevWeight = (info.period2PrevVolumeB * remainingFromPrev) / duration;
  const nowWeight = info.period2NowVolumeB;

  if (nowWeight + prevWeight === 0n) return info.period2PrevVWAP; // dnes zatiaľ žiadne obchody

  return (info.period2NowVWAP * nowWeight + info.period2PrevVWAP * prevWeight) / (nowWeight + prevWeight);
}
```

Týmto sa VWAP každej priehradky naváži podľa toho, akou časťou prispieva do spätného 24-hodinového okna — krátko po prechode dňa v zmesi dominuje `Prev` (ako aj má, keďže takmer celých posledných 24 hodín je stále včerajšia priehradka); po uplynutí celého dňa vo vnútri `Now` príspevok `Prev` prirodzene klesne na nulu. Neexistuje žiadna on-chain metóda, ktorá by vracala toto skombinované číslo — `getPrice()` vracia iba surový box — takže toto spriemerovanie sa musí vykonať off-chain, raz pre každý pár v čase čítania.

Prečítanie ceny páru iba pomocou `algod`:

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
  const info = decodeAppPoolInfo(box.value); // ABI dekódovanie podľa contracts/artifacts/BiatecPoolProvider.arc56.json
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  return trailing1DayVwap(info, nowSeconds);
}
```

(`decodeAppPoolInfo` je priamočiare ABI dekódovanie n-tice podľa poradia polí v `contracts/artifacts/BiatecPoolProvider.arc56.json`; vygenerovaný `BiatecPoolProviderClient` na tento účel sprístupňuje ABI typ `AppPoolInfo`.)

### Reťazenie cez premostovacie aktívum (bridge asset), keď neexistuje priamy USD pár

Väčšina párov Biatec nie je kótovaná priamo voči USD stablecoinu a nie každý token je spárovaný ani s ALGO — množstvo tokenov má pooly iba voči vlastnému governance tokenu Biatec, VoteCoin (mainnet asset ID `452399768`, pozri `voteAssetId` v `.env.example`). Samotný `VOTE` predstavuje hlbokú, aktívne obchodovanú likviditu (tvorí aktívovú polovicu smerovania protokolových poplatkov Biatec a vystupuje ako párovacie aktívum vo veľkej časti poolov uvedených v dokumente [Oprava živých poolov po oprave mintovania LP](./live-pool-reconciliation)), čo z neho robí druhé prirodzené premostovacie aktívum popri ALGO pre tokeny, ktoré nemajú priamu USD ani ALGO trasu.

Ak chcete oceniť ľubovoľné aktívum v USD, skúšajte trasy v tomto poradí a použite prvú, ktorá sa vyhodnotí:

1. **Priama**: `(asset, usdAssetId)` alebo `(usdAssetId, asset)` — ak tento box existuje, jeho spätný 1-dňový VWAP už je cenou v USD, pričom dávajte pozor na jej prevrátenie (`1 / vwap`), keď je USD aktívom `assetA` (VWAP je vo vlastnej konvencii poolu kótovaný ako B/A).
2. **Cez ALGO**: `asset ↔ ALGO` v kombinácii s `ALGO ↔ usdAssetId`:
   `priceInUsd = priceInAlgo * algoPriceInUsd`.
3. **Cez VoteCoin**: `asset ↔ VOTE` v kombinácii s `VOTE ↔ usdAssetId` (vyhľadané rovnako ako priama USD trasa — ak samotný VoteCoin nemá priamy USD pár, vyhodnoťte najprv `voteInUsd` cez jeho vlastnú ALGO trasu: `VOTE ↔ ALGO` v kombinácii s `ALGO ↔ usdAssetId`).

Jeden zoznam premostovacích aktív udržiava tento postup všeobecný namiesto natvrdo zakódovaných dvoch oddelených vetiev:

```ts
async function getUsdPrice(
  algod: Algodv2,
  poolProviderAppId: number | bigint,
  assetId: bigint,
  usdAssetId: bigint,
  bridgeAssetIds: bigint[] = [0n, 452399768n] // ALGO, potom VoteCoin (mainnet asset id)
): Promise<bigint | undefined> {
  if (assetId === usdAssetId) return 1n; // už je v USD

  const direct = await tryGetPairVwap(algod, poolProviderAppId, assetId, usdAssetId);
  if (direct !== undefined) return direct;

  for (const bridgeAssetId of bridgeAssetIds) {
    if (bridgeAssetId === assetId) continue; // samotné aktívum je premostovacím aktívom, preskočte trasu k samému sebe

    const assetInBridge = await tryGetPairVwap(algod, poolProviderAppId, assetId, bridgeAssetId);
    if (assetInBridge === undefined) continue; // žiadny pár voči tomuto premostovaciemu aktívu, skúste ďalšie

    // rekurzívne vyhodnoťte USD cenu samotného premostovacieho aktíva (pokrýva napr. VOTE -> ALGO -> USD)
    const bridgeInUsd = await getUsdPrice(algod, poolProviderAppId, bridgeAssetId, usdAssetId, bridgeAssetIds);
    if (bridgeInUsd === undefined) continue;

    return assetInBridge * bridgeInUsd; // pred spojením upravte podľa desatinnej škály každého aktíva
  }

  return undefined; // cez žiadne nakonfigurované premostovacie aktívum sa nenašla USD trasa
}
```

`tryGetPairVwap` je funkcia `getPairVwap` vyššie obalená tak, aby namiesto vyhodenia výnimky vrátila `undefined`, keď je `poolsAggregated(...).exists` pre daný pár nepravdivé (žiadny box → žiadne registrované obchody, takže trasu nemožno použiť). ALGO (asset ID `0`) je natívne aktívum siete a v `AssetsCombined` vystupuje rovnako ako akékoľvek ASA; ID aktíva VoteCoin je špecifické pre protokol a sieť (v `.env.example` tohto repozitára je zdokumentované iba mainnet ID `452399768` — pred použitím tohto zoznamu na testnete alebo Voi si overte príslušné ID tokenu VOTE). V tomto repozitári momentálne nie je natvrdo zakódované ani referenčné USD ID aktíva, preto si zvoľte svoje ASA naviazané na USD (napr. asset ID tokenu USDC v danej sieti) a odovzdajte ho explicitne ako `usdAssetId`. Zoznam `bridgeAssetIds` môžete rozšíriť o akékoľvek ďalšie trvalo likvidné a aktívne obchodované aktívum, na ktoré sa vaše nasadenie spolieha ako na oceňovací uzol.

Skutočné hodnoty VWAP sú celé čísla v základnej škále (`1e9`), takže pred spojením `assetInAlgo * algoPriceInUsd` alebo vynásobením zostatkom z kroku 3 normalizujte oba operandy na rovnaký desatinný základ pomocou známeho počtu `decimals` každého aktíva (z `algod.getAssetByID`).

## Spojenie všetkého dokopy {#-putting-it-together}

```ts
const algod = new algosdk.Algodv2(token, server, port);
const poolProviderAppId = 3074197785n; // mainnet, pozri nižšie
const usdAssetId = 31566704n; // napr. USDC na mainnete — zvoľte si svoje ASA naviazané na USD

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
  if (priceUsd === undefined) continue; // pre toto aktívum sa nenašla USD trasa — vykážte samostatne
  tvlUsd += Number(balance) * Number(priceUsd); // pred násobením normalizujte desatinné miesta, pozri vyššie
}
```

`tvlByAsset` drží pre každé ID aktíva súčet skutočného zostatku tohto aktíva naprieč všetkými poolmi, ktoré protokol kedy zaregistroval, a `tvlUsd` je to isté číslo prevedené na USD výlučne pomocou on-chain VWAP dát — vypočítané čisto volaniami `algod` voči pool provideru a účtom aplikácií jednotlivých poolov.

## ID aplikácií pre jednotlivé siete {#-network-app-ids}

ID aplikácie pool providera pre jednotlivé siete sa nachádza v [`src/getConfig.ts`](https://github.com/scholtz/BiatecCLAMM/blob/main/src/getConfig.ts):

| Sieť (`genesisId`) | App ID pool providera |
|---|---|
| `mainnet-v1.0` | `3074197785` |
| `testnet-v1.0` | `741107916` |
| `voimain-v1.0` | `40133595` |

## Upozornenia a obmedzenia {#-caveats}

- Názov `fc` boxu sa zapíše raz pri vytvorení poolu a potom sa už nikdy neaktualizuje — pre daný pool ho možno bezpečne považovať za nemenný (immutable), takže výsledky možno kešovať podľa `appId`.
- ID LP tokenu a poplatok poolu sú takisto vložené v názve `fc` boxu, ak ich chce TVL prehľad zobrazovať bez ďalších čítaní.
- Boxy `poolsAggregated` existujú iba pre páry aktív, s ktorými sa skutočne aspoň raz obchodovalo; úplne nový pool bez swapov nemá žiadnu cenovú trasu až do svojho prvého obchodu. Chýbajúci box spracujte ako „cena v USD zatiaľ nie je k dispozícii“, nie ako chybu.
- Hodnoty `period2NowVWAP`/`period2PrevVWAP` odrážajú obchodné ceny, nie hĺbku likvidity — pri veľmi riedko obchodovanom páre môže byť VWAP zastaraný alebo ľahko posunutý malým obchodom. Zvážte vylúčenie alebo samostatné označenie aktív, ktorých jediná cenová trasa má veľmi nízky objem `period2NowVolumeB` / `period2PrevVolumeB`.
- Logika spriemerovania VWAP v tomto dokumente je off-chain odporúčaním odvodeným z čítania kontraktu; samotný kontrakt sprístupňuje cez `getPrice()` iba surové priehradky `Now`/`Prev`, takže akíkoľvek dvaja integrátori sa musia zhodnúť na rovnakom vzorci spriemerovania, aby získali porovnateľné hodnoty TVL.
- Pozri dokument [Oprava živých poolov po oprave mintovania LP](./live-pool-reconciliation) pre vypracovaný príklad (`scripts/survey-orphaned-liquidity.ts`), ktorý prejde každý mainnet pool cez pool providera a krížovo skontroluje interné účtovníctvo likvidity každého poolu — s využitím presne tej istej techniky enumerácie boxov, aká je zdokumentovaná tu.
