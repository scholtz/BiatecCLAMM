# Przewodnik integracji BiatecCLAMM

Ten przewodnik zawiera sprawdzone praktyki i uwagi bezpieczeństwa dotyczące integracji pul skoncentrowanej płynności BiatecCLAMM z Twoją aplikacją lub protokołem.

## Spis treści {#-spis-tresci}

- [Szybki start](#-szybki-start)
- [Uwagi bezpieczeństwa](#-uwagi-bezpieczenstwa)
- [Używanie CLAMM jako orakulum cenowego](#-uzywanie-clamm-jako-orakulum-cenowego)
- [Konstrukcja transakcji](#-konstrukcja-transakcji)
- [Referencje box](#-wymagane-referencje-box)
- [Powszechne wzorce integracji](#-powszechne-wzorce-integracji)
- [Obsługa błędów](#-obsluga-bledow)
- [Testowanie Twojej integracji](#-testowanie-twojej-integracji)

## Szybki start {#-szybki-start}

### Instalacja {#-instalacja}

```bash
npm install biatec-concentrated-liquidity-amm
```

### Podstawowa interakcja z pulą {#-podstawowa-interakcja-z-pula}

```typescript
import { clammSwapSender, clammAddLiquiditySender, clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

// Przykład swapu
const swapResult = await clammSwapSender({
  algod,
  sender,
  appBiatecClammPool: poolAppId,
  appBiatecConfigProvider: configAppId,
  appBiatecIdentityProvider: identityAppId,
  appBiatecPoolProvider: poolProviderAppId,
  assetA: usdcAssetId,
  assetB: algoAssetId,
  assetIn: usdcAssetId,
  amountIn: 1000000n, // 1 USDC (6 miejsc dziesiętnych)
  minimumToReceive: 900000n, // 5% tolerancja slippage
});
```

## Uwagi bezpieczeństwa {#-uwagi-bezpieczenstwa}

### Krytyczne ostrzeżenia bezpieczeństwa {#-krytyczne-ostrzezenia-bezpieczenstwa}

⚠️ **NIGDY nie używaj CLAMM VWAP jako jedynego źródła cen dla decyzji o wysokiej wartości**

Volume Weighted Average Price (VWAP) może być manipulowany przez duże transakcje jednorazowe. Jeśli Twój protokół podejmuje decyzje finansowe oparte na danych cenowych, MUSISZ:

1. **Łącz wiele źródeł**: Używaj VWAP z wielu pul
2. **Waż ceny czasowo**: Uśredniaj ceny przez wiele okresów
3. **Implementuj circuit breakery**: Zatrzymaj operacje przy dużych ruchach cenowych
4. **Używaj cen medianowych**: Bierz medianę z wielu pul CLAMM
5. **Ustaw limity odchyleń**: Odrzucaj ceny, które zbyt mocno odbiegają od referencji

### Anti-wzorce orakulum cenowego {#-anti-wzorce-orakulum-cenowego}

❌ **NIE RÓB TEGO:**

```typescript
// NIEBEZPIECZNE: Używanie VWAP z jednej puli do likwidacji
const price = await getPoolVWAP(poolId);
if (collateralValue < debtValue * price) {
  liquidate(user); // Może być manipulowane!
}
```

✅ **RÓB TO TAK:**

```typescript
// BEZPIECZNE: Wiele źródeł z kontrolami odchyleń
const prices = await Promise.all([getPoolVWAP(poolId1), getPoolVWAP(poolId2), getPoolVWAP(poolId3), getExternalOraclePrice()]);

const medianPrice = getMedian(prices);
const maxDeviation = 0.05; // 5%

for (const price of prices) {
  if (Math.abs(price - medianPrice) / medianPrice > maxDeviation) {
    throw new Error('Wykryto manipulację cenową');
  }
}

// Teraz bezpieczne jest użycie medianPrice
if (collateralValue < debtValue * medianPrice) {
  liquidate(user);
}
```

### Weryfikacja tożsamości {#-weryfikacja-tozsamosci}

Wszystkie operacje płynności i swap wymagają weryfikacji tożsamości. Twoja integracja musi:

1. **Sprawdzić klasę weryfikacji**: Zapewnić, że użytkownicy spełniają minimalną klasę weryfikacji puli
2. **Obsłużyć zablokowane konta**: Ładnie obsłużyć błędy `ERR-USER-LOCKED`
3. **Cache'ować dane tożsamości**: Rozważyć cache'owanie lookups tożsamości (z wygaśnięciem)
4. **Dostarczać jasne błędy**: Informować użytkowników, dlaczego operacje zawodzą (niewystarczająca weryfikacja)

### Ochrona slippage {#-ochrona-slippage}

⚠️ **ZAWSZE wymuszaj minimalną ochronę slippage**

Chociaż kontrakt pozwala na `minimumToReceive = 0`, to naraża użytkowników na ataki sandwich:

```typescript
// Minimalnie zalecana ochrona slippage
const MIN_SLIPPAGE_BPS = 50; // 0.5%

function calculateMinimumReceive(expectedOutput: bigint, slippageBps: bigint): bigint {
  const actualSlippage = slippageBps < MIN_SLIPPAGE_BPS ? MIN_SLIPPAGE_BPS : slippageBps;
  return (expectedOutput * (10000n - actualSlippage)) / 10000n;
}
```

## Używanie CLAMM jako orakulum cenowego {#-uzywanie-clamm-jako-orakulum-cenowego}

### Bezpieczny wzorzec pozyskiwania ceny {#-bezpieczny-wzorzec-pozyskiwania-ceny}

```typescript
interface PriceDataPoint {
  poolId: number;
  price: bigint;
  volume: bigint;
  timestamp: number;
  period: string;
}

class SafePriceOracle {
  private readonly minPools = 3;
  private readonly maxDeviation = 0.05; // 5%
  private readonly timeWindow = 300; // 5 minut

  async getPrice(assetA: bigint, assetB: bigint): Promise<bigint> {
    // 1. Uzyskaj ceny z wielu pul
    const pools = await this.findPoolsForPair(assetA, assetB);
    if (pools.length < this.minPools) {
      throw new Error(`Niewystarczające źródła płynności (${pools.length} < ${this.minPools})`);
    }

    // 2. Załaduj VWAP z każdej puli
    const priceData = await Promise.all(pools.map((pool) => this.getPoolPriceData(pool)));

    // 3. Filtruj tylko ostatnie dane
    const cutoff = Date.now() / 1000 - this.timeWindow;
    const recentData = priceData.filter((d) => d.timestamp > cutoff);

    if (recentData.length < this.minPools) {
      throw new Error('Niewystarczające ostatnie dane cenowe');
    }

    // 4. Oblicz medianową cenę
    const prices = recentData.map((d) => d.price).sort((a, b) => Number(a - b));
    const median = prices[Math.floor(prices.length / 2)];

    // 5. Sprawdź manipulację (outliery)
    for (const data of recentData) {
      const deviation = Math.abs(Number(data.price - median)) / Number(median);
      if (deviation > this.maxDeviation) {
        throw new Error(`Wykryto manipulację cenową: ${deviation * 100}% odchylenie`);
      }
    }

    // 6. Zwróć volume-ważony średni z pozostałych danych
    let totalValue = 0n;
    let totalVolume = 0n;
    for (const data of recentData) {
      totalValue += data.price * data.volume;
      totalVolume += data.volume;
    }

    return totalValue / totalVolume;
  }

  private async getPoolPriceData(poolId: number): Promise<PriceDataPoint> {
    // Implementacja ładuje VWAP z pool provider box storage
    // Zobacz BiatecPoolProvider.algo.ts dla struktury box
  }
}
```

### Monitorowanie zdrowia feedu cenowego {#-monitorowanie-zdrowia-feedu-cenowego}

Monitoruj swoje feedy cenowe nieprzerwanie:

```typescript
interface PriceHealthMetrics {
  poolCount: number;
  averageSpread: number;
  maxDeviation: number;
  totalVolume: bigint;
  stalestTimestamp: number;
}

async function checkPriceHealth(assetPair: [bigint, bigint]): Promise<PriceHealthMetrics> {
  // Sprawdź metryki zdrowia i ostrzeż jeśli:
  // - Liczba pul spadnie poniżej minimum
  // - Spread rozszerzy się poza próg
  // - Wolumen znacząco spadnie
  // - Dane staną się przestarzałe
}

// Uruchamiaj kontrole zdrowia regularnie
setInterval(() => {
  const health = await checkPriceHealth([usdcId, algoId]);
  if (health.poolCount < 3) {
    alertOps('Niewystarczające źródła cenowe');
  }
  if (health.maxDeviation > 0.1) {
    alertOps('Możliwa manipulacja cenowa');
  }
}, 60000); // Co minutę
```

## Konstrukcja transakcji {#-konstrukcja-transakcji}

### Wymagane referencje box {#-wymagane-referencje-box}

Przy wywoływaniu metod CLAMM, dołącz te referencje box:

```typescript
const boxReferences = [
  // Pool statystyki box
  { appIndex: poolProviderAppId, name: encodeBoxName('p', poolAppId) },

  // Para statystyki box
  { appIndex: poolProviderAppId, name: encodeBoxName('s', assetA, assetB) },

  // Identity box
  { appIndex: identityAppId, name: encodeBoxName('i', userAddress) },
];

function encodeBoxName(prefix: string, ...params: (number | string)[]): Uint8Array {
  // Helper do prawidłowego enkodowania nazw box
  // Zobacz src/boxes/index.ts dla referencyjnej implementacji
}
```

### Wzorce grup transakcyjnych {#-wzorce-grup-transakcyjnych}

#### Prosty swap {#-prosty-swap}

```typescript
const group = [
  // 1. Asset transfer do puli
  makeAssetTransferTxn(sender, poolAddress, assetIn, amount),

  // 2. Pool swap wywołanie (z referencjami box)
  makeApplicationCallTxn(sender, poolAppId, 'swap', {
    foreignApps: [configAppId, identityAppId, poolProviderAppId],
    foreignAssets: [assetA, assetB],
    boxes: boxReferences,
  }),

  // 3. Pool provider NOOP (rejestruje handel)
  makeApplicationNoOpTxn(sender, poolProviderAppId),
];

// Przypisz group ID
algosdk.assignGroupID(group);
```

#### Dodanie płynności {#-dodanie-plynności}

```typescript
const group = [
  // 1. Asset A transfer
  makeAssetTransferTxn(sender, poolAddress, assetA, amountA),

  // 2. Asset B transfer
  makeAssetTransferTxn(sender, poolAddress, assetB, amountB),

  // 3. LP token opt-in (jeśli potrzebne)
  makeAssetTransferTxn(sender, sender, lpToken, 0),

  // 4. Dodanie płynności wywołanie
  makeApplicationCallTxn(sender, poolAppId, 'addLiquidity', {
    foreignApps: [configAppId, identityAppId, poolProviderAppId],
    foreignAssets: [assetA, assetB, lpToken],
    boxes: boxReferences,
  }),
];
```

### Gas (fee) szacunek {#-gas-fee-szacunek}

Operacje CLAMM mogą być złożone i wymagać adekwatnych fees:

```typescript
function estimateFees(operationType: 'swap' | 'addLiquidity' | 'removeLiquidity'): number {
  const baseFee = 1000; // 0.001 ALGO minimalny fee

  const opcodeBudgetMultiplier = {
    swap: 4, // Swap używa increaseOpcodeBudget() wielokrotnie
    addLiquidity: 5, // Złożona matematyka płynności
    removeLiquidity: 4,
  };

  return baseFee * opcodeBudgetMultiplier[operationType];
}

// Użycie
const txn = makeApplicationCallTxn(sender, poolId, 'swap', {
  fee: estimateFees('swap'),
  // ... pozostałe parametry
});
```

## Powszechne wzorce integracji {#-powszechne-wzorce-integracji}

### DEX agregator integracja {#-dex-agregator-integracja}

```typescript
interface PoolQuote {
  poolId: number;
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpact: number;
  route: [bigint, bigint][];
}

class DEXAggregator {
  async getBestQuote(assetIn: bigint, assetOut: bigint, amountIn: bigint): Promise<PoolQuote> {
    // 1. Znajdź wszystkie odpowiednie pule
    const directPools = await this.findPools(assetIn, assetOut);
    const multiHopRoutes = await this.findMultiHopRoutes(assetIn, assetOut);

    // 2. Uzyskaj quotes z każdego
    const quotes = await Promise.all([...directPools.map((p) => this.getPoolQuote(p, amountIn)), ...multiHopRoutes.map((r) => this.getRouteQuote(r, amountIn))]);

    // 3. Zwróć najlepszy quote według ilości wyjściowej
    return quotes.sort((a, b) => Number(b.outputAmount - a.outputAmount))[0];
  }

  async executeSwap(quote: PoolQuote): Promise<string> {
    // Wykonaj swap z właściwą ochroną slippage
    const minOutput = this.applySlippage(quote.outputAmount, 0.5); // 0.5%

    if (quote.route.length === 1) {
      // Bezpośredni swap
      return await this.directSwap(quote, minOutput);
    } else {
      // Multi-hop wymaga atomowej kompozycji
      return await this.multiHopSwap(quote, minOutput);
    }
  }
}
```

### Lending protokół integracja {#-lending-protokol-integracja}

```typescript
interface CollateralPosition {
  user: string;
  collateralAsset: bigint;
  collateralAmount: bigint;
  debtAsset: bigint;
  debtAmount: bigint;
  healthFactor: number;
}

class LendingProtocol {
  private priceOracle: SafePriceOracle;

  async checkLiquidation(position: CollateralPosition): Promise<boolean> {
    // Uzyskaj bezpieczną cenę z ochroną przed manipulacją
    const collateralPrice = await this.priceOracle.getPrice(
      position.collateralAsset,
      0n // ALGO
    );
    const debtPrice = await this.priceOracle.getPrice(position.debtAsset, 0n);

    // Oblicz health factor z safety margins
    const collateralValue = position.collateralAmount * collateralPrice;
    const debtValue = position.debtAmount * debtPrice;
    const liquidationThreshold = 1.2; // 120% collateralizacja

    const healthFactor = Number(collateralValue) / Number(debtValue);

    return healthFactor < liquidationThreshold;
  }

  async liquidate(position: CollateralPosition): Promise<string> {
    // 1. Zweryfikuj, że likwidacja jest ważna
    if (!(await this.checkLiquidation(position))) {
      throw new Error('Pozycja jest zdrowa');
    }

    // 2. Oblicz liquidation bonus (incentywy dla likwidatorów)
    const liquidationBonus = 1.05; // 5% bonus

    // 3. Swapuj collateral za debt token przez CLAMM
    const swapAmount = position.debtAmount * liquidationBonus;

    return await clammSwapSender({
      // Swap collateral na debt token
      assetIn: position.collateralAsset,
      amountIn: swapAmount,
      minimumToReceive: position.debtAmount, // Precyzyjny debt repayment
      // ... pozostałe parametry
    });
  }
}
```

### Yield agregator integracja {#-yield-agregator-integracja}

```typescript
interface YieldStrategy {
  poolId: number;
  apy: number;
  tvl: bigint;
  risk: 'low' | 'medium' | 'high';
}

class YieldAggregator {
  async findBestYield(asset: bigint): Promise<YieldStrategy> {
    // Znajdź B-{TOKEN} staking pule dla asset
    const stakingPools = await this.findStakingPools(asset);

    // Oblicz APY dla każdego (na podstawie ostatnich dystrybucji reward)
    const strategies = await Promise.all(
      stakingPools.map(async (pool) => ({
        poolId: pool.id,
        apy: await this.calculateAPY(pool),
        tvl: await this.getTVL(pool),
        risk: this.assessRisk(pool),
      }))
    );

    // Filtruj według minimalnego TVL i tolerancji ryzyka
    const safeStrategies = strategies.filter((s) => s.tvl > 100000n && s.risk !== 'high');

    // Zwróć najwyższy APY
    return safeStrategies.sort((a, b) => b.apy - a.apy)[0];
  }

  async deposit(strategy: YieldStrategy, amount: bigint): Promise<string> {
    // Dodaj płynność do staking puli (B-{TOKEN})
    return await clammAddLiquiditySender({
      appBiatecClammPool: strategy.poolId,
      amountA: amount,
      amountB: amount, // Ten sam asset dla staking pul
      // ... pozostałe parametry
    });
  }
}
```

## Obsługa błędów {#-obsluga-bledow}

### Złożona obsługa błędów {#-zlozona-obsluga-bledow}

```typescript
async function safeSwap(params: SwapParams): Promise<SwapResult> {
  try {
    return await clammSwapSender(params);
  } catch (error) {
    // Parse error message
    const errorMsg = error.message || '';

    if (errorMsg.includes('ERR-LOW-VER')) {
      throw new UserError('Niewystarczająca weryfikacja tożsamości. Proszę ukończyć KYC.');
    }

    if (errorMsg.includes('ERR-USER-LOCKED')) {
      throw new UserError('Twoje konto jest zablokowane. Skontaktuj się z wsparciem.');
    }

    if (errorMsg.includes('Minimum to receive is not met')) {
      throw new UserError('Cena poruszyła się niekorzystnie. Spróbuj zwiększyć tolerancję slippage.');
    }

    if (errorMsg.includes('E_PAUSED')) {
      throw new UserError('Protokół jest obecnie wstrzymany. Spróbuj ponownie później.');
    }

    if (errorMsg.includes('E_ZERO_LIQ')) {
      throw new UserError('Pula ma niewystarczającą płynność.');
    }

    // Unknown error - log for debugging
    console.error('Nieoczekiwany błąd swap:', error);
    throw new Error('Swap nie powiódł się. Proszę spróbować ponownie lub skontaktować się z wsparciem.');
  }
}

class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
```

### Logika retry {#-logika-retry}

```typescript
async function swapWithRetry(params: SwapParams, maxRetries: number = 3): Promise<SwapResult> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await safeSwap(params);
    } catch (error) {
      lastError = error;

      // Don't retry user errors
      if (error instanceof UserError) {
        throw error;
      }

      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await sleep(delay);

      console.log(`Próba swap ${attempt} nie powiodła się, ponawiam za ${delay}ms...`);
    }
  }

  throw new Error(`Swap nie powiódł się po ${maxRetries} próbach: ${lastError.message}`);
}
```

## Testowanie Twojej integracji {#-testowanie-twojej-integracji}

### Testy jednostkowe {#-testy-jednostkowe}

```typescript
describe('CLAMM Integration', () => {
  it('should handle slippage correctly', async () => {
    const quote = await getSwapQuote(usdcId, algoId, 1000000n);
    const minOutput = calculateMinimumReceive(quote.output, 50n); // 0.5%

    const result = await clammSwapSender({
      // ... params
      minimumToReceive: minOutput,
    });

    expect(result.amountOut).toBeGreaterThanOrEqual(minOutput);
  });

  it('should reject insufficient verification', async () => {
    // Mock user with low verification class
    await expect(clammSwapSender(/* params with low-ver user */)).rejects.toThrow('ERR-LOW-VER');
  });

  it('should handle price manipulation', async () => {
    const prices = [
      100n,
      101n,
      102n,
      150n, // Outlier
    ];

    await expect(validatePrices(prices)).rejects.toThrow('Wykryto manipulację cenową');
  });
});
```

### Testy integracyjne {#-testy-integracyjne}

Test against Algorand sandbox:

```bash
# Start sandbox
algokit localnet start

# Run integration tests
npm run test:integration
```

### Testowanie bezpieczeństwa {#-testowanie-bezpieczenstwa}

1. **Testy manipulacji cenowej**: Próbuj duże swapy i sprawdź, że zmiany VWAP są wykrywane
2. **Testy slippage**: Testuj z zerową i niewystarczającą ochroną slippage
3. **Testy tożsamości**: Testuj z zablokowanymi kontami i niewystarczającą weryfikacją
4. **Testy pauzy**: Sprawdź, że operacje zawodzą gdy protokół jest wstrzymany
5. **Testy overflow**: Testuj z maksymalnymi wartościami uint64

## Checklist najlepszych praktyk {#-checklist-najlepszych-praktyk}

Przed wdrożeniem Twojej integracji:

- [ ] Używaj wielu źródeł cenowych, nigdy tylko pojedynczego VWAP puli
- [ ] Implementuj circuit breakery dla anomalii cenowych
- [ ] Wymuszaj minimalną ochronę slippage (≥0.5%)
- [ ] Obsługuj wszystkie kody błędów łagodnie
- [ ] Implementuj logikę retry z exponential backoff
- [ ] Dołącz wszystkie wymagane referencje box
- [ ] Testuj extensively na testnecie
- [ ] Monitoruj zdrowie feedu cenowego nieprzerwanie
- [ ] Dokumentuj swoją integrację dla auditorów
- [ ] Miej plan reagowania na incydenty dla manipulacji cenowej
- [ ] Używaj multi-sig dla operacji admin
- [ ] Regularne przeglądy bezpieczeństwa Twojej integracji
- [ ] Load testuj z realistycznym wolumenem
- [ ] Sprawdź, że szacunek fee jest adekwatny

## Referencje audytów bezpieczeństwa {#-referencje-audytow-bezpieczenstwa}

Multiple security audits have been conducted on BiatecCLAMM. Review these before integrating:

- `audits/2025-10-27-audit-report-ai-claude-3-5.md` - Comprehensive security analysis
- `audits/2025-10-27-audit-report-ai-gpt5-codex.md` - Oracle manipulation concerns
- `audits/2025-10-27-audit-report-ai-gemini-2-5-pro.md` - VWAP vulnerabilities

Key takeaways for integrators:

- VWAP can be manipulated in single blocks
- Always use multiple price sources
- Implement circuit breakers
- Test extensively before mainnet

## Wsparcie i zasoby {#-wsparcie-i-zasoby}

- **GitHub**: [https://github.com/scholtz/BiatecCLAMM](https://github.com/scholtz/BiatecCLAMM)
- **Dokumentacja**: See `docs/` folder for detailed guides
- **Kody błędów**: `docs/error-codes.md` for complete reference
- **Bezpieczeństwo**: `audits/` folder for audit reports
- **Przykłady**: `__test__/` for usage examples

---

**Ostatnia aktualizacja**: 2025-10-27
**Wersja**: 1.0
**Zarządzane**: Zespół BiatecCLAMM
