# Referencia chybových kódov BiatecCLAMM

Tento dokument poskytuje komplexnú referenciu všetkých chybových kódov používaných v systéme smart kontraktov BiatecCLAMM. Pochopenie týchto chybových kódov pomôže vývojárom debugovať problémy a poskytovať lepšie používateľské skúsenosti.

# Referencja kodów błędów BiatecCLAMM

Ten dokument zawiera kompleksową referencję wszystkich kodów błędów używanych w systemie smart kontraktów BiatecCLAMM. Zrozumienie tych kodów błędów pomoże deweloperom debugować problemy i zapewniać lepsze doświadczenia użytkowników.

## Format kodu błędu {#-format-kodu-bledu}

Kody błędów śledzą spójny format:

- **Krótkie kody**: 3-4 znakowe kody z prefiksem `E_` lub `ERR-`
- **Przykład**: `E_CONFIG`, `ERR-LOW-VER`

## Błędy podstawowych kontraktów {#-bledy-podstawowych-kontraktow}

### BiatecClammPool {#-biatecclammpool}

#### Błędy konfiguracji i inicjalizacji {#-bledy-konfiguracji-i-inicjalizacji}

| Kod               | Opis                                  | Przyczyna                                                   | Rozwiązanie                                         |
| ----------------- | ------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| `E_CONFIG`        | Niespójność aplikacji konfiguracyjnej | Podane config app ID nie odpowiada zarejestrowanemu config  | Zweryfikuj prawidłową referencję config app         |
| `E_UPDATER`       | Nieautoryzowany updater               | Nadawca nie jest autoryzowanym adresem updater              | Użyj prawidłowego konta updater                     |
| `E_SENDER`        | Nieautoryzowany nadawca               | Nadawca nie jest autoryzowany do tej operacji               | Użyj autoryzowanego konta (twórca, executive, itp.) |
| `E_PRICE_MAX`     | Bootstrap już został wywołany         | Nie można bootstrapować dwukrotnie                          | Pula już jest zainicjalizowana                      |
| `E_PRICE`         | Nieprawidłowa cena                    | Cena musi być większa niż zero                              | Ustaw prawidłowe wartości cenowe                    |
| `E_FEE`           | Bootstrap już jest zakończony         | Opłata już jest ustawiona, nie można bootstrapować ponownie | Pula już jest zainicjalizowana                      |
| `E_PAUSED`        | Usługi wstrzymane                     | Protokół jest obecnie wstrzymany przez admina               | Poczekaj na unpause lub skontaktuj się z adminem    |
| `E_STAKING_PRICE` | Nieprawidłowa cena puli stakingowej   | Same-asset pule wymagają płaskiego zakresu cenowego         | Ustaw priceMin === priceMax dla pul stakingowych    |
| `E_PRICE_RANGE`   | Nieprawidłowy zakres cenowy           | Standardowe pule wymagają priceMin < priceMax               | Użyj rozszerzających granic cenowych                |
| `E_ASSET_ORDER`   | Nieprawidłowa kolejność aktywów       | Asset A musi być mniejszy niż Asset B                       | Zapewnij assetA.id < assetB.id                      |

#### Błędy płynności i bilansów {#-bledy-plynności-i-bilansow}

| Kod                   | Opis                                            | Przyczyna                            | Rozwiązanie                                      |
| --------------------- | ----------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `E_ZERO_LIQ`          | Zerowa płynność                                 | Płynność jest zero przed dzieleniem  | Zapewnij, że pula ma płynność                    |
| `E_ZERO_DENOM`        | Zerowy mianownik                                | Mianownik w kalkulacji jest zero     | Sprawdź parametry wejściowe                      |
| `ERR-LIQ-DROP`        | Przekroczony spadek płynności                   | Płynność spadła więcej niż dozwolone | Sprawdź błędy zaokrąglania lub niespójność stanu |
| `ERR-TOO-MUCH`        | Nadmierna wypłata                               | Próba wypłaty więcej niż dostępne    | Zmniejsz ilość wypłaty                           |
| `ERR-BALANCE-CHECK-1` | Sprawdzenie bilansów nie powiodło się (Asset A) | Bilans Asset A niespójny             | Sprawdź stan puli                                |
| `ERR-BALANCE-CHECK-2` | Sprawdzenie bilansów nie powiodło się (Asset B) | Bilans Asset B niespójny             | Sprawdź stan puli                                |

