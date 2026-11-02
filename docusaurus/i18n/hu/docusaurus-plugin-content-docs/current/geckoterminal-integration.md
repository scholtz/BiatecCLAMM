---
sidebar_label: GeckoTerminal DEX Adapter
---

# GeckoTerminal DEX Adapter

A Biatec DEX a swapokat és a likviditásváltozásokat a [GeckoTerminal](https://www.geckoterminal.com) (CoinGecko) felé egy olyan **DEX adapter API**-n keresztül publikálja, amely követi a nem-EVM láncokra vonatkozó *GeckoTerminal Integration API Standards v0.1* előírásokat. Az adaptert a Biatec kereskedési jelentőszolgáltatás (AVMTradeReporter) szolgálja ki — ugyanaz a szolgáltatás, amely a [Biatec Scan](https://scan.biatec.io) mögött is áll —, így pontosan azokat az adatokat olvassa, amelyeket maga a Biatec DEX is megjelenít.

Ez az oldal referencia a CoinGecko / GeckoTerminal ellenőrök és mindenki számára, aki használni kívánja az adaptert: tartalmazza az alap URL-eket, a négy végpontot valós válaszokkal, az adatszemantikát, a hibaszerződést és az adapter által vállalt garanciákat.

## Alap URL-ek {#-base-urls}

| Hálózat | Alap URL | Swagger UI |
|---|---|---|
| **Algorand MainNet** | `https://api.algorand.scan.biatec.io/api/coingecko/` | [swagger/index.html](https://api.algorand.scan.biatec.io/swagger/index.html) |
| **Algorand TestNet** | `https://api.testnet.scan.biatec.io/api/coingecko/` | [swagger/index.html](https://api.testnet.scan.biatec.io/swagger/index.html) |

- A végpontok a Swagger UI felületen az `/api/coingecko/*` útvonalak alatt szerepelnek, a lekérdezési paramétereikkel és válaszmodelljeikkel együtt.
- Minden végpont egyszerű `GET` kérés, amely `application/json` választ ad vissza.
- Egy adott telepítésen az adapter kikapcsolható; ilyenkor minden végpont üres törzsű `404` válasszal tér vissza (a fenti két URL-en be van kapcsolva).
- **Nem szükséges hitelesítés.** A Biatec kereskedési API többi része ARC-14 aláírt tokeneket használ; az adapter szándékosan nem kér ilyet, mivel a GeckoTerminal indexelője nem tudja aláírni őket.
- Sebességkorlátozás (rate limit): az adapter saját, kliens IP-címenként percenként 1200 kéréses kerettel rendelkezik (az indexelő körülbelül 2 másodpercenként kérdez le), elkülönítve az API többi részének percenkénti 60-as anonim keretétől.

## Végpontok {#-endpoints}

| Végpont | Cél |
|---|---|
| `GET /latest-block` | A legújabb blokk, amelyhez már minden swap, belépés (join) és kilépés (exit) el van tárolva és kereshető. |
| `GET /asset?id=ASSET_ID` | Egy publikált poolban szereplő eszköz metaadatai. |
| `GET /pair?id=POOL_APP_ID` | Egy pool (kereskedési pár) metaadatai. |
| `GET /events?fromBlock=FROM&toBlock=TO` | Egy blokktartomány swap, join és exit eseményei. |

Az alábbi példák a MainNet alap URL-t használják (TestNet esetén cserélje le a TestNet URL-re), és 2026-10-04-én rögzített valós válaszokat mutatnak. A blokkszámok és a tartalékok azóta továbbhaladtak; egy történeti lekérdezés azonban újra pontosan ugyanezeket az eseményeket adja vissza (az egyetlen kivételt lásd a [Garanciák](#-guarantees) szakaszban).

### latest-block {#-latest-block}

```bash
curl https://api.algorand.scan.biatec.io/api/coingecko/latest-block
```

```json
{ "block": { "blockNumber": 65671739, "blockTimestamp": 1791140699 } }
```

A `blockNumber` az Algorand kör (round), a `blockTimestamp` pedig annak Unix ideje másodpercben. Az érték a **teljesen feldolgozott blokkok vízjele (watermark)**: minden esemény eddig a blokkig (beleértve ezt is) már lekérdezhető az `/events` végpontról. Néhány másodperccel vissza van tartva, hogy a keresési index frissüljön, mielőtt a GeckoTerminal lekérdezné az eseményeket. A szolgáltatás minden replikája ugyanazzal az értékkel válaszol (Redisbe van tükrözve), és az érték soha nem lép visszafelé. Amíg a vízjel nem ismert, a végpont `503` státusszal válaszol.

### asset {#-asset}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/asset?id=452399768"
```

```json
{
  "asset": {
    "id": "452399768",
    "name": "Vote Coin",
    "symbol": "Vote",
    "decimals": 6,
    "totalSupply": "1000000000",
    "metadata": { "type": "ASA", "url": "https://www.vote-coin.com/" }
  }
}
```

- Az ALGO azonosítója `0`: `{"asset":{"id":"0","name":"Algorand","symbol":"ALGO","decimals":6,"totalSupply":"10000000000", ...}}`.
- A `totalSupply` a teljes készlet egész egységekben (már elosztva `10^decimals`-szel); elmarad, ha a lánc nem közöl ilyet. A `metadata.type` az eszköz fajtája (`ASA` standard eszköz esetén), a `metadata.url` pedig csak akkor szerepel, ha az eszköznek van URL-je. Az üres eszköznév az egységnévre (unit name) esik vissza (és fordítva), majd az `"Asset"` szövegre és az azonosítóra.
- A végpont csak **publikált poolok** eszközeire válaszol, így nem használható tetszőleges eszközök lekérdezésére. Az ismeretlen vagy megsemmisített eszköz válasza `404`; egy olyan eszköz, amelyet pillanatnyilag nem lehet beolvasni, újrapróbálható `503` (lásd: [Hibaszerződés](#-error-contract)), soha nem `404`.

### pair {#-pair}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/pair?id=3136517663"
```

```json
{
  "pair": {
    "id": "3136517663",
    "dexKey": "biatec",
    "asset0Id": "452399768",
    "asset1Id": "0",
    "feeBps": 1
  }
}
```

- Egy pár egyetlen Biatec CLAMM **poolnak** felel meg. Az `id` a pool okosszerződés alkalmazásazonosítója (app ID), így ugyanaz a két eszköz eltérő díjszinttel vagy eltérő ársávval külön párnak számít.
- Az `asset0Id` a pool A eszköze, az `asset1Id` pedig a B eszköze, a pool szerződés **on-chain sorrendjében**; az adapter soha nem rendezi át őket (így az ALGO, `0`-s azonosítóval, lehet `asset1Id`, ahogy fent is látható). A sorrend soha nem változik.
- A `feeBps` a pool LP díja bázispontban (`1` = 0,01%). Ez egy JSON szám, amely lehet **tört** is (egy 0,005%-os díj értéke `0.5`), és a kulcs **hiányzik**, ha a díj nem ismert vagy kívül esik a 0–100% tartományon.
- Az ismeretlen és a csalásnak (scam) minősített poolok válasza `404`; egy létező, de pillanatnyilag le nem írható pool válasza újrapróbálható `503`.

### events {#-events}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/events?fromBlock=65666403&toBlock=65666675"
```

Mindkét határ **zárt (inclusive)**. Egy kérés legfeljebb **1000 blokkot** foghat át (`toBlock - fromBlock` legfeljebb 999). A válasz `{ "events": [...] }`, blokkszám, majd `txnIndex`, majd `eventIndex` szerint rendezve; egy esemény nélküli tartomány válasza `{ "events": [] }`.

**Swap**

```json
{
  "eventType": "swap",
  "asset0In": "4918.617175",
  "asset1Out": "745.160378",
  "priceNative": "0.1514979416953709148954045199",
  "metadata": { "fees0In": "0.4918617175" },
  "block": { "blockNumber": 65666403, "blockTimestamp": 1791126026 },
  "txnId": "MFFCTLZFHLLPYGAAUT3LZ55Z4NAO4B6ADXOHD64XEXG3EATIAMMQ",
  "txnIndex": 1,
  "eventIndex": 0,
  "maker": "7YZORIFPVIGBU4Y2KPCKXYWDJE2VQT5EKFZ2NEYETMQGAHMQNJCBHIZPFU",
  "pairId": "3136517663",
  "reserves": { "asset0": "1068648.098149176", "asset1": "233179.618669844" }
}
```

**Join** (likviditás hozzáadása; az `exit` ugyanezzel a szerkezettel jelöli a likviditás kivonását)

```json
{
  "eventType": "join",
  "amount0": "398.549045",
  "amount1": "0.035351",
  "block": { "blockNumber": 65662126, "blockTimestamp": 1791114232 },
  "txnId": "G77DGPNZK562IHIRSCEWSIP5UM4DYYVSO2T7T4735AHTMRWUDH5A",
  "txnIndex": 1,
  "eventIndex": 0,
  "maker": "USFJPKLPDKZOGA64GJ4ESBDHF3RHSQONSU6QGPDT7OOYN3DRYJLAWRNXLE",
  "pairId": "3721772702",
  "reserves": { "asset0": "162718.169058", "asset1": "18.093768" }
}
```

| Mező | Jelentés |
|---|---|
| `eventType` | `swap`, `join` (likviditás befizetés) vagy `exit` (likviditás kivonás). |
| `asset0In` + `asset1Out` vagy `asset1In` + `asset0Out` | Egy swapnak pontosan egy iránya van: mit fizetett és mit kapott a kereskedő, az adott eszköz egész egységeiben. |
| `amount0`, `amount1` | Egy `join` / `exit` összegei, egész egységekben. |
| `priceNative` | A swap végrehajtási ára: **asset1 mennyisége egyetlen asset0-ra vetítve** (a fenti swapban 0.1515 ALGO / Vote). Mindig nagyobb nullánál, és a két swapolt mennyiség hányadosa, .NET `decimal` pontosságú (kb. 28 értékes jegy, legfeljebb 28 tizedesjeggyel kiírva), ezért pontos egyenlőség helyett tűréshatárral hasonlítsa össze. |
| `reserves` | A pool mindkét eszközének tartaléka az esemény **után**. |
| `metadata.fees0In` / `fees1In` | Egy swap **névleges** LP díja: a bemeneti összeg szorozva a pool alapdíjával, a bemeneti eszköz oldalán. A szerződés módosíthatja a kereskedőnek ténylegesen felszámított díjat (a díjkedvezménnyel rendelkező kereskedő kevesebbet fizet a névleges díjnál), ezért ezt a bemenetre alkalmazott pool-díjkulcsként kezelje, ne pedig auditált egyéni díjként. A teljes `metadata` objektum **opcionális**: hiányzik, ha a pool díja nulla, kívül esik a 0–1 tartományon, vagy nem ismert. |
| `block` | A tranzakciót tartalmazó blokk `blockNumber` és `blockTimestamp` (Unix másodperc) értéke. |
| `txnId` | A legfelső szintű tranzakció azonosítója (a belső tranzakción keresztül irányított swap is a felhasználó által aláírt tranzakció alatt jelenik meg). |
| `txnIndex`, `eventIndex` | A tranzakció pozíciója a blokkon belül, illetve az esemény pozíciója a tranzakción belül. A blokkszámmal együtt **egyediek és determinisztikusak**, és meghatározzák a sorrendet. A legrégebbi eseményeknél, amelyeket a valós pozíció rögzítése előtt tároltak, a pozíció egy determinisztikus helyettesítő érték az adott blokk valós tranzakciói után, ezért ne használja láncon belüli visszakeresésre: használja a `txnId` mezőt. |
| `maker` | A tranzakciót beküldő számla. |
| `pairId` | A pool alkalmazásazonosítója; a `/pair` végponton keresztül oldható fel. |

Az összegek egész egységekben megadott **tizedes karakterláncok (string)** (a nyers összeg elosztva az eszköz `10^decimals` értékével). A kereskedett összegek (`asset0In`, `asset1Out`, `amount0`, ...) soha nem tartalmaznak több tizedesjegyet, mint maga az eszköz. A `reserves`, a `metadata`-ban lévő díjak és a `priceNative` tartalmazhatnak több jegyet: a Biatec belsőleg `1e9` léptékben tárolja a tartalékokat, a díj pedig a bemeneti összeg töredéke (a fenti swapban a 4918.617175 0,01%-a `0.4918617175`). Mindegyik ugyanabban az egész egységben van kifejezve, mint az összegek.

## Mi kerül publikálásra {#-what-is-published}

- **Kizárólag Biatec DEX poolok** (`dexKey` értéke `biatec`). A kereskedési jelentőszolgáltatás számos Algorand DEX-et követ a Biatec Scan számára, de ez az adapter csak a Biatec DEX-et listázza, így más protokollok eseményei soha nem jelennek meg itt. Egy 1000 blokkos tartomány ezért üres is lehet: a Biatec poolokban ritkábban történik kereskedés, mint a teljes láncon.
- Kizárólag **megerősített** swapok és likviditásváltozások.
- Azok az események, amelyek nem fejezhetők ki a szabvány szerint, **kihagyásra kerülnek** (és a szerveroldalon naplózódnak) ahelyett, hogy kiküldésre kerülnének. A GeckoTerminal az első érvénytelen eseménynél leállítja egy DEX indexelését, ezért az adapter inkább kihagy egy eseményt, semmint hibásat küldjön. Ezek az esetek:
  - nulla bemeneti vagy kimeneti összegű swap, vagy olyan swap, amely után mindkét tartalék nulla, illetve amelynek ára nullára kerekítődik vagy nem ábrázolható;
  - összeg nélküli `join` / `exit`, vagy olyan, amelynél a tranzakcióból nem ismert **mindkét** eszköz tartaléka. Az aktuális ár feletti vagy alatti koncentrált likviditási pozíció **egyoldalas (single-sided)**: csak az egyik tartalékot változtatja meg, a másik nem része a tranzakció állapotváltozásának, az adapter pedig nem jelent olyan tartalékot, amelyet nem tud bizonyítani. Az egyoldalas befizetések és kivonások (valamint az üres poolba történő első befizetés vagy az utolsó likviditás kivonása) ezért **nem** jelennek meg `join` / `exit` eseményként. Ez soha nem rejti el a kereskedési volument: minden swap tartalmazza a pool hiteles tartalékait az esemény után;
  - ismeretlen vagy a poolhoz nem illeszkedő pool/eszköz eseménye, valamint feladó vagy tranzakcióazonosító nélküli esemény.

  Ha a feedet összeveti a láncon belüli tranzakciókkal, számítson ezekre az eltérésekre: swap csak a fent felsorolt ritka esetekben hiányzik (használhatatlan összeg vagy ár), a `join` / `exit` események pedig csak a pool mindkét eszközét érintő likviditásváltozásokat fedik le.

## Hogyan érdemes használni {#-how-to-consume-it}

A GeckoTerminal indexelője által használt minta, amely ellen mi is tesztelünk:

1. Hívja meg a `latest-block` végpontot.
2. Hívja meg az `events` végpontot a `(lastIndexedBlock + 1) .. latest` tartományra, legfeljebb 1000 blokkos szeletekben.
3. Minden még nem látott `pairId`-ra hívja meg a `pair` végpontot; a pár minden eszközére hívja meg az `asset` végpontot. Egy pár megváltoztathatatlan (immutable), és egy eszköz is megváltoztathatatlan a `totalSupply` mezőjét leszámítva (amely utánnyomható eszköznél változhat), így mindkettő gyorsítótárazható; ha megjeleníti a készletet, időnként frissítse.
4. Várjon körülbelül 2 másodpercet, és ismételje meg.

Olyan tartomány lekérdezése, amelynek `toBlock` értéke meghaladja a `latest-block` értékét, újrapróbálható `503` választ ad (lásd alább). Egy tartomány kettéosztása pontosan a teljes tartomány eseményeit adja vissza, így a kliens szabadon megválaszthatja a szeletméretet 1000 blokkig. Ha egy szelet azért válaszol `400`-zal, mert túl sok eseményt tartalmaz, felezze meg és próbálja újra; csak egyetlen olyan blokk nem szolgálható ki soha, amely önmagában túl nagy (és ez így is kerül jelentésre, nem `503`-ként).

## Hibaszerződés {#-error-contract}

Az adapter által visszaadott hibák `{ "error": "..." }` alakú JSON objektumok. Az olyan lekérdezési paramétert, amely egyáltalán nem szám (például `fromBlock=abc`), a webes keretrendszer már korábban elutasítja `400` státusszal és szabványos problem-details JSON törzzsel (`application/problem+json`).

| Státusz | Mikor |
|---|---|
| `200` | Sikeres kérés (az esemény nélküli tartomány is sikeres, üres listával). |
| `400` | Hiányzó vagy hibás formátumú paraméter, `toBlock` kisebb mint `fromBlock`, 1000 blokknál szélesebb tartomány (mindkét határ zárt: `toBlock - fromBlock` legfeljebb 999), egyetlen válaszba nem férő eseményszámú tartomány (kérjen kisebb tartományt), vagy egy **egyetlen blokk**, amely önmagában több eseményt tartalmaz, mint amennyit az API vissza tud adni (a kisebb tartomány nem segít; ez determinisztikus és újrapróbálkozásra sem sikerül). Ugyanannak a kérésnek az megismétlése nem segít. |
| `404` | Ismeretlen (vagy megsemmisített / scamnek jelölt) eszköz vagy pár; valamint minden végpont olyan telepítésen, ahol az adapter ki van kapcsolva (üres törzs). |
| `429` | Túllépte az IP-címenkénti sebességkorlátot. A törzs `{ "error": "Rate limit exceeded. Try again later." }`, a válasz pedig `Retry-After: 60` fejlécet tartalmaz: várjon ennyi ideig a következő kérésig. Egy 2 másodpercenként lekérdező poller bőven a korlát alatt marad. |
| `503` | **Újrapróbálható (retryable)** minden végponton, beleértve az `asset` és `pair` végpontokat is. A `toBlock` túlmutat a legutóbbi indexelt blokkon, vagy tárolási / lekérdezési hiba történt (egy pillanatnyilag nem olvasható eszközt vagy poolt soha nem jelent ismeretlenként). A válasz `Retry-After: 2` fejlécet tartalmaz. Az adapter soha nem válaszol részleges listával, és soha nem gyorsítótáraz részleges választ. |

A kliensnek az `503` választ úgy kell kezelnie, hogy „kérdezze le újra egy pillanat múlva, tartsa meg a pozícióját”, és soha nem kezelheti egy `asset` vagy `pair` `503` válaszát úgy, hogy „nem létezik”.

## Garanciák {#-guarantees}

- **Megváltoztathatatlanság (Immutability).** Egy `latest-block` alatti vagy azzal egyenlő blokktartományra adott válasz utólag nem változik meg: az ismételt kérések azonos bájtokat adnak vissza, és egy történeti esemény megtartja árát, összegeit, tartalékait, sorrendjét és díjait. Egy pár eszközsorrendje soha nem változik, a díja pedig a pool létrehozásakor beállított érték. Az egyetlen szándékos kivétel maga a publikálási döntés: ha egy poolt utólag csalásnak (magas scam minősítésűnek) sorolnak be, az eseményei ettől kezdve kikerülnek a feedből, és egy olyan tartomány, amelyet a gyorsítótár lejárta után számítanak újra, már ezt tükrözi.
- **Teljesség (Completeness).** Minden `latest-block`-ig megerősített, kifejezhető Biatec swap szerepel az `events` válaszban, ahogy minden mindkét tartalékkal kifejezhető join és exit is; kizárólag a [Mi kerül publikálásra](#-what-is-published) szakaszban leírt kihagyott események jelentenek kivételt. Egy tartományra soha nem érkezik válasz, amíg annak összes blokkja nincs eltárolva.
- **Konzisztencia a replikák között.** Minden replika ugyanazt a `latest-block` értéket jelenti, így a közöttük terheléselosztott kliens egységes történetet lát.
- **Hatékonyság.** Az eszköz- és párválaszok memóriabeli gyorsítótárból érkeznek; az `events` tartományok kiszámítás után memóriában és Redisben gyorsítótárazódnak, az egyidejű azonos kérések pedig egyetlen lekérdezéssé olvadnak össze.

## Minőségbiztosítás {#-quality-assurance}

Az adaptert minden módosításkor és minden telepítés után a GeckoTerminal publikált szabványa ellen teszteljük:

- Szigorú sémavalidátor utasít el minden eltérést a szabványtól (mezőnevek, formátumok, rendezés, `(txnIndex, eventIndex)` egyedisége, ár- és összegkonzisztencia).
- Élő megfelelőségi tesztcsomag fut a valós API ellen minden kiadás után (majd néhány óránként): séma, hézagmentes láncbekövetés az indexelő módjára, megváltoztathatatlanság a rögzített **arany adatokkal (golden data)** szemben (a történeti eseményeket és párokat pontosan kell reprodukálni), hibaszerződés, késleltetési keretek (`latest-block` és gyorsítótárazott tartományok 800 ms alatt a 95. percentilisnél, hideg 1000 blokkos tartomány 8 s alatt), valamint 50 konkurens lekérdező lökésszerű terhelése (100 kérés) és 150 egymást követő kérés egyetlen `429` nélkül.
- A MainNetre történő kiadás csak azután történik meg, hogy ugyanez a tesztcsomag sikeresen lefutott a TestNet környezeten, majd a kiadás után azonnal újra lefut a MainNeten is.

## Igazságforrás (Source of truth) {#-source-of-truth}

Az adapter az [AVMTradeReporter](https://github.com/scholtz/AVMTradeReporter) repozitóriumban van megvalósítva (`Controllers/CoinGeckoController.cs`, `Services/CoinGecko/`; a `docs/GECKOTERMINAL.md` a biztonsági háló üzemeltetési útmutatója). Az olyan korlátok, mint az 1000 blokkos terjedelem, a sebességkorlát és a gyorsítótár-élettartamok ennek a szolgáltatásnak a beállításai; ez az oldal a Biatec telepítéseken futó értékeket sorolja fel. A fenti Swagger UI közvetlenül a futó szolgáltatásból generálódik.

## Kapcsolódó dokumentumok {#-related-documents}

- [Integrációs útmutató](./integration-guide) a Biatec CLAMM poolok on-chain integrálásához.
- [Logaritmikus tick-rendszer](./tick-system) arról, hogyan épül fel egy pool ártartománya.
- A kereskedési jelentőszolgáltatás teljes API-ja (beleértve a hitelesítést igénylő végpontokat is) a fent hivatkozott Swagger UI felületen található.
