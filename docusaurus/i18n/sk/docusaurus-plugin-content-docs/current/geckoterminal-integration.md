---
sidebar_label: GeckoTerminal DEX Adaptér
---

# GeckoTerminal DEX Adaptér

Biatec DEX publikuje svoje swapy a zmeny likvidity do služby [GeckoTerminal](https://www.geckoterminal.com) (CoinGecko) prostredníctvom **DEX adaptér API**, ktoré dodržiava štandard *GeckoTerminal Integration API Standards v0.1* pre non-EVM reťazce. Adaptér je poskytovaný službou Biatec trade reporter (AVMTradeReporter) — tou istou službou, ktorá poháňa [Biatec Scan](https://scan.biatec.io) — takže číta presne tie dáta, ktoré zobrazuje samotný Biatec DEX.

Táto stránka slúži ako referencia pre kontrolórov CoinGecko / GeckoTerminal a pre každého, kto chce adaptér používať: obsahuje základné URL adresy, štyri endpointy so skutočnými odpoveďami, sémantiku dát, chybový kontrakt a záruky, ktoré adaptér dodržiava.

## Základné URL adresy {#-base-urls}

| Sieť | Základná URL | Swagger UI |
|---|---|---|
| **Algorand MainNet** | `https://api.algorand.scan.biatec.io/api/coingecko/` | [swagger/index.html](https://api.algorand.scan.biatec.io/swagger/index.html) |
| **Algorand TestNet** | `https://api.testnet.scan.biatec.io/api/coingecko/` | [swagger/index.html](https://api.testnet.scan.biatec.io/swagger/index.html) |

- Endpointy sú uvedené v rozhraní Swagger UI pod cestami `/api/coingecko/*` spolu s ich query parametrami a modelmi odpovedí.
- Všetky endpointy sú obyčajné `GET` požiadavky, ktoré vracajú `application/json`.
- Nasadenie môže adaptér vypnúť; každý endpoint vtedy odpovedá čistým kódom `404` s prázdnym telom (dve URL adresy vyššie ho majú zapnutý).
- **Nevyžaduje sa žiadna autentifikácia.** Zvyšok obchodného API Biatec používa tokeny podpísané podľa ARC-14; adaptér ich zámerne nevyžaduje, pretože indexer GeckoTerminal ich nedokáže podpisovať.
- Rate limit: adaptér má vlastný limit 1200 požiadaviek za minútu na klientsku IP adresu (indexer sa dopytuje približne každé 2 sekundy), oddelený od anonymného rozpočtu 60 požiadaviek za minútu pre zvyšok API.

## Endpointy {#-endpoints}

| Endpoint | Účel |
|---|---|
| `GET /latest-block` | Najnovší blok, pre ktorý sú už všetky swapy, vklady (join) a výbery (exit) uložené a vyhľadateľné. |
| `GET /asset?id=ASSET_ID` | Metadáta aktíva, ktoré je súčasťou publikovaného poolu. |
| `GET /pair?id=POOL_APP_ID` | Metadáta poolu (obchodného páru). |
| `GET /events?fromBlock=FROM&toBlock=TO` | Udalosti `swap`, `join` a `exit` v zadanom rozsahu blokov. |

Príklady nižšie používajú základnú URL pre MainNet (pre TestNet ju nahraďte TestNet adresou) a skutočné odpovede zachytené dňa 2026-10-04. Čísla blokov a rezervy sa posúvajú ďalej; historická požiadavka však vráti opäť tie isté udalosti (jedinú výnimku nájdete v časti [Záruky](#-guarantees)).

### latest-block {#-latest-block}

```bash
curl https://api.algorand.scan.biatec.io/api/coingecko/latest-block
```

```json
{ "block": { "blockNumber": 65671739, "blockTimestamp": 1791140699 } }
```

`blockNumber` je kolo (round) Algorandu, `blockTimestamp` je jeho unixový čas v sekundách. Hodnota predstavuje **vodoznak (watermark) plne spracovaných blokov**: každú udalosť až po tento blok vrátane je už možné vyžiadať z `/events`. Je pozdržaná o niekoľko sekúnd, aby sa vyhľadávací index stihol obnoviť predtým, než si GeckoTerminal vypýta udalosti. Každá replika služby odpovedá rovnakou hodnotou (je zrkadlená do Redisu) a hodnota sa nikdy neposúva dozadu. Kým vodoznak nie je známy, endpoint odpovedá kódom `503`.

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

- ALGO má ID aktíva `0`: `{"asset":{"id":"0","name":"Algorand","symbol":"ALGO","decimals":6,"totalSupply":"10000000000", ...}}`.
- `totalSupply` je celková ponuka v celých jednotkách (už vydelená `10^decimals`); chýba, ak ju reťazec neuvádza. `metadata.type` je druh aktíva (`ASA` pre štandardné aktívum) a `metadata.url` je prítomné iba vtedy, keď má aktívum priradenú URL adresu. Prázdny názov aktíva sa nahradí názvom jednotky (a naopak), prípadne textom `"Asset"` nasledovaným identifikátorom.
- Odpovedá sa iba pre aktíva **publikovaných poolov**, takže endpoint nemožno zneužiť na vyhľadávanie ľubovoľných aktív. Neznáme alebo zničené aktívum vráti `404`; aktívum, ktoré momentálne nie je možné prečítať, vráti opakovateľný kód `503` (pozri [Chybový kontrakt](#-error-contract)), nikdy nie `404`.

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

- Pár predstavuje jeden Biatec CLAMM **pool**. Jeho `id` je ID aplikácie (app ID) kontraktu poolu, takže tie isté dve aktíva s inou úrovňou poplatkov alebo iným cenovým rozsahom tvoria odlišné páry.
- `asset0Id` je aktívum A poolu a `asset1Id` jeho aktívum B v **on-chain poradí** kontraktu poolu; adaptér ich nikdy nepreusporiada (takže ALGO s id `0` môže byť `asset1Id`, ako je uvedené vyššie). Poradie sa nikdy nemení.
- `feeBps` je LP poplatok poolu v bázických bodoch (`1` = 0,01 %). Ide o JSON číslo, ktoré môže byť **desatinné** (poplatok 0,005 % je `0.5`), a kľúč **chýba**, ak poplatok nie je známy alebo je mimo rozsahu 0 až 100 %.
- Neznáme pooly a pooly označené ako podvodné (scam) vracajú `404`; pool, ktorý existuje, ale momentálne ho nie je možné opísať, vracia opakovateľný kód `503`.

### events {#-events}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/events?fromBlock=65666403&toBlock=65666675"
```

Obe hranice sú **vrátane (inclusive)**. Požiadavka môže pokrývať najviac **1000 blokov** (`toBlock - fromBlock` najviac 999). Odpoveďou je `{ "events": [...] }`, zoradené podľa čísla bloku, potom `txnIndex` a potom `eventIndex`; rozsah bez udalostí vráti `{ "events": [] }`.

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

**Join** (pridaná likvidita; `exit` má rovnaký tvar pre odobratú likviditu)

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

| Pole | Význam |
|---|---|
| `eventType` | `swap`, `join` (vklad likvidity) alebo `exit` (výber likvidity). |
| `asset0In` + `asset1Out` alebo `asset1In` + `asset0Out` | Swap má presne jeden smer: čo obchodník zaplatil a čo dostal, v celých jednotkách každého aktíva. |
| `amount0`, `amount1` | Sumy operácie `join` / `exit`, v celých jednotkách. |
| `priceNative` | Realizovaná cena swapu: **asset1 za jednu jednotku asset0** (vo swape vyššie 0.1515 ALGO za Vote). Je vždy väčšia ako nula a predstavuje podiel dvoch vymenených súm s presnosťou typu `.NET decimal` (približne 28 platných číslic, zapísaných s najviac 28 desatinnými miestami), preto ju porovnávajte s toleranciou namiesto presnej rovnosti. |
| `reserves` | Rezervy poolu pre obe aktíva **po** udalosti. |
| `metadata.fees0In` / `fees1In` | **Nominálny** LP poplatok swapu: vstupná suma vynásobená základným poplatkom poolu na strane vstupného aktíva. Kontrakt môže upraviť poplatok skutočne účtovaný obchodníkovi (obchodník so zľavou na poplatkoch platí menej ako nominálny poplatok), preto túto hodnotu berte ako sadzbu poplatku poolu aplikovanú na vstup, nie ako auditovanú sumu pre konkrétneho obchodníka. Celý objekt `metadata` je **voliteľný**: chýba, keď je poplatok poolu nulový, mimo rozsahu 0 až 1 alebo nie je známy. |
| `block` | `blockNumber` a `blockTimestamp` (unixové sekundy) bloku, ktorý drží transakciu. |
| `txnId` | ID transakcie najvyššej úrovne (swap smerovaný cez vnútornú transakciu je vykazovaný pod transakciou, ktorú podpísal používateľ). |
| `txnIndex`, `eventIndex` | Pozícia transakcie v bloku a udalosti v rámci transakcie. Spolu s číslom bloku sú **unikátne a deterministické** a definujú poradie. Pre najstaršie udalosti uložené pred zaznamenávaním skutočnej pozície je pozícia deterministickou náhradou umiestnenou za skutočnými transakciami daného bloku, preto ju nepoužívajte na vyhľadávanie udalosti on-chain: použite `txnId`. |
| `maker` | Účet, ktorý odoslal transakciu. |
| `pairId` | ID aplikácie poolu; prekladá sa cez `/pair`. |

Sumy sú **desatinné reťazce (string)** v celých jednotkách (surová suma vydelená `10^decimals` aktíva). Obchodované sumy (`asset0In`, `asset1Out`, `amount0`, ...) nikdy nemajú viac desatinných miest ako `decimals` aktíva. `reserves`, poplatky v `metadata` a `priceNative` môžu mať viac číslic: Biatec interne ukladá rezervy v škále `1e9` a poplatok je zlomkom vstupnej sumy (vo swape vyššie je 0,01 % zo 4918.617175 rovné `0.4918617175`). Všetky sú vyjadrené v rovnakých celých jednotkách ako sumy.

## Čo sa publikuje {#-what-is-published}

- **Iba pooly Biatec DEX** (`dexKey` je `biatec`). Trade reporter sleduje pre Biatec Scan viacero Algorand DEXov, ale tento adaptér uvádza iba Biatec DEX, takže udalosti iných protokolov sa tu nikdy neobjavia. Rozsah 1000 blokov preto môže byť prázdny: v pooloch Biatec sa obchoduje menej často ako na celom reťazci.
- Iba **potvrdené** swapy a zmeny likvidity.
- Udalosť, ktorú nie je možné vyjadriť podľa štandardu, sa **preskočí** (a zaloguje na strane servera) namiesto odoslania. GeckoTerminal zastaví indexovanie DEXu pri prvej neplatnej udalosti, takže adaptér uprednostní chýbajúcu udalosť pred nesprávnou. Ide o tieto prípady:
  - swap s nulovou vstupnou alebo výstupnou sumou, alebo s oboma rezervami nulovými po ňom, alebo ktorého cena sa zaokrúhli na nulu či sa nedá reprezentovať;
  - `join` / `exit` bez akejkoľvek sumy alebo taký, pre ktorý nie sú z transakcie známe rezervy **oboch** aktív. Pozícia koncentrovanej likvidity nad alebo pod aktuálnou cenou je **jednostranná (single-sided)**: mení iba jednu rezervu, druhá nie je súčasťou zmeny stavu transakcie a adaptér nebude hlásiť rezervu, ktorú nevie preukázať. Jednostranné vklady a výbery (ako aj prvý vklad do prázdneho poolu alebo výber poslednej likvidity) sa preto **nepublikujú** ako `join` / `exit`. Nikdy to neskrýva obchodný objem: každý swap nesie autoritatívne rezervy poolu po jeho vykonaní;
  - udalosť poolu alebo aktíva, ktoré je neznáme alebo nezodpovedá poolu, a udalosť bez odosielateľa alebo ID transakcie.

  Ak porovnávate tento feed s on-chain transakciami, počítajte s týmito rozdielmi: swap chýba iba v zriedkavých prípadoch uvedených vyššie (nepoužiteľná suma alebo cena) a udalosti `join` / `exit` pokrývajú iba zmeny likvidity, ktoré sa dotýkajú oboch aktív poolu.

## Ako adaptér používať {#-how-to-consume-it}

Vzor, ktorý používa indexer GeckoTerminal a voči ktorému testujeme:

1. Zavolajte `latest-block`.
2. Zavolajte `events` pre `(lastIndexedBlock + 1) .. latest` v častiach po najviac 1000 blokoch.
3. Pre každé `pairId`, ktoré ste ešte nevideli, zavolajte `pair`; pre každé aktívum daného páru zavolajte `asset`. Pár je nemenný (immutable) a aktívum je nemenné okrem svojho `totalSupply` (ktoré sa môže meniť pri mintovateľnom aktíve), takže oboje možno kešovať; ak zobrazujete celkovú ponuku, občas ju obnovte.
4. Počkajte približne 2 sekundy a opakujte.

Vyžiadanie rozsahu, ktorého `toBlock` je za `latest-block`, vráti opakovateľný kód `503` (pozri nižšie). Rozdelenie rozsahu na dve časti vráti presne udalosti celého rozsahu, takže konzument môže prechádzať reťazec v častiach až do 1000 blokov a veľkosť časti si zvoliť ľubovoľne. Ak časť odpovie kódom `400`, pretože obsahuje príliš veľa udalostí, rozdeľte ju na polovicu a skúste znova; iba jediný blok, ktorý je sám osebe príliš veľký, nemôže byť nikdy obslúžený (a je takto aj nahlásený, nie ako `503`).

## Chybový kontrakt {#-error-contract}

Chyby vyvolané adaptérom sú JSON objekty v tvare `{ "error": "..." }`. Query parameter, ktorý vôbec nie je číslom (napríklad `fromBlock=abc`), odmietne už webový framework skôr s kódom `400` a štandardným problem-details JSON telom (`application/problem+json`).

| Status | Kedy |
|---|---|
| `200` | Úspech (rozsah bez udalostí je úspech s prázdnym zoznamom). |
| `400` | Chýbajúci alebo poškodený parameter, `toBlock` menší ako `fromBlock`, rozsah širší ako 1000 blokov (obe hranice vrátane: `toBlock - fromBlock` je najviac 999), rozsah, ktorý drží viac udalostí, než môže niesť jedna odpoveď (vyžiadajte menší rozsah), alebo **jediný blok**, ktorý sám drží viac udalostí, než dokáže API vrátiť (menší rozsah nepomôže; toto je deterministické a pri opakovaní nikdy neuspeje). Opakovanie tej istej požiadavky nepomôže. |
| `404` | Neznáme (alebo zničené / ako scam označené) aktívum alebo pár; takisto každý endpoint na nasadení, kde je adaptér vypnutý (prázdne telo). |
| `429` | Bol prekročený rate limit na IP adresu. Telo je `{ "error": "Rate limit exceeded. Try again later." }` a odpoveď nesie hlavičku `Retry-After: 60`: pred ďalšou požiadavkou počkajte takto dlho. Poller, ktorý sa pýta každé 2 sekundy, zostáva hlboko pod limitom. |
| `503` | **Opakovateľné (retryable)** na každom endpointe vrátane `asset` a `pair`. `toBlock` je za posledným zindexovaným blokom alebo nastal problém s úložiskom / vyhľadávaním (aktívum alebo pool, ktoré momentálne nemožno prečítať, sa nikdy nehlási ako neznáme). Odpoveď nesie `Retry-After: 2`. Adaptér nikdy neodpovedá čiastočným zoznamom a nikdy nekešuje čiastočnú odpoveď. |

Konzument by mal kód `503` spracovať ako „spýtaj sa znova o chvíľu, zachovaj svoju pozíciu“ a nesmie spracovať kód `503` pre `asset` alebo `pair` ako „neexistuje“.

## Záruky {#-guarantees}

- **Nemennosť (Immutability).** Odpoveď pre rozsah blokov na úrovni alebo pod `latest-block` sa dodatočne nemení: opakované požiadavky vracajú identické bajty a historická udalosť si zachováva svoju cenu, sumy, rezervy, poradie aj poplatky. Poradie aktív páru sa nikdy nemení a jeho poplatok je ten, ktorý bol nastavený pri vytvorení poolu. Jedinou zámernou výnimkou je samotné rozhodnutie o publikovaní: ak je pool neskôr klasifikovaný ako podvodný (vysoké scam hodnotenie), jeho udalosti od tej chvíle opustia feed a rozsah, ktorý sa prepočíta po vypršaní kešovanej kópie, to odrazí.
- **Úplnosť (Completeness).** Každý potvrdený Biatec swap až po `latest-block`, ktorý možno vyjadriť, je v `events`, a rovnako aj každý `join` a `exit`, ktorý možno vyjadriť s oboma rezervami; jedinými výnimkami sú udalosti preskočené podľa časti [Čo sa publikuje](#-what-is-published). Rozsah nie je nikdy zodpovedaný skôr, než sú uložené všetky jeho bloky.
- **Konzistentnosť naprieč replikami.** Všetky repliky hlásia rovnaký `latest-block`, takže konzument rozkladaný medzi ne vidí jednu históriu.
- **Efektívnosť.** Odpovede pre `asset` a `pair` pochádzajú z in-memory keší; rozsahy `events` sa po vypočítaní kešujú v pamäti a v Redise a súbežné identické požiadavky sa spájajú do jedného dopytu.

## Zabezpečenie kvality {#-quality-assurance}

Adaptér je testovaný voči publikovanému štandardu GeckoTerminal pri každej zmene a po každom nasadení:

- Prísny validátor schémy odmietne akúkoľvek odchýlku od štandardu (názvy polí, formáty, zoradenie, unikátnosť `(txnIndex, eventIndex)`, konzistentnosť ceny a sumy).
- Živá sada testov zhody (conformance suite) beží voči skutočnému API po každom nasadení (a následne každých niekoľko hodín): schéma, žiadne medzery pri sledovaní reťazca tak, ako to robí indexer, nemennosť voči zaznamenaným **vzorovým dátam (golden data)** (historické udalosti a páry musia byť reprodukované presne), chybový kontrakt, limity odozvy (`latest-block` a kešované rozsahy pod 800 ms na 95. percentile, studený 1000-blokový rozsah pod 8 s) a nárazová záťaž 50 súbežných pollerov (100 požiadaviek) a 150 požiadaviek tesne za sebou bez jediného `429`.
- Nasadenie na MainNet je povýšené až po tom, čo tá istá testovacia sada prešla na prostredí TestNet, a sada sa znova spustí na MainNete ihneď po nasadení.

## Zdroj pravdy {#-source-of-truth}

Adaptér je implementovaný v repozitári [AVMTradeReporter](https://github.com/scholtz/AVMTradeReporter) (`Controllers/CoinGeckoController.cs`, `Services/CoinGecko/`; jeho `docs/GECKOTERMINAL.md` je prevádzkovou príručkou záchrannej siete). Limity ako rozpätie 1000 blokov, rate limit a životnosti keší sú nastaveniami tejto služby; táto stránka uvádza hodnoty, s ktorými bežia nasadenia Biatec. Vyššie uvedené Swagger UI sa generuje priamo z bežiacej služby.

## Súvisiace dokumenty {#-related-documents}

- [Príručka integrácie](./integration-guide) pre on-chain integráciu Biatec CLAMM poolov.
- [Logaritmický systém tickov](./tick-system) o tom, ako je definovaný cenový rozsah poolu.
- Kompletné API služby trade reporter (vrátane endpointov vyžadujúcich autentifikáciu) sa nachádza vo vyššie odkazovanom Swagger UI.