#### Błędy tożsamości i weryfikacji {#-bledy-tozsamosci-i-weryfikacji}

| Kod                  | Opis                              | Przyczyna                                                    | Rozwiązanie                                    |
| -------------------- | --------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| `ERR-INVALID-CONFIG` | Nieprawidłowa aplikacja config    | Config app nie odpowiada zarejestrowanemu config puli        | Użyj prawidłowej referencji config app         |
| `ERR-WRONG-IDENT`    | Nieprawidłowy dostawca tożsamości | Dostawca tożsamości nie odpowiada config                     | Użyj prawidłowego dostawcy tożsamości          |
| `ERR-USER-LOCKED`    | Konto użytkownika zablokowane     | Konto użytkownika jest zablokowane przez dostawcę tożsamości | Skontaktuj się z wsparciem w celu odblokowania |
| `ERR-LOW-VER`        | Klasa weryfikacji zbyt niska      | Klasa weryfikacji użytkownika poniżej minimum                | Ukończ wymaganą weryfikację KYC                |
| `ERR-HIGH-VER`       | Klasa weryfikacji poza granicami  | Klasa weryfikacji przekracza maksimum (4)                    | Sprawdź dane dostawcy tożsamości               |

#### Błędy swap {#-bledy-swap}

| Kod                                  | Opis                               | Przyczyna                              | Rozwiązanie                                      |
| ------------------------------------ | ---------------------------------- | -------------------------------------- | ------------------------------------------------ |
| `E_ASSET_A`                          | Nieprawidłowy Asset A              | Asset A nie odpowiada Asset A puli     | Użyj prawidłowego aktywa                         |
| `E_ASSET_B`                          | Nieprawidłowy Asset B              | Asset B nie odpowiada Asset B puli     | Użyj prawidłowego aktywa                         |
| `Swaps not allowed in staking pools` | Próba swap w puli stakingowej      | Nie można swapować w pulach same-asset | Użyj add/remove liquidity zamiast                |
| `Minimum to receive is not met`      | Uruchomiona ochrona przed slippage | Wyjście mniej niż minimumToReceive     | Zwiększ tolerancję slippage lub spróbuj ponownie |

### BiatecConfigProvider {#-biatecconfigprovider}

| Kod                                                              | Opis                         | Przyczyna                     | Rozwiązanie                        |
| ---------------------------------------------------------------- | ---------------------------- | ----------------------------- | ---------------------------------- |
| `Only addressUdpater setup in the config can update application` | Nieautoryzowana próba update | Nadawca nie jest updater      | Użyj autoryzowanego adresu updater |
| `E_PAUSED`                                                       | Usługi wstrzymane            | Protokół wstrzymany globalnie | Poczekaj na admina na unpause      |

### BiatecIdentityProvider {#-biatecidentityprovider}

| Kod                                                              | Opis                            | Przyczyna                                    | Rozwiązanie                                   |
| ---------------------------------------------------------------- | ------------------------------- | -------------------------------------------- | --------------------------------------------- |
| `Configuration app does not match`                               | Niespójność config              | Podany config nie odpowiada zarejestrowanemu | Użyj prawidłowej aplikacji config             |
| `Only addressUdpater setup in the config can update application` | Nieautoryzowany update          | Nie jest autoryzowanym updater               | Użyj konta updater                            |
| `ERR_PAUSED`                                                     | Usługi wstrzymane               | Protokół obecnie wstrzymany                  | Poczekaj na unpause                           |
| `FeeMultiplierBase must be set properly`                         | Nieprawidłowy mnożnik opłat     | Mnożnik opłat musi równać SCALE              | Ustaw feeMultiplierBase na SCALE (1000000000) |
| `Verification class out of bounds`                               | Nieprawidłowa klasa weryfikacji | Klasa musi być 0-4                           | Użyj prawidłowej klasy weryfikacyjnej         |

