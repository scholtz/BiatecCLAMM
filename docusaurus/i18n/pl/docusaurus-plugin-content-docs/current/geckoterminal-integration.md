---
sidebar_label: Adapter DEX GeckoTerminal
---

# Adapter DEX GeckoTerminal

Biatec DEX publikuje swoje swapy oraz zmiany płynności w serwisie [GeckoTerminal](https://www.geckoterminal.com) (CoinGecko) za pośrednictwem **API adaptera DEX**, które jest zgodne ze specyfikacją *GeckoTerminal Integration API Standards v0.1* dla sieci innych niż EVM. Adapter jest obsługiwany przez serwis raportowania transakcji Biatec (AVMTradeReporter) — ten sam serwis, który napędza [Biatec Scan](https://scan.biatec.io) — dzięki czemu odczytuje dokładnie te dane, które wyświetla sam Biatec DEX.

Ta strona stanowi dokumentację referencyjną dla recenzentów CoinGecko / GeckoTerminal oraz dla każdego, kto chce korzystać z adaptera: opisuje bazowe adresy URL, cztery punkty końcowe (endpoints) z rzeczywistymi odpowiedziami, semantykę danych, kontrakt błędów oraz gwarancje utrzymywane przez adapter.

## Bazowe adresy URL {#-base-urls}

| Sieć | Bazowy URL | Swagger UI |
|---|---|---|
| **Algorand MainNet** | `https://api.algorand.scan.biatec.io/api/coingecko/` | [swagger/index.html](https://api.algorand.scan.biatec.io/swagger/index.html) |
| **Algorand TestNet** | `https://api.testnet.scan.biatec.io/api/coingecko/` | [swagger/index.html](https://api.testnet.scan.biatec.io/swagger/index.html) |

- Punkty końcowe są widoczne w Swagger UI pod ścieżkami `/api/coingecko/*` wraz z parametrami zapytań i modelami odpowiedzi.
- Wszystkie punkty końcowe obsługują zwykłe żądania `GET` zwracające `application/json`.
- W danej instancji wdrożeniowej adapter można wyłączyć; wówczas każdy punkt końcowy zwraca kod `404` z pustym ciałem odpowiedzi (pod dwoma powyższymi adresami URL adapter jest włączony).
- **Uwierzytelnianie nie jest wymagane.** Pozostała część API handlowego Biatec wykorzystuje tokeny podpisywane zgodnie z ARC-14; adapter celowo z nich nie korzysta, ponieważ indeksator GeckoTerminal nie może ich podpisywać.
- Limit zapytań (rate limit): adapter posiada własną pulę 1200 żądań na minutę na adres IP klienta (indeksator odpytuje serwis mniej więcej co 2 sekundy), niezależną od anonimowego limitu 60 żądań na minutę obowiązującego w pozostałej części API.

## Punkty końcowe (Endpoints) {#-endpoints}

| Punkt końcowy | Przeznaczenie |
|---|---|
| `GET /latest-block` | Najnowszy blok, dla którego wszystkie swapy, wpłaty (join) i wypłaty (exit) zostały zapisane i są gotowe do wyszukiwania. |
| `GET /asset?id=ASSET_ID` | Metadane aktywa będącego częścią opublikowanej puli. |
| `GET /pair?id=POOL_APP_ID` | Metadane puli (pary handlowej). |
| `GET /events?fromBlock=FROM&toBlock=TO` | Zdarzenia `swap`, `join` oraz `exit` z podanego zakresu bloków. |

Poniższe przykłady wykorzystują bazowy URL sieci MainNet (dla TestNet należy zastąpić go adresem TestNet) oraz rzeczywiste odpowiedzi zarejestrowane w dniu 2026-10-04. Numery bloków i rezerwy przesuwają się w czasie; zapytanie historyczne zwraca jednak ponownie te same zdarzenia (jedyny wyjątek opisano w sekcji [Gwarancje](#-guarantees)).

### latest-block {#-latest-block}

```bash
curl https://api.algorand.scan.biatec.io/api/coingecko/latest-block
```

```json
{ "block": { "blockNumber": 65671739, "blockTimestamp": 1791140699 } }
```

`blockNumber` to runda (round) sieci Algorand, a `blockTimestamp` to jej czas uniksowy w sekundach. Wartość ta stanowi **znacznik (watermark) w pełni przetworzonych bloków**: każde zdarzenie aż do tego bloku włącznie można już pobrać z `/events`. Znacznik jest opóźniony o kilka sekund, aby indeks wyszukiwania zdążył się odświeżyć, zanim GeckoTerminal odpyta o zdarzenia. Każda replika serwisu odpowiada tą samą wartością (jest ona replikowana w Redis), a wartość ta nigdy się nie cofa. Dopóki znacznik nie jest znany, punkt końcowy zwraca kod `503`.

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

- ALGO ma identyfikator aktywa `0`: `{"asset":{"id":"0","name":"Algorand","symbol":"ALGO","decimals":6,"totalSupply":"10000000000", ...}}`.
- `totalSupply` to całkowita podaż w pełnych jednostkach (już podzielona przez `10^decimals`); pole jest pomijane, gdy sieć go nie raportuje. `metadata.type` określa rodzaj aktywa (`ASA` dla standardowego aktywa Algorand), a `metadata.url` pojawia się tylko wtedy, gdy aktywo posiada przypisany adres URL. Pusta nazwa aktywa przyjmuje wartość nazwy jednostki (i odwrotnie), a w ostateczności tekst `"Asset"` z dołączonym identyfikatorem.
- Zwracane są wyłącznie aktywa należące do **opublikowanych pul**, dzięki czemu punkt końcowy nie może zostać użyty do zmuszenia serwisu do wyszukiwania dowolnych aktywów. Nieznane lub zniszczone aktywo zwraca `404`; aktywo, którego nie można w danej chwili odczytać, zwraca ponawialny błąd `503` (zobacz [Kontrakt błędów](#-error-contract)), nigdy `404`.

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

- Para odpowiada jednej **puli** Biatec CLAMM. Jej `id` to identyfikator aplikacji (app ID) kontraktu puli, dlatego te same dwa aktywa z innym poziomem opłat lub innym zakresem cenowym stanowią osobne pary.
- `asset0Id` to aktywo A puli, a `asset1Id` to jej aktywo B, w **kolejności on-chain** kontraktu puli; adapter nigdy ich nie przestawia (dlatego ALGO o id `0` może występować jako `asset1Id`, jak w powyższym przykładzie). Kolejność ta nigdy się nie zmienia.
- `feeBps` to opłata LP puli wyrażona w punktach bazowych (`1` = 0,01%). Jest to liczba JSON mogąca przyjmować wartości **ułamkowe** (opłata 0,005% to `0.5`), a klucz ten jest **pomijany**, gdy opłata nie jest znana lub wykracza poza przedział od 0 do 100%.
- Nieznane pule oraz pule oznaczone jako oszustwo (scam) zwracają `404`; pula, która istnieje, ale nie może zostać w danej chwili opisana, zwraca ponawialny kod `503`.

### events {#-events}

```bash
curl "https://api.algorand.scan.biatec.io/api/coingecko/events?fromBlock=65666403&toBlock=65666675"
```

Oba końce przedziału są **domknięte (włącznie)**. Pojedyncze zapytanie może obejmować maksymalnie **1000 bloków** (`toBlock - fromBlock` wynosi co najwyżej 999). Odpowiedź ma postać `{ "events": [...] }`, posortowaną według numeru bloku, następnie `txnIndex`, a następnie `eventIndex`; przedział bez zdarzeń zwraca `{ "events": [] }`.

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

**Join** (dodanie płynności; zdarzenie `exit` ma identyczny kształt dla usunięcia płynności)

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

| Pole | Znaczenie |
|---|---|
| `eventType` | `swap`, `join` (wpłata płynności) lub `exit` (wypłata płynności). |
| `asset0In` + `asset1Out` lub `asset1In` + `asset0Out` | Swap ma dokładnie jeden kierunek: co trader zapłacił i co otrzymał, w pełnych jednostkach każdego aktywa. |
| `amount0`, `amount1` | Kwoty operacji `join` / `exit`, w pełnych jednostkach. |
| `priceNative` | Zrealizowana cena swapu: **ilość asset1 za jedną jednostkę asset0** (w powyższym swapie 0.1515 ALGO za Vote). Jest zawsze większa od zera i stanowi iloraz dwóch wymienionych kwot, zapisany z precyzją typu `decimal` platformy .NET (około 28 cyfr znaczących, maksymalnie 28 miejsc po przecinku), dlatego należy porównywać ją z tolerancją zamiast dokładnej równości. |
| `reserves` | Rezerwy obu aktywów w puli **po** wystąpieniu zdarzenia. |
| `metadata.fees0In` / `fees1In` | **Nominalna** opłata LP swapu: kwota wejściowa pomnożona przez bazową stawkę opłaty puli, po stronie aktywa wejściowego. Kontrakt może skalować opłatę faktycznie pobieraną od tradera (trader ze zniżką opłat płaci mniej niż opłata nominalna), dlatego należy traktować tę wartość jako stawkę opłaty puli zastosowaną do wejścia, a nie zaudytowaną kwotę dla konkretnego tradera. Cały obiekt `metadata` jest **opcjonalny**: nie występuje, gdy opłata puli wynosi zero, wykracza poza zakres od 0 do 1 lub nie jest znana. |
| `block` | `blockNumber` oraz `blockTimestamp` (sekundy uniksowe) bloku zawierającego transakcję. |
| `txnId` | Identyfikator transakcji najwyższego poziomu (swap wykonany przez transakcję wewnętrzną jest raportowany pod transakcją podpisaną przez użytkownika). |
| `txnIndex`, `eventIndex` | Pozycja transakcji w bloku oraz zdarzenia wewnątrz transakcji. Razem z numerem bloku są **unikalne i deterministyczne** oraz definiują kolejność. Dla najstarszych zdarzeń, zapisanych zanim rejestrowano rzeczywistą pozycję, wartość ta jest deterministycznym zamiennikiem umieszczonym po rzeczywistych transakcjach danego bloku — nie należy więc używać jej do wyszukiwania zdarzeń on-chain; w tym celu należy użyć `txnId`. |
| `maker` | Konto, które wysłało transakcję. |
| `pairId` | Identyfikator aplikacji puli; rozwiązywany przez `/pair`. |

Kwoty są **łańcuchami dziesiętnymi (string)** w pełnych jednostkach (surowa kwota podzielona przez `10^decimals` danego aktywa). Kwoty transakcyjne (`asset0In`, `asset1Out`, `amount0`, ...) nigdy nie mają więcej miejsc po przecinku niż liczba `decimals` aktywa. Pola `reserves`, opłaty w `metadata` oraz `priceNative` mogą mieć więcej cyfr: Biatec wewnętrznie przechowuje rezerwy w skali `1e9`, a opłata stanowi ułamek kwoty wejściowej (w powyższym swapie 0,01% z 4918.617175 to `0.4918617175`). Wszystkie te wartości są wyrażone w tych samych pełnych jednostkach co kwoty.

## Co jest publikowane {#-what-is-published}

- **Wyłącznie pule Biatec DEX** (`dexKey` ma wartość `biatec`). Serwis raportowania śledzi wiele giełd DEX na Algorandzie na potrzeby Biatec Scan, ale ten adapter udostępnia wyłącznie Biatec DEX, więc zdarzenia z innych protokołów nigdy się tu nie pojawiają. Zakres 1000 bloków może być zatem pusty: pule Biatec handlują rzadziej niż cała sieć.
- Wyłącznie **potwierdzone** swapy i zmiany płynności.
- Zdarzenie, którego nie da się wyrazić zgodnie ze standardem, jest **pomijane** (i logowane po stronie serwera) zamiast wysyłania. GeckoTerminal zatrzymuje indeksowanie DEX-u przy pierwszym nieprawidłowym zdarzeniu, dlatego adapter woli pominąć zdarzenie niż zwrócić błędne dane. Przypadki te obejmują:
  - swap z zerową kwotą wejściową lub wyjściową, lub z obiema rezerwami równymi zero po transakcji, albo taki, którego cena zaokrągla się do zera lub nie daje się przedstawić;
  - zdarzenie `join` / `exit` bez żadnej kwoty lub takie, dla którego rezerwy **obu** aktywów nie są znane z transakcji. Pozycja skoncentrowanej płynności powyżej lub poniżej bieżącej ceny jest **jednostronna (single-sided)**: zmienia tylko jedną rezerwę, druga nie jest częścią zmiany stanu w transakcji, a adapter nie raportuje rezerwy, której nie potrafi udowodnić. Jednostronne wpłaty i wypłaty (a także pierwsza wpłata do pustej puli lub wycofanie ostatniej płynności) **nie** są zatem publikowane jako `join` / `exit`. Nigdy nie ukrywa to wolumenu obrotu: każdy swap zawiera autorytatywne rezerwy puli po jego wykonaniu;
  - zdarzenie dotyczące nieznanej lub niedopasowanej puli/aktywa oraz zdarzenie bez nadawcy lub identyfikatora transakcji.

  Przy uzgadnianiu tego kanału z transakcjami on-chain należy uwzględnić te różnice: swap jest pomijany tylko w rzadkich przypadkach wymienionych powyżej (nieużyteczna kwota lub cena), a zdarzenia `join` / `exit` obejmują wyłącznie zmiany płynności dotykające obu aktywów puli.

## Jak korzystać z adaptera {#-how-to-consume-it}

Wzorzec używany przez indeksator GeckoTerminal, względem którego testujemy serwis:

1. Wywołaj `latest-block`.
2. Wywołaj `events` dla zakresu `(lastIndexedBlock + 1) .. latest`, w porcjach po maksymalnie 1000 bloków.
3. Dla każdego wcześniej niewidzianego `pairId` wywołaj `pair`; dla każdego aktywa tej pary wywołaj `asset`. Para jest niemutowalna, a aktywo jest niemutowalne poza polem `totalSupply` (które może się zmieniać dla aktywów z możliwością dodruku), więc oba obiekty można buforować (cache'ować); odświeżaj podaż okresowo, jeśli ją wyświetlasz.
4. Odczekaj około 2 sekundy i powtórz cykl.

Zapytanie o zakres, którego `toBlock` wykracza poza `latest-block`, zwraca ponawialny kod `503` (zobacz poniżej). Podzielenie zakresu na dwie części zwraca dokładnie te same zdarzenia co cały zakres, dzięki czemu klient może przeglądać łańcuch w porcjach do 1000 bloków i dowolnie dobierać rozmiar porcji. Jeśli porcja zwróci `400`, ponieważ zawiera zbyt wiele zdarzeń, podziel ją na pół i ponów próbę; jedynie pojedynczy blok, który sam w sobie jest zbyt duży, nie może zostać nigdy obsłużony (i jest zgłaszany jako taki, a nie jako `503`).

## Kontrakt błędów {#-error-contract}

Błędy zgłaszane przez adapter są obiektami JSON w postaci `{ "error": "..." }`. Parametr zapytania niebędący w ogóle liczbą (na przykład `fromBlock=abc`) jest odrzucany wcześniej przez framework webowy z kodem `400` i standardowym ciałem JSON `application/problem+json`.

| Status | Kiedy występuje |
|---|---|
| `200` | Sukces (zakres bez zdarzeń to również sukces z pustą listą). |
| `400` | Brakujący lub niepoprawnie sformatowany parametr, `toBlock` mniejszy niż `fromBlock`, zakres szerszy niż 1000 bloków (oba końce włącznie: `toBlock - fromBlock` wynosi co najwyżej 999), zakres zawierający więcej zdarzeń niż mieści jedna odpowiedź (odpytaj o mniejszy zakres) lub **pojedynczy blok**, który sam zawiera więcej zdarzeń niż API może zwrócić (mniejszy zakres nie pomoże; błąd jest deterministyczny i ponowienie nigdy się nie powiedzie). Ponawianie tego samego żądania nie pomoże. |
| `404` | Nieznane (lub zniszczone / oznaczone jako scam) aktywo lub para; a także każdy punkt końcowy w instancji, w której adapter jest wyłączony (puste ciało). |
| `429` | Przekroczono limit zapytań na adres IP. Ciało odpowiedzi to `{ "error": "Rate limit exceeded. Try again later." }`, a odpowiedź zawiera nagłówek `Retry-After: 60`: należy odczekać tyle sekund przed kolejnym żądaniem. Klient odpytujący co 2 sekundy pozostaje daleko poniżej limitu. |
| `503` | **Ponawialny (retryable)** na każdym punkcie końcowym, włączając `asset` oraz `pair`. `toBlock` wykracza poza ostatni zindeksowany blok lub wystąpił chwilowy problem z odczytem/pamięcią masową (aktywo lub pula, których nie można w danej chwili odczytać, nigdy nie są zgłaszane jako nieznane). Odpowiedź zawiera nagłówek `Retry-After: 2`. Adapter nigdy nie zwraca częściowej listy i nigdy nie buforuje częściowej odpowiedzi. |

Klient powinien traktować kod `503` jako sygnał „zapytaj ponownie za chwilę, zachowaj swoją pozycję” i nie może traktować kodu `503` dla `asset` lub `pair` jako informacji „nie istnieje”.

## Gwarancje {#-guarantees}

- **Niemutowalność.** Odpowiedź dla zakresu bloków mniejszych lub równych `latest-block` nie zmienia się w przyszłości: powtarzane żądania zwracają identyczne bajty, a historyczne zdarzenie zachowuje swoją cenę, kwoty, rezerwy, kolejność i opłaty. Kolejność aktywów w parze nigdy się nie zmienia, a jej opłata jest taka, jaką ustawiono przy tworzeniu puli. Jedynym celowym wyjątkiem jest sama decyzja o publikacji: jeśli pula zostanie później sklasyfikowana jako oszustwo (wysoki wskaźnik scam), jej zdarzenia znikają z kanału od tego momentu, a zakres przeliczony ponownie po wygaśnięciu kopii w pamięci podręcznej będzie to odzwierciedlał.
- **Kompletność.** Każdy potwierdzony swap Biatec aż do `latest-block`, który daje się wyrazić w standardzie, znajduje się w `events`, podobnie jak każde zdarzenie `join` i `exit`, które daje się wyrazić z obiema rezerwami; jedynymi wyjątkami są zdarzenia pomijane zgodnie z sekcją [Co jest publikowane](#-what-is-published). Odpowiedź dla zakresu nigdy nie jest zwracana przed zapisaniem wszystkich jego bloków.
- **Spójność pomiędzy replikami.** Wszystkie repliki zgłaszają ten sam `latest-block`, dzięki czemu klient przełączany pomiędzy nimi przez load balancer widzi jedną spójną historię.
- **Wydajność.** Odpowiedzi `asset` i `pair` pochodzą z pamięci podręcznej RAM; zakresy `events` po obliczeniu są buforowane w pamięci RAM i w Redis, a współbieżne identyczne żądania są łączone w jedno zapytanie.

## Zapewnienie jakości {#-quality-assurance}

Adapter jest testowany pod kątem opublikowanego standardu GeckoTerminal przy każdej zmianie oraz po każdym wdrożeniu:

- Ścisły walidator schematu odrzuca wszelkie odstępstwa od standardu (nazwy pól, formaty, kolejność, unikalność `(txnIndex, eventIndex)`, spójność cen i kwot).
- Zestaw testów zgodności na żywo uruchamia się przeciwko prawdziwemu API po każdym wdrożeniu (a następnie co kilka godzin): weryfikuje schemat, brak luk podczas śledzenia łańcucha tak jak robi to indeksator, niemutowalność względem zapisanych **danych wzorcowych (golden data)** (historyczne zdarzenia i pary muszą być odtwarzane identycznie), kontrakt błędów, budżety opóźnień (`latest-block` i zbuforowane zakresy poniżej 800 ms w 95. percentylu, zimny zakres 1000 bloków poniżej 8 s) oraz serię 50 współbieżnych klientów (100 żądań) i 150 żądań jedno po drugim bez ani jednego błędu `429`.
- Wdrożenie na MainNet jest promowane dopiero po przejściu tego samego zestawu testów na środowisku TestNet, a zestaw uruchamia się ponownie na MainNet bezpośrednio po wdrożeniu.

## Źródło prawdy {#-source-of-truth}

Adapter jest zaimplementowany w repozytorium [AVMTradeReporter](https://github.com/scholtz/AVMTradeReporter) (`Controllers/CoinGeckoController.cs`, `Services/CoinGecko/`; plik `docs/GECKOTERMINAL.md` stanowi instrukcję operacyjną zabezpieczeń). Limity takie jak rozpiętość 1000 bloków, limit zapytań oraz czasy życia pamięci podręcznej są ustawieniami tego serwisu; niniejsza strona podaje wartości używane we wdrożeniach Biatec. Powyższy interfejs Swagger UI jest generowany bezpośrednio z działającego serwisu.

## Powiązane dokumenty {#-related-documents}

- [Przewodnik integracji](./integration-guide) — integracja z pulami Biatec CLAMM on-chain.
- [Logarytmiczny system ticków](./tick-system) — jak definiowany jest zakres cenowy puli.
- Pełne API serwisu raportowania transakcji (w tym punkty końcowe wymagające uwierzytelniania) znajduje się w podlinkowanym powyżej interfejsie Swagger UI.
