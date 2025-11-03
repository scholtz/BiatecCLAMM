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
