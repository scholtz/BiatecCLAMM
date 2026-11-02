---
sidebar_label: Opłaty Sieciowe
---

# Opłaty Sieciowe

Ten dokument wyjaśnia strukturę opłat i mechanikę w skoncentrowanych pulach płynności BiatecCLAMM.

## Przegląd

BiatecCLAMM implementuje wielopoziomowy system opłat zaprojektowany do kompensacji dostawców płynności przy jednoczesnym zachowaniu zrównoważoności protokołu. Opłaty są zbierane podczas operacji wymiany i dystrybuowane między dostawców płynności a protokół.

Użytkownicy płacą dwa typy opłat:

1. **Opłaty Protokołu**: Opłaty handlowe, które trafiają do dostawców płynności i protokołu (obecnie 20% opłat LP trafia do Biatec)
2. **Opłaty Sieciowe**: Opłaty blockchainu Algorand wymagane do przetwarzania transakcji

## Opłaty Sieciowe Algorand

Oprócz opłat protokołu, użytkownicy muszą płacić opłaty sieciowe blockchainu Algorand za każdą transakcję. Są one płacone w ALGO i pokrywają koszty obliczeniowe przetwarzania transakcji w sieci.

### Minimalne Opłaty Transakcyjne

- **Opłata Bazowa**: 1,000 microAlgos (0.001 ALGO) za transakcję
- **Wywołania Aplikacji**: Dodatkowe opłaty w zależności od złożoności i wykorzystania zasobów
- **Transakcje Zgrupowane**: Każda transakcja w grupie płaci minimalną opłatę

### Opłaty za Tworzenie Puli

Tworzenie nowej puli płynności wymaga wielu transakcji i ma najwyższe opłaty sieciowe ze względu na Minimalne Wymagania Salda (MBR) dla nowego konta puli. **Uwaga**: Tworzenie puli wymaga znaczącej wstępnej inwestycji ~5 ALGO na zgodność z MBR.

**Podział Transakcji:**

- Transakcja wdrożenia puli: 10,000 microAlgos (0.01 ALGO) stała opłata
- Wywołania NOOP dostawcy puli: 2 × 1,000 microAlgos (0.002 ALGO)
- Minimalne Wymaganie Salda (MBR): 5,000,000 microAlgos (5 ALGO) - wymagane dla konta puli
- Krok bootstrap 2: 5,000 microAlgos (0.005 ALGO) dodatkowa opłata

**Całkowita Opłata Sieciowa**: ~5.018 ALGO (w tym wymaganie MBR)
**Całkowita Liczba Transakcji**: 4-6 transakcji w grupie

### Opłaty za Dodanie Płynności

Dodawanie płynności do istniejącej puli:

**Podział Transakcji:**

- Główne wywołanie dodania płynności: 8,000 microAlgos (0.008 ALGO) stała opłata
- Transakcje transferu aktywów: 1-2 × 1,000 microAlgos (0.001-0.002 ALGO)
- Wywołanie NOOP dostawcy puli: 1,000 microAlgos (0.001 ALGO)
- Opt-in tokenów LP (jeśli potrzebne): 1,000 microAlgos (0.001 ALGO)

**Całkowita Opłata Sieciowa**: ~0.011-0.013 ALGO
**Całkowita Liczba Transakcji**: 3-5 transakcji w grupie

### Opłaty za Swap

Wykonanie wymiany (swapu) tokenów:

**Podział Transakcji:**

- Główne wywołanie swap: 12,000 microAlgos (0.012 ALGO) stała opłata
- Transakcja transferu aktywa: 1,000 microAlgos (0.001 ALGO)

**Całkowita Opłata Sieciowa**: ~0.013 ALGO
**Całkowita Liczba Transakcji**: 2-3 transakcje w grupie

### Opłaty za Usunięcie Płynności

Wycofanie płynności z puli:

**Podział Transakcji:**

- Główne wywołanie usunięcia płynności: 12,000 microAlgos (0.012 ALGO) stała opłata
- Transfer tokenu LP: 1,000 microAlgos (0.001 ALGO)

**Całkowita Opłata Sieciowa**: ~0.013 ALGO
**Całkowita Liczba Transakcji**: 1-2 transakcje w grupie

### Optymalizacja Opłat

Protokół wykorzystuje grupowanie transakcji w celu minimalizacji opłat sieciowych:

- **Transakcje Atomowe**: Wszystkie operacje w grupie kończą się sukcesem lub niepowodzeniem razem
- **Współdzielone Referencje**: Referencje boxów i aplikacji są współdzielone pomiędzy zgrupowanymi transakcjami
- **Wydajny Dostęp do Stanu**: Minimalna liczba odczytów i zapisów stanu on-chain

### Szacowanie Opłat w Kodzie

Podczas szacowania całkowitego kosztu dla użytkownika należy uwzględnić zarówno opłaty protokołu, jak i opłaty sieciowe:

```typescript
// Szacowanie opłaty protokołu
const protocolFee = (swapAmount * lpFeeRate) / SCALE;

// Szacowanie opłaty sieciowej (przybliżone)
const networkFee = 13000; // microAlgos dla operacji swap

// Całkowity koszt użytkownika
const totalCost = swapAmount + protocolFee + networkFee / 1_000_000; // Konwersja na ALGO
```

## Typy Opłat

### 1. Opłaty Dostawców Płynności (LP)

**Definicja**: Opłaty pobierane przy transakcjach swap, które wynagradzają dostawców płynności za udostępnienie kapitału w puli.

**Konfiguracja**:

- Ustawiana indywidualnie dla każdej puli (nie globalnie)
- Zakres: od 0% do 100% (reprezentowany z dokładnością do 9 miejsc dziesiętnych)
- Przykład: opłata 10% = `100_000_000` (0.1 \* 10^9)
- Przechowywana w stanie kontraktu puli jako `fee`

**Obliczenie**: Stosowana do kwoty wejściowej swapu przed obliczeniem kwoty wyjściowej.

```typescript
// Obliczanie opłaty w funkcji swap
const feesMultiplier = (s - ((this.fee.value as uint256) * (user.feeMultiplier as uint256)) / (user.base as uint256)) as uint256;
const inAssetAfterFee = (inAssetInBaseScale * feesMultiplier) / s;
```

### 2. Opłaty Protokołu Biatec

**Definicja**: Procent opłat LP pobierany przez protokół w celu utrzymania ciągłości operacyjnej.

**Konfiguracja**:

- Ustawiana globalnie w kontrakcie `BiatecConfigProvider`
- **Obecna Stawka**: 20% opłat LP
- Maksimum: 50% opłat LP, Minimum: 0% opłat LP (wymuszane przez kontrakt)
- Przechowywana jako `biatecFee` w kontrakcie konfiguracyjnym
- Przykład: 10% opłat LP = `100_000_000` (0.1 \* 10^9)

**Dystrybucja**: Gdy opłaty Biatec są włączone, zebrane opłaty są dzielone pomiędzy użytkowników a protokół:

```typescript
if (biatecFee === 0n) {
  const usersLiquidityFromFeeIncrement = diff;
  this.LiquidityUsersFromFees.value = this.LiquidityUsersFromFees.value + usersLiquidityFromFeeIncrement;
} else {
  const usersLiquidityFromFeeIncrement = (diff * (s - biatecFee)) / s;
  const biatecLiquidityFromFeeIncrement = diff - usersLiquidityFromFeeIncrement;
  this.LiquidityUsersFromFees.value = this.LiquidityUsersFromFees.value + usersLiquidityFromFeeIncrement;
  this.LiquidityBiatecFromFees.value = this.LiquidityBiatecFromFees.value + biatecLiquidityFromFeeIncrement;
}
```

### 3. Mnożniki Opłat Użytkowników

**Definicja**: Zniżki lub dopłaty do opłat zależne od poziomu weryfikacji tożsamości użytkownika oraz jego aktywności.

**Konfiguracja**:

- Wyznaczana na podstawie klasy weryfikacji tożsamości oraz poziomu aktywności użytkownika
- **Zakres**: od 1.0 do 2.0 (mnożnik stosowany do bazowych opłat LP)
- **Mnożnik Bazowy**: 2.0 (anonimowi użytkownicy płacą 2-krotność bazowej opłaty LP)
- Zweryfikowani użytkownicy mogą otrzymać zniżki aż do poziomu 1.0x (brak dopłaty)
- Stosowany jako mnożnik do bazowych opłat LP

**Wyznaczanie na podstawie aktywności**:

- **Anonimowi Użytkownicy**: mnożnik 2.0x (podwójne opłaty)
- **Zweryfikowany Basic**: mnożnik 1.5x (50% dopłaty)
- **Zweryfikowany Advanced**: mnożnik 1.2x (20% dopłaty)
- **Zweryfikowany Premium**: mnożnik 1.0x (brak dopłaty)

**Źródło**: Pobierane z kontraktu `BiatecIdentityProvider` podczas operacji swap.

## Proces Pobierania Opłat

### Podczas Swapów

1. **Kwota Wejściowa**: Użytkownik wysyła tokeny do wymiany
2. **Potrącenie Opłaty**: Opłaty LP są potrącane z kwoty wejściowej
3. **Mnożnik Użytkownika**: Stosowany jest mnożnik opłat oparty na tożsamości
4. **Obliczenie Swapu**: Kwota wyjściowa jest obliczana na podstawie skorygowanej kwoty wejściowej
5. **Aktualizacja Płynności**: Płynność puli wzrasta o kwotę opłaty
6. **Dystrybucja Opłaty**: Opłaty są dzielone pomiędzy użytkowników a Biatec (jeśli skonfigurowano)

### Księgowanie Opłat

Opłaty są śledzone w stanie puli jako dodatkowa płynność:

- `LiquidityUsersFromFees`: Opłaty należące do dostawców płynności
- `LiquidityBiatecFromFees`: Opłaty zebrane przez protokół

Wartości te reprezentują niezrealizowaną płynność z opłat, która zwiększa wartość tokenów LP.

## Wypłata Opłat

### Dla Dostawców Płynności

Opłaty LP są automatycznie uwzględniane podczas wycofywania płynności. Obliczenie wypłaty bierze pod uwagę naliczone opłaty:

```typescript
// Obliczanie wypłaty skorygowane o opłaty
const percentageOfL = (lpAmount * s) / totalLpSupply;
const assetAOut = (assetABalance * percentageOfL) / s;
const assetBOut = (assetBBalance * percentageOfL) / s;
```

### Dla Opłat Protokołu

Opłaty protokołu mogą być wypłacane przez wyznaczony adres wykonawczy opłat (`addressExecutiveFee`) za pomocą metod `removeLiquidityAdmin`, `distributeExcessAssets` lub `withdrawExcessAssets`.

## Mechanizmy Ochrony Opłat

### Ochrona Przed Nowymi LP

Aby uniemożliwić nowym dostawcom płynności przejmowanie historycznych opłat, protokół podczas mintowania tokenów LP dyskontuje przyrost płynności o istniejący współczynnik opłat i księguje różnicę w `LiquidityUsersFromFees`:

```
X = delta * distributedLp / (distributedLp + LiquidityUsersFromFees)
```

Zapewnia to, że nowi dostawcy płynności nie mogą natychmiast wypłacić historycznych opłat należących do dotychczasowych dostawców (zobacz [Ochrona opłat płynności](./liquidity-fee-protection) oraz [Agregacja opłat wielu podmiotów](./multi-party-fee-aggregation)).

### Zachowanie Zaokrąglania

- Obliczenia tokenów LP wykorzystują zaokrąglanie w dół (flooring), faworyzując dotychczasowych dostawców płynności
- Drobne różnice z zaokrągleń pozostają w puli
- Wypłaty mogą zwrócić o kilka jednostek bazowych mniej niż depozyty ze względu na ochronę opłat

## Przykłady Opłat

### Przykład 1: 1% Opłaty LP, Brak Opłaty Biatec

```
Wejście swapu: 100 USDC
Opłata LP: 1% = 1 USDC
Efektywne wejście: 99 USDC
Wyjście: Obliczone na podstawie 99 USDC
Opłata dodana do puli: płynność o wartości 1 USDC
Dystrybucja: 100% dla dostawców płynności
```

### Przykład 2: 1% Opłaty LP, 20% Opłaty Biatec

```
Wejście swapu: 100 USDC
Opłata LP: 1% = 1 USDC
Opłata Biatec: 20% z opłaty LP = 0.2 USDC
Opłata dla użytkowników: 80% z opłaty LP = 0.8 USDC
Efektywne wejście: 99 USDC
Wyjście: Obliczone na podstawie 99 USDC
Dystrybucja: 0.8 USDC dla LP, 0.2 USDC dla protokołu
```