### BiatecPoolProvider {#-biatecpoolprovider}

| Kod                                                              | Opis                         | Przyczyna                                    | Rozwiązanie                           |
| ---------------------------------------------------------------- | ---------------------------- | -------------------------------------------- | ------------------------------------- |
| `E_CONFIG`                                                       | Niespójność config           | Podany config nie odpowiada zarejestrowanemu | Użyj zarejestrowanej aplikacji config |
| `Configuration app does not match`                               | Niespójność aplikacji config | Podana nieprawidłowa aplikacja config        | Zweryfikuj ID aplikacji config        |
| `Only addressUdpater setup in the config can update application` | Nieautoryzowany update       | Nadawca nie jest autoryzowanym updater       | Użyj konta updater                    |
| `ERR_PAUSED`                                                     | Usługi wstrzymane            | Protokół jest wstrzymany                     | Poczekaj na akcję admin               |
| `Pool already registered`                                        | Duplikacja rejestracji puli  | Pula lub config już istnieje                 | Sprawdź istniejące pule               |

## Powszechne scenariusze błędów {#-powszechne-scenariusze-bledow}

### Niepowodzenia tworzenia puli {#-niepowodzenia-tworzenia-puli}

**Błąd**: `E_STAKING_PRICE`

```
Przyczyna: Tworzenie puli stakingowej (assetA === assetB) z priceMin !== priceMax
Rozwiązanie: Dla pul stakingowych ustaw priceMin = priceMax = 1000000000 (SCALE)
```

**Błąd**: `E_CONFIG` w deployPool

```
Przyczyna: Próba deploy puli z niezarejestrowaną aplikacją config
Rozwiązanie: Użyj kanonicznej aplikacji config zarejestrowanej z dostawcą puli
```

### Niepowodzenia swap {#-niepowodzenia-swap}

**Błąd**: `ERR-LOW-VER`

```
Przyczyna: Klasa weryfikacji użytkownika niewystarczająca dla wymagań puli
Rozwiązanie: Ukończ dodatkową weryfikację KYC/identity aby zwiększyć klasę
```

**Błąd**: `Swaps not allowed in staking pools`

```
Przyczyna: Próba swap w puli stakingowej B-ALGO lub B-USDC
Rozwiązanie: Użyj distributeExcessAssets dla nagród, tylko add/remove liquidity
```

**Błąd**: `Minimum to receive is not met`

```
Przyczyna: Cena poruszyła się niekorzystnie podczas transakcji, uruchomiona ochrona slippage
Rozwiązanie: Zwiększ tolerancję minimumToReceive lub poczekaj na lepszą cenę
```

### Niepowodzenia zapewniania płynności {#-niepowodzenia-zapewniania-plynności}

**Błąd**: `E_ZERO_LIQ`

```
Przyczyna: Próba operacji gdy pula ma zerową płynność
Rozwiązanie: Najpierw zainicjalizuj pulę z płynnością
```

**Błąd**: `ERR-LIQ-DROP`

```
Przyczyna: Kalkulacja płynności doprowadziła do niedopuszczalnego spadku
Rozwiązanie: Sprawdź błędy kalkulacyjne lub problemy z zaokrąglaniem
```

### Niepowodzenia operacji administracyjnych {#-niepowodzenia-operacji-administracyjnych}

**Błąd**: `E_UPDATER` lub `E_SENDER`

```
Przyczyna: Próba wykonania funkcji admin bez prawidłowej autoryzacji
Rozwiązanie: Użyj wyznaczonego konta admin (addressUpdater, addressExecutiveFee, itp.)
```

**Błąd**: `E_PAUSED`

```
Przyczyna: Wstrzymanie protokołu jest aktywne
Rozwiązanie: Poczekaj na admina na unpause usług, lub skontaktuj się z zarządem protokołu
```

## Sprawdzone praktyki obsługi błędów {#-sprawdzone-praktyki-obslugi-bledow}

