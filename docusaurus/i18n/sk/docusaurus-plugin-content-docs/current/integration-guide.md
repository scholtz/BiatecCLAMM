# Príručka integrácie BiatecCLAMM

Táto príručka poskytuje osvedčené postupy a bezpečnostné úvahy pre integráciu BiatecCLAMM koncentrovaných likviditných poolov do vašej aplikácie alebo protokolu.

## Obsah {#-obsah}

- [Rýchly štart](#-rychly-start)
- [Bezpečnostné úvahy](#-bezpecnostne-uvahy)
- [Použitie CLAMM ako cenového orákla](#-pouzitie-clamm-ako-cenoveho-orakla)
- [Konštrukcia transakcií](#-konstrukcia-transakcii)
- [Box referencie](#-pozadovane-box-referencie)
- [Bežné integračné vzory](#-bezne-integračne-vzory)
- [Spracovanie chýb](#-spracovanie-chyb)
- [Testovanie vašej integrácie](#-testovanie-vassej-integracie)

## Rýchly štart {#-rychly-start}

### Inštalácia {#-instalacia}

```bash
npm install biatec-concentrated-liquidity-amm
```

### Základná interakcia s poolom {#-zakladna-interakcia-s-poolom}

```typescript
import { clammSwapSender, clammAddLiquiditySender, clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

// Príklad swapu
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
  amountIn: 1000000n, // 1 USDC (6 desatinných miest)
  minimumToReceive: 900000n, // 5% slippage tolerancia
});
```

## Bezpečnostné úvahy {#-bezpecnostne-uvahy}

### Kritické bezpečnostné varovania {#-kriticke-bezpecnostne-varovania}

⚠️ **NIKDY nepoužívajte CLAMM VWAP ako jediný cenový zdroj pre vysokohodnotné rozhodnutia**

Volume Weighted Average Price (VWAP) môže byť manipulovaný veľkými jednoblokovými obchodmi. Ak váš protokol robí finančné rozhodnutia založené na cenových dátach, MUSÍTE:

1. **Kombinovať viacero zdrojov**: Použite VWAP z viacerých poolov
2. **Časovo vážiť dáta**: Priemerujte ceny cez viacero období
3. **Implementovať circuit breakery**: Zastavte operácie pri veľkých cenových pohyboch
4. **Použite mediánové ceny**: Vezmite medián z viacerých CLAMM poolov
5. **Nastavte limity odchýlok**: Odmietnite ceny, ktoré sa príliš odchýlia od referencie

### Anti-vzory cenového orákla {#-anti-vzory-cenoveho-orakla}

❌ **NEROBTE TOTO:**

```typescript
// NEBEZPEČNÉ: Použitie VWAP z jedného poolu pre likvidácie
const price = await getPoolVWAP(poolId);
if (collateralValue < debtValue * price) {
  liquidate(user); // Môže byť manipulované!
}
```

✅ **ROBTE TO TAKTO:**

```typescript
// BEZPEČNÉ: Viacero zdrojov s kontrolami odchýlok
const prices = await Promise.all([getPoolVWAP(poolId1), getPoolVWAP(poolId2), getPoolVWAP(poolId3), getExternalOraclePrice()]);

const medianPrice = getMedian(prices);
const maxDeviation = 0.05; // 5%

for (const price of prices) {
  if (Math.abs(price - medianPrice) / medianPrice > maxDeviation) {
    throw new Error('Detekovaná cenová manipulácia');
  }
}

// Teraz je bezpečné použiť medianPrice
if (collateralValue < debtValue * medianPrice) {
  liquidate(user);
}
```

### Identity verifikácia {#-identity-verifikacia}

Všetky likviditné a swap operácie vyžadujú identity verifikáciu. Vaša integrácia musí:

1. **Skontrolovať verifikačnú triedu**: Zaistiť, že používatelia spĺňajú minimálnu verifikačnú triedu poolu
2. **Spracovať zamknuté účty**: Gracefully spracovať `ERR-USER-LOCKED` chyby
3. **Cache identity dáta**: Zvážte cacheovanie identity lookups (s expiráciou)
4. **Poskytnúť jasné chyby**: Informovať používateľov, prečo operácie zlyhávajú (nedostatočná verifikácia)

### Slippage ochrana {#-slippage-ochrana}

⚠️ **VŽDY vynucujte minimálnu slippage ochranu**

Zatiaľ čo kontrakt umožňuje `minimumToReceive = 0`, toto vystavuje používateľov sandwich atakom:

```typescript
// Minimálne odporúčaná slippage ochrana
const MIN_SLIPPAGE_BPS = 50; // 0.5%

function calculateMinimumReceive(expectedOutput: bigint, slippageBps: bigint): bigint {
  const actualSlippage = slippageBps < MIN_SLIPPAGE_BPS ? MIN_SLIPPAGE_BPS : slippageBps;
  return (expectedOutput * (10000n - actualSlippage)) / 10000n;
}
```

## Použitie CLAMM ako cenového orákla {#-pouzitie-clamm-ako-cenoveho-orakla}

### Bezpečný vzor získavania ceny {#-bezpecny-vzor-ziskavania-ceny}

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
  private readonly timeWindow = 300; // 5 minút

  async getPrice(assetA: bigint, assetB: bigint): Promise<bigint> {
    // 1. Získajte ceny z viacerých poolov
    const pools = await this.findPoolsForPair(assetA, assetB);
    if (pools.length < this.minPools) {
      throw new Error(`Nedostatočné zdroje likvidity (${pools.length} < ${this.minPools})`);
    }

    // 2. Načítajte VWAP z každého poolu
    const priceData = await Promise.all(pools.map((pool) => this.getPoolPriceData(pool)));

    // 3. Filtrovať iba nedávne dáta
    const cutoff = Date.now() / 1000 - this.timeWindow;
    const recentData = priceData.filter((d) => d.timestamp > cutoff);

    if (recentData.length < this.minPools) {
      throw new Error('Nedostatočné nedávne cenové dáta');
    }

    // 4. Vypočítajte mediánovú cenu
    const prices = recentData.map((d) => d.price).sort((a, b) => Number(a - b));
    const median = prices[Math.floor(prices.length / 2)];

    // 5. Skontrolujte manipuláciu (outliery)
    for (const data of recentData) {
      const deviation = Math.abs(Number(data.price - median)) / Number(median);
      if (deviation > this.maxDeviation) {
        throw new Error(`Detekovaná cenová manipulácia: ${deviation * 100}% odchýlka`);
      }
    }

    // 6. Vráťte volume-vážený priemer zostávajúcich dát
    let totalValue = 0n;
    let totalVolume = 0n;
    for (const data of recentData) {
      totalValue += data.price * data.volume;
      totalVolume += data.volume;
    }

    return totalValue / totalVolume;
  }

  private async getPoolPriceData(poolId: number): Promise<PriceDataPoint> {
    // Implementácia načíta VWAP z pool provider box storage
    // Pozrite BiatecPoolProvider.algo.ts pre box štruktúru
  }
}
```

### Monitorovanie zdravia cenového feedu {#-monitorovanie-zdravia-cenoveho-feedu}

Monitorujte vaše cenové feedy nepretržite:

```typescript
interface PriceHealthMetrics {
  poolCount: number;
  averageSpread: number;
  maxDeviation: number;
  totalVolume: bigint;
  stalestTimestamp: number;
}

async function checkPriceHealth(assetPair: [bigint, bigint]): Promise<PriceHealthMetrics> {
  // Skontrolujte metriky zdravia a upozornite ak:
  // - Počet poolov klesne pod minimum
  // - Spread sa rozšíri za prahovú hodnotu
  // - Objem významne klesne
  // - Dáta sa stanú zastaranými
}

// Spúšťajte kontroly zdravia pravidelne
setInterval(() => {
  const health = await checkPriceHealth([usdcId, algoId]);
  if (health.poolCount < 3) {
    alertOps('Nedostatočné cenové zdroje');
  }
  if (health.maxDeviation > 0.1) {
    alertOps('Možná cenová manipulácia');
  }
}, 60000); // Každú minútu
```

## Konštrukcia transakcií {#-konstrukcia-transakcii}

### Požadované box referencie {#-pozadovane-box-referencie}

Pri volaní CLAMM metód, zahrňte tieto box referencie:

```typescript
const boxReferences = [
  // Pool štatistiky box
  { appIndex: poolProviderAppId, name: encodeBoxName('p', poolAppId) },

  // Pár štatistiky box
  { appIndex: poolProviderAppId, name: encodeBoxName('s', assetA, assetB) },

  // Identity box
  { appIndex: identityAppId, name: encodeBoxName('i', userAddress) },
];

function encodeBoxName(prefix: string, ...params: (number | string)[]): Uint8Array {
  // Helper na správne enkódovanie box názvov
  // Pozrite src/boxes/index.ts pre referenčnú implementáciu
}
```

### Vzory transakčných skupín {#-vzory-transakcnych-skupin}

#### Jednoduchý swap {#-jednoduchy-swap}

```typescript
const group = [
  // 1. Asset transfer do poolu
  makeAssetTransferTxn(sender, poolAddress, assetIn, amount),

  // 2. Pool swap volanie (s box referenciami)
  makeApplicationCallTxn(sender, poolAppId, 'swap', {
    foreignApps: [configAppId, identityAppId, poolProviderAppId],
    foreignAssets: [assetA, assetB],
    boxes: boxReferences,
  }),

  // 3. Pool provider NOOP (registruje obchod)
  makeApplicationNoOpTxn(sender, poolProviderAppId),
];

// Priraďte group ID
algosdk.assignGroupID(group);
```

#### Pridanie likvidity {#-pridanie-likvidity}

```typescript
const group = [
  // 1. Asset A transfer
  makeAssetTransferTxn(sender, poolAddress, assetA, amountA),

  // 2. Asset B transfer
  makeAssetTransferTxn(sender, poolAddress, assetB, amountB),

  // 3. LP token opt-in (ak potrebné)
  makeAssetTransferTxn(sender, sender, lpToken, 0),

  // 4. Pridanie likvidity volanie
  makeApplicationCallTxn(sender, poolAppId, 'addLiquidity', {
    foreignApps: [configAppId, identityAppId, poolProviderAppId],
    foreignAssets: [assetA, assetB, lpToken],
    boxes: boxReferences,
  }),
];
```

### Gas (fee) odhad {#-gas-fee-odhad}

CLAMM operácie môžu byť komplexné a vyžadovať adekvátne fees:

```typescript
function estimateFees(operationType: 'swap' | 'addLiquidity' | 'removeLiquidity'): number {
  const baseFee = 1000; // 0.001 ALGO minimálny fee

  const opcodeBudgetMultiplier = {
    swap: 4, // Swap používa increaseOpcodeBudget() viackrát
    addLiquidity: 5, // Komplexná likviditná matematika
    removeLiquidity: 4,
  };

  return baseFee * opcodeBudgetMultiplier[operationType];
}

// Použitie
const txn = makeApplicationCallTxn(sender, poolId, 'swap', {
  fee: estimateFees('swap'),
  // ... ostatné parametre
});
```

## Bežné integračné vzory {#-bezne-integračne-vzory}

### DEX agregátor integrácia {#-dex-agregator-integracia}

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
    // 1. Nájdite všetky relevantné pooly
    const directPools = await this.findPools(assetIn, assetOut);
    const multiHopRoutes = await this.findMultiHopRoutes(assetIn, assetOut);

    // 2. Získajte quotes z každého
    const quotes = await Promise.all([...directPools.map((p) => this.getPoolQuote(p, amountIn)), ...multiHopRoutes.map((r) => this.getRouteQuote(r, amountIn))]);

    // 3. Vráťte najlepší quote podľa output množstva
    return quotes.sort((a, b) => Number(b.outputAmount - a.outputAmount))[0];
  }

  async executeSwap(quote: PoolQuote): Promise<string> {
    // Vykonajte swap s proper slippage ochranou
    const minOutput = this.applySlippage(quote.outputAmount, 0.5); // 0.5%

    if (quote.route.length === 1) {
      // Priamy swap
      return await this.directSwap(quote, minOutput);
    } else {
      // Multi-hop vyžaduje atomickú kompozíciu
      return await this.multiHopSwap(quote, minOutput);
    }
  }
}
```

### Lending protokol integrácia {#-lending-protokol-integracia}

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
    // Získajte bezpečnú cenu s manipuláciou ochranou
    const collateralPrice = await this.priceOracle.getPrice(
      position.collateralAsset,
      0n // ALGO
    );
    const debtPrice = await this.priceOracle.getPrice(position.debtAsset, 0n);

    // Vypočítajte health factor so safety margins
    const collateralValue = position.collateralAmount * collateralPrice;
    const debtValue = position.debtAmount * debtPrice;
    const liquidationThreshold = 1.2; // 120% collateralizácia

    const healthFactor = Number(collateralValue) / Number(debtValue);

    return healthFactor < liquidationThreshold;
  }

  async liquidate(position: CollateralPosition): Promise<string> {
    // 1. Overte, že likvidácia je validná
    if (!(await this.checkLiquidation(position))) {
      throw new Error('Pozícia je zdravá');
    }

    // 2. Vypočítajte liquidation bonus (incentíva pre liquidátorov)
    const liquidationBonus = 1.05; // 5% bonus

    // 3. Swapujte collateral za debt token cez CLAMM
    const swapAmount = position.debtAmount * liquidationBonus;

    return await clammSwapSender({
      // Swap collateral na debt token
      assetIn: position.collateralAsset,
      amountIn: swapAmount,
      minimumToReceive: position.debtAmount, // Presný debt repayment
      // ... ostatné parametre
    });
  }
}
```

### Yield agregátor integrácia {#-yield-agregator-integracia}

```typescript
interface YieldStrategy {
  poolId: number;
  apy: number;
  tvl: bigint;
  risk: 'low' | 'medium' | 'high';
}

class YieldAggregator {
  async findBestYield(asset: bigint): Promise<YieldStrategy> {
    // Nájdite B-{TOKEN} staking pooly pre asset
    const stakingPools = await this.findStakingPools(asset);

    // Vypočítajte APY pre každý (na základe nedávnych reward distribúcií)
    const strategies = await Promise.all(
      stakingPools.map(async (pool) => ({
        poolId: pool.id,
        apy: await this.calculateAPY(pool),
        tvl: await this.getTVL(pool),
        risk: this.assessRisk(pool),
      }))
    );

    // Filtrovať podľa minimálneho TVL a risk tolerance
    const safeStrategies = strategies.filter((s) => s.tvl > 100000n && s.risk !== 'high');

    // Vráťte najvyšší APY
    return safeStrategies.sort((a, b) => b.apy - a.apy)[0];
  }

  async deposit(strategy: YieldStrategy, amount: bigint): Promise<string> {
    // Pridajte likviditu do staking poolu (B-{TOKEN})
    return await clammAddLiquiditySender({
      appBiatecClammPool: strategy.poolId,
      amountA: amount,
      amountB: amount, // Rovnaký asset pre staking pooly
      // ... ostatné parametre
    });
  }
}
```

## Spracovanie chýb {#-spracovanie-chyb}

### Komplexné spracovanie chýb {#-komplexne-spracovanie-chyb}

```typescript
async function safeSwap(params: SwapParams): Promise<SwapResult> {
  try {
    return await clammSwapSender(params);
  } catch (error) {
    // Parse error message
    const errorMsg = error.message || '';

    if (errorMsg.includes('ERR-LOW-VER')) {
      throw new UserError('Nedostatočná identity verifikácia. Prosím dokončite KYC.');
    }

    if (errorMsg.includes('ERR-USER-LOCKED')) {
      throw new UserError('Váš účet je zamknutý. Kontaktujte podporu.');
    }

    if (errorMsg.includes('Minimum to receive is not met')) {
      throw new UserError('Cena sa pohybovala nepriaznivo. Skúste zvýšiť slippage toleranciu.');
    }

    if (errorMsg.includes('E_PAUSED')) {
      throw new UserError('Protokol je momentálne pozastavený. Skúste znovu neskôr.');
    }

    if (errorMsg.includes('E_ZERO_LIQ')) {
      throw new UserError('Pool má nedostatočnú likviditu.');
    }

    // Unknown error - log for debugging
    console.error('Neočakávaná swap chyba:', error);
    throw new Error('Swap zlyhal. Prosím skúste znovu alebo kontaktujte podporu.');
  }
}

class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
```

### Retry logika {#-retry-logika}

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

      console.log(`Swap pokus ${attempt} zlyhal, opakujem o ${delay}ms...`);
    }
  }

  throw new Error(`Swap zlyhal po ${maxRetries} pokusoch: ${lastError.message}`);
}
```

## Testovanie vašej integrácie {#-testovanie-vassej-integracie}

### Unit testy {#-unit-testy}

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

    await expect(validatePrices(prices)).rejects.toThrow('Detekovaná cenová manipulácia');
  });
});
```

### Integration testy {#-integration-testy}

Test against Algorand sandbox:

```bash
# Start sandbox
algokit localnet start

# Run integration tests
npm run test:integration
```

### Bezpečnostné testovanie {#-bezpecnostne-testovanie}

1. **Cenová manipulácia testy**: Pokúste sa o veľké swapy a overte, že VWAP zmeny sú detekované
2. **Slippage testy**: Testujte s nulovou a nedostatočnou slippage ochranou
3. **Identity testy**: Testujte so zamknutými účtami a nedostatočnou verifikáciou
4. **Pause testy**: Overte, že operácie zlyhajú keď je protokol pozastavený
5. **Overflow testy**: Testujte s maximálnymi uint64 hodnotami

## Checklist osvedčených postupov {#-checklist-osvedcenych-postupov}

Pred deployovaním vašej integrácie:

- [ ] Používajte viacero cenových zdrojov, nikdy iba single pool VWAP
- [ ] Implementujte circuit breakery pre cenové anomálie
- [ ] Vynucujte minimálnu slippage ochranu (≥0.5%)
- [ ] Spracovávajte všetky chybové kódy gracefulne
- [ ] Implementujte retry logiku s exponential backoff
- [ ] Zahrňte všetky požadované box referencie
- [ ] Testujte na testnete extensively
- [ ] Monitorujte zdravie cenového feedu nepretržite
- [ ] Dokumentujte vašu integráciu pre audítorov
- [ ] Majte incident response plán pre cenovú manipuláciu
- [ ] Používajte multi-sig pre admin operácie
- [ ] Pravidelné bezpečnostné reviews vašej integrácie
- [ ] Load testujte s realistickým objemom
- [ ] Overte, že fee odhad je adekvátny

## Referencie bezpečnostných auditov {#-referencie-bezpecnostnych-auditov}

Multiple security audits have been conducted on BiatecCLAMM. Review these before integrating:

- `audits/2025-10-27-audit-report-ai-claude-3-5.md` - Comprehensive security analysis
- `audits/2025-10-27-audit-report-ai-gpt5-codex.md` - Oracle manipulation concerns
- `audits/2025-10-27-audit-report-ai-gemini-2-5-pro.md` - VWAP vulnerabilities

Key takeaways for integrators:

- VWAP can be manipulated in single blocks
- Always use multiple price sources
- Implement circuit breakers
- Test extensively before mainnet

## Podpora a zdroje {#-podpora-a-zdroje}

- **GitHub**: [https://github.com/scholtz/BiatecCLAMM](https://github.com/scholtz/BiatecCLAMM)
- **Dokumentácia**: See `docs/` folder for detailed guides
- **Chybové kódy**: `docs/error-codes.md` for complete reference
- **Bezpečnosť**: `audits/` folder for audit reports
- **Príklady**: `__test__/` for usage examples

---

**Posledná aktualizácia**: 2025-10-27
**Verzia**: 1.0
**Spravované**: BiatecCLAMM tím