### Dla deweloperów {#-dla-deweloperow}

1. **Zawsze sprawdzaj Config**: Zapewnij, że wszystkie referencje aplikacji (config, identity, pool provider) są prawidłowe
2. **Waliduj wejścia**: Sprawdź ID aktywów, ilości i parametry slippage przed wysłaniem
3. **Obsługuj stan wstrzymania**: Sprawdź, czy protokół jest wstrzymany przed próbą operacji
4. **Używaj Try-Catch**: Opakuj wywołania kontraktów w try-catch i parsuj komunikaty błędów
5. **Loguj błędy**: Loguj pełny kontekst błędu dla debugowania

### Dla użytkowników {#-dla-uzytkownikow}

1. **Weryfikacja tożsamości**: Zapewnij, że Twoje konto ma wystarczającą klasę weryfikacji
2. **Tolerancja slippage**: Ustaw odpowiednią ochronę slippage dla zmiennych rynków
3. **Typ puli**: Zrozum różnicę między pulami płynności a pulami stakingowymi
4. **Stan konta**: Zweryfikuj, że Twoje konto nie jest zablokowane przed transakcjami

## Wskazówki debugowania {#-wskazowki-debugowania}

### Znajdowanie kontekstu błędu {#-znajdowanie-kontekstu-bledu}

Gdy wystąpi błąd:

1. **Sprawdź logi transakcyjne**: Użyj indeksatora Algorand do wyświetlenia szczegółów transakcji
2. **Zweryfikuj referencje aplikacji**: Zapewnij, że wszystkie ID aplikacji odpowiadają oczekiwanym wartościom
3. **Sprawdź stan globalny**: Przeczytaj stan globalny aplikacji config/identity/pool
4. **Sprawdź pamięć box**: Zweryfikuj, że referencje box są włączone w transakcji
5. **Przejrzyj ostatnie zmiany**: Sprawdź, czy protokół był ostatnio aktualizowany lub wstrzymany

### Powszechne błędne konfiguracje {#-powszechne-bledne-konfiguracje}

- **Nieprawidłowa aplikacja Config**: Użycie config testnet na mainnet lub odwrotnie
- **Brakujące referencje box**: Zapomnienie włączenia wymaganych referencji box
- **Nieprawidłowa kolejność aplikacji**: Aplikacje muszą być w prawidłowej kolejności w tablicy foreign apps
- **Niewystarczające opłaty**: Niewystarczające opłaty dla złożonych operacji wymagających zwiększenia budżetu opcode

## Odzyskiwanie z błędów {#-odzyskiwanie-z-bledow}

### Dla błędów odwracalnych {#-dla-bledow-odwracalnych}

Większość błędów jest odwracalna poprzez naprawę problemu i powtórzenie:

- Weryfikacja tożsamości: Ukończ wymagane KYC
- Błędy config: Użyj prawidłowych referencji aplikacji
- Slippage: Dostosuj tolerancję i spróbuj ponownie
- Wstrzymanie: Poczekaj na przywrócenie usług

### Dla błędów nieodwracalnych {#-dla-bledow-nieodwracalnych}

Niektóre błędy wymagają interwencji admin:

- Konto zablokowane: Skontaktuj się z dostawcą tożsamości
- Protokół wstrzymany: Poczekaj na decyzję zarządu
- Błędy kontraktu: Zgłoś deweloperom

## Wsparcie {#-wsparcie}

Jeśli napotkasz błąd, który nie jest udokumentowany tutaj lub potrzebujesz pomocy:

1. **GitHub Issues**: Otwórz issue z pełnymi szczegółami błędu
2. **Dokumentacja**: Sprawdź folder docs/ dla przewodników
3. **Raporty audytu**: Przejrzyj folder audits/ dla znanych problemów
4. **Społeczność**: Dołącz do kanałów społeczności dla wsparcia

---

**Ostatnia aktualizacja**: 2025-10-28
**Wersja**: 1.0
**Zarządzane**: Zespół BiatecCLAMM
