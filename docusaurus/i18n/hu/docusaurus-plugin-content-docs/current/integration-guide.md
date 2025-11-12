# BiatecCLAMM integrációs útmutató

Ez az útmutató a BiatecCLAMM koncentrált likviditási poolok alkalmazásba vagy protokollba történő integrálásához szükséges bevált gyakorlatokat és biztonsági szempontokat foglalja össze.

## Tartalomjegyzék {#-table-of-contents}

- [Gyors kezdés](#-quick-start)
- [Biztonsági megfontolások](#-security-considerations)
- [CLAMM használata árfolyam oracle-ként](#-using-clamm-as-price-oracle)
- [Tranzakciók összeállítása](#-transaction-construction)
- [Kötelező box hivatkozások](#-required-box-references)
- [Gyakori integrációs minták](#-common-integration-patterns)
- [Hibakezelés](#-error-handling)
- [Integráció tesztelése](#-testing-your-integration)

## Gyors kezdés {#-quick-start}

### Telepítés {#-installation}

```bash
npm install biatec-concentrated-liquidity-amm
```

### Alap pool interakció {#-basic-pool-interaction}

```typescript
import { clammSwapSender, clammAddLiquiditySender, clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

// Swap példa
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
  amountIn: 1000000n, // 1 USDC (6 tizedes)
  minimumToReceive: 900000n, // 5% csúszási tolerancia
});
```

## Biztonsági megfontolások {#-security-considerations}

### Kritikus biztonsági figyelmeztetések {#-critical-security-warnings}

⚠️ **SOHA ne használja a CLAMM VWAP értékét egyedüli árforrásként nagy értékű döntésekhez**

A volumennel súlyozott átlagár (VWAP) egyetlen blokkon belüli nagy tranzakcióval manipulálható. Ha a protokoll pénzügyi döntéseket hoz árfolyam adatok alapján, akkor KÖTELEZŐ:

1. **Több forrás kombinálása**: Használja több pool VWAP értékét
2. **Időbeli súlyozás**: Átlagolja az árakat több perióduson
3. **Vészleállítás**: Állítsa le a műveleteket nagy ármozgás esetén
4. **Medián ár használata**: Vegye a mediánt több CLAMM pool értékeiből
5. **Eltérés korlátok**: Utasítsa el a referenciától túlságosan eltérő árakat

### Árfolyam oracle anti minták {#-price-oracle-anti-patterns}

❌ **NE TEGYE:**

```typescript
// VESZÉLYES: Egyetlen pool VWAP-ját használja likvidációhoz
const price = await getPoolVWAP(poolId);
if (collateralValue < debtValue * price) {
  liquidate(user); // Manipulálható!
}
```

✅ **INKÁBB EZT:**

```typescript
// BIZTONSÁGOS: Több forrás eltérésvizsgálattal
const prices = await Promise.all([getPoolVWAP(poolId1), getPoolVWAP(poolId2), getPoolVWAP(poolId3), getExternalOraclePrice()]);

const medianPrice = getMedian(prices);
const maxDeviation = 0.05; // 5%

for (const price of prices) {
  if (Math.abs(price - medianPrice) / medianPrice > maxDeviation) {
    throw new Error('Price manipulation detected');
  }
}

// A medián ár biztonsággal használható
if (collateralValue < debtValue * medianPrice) {
  liquidate(user);
}
```

### Identitás ellenőrzés {#-identity-verification}

Minden likviditási és swap művelet identitás ellenőrzést igényel. Az integrációjának gondoskodnia kell arról, hogy:

1. **Ellenőrizze a verifikációs osztályt**: A felhasználó feleljen meg a pool minimum követelményének
2. **Kezelje a zárolt fiókokat**: Kezelje elegánsan az `ERR-USER-LOCKED` hibákat
3. **Gyorsítótárazza az identitás adatokat**: Tárolja az ellenőrzéseket (lejárati idővel)
4. **Kommunikáljon tisztán**: Értesítse a felhasználókat, ha a művelet verifikáció hiányában hiúsul meg

### Csúszásvédelem {#-slippage-protection}

⚠️ **Mindig alkalmazzon minimális csúszásvédelmet**

Bár a szerződés engedi, hogy a `minimumToReceive = 0` legyen, ezzel a felhasználó kiszolgáltatja magát sandwich támadásoknak:

```typescript
// Ajánlott minimális csúszásvédelem
const MIN_SLIPPAGE_BPS = 50; // 0,5%

function calculateMinimumReceive(expectedOutput: bigint, slippageBps: bigint): bigint {
  const actualSlippage = slippageBps < MIN_SLIPPAGE_BPS ? MIN_SLIPPAGE_BPS : slippageBps;
  return (expectedOutput * (10000n - actualSlippage)) / 10000n;
}
```

## CLAMM használata árfolyam oracle-ként {#-using-clamm-as-price-oracle}

### Biztonságos ár lekérdezési minta {#-safe-price-retrieval-pattern}

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
  private readonly timeWindow = 300; // 5 perc

  async getPrice(assetA: bigint, assetB: bigint): Promise<bigint> {
    // 1. Ár lekérése több poolból
    const pools = await this.findPoolsForPair(assetA, assetB);
    if (pools.length < this.minPools) {
      throw new Error(`Insufficient liquidity sources (${pools.length} < ${this.minPools})`);
    }

    // 2. VWAP lekérése minden poolból
    const priceData = await Promise.all(pools.map((pool) => this.getPoolPriceData(pool)));

    // 3. Csak friss adatok megtartása
    const cutoff = Date.now() / 1000 - this.timeWindow;
    const recentData = priceData.filter((d) => d.timestamp > cutoff);

    if (recentData.length < this.minPools) {
      throw new Error('Insufficient recent price data');
    }

    // 4. Medián ár számítása
    const prices = recentData.map((d) => d.price).sort((a, b) => Number(a - b));
    const median = prices[Math.floor(prices.length / 2)];

    // 5. Manipuláció (kiugró értékek) vizsgálata
    for (const data of recentData) {
      const deviation = Math.abs(Number(data.price - median)) / Number(median);
      if (deviation > this.maxDeviation) {
        throw new Error(`Price manipulation detected: ${deviation * 100}% deviation`);
      }
    }

    // 6. A fennmaradó adatok volumen súlyozott átlaga
    let totalValue = 0n;
    let totalVolume = 0n;
    for (const data of recentData) {
      totalValue += data.price * data.volume;
      totalVolume += data.volume;
    }

    return totalValue / totalVolume;
  }

  private async getPoolPriceData(poolId: number): Promise<PriceDataPoint> {
    // A megvalósítás a pool szolgáltató box tárolójából olvassa a VWAP értéket
    // Lásd: BiatecPoolProvider.algo.ts a box struktúrához
  }
}
```

### Árfolyam feed egészségének monitorozása {#-price-feed-health-monitoring}

Figyelje folyamatosan az árfolyam feedeket:

```typescript
interface PriceHealthMetrics {
  poolCount: number;
  averageSpread: number;
  maxDeviation: number;
  totalVolume: bigint;
  stalestTimestamp: number;
}

async function checkPriceHealth(assetPair: [bigint, bigint]): Promise<PriceHealthMetrics> {
  // Ellenőrizze a mutatókat, és jelezzen, ha:
  // - A poolok száma a minimum alá esik
  // - A spread a küszöb fölé nő
  // - A volumen jelentősen csökken
  // - Az adatok elavulnak
}

// Egészségügyi ellenőrzés futtatása időzítve
setInterval(() => {
  const health = await checkPriceHealth([usdcId, algoId]);
  if (health.poolCount < 3) {
    alertOps('Insufficient price sources');
  }
  if (health.maxDeviation > 0.1) {
    alertOps('Price manipulation possible');
  }
}, 60000); // Percenként
```

## Tranzakciók összeállítása {#-transaction-construction}

### Kötelező box hivatkozások {#-required-box-references}

CLAMM hívások esetén az alábbi box hivatkozásokat adja hozzá:

```typescript
const boxReferences = [
  // Pool statisztika box
  { appIndex: poolProviderAppId, name: encodeBoxName('p', poolAppId) },

  // Pár statisztika box
  { appIndex: poolProviderAppId, name: encodeBoxName('s', assetA, assetB) },

  // Identitás box
  { appIndex: identityAppId, name: encodeBoxName('i', userAddress) },
];

function encodeBoxName(prefix: string, ...params: (number | string)[]): Uint8Array {
  // Segédfüggvény a box nevek kódolásához
  // Lásd: src/boxes/index.ts a referencia megvalósításhoz
}
```

### Tranzakció csoport minták {#-transaction-group-patterns}

#### Egyszerű swap {#-simple-swap}

```typescript
const group = [
  // 1. Eszköz átutalása a pool címére
  makeAssetTransferTxn(sender, poolAddress, assetIn, amount),

  // 2. Pool swap hívás (box hivatkozásokkal)
  makeApplicationCallTxn(sender, poolAppId, 'swap', {
    foreignApps: [configAppId, identityAppId, poolProviderAppId],
    foreignAssets: [assetA, assetB],
    boxes: boxReferences,
  }),

  // 3. Pool szolgáltató NOOP (kereskedés rögzítése)
  makeApplicationNoOpTxn(sender, poolProviderAppId),
];

// Csoport azonosító hozzárendelése
algosdk.assignGroupID(group);
```

#### Likviditás hozzáadása {#-add-liquidity}

```typescript
const group = [
  // 1. Asset A átutalás
  makeAssetTransferTxn(sender, poolAddress, assetA, amountA),

  // 2. Asset B átutalás
  makeAssetTransferTxn(sender, poolAddress, assetB, amountB),

  // 3. LP token opt-in (ha szükséges)
  makeAssetTransferTxn(sender, sender, lpToken, 0),

  // 4. Likviditás hozzáadása hívás
  makeApplicationCallTxn(sender, poolAppId, 'addLiquidity', {
    foreignApps: [configAppId, identityAppId, poolProviderAppId],
    foreignAssets: [assetA, assetB, lpToken],
    boxes: boxReferences,
  }),
];
```

### Díj (fee) becslés {#-gas-fee-estimation}

A CLAMM műveletek összetettek lehetnek, ezért gondoskodni kell a megfelelő díjról:

```typescript
function estimateFees(operationType: 'swap' | 'addLiquidity' | 'removeLiquidity'): number {
  const baseFee = 1000; // 0,001 ALGO minimum díj

  const opcodeBudgetMultiplier = {
    swap: 4, // A swap többször hívja az increaseOpcodeBudget() függvényt
    addLiquidity: 5, // Összetett likviditás számítások
    removeLiquidity: 4,
  };

  return baseFee * opcodeBudgetMultiplier[operationType];
}

// Használat
const txn = makeApplicationCallTxn(sender, poolId, 'swap', {
  fee: estimateFees('swap'),
  // ... egyéb paraméterek
});
```

## Gyakori integrációs minták {#-common-integration-patterns}

### DEX aggregátor integráció {#-dex-aggregator-integration}

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
    // 1. Vonja össze az összes releváns poolt
    const directPools = await this.findPools(assetIn, assetOut);
    const multiHopRoutes = await this.findMultiHopRoutes(assetIn, assetOut);

    // 2. Kérjen ajánlatot mindegyiktől
    const quotes = await Promise.all([...directPools.map((p) => this.getPoolQuote(p, amountIn)), ...multiHopRoutes.map((r) => this.getRouteQuote(r, amountIn))]);

    // 3. Adja vissza a legjobb (legnagyobb kimenetű) ajánlatot
    return quotes.sort((a, b) => Number(b.outputAmount - a.outputAmount))[0];
  }

  async executeSwap(quote: PoolQuote): Promise<string> {
    // Swap végrehajtása megfelelő csúszásvédelemmel
    const minOutput = this.applySlippage(quote.outputAmount, 0.5); // 0,5%

    if (quote.route.length === 1) {
      // Közvetlen swap
      return await this.directSwap(quote, minOutput);
    } else {
      // Multi-hop esetén atomikus összetétel kell
      return await this.multiHopSwap(quote, minOutput);
    }
  }
}
```

### Hitelezési protokoll integráció {#-lending-protocol-integration}

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
    // Árfolyam lekérése manipuláció védelemmel
    const collateralPrice = await this.priceOracle.getPrice(
      position.collateralAsset,
      0n // ALGO
    );
    const debtPrice = await this.priceOracle.getPrice(position.debtAsset, 0n);

    // Health factor számítása biztonsági tartalékkal
    const collateralValue = position.collateralAmount * collateralPrice;
    const debtValue = position.debtAmount * debtPrice;
    const liquidationThreshold = 1.2; // 120%-os fedezet

    const healthFactor = Number(collateralValue) / Number(debtValue);

    return healthFactor < liquidationThreshold;
  }

  async liquidate(position: CollateralPosition): Promise<string> {
    // 1. Ellenőrizze, hogy a likvidáció jogos-e
    if (!(await this.checkLiquidation(position))) {
      throw new Error('Position is healthy');
    }

    // 2. Likvidációs bónusz kiszámítása (likvidátor ösztönzése)
    const liquidationBonus = 1.05; // 5% bónusz

    // 3. Kollaterál átváltása adósságra CLAMM segítségével
    const swapAmount = position.debtAmount * liquidationBonus;

    return await clammSwapSender({
      // Kollaterál átváltása az adósság tokenre
      assetIn: position.collateralAsset,
      amountIn: swapAmount,
      minimumToReceive: position.debtAmount, // Pontos adósság visszafizetés
      // ... egyéb paraméterek
    });
  }
}
```

### Hozam aggregátor integráció {#-yield-aggregator-integration}

```typescript
interface YieldStrategy {
  poolId: number;
  apy: number;
  tvl: bigint;
  risk: 'low' | 'medium' | 'high';
}

class YieldAggregator {
  async findBestYield(asset: bigint): Promise<YieldStrategy> {
    // Keresse meg az adott eszköz B-{TOKEN} staking pooljait
    const stakingPools = await this.findStakingPools(asset);

    // Számolja ki mindegyik APY-ját (friss jutalomelosztás alapján)
    const strategies = await Promise.all(
      stakingPools.map(async (pool) => ({
        poolId: pool.id,
        apy: await this.calculateAPY(pool),
        tvl: await this.getTVL(pool),
        risk: this.assessRisk(pool),
      }))
    );

    // Szűrés minimum TVL és kockázati szint alapján
    const safeStrategies = strategies.filter((s) => s.tvl > 100000n && s.risk !== 'high');

    // Válassza a legmagasabb hozamot
    return safeStrategies.sort((a, b) => b.apy - a.apy)[0];
  }

  async deposit(strategy: YieldStrategy, amount: bigint): Promise<string> {
    // Likviditás hozzáadása a staking poolhoz (B-{TOKEN})
    return await clammAddLiquiditySender({
      appBiatecClammPool: strategy.poolId,
      amountA: amount,
      amountB: amount, // Staking pooloknál azonos eszköz
      // ... egyéb paraméterek
    });
  }
}
```

## Hibakezelés {#-error-handling}

### Átfogó hibakezelés {#-comprehensive-error-handling}

```typescript
async function safeSwap(params: SwapParams): Promise<SwapResult> {
  try {
    return await clammSwapSender(params);
  } catch (error) {
    // Hibaüzenet feldolgozása
    const errorMsg = error.message || '';

    if (errorMsg.includes('ERR-LOW-VER')) {
      throw new UserError('Insufficient identity verification. Please complete KYC.');
    }

    if (errorMsg.includes('ERR-USER-LOCKED')) {
      throw new UserError('Your account is locked. Contact support.');
    }

    if (errorMsg.includes('Minimum to receive is not met')) {
      throw new UserError('Price moved unfavorably. Try increasing slippage tolerance.');
    }

    if (errorMsg.includes('E_PAUSED')) {
      throw new UserError('Protocol is currently paused. Try again later.');
    }

    if (errorMsg.includes('E_ZERO_LIQ')) {
      throw new UserError('Pool has insufficient liquidity.');
    }

    // Ismeretlen hiba - naplózza hibakereséshez
    console.error('Unexpected swap error:', error);
    throw new Error('Swap failed. Please try again or contact support.');
  }
}

class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
```

### Újrapróbálkozási logika {#-retry-logic}

```typescript
async function swapWithRetry(params: SwapParams, maxRetries: number = 3): Promise<SwapResult> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await safeSwap(params);
    } catch (error) {
      lastError = error;

      // Felhasználói hibákon ne próbálkozzon újra
      if (error instanceof UserError) {
        throw error;
      }

      // Utolsó próbálkozásnál ne próbálja újra
      if (attempt === maxRetries) {
        break;
      }

      // Exponenciális várakozás
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await sleep(delay);

      console.log(`Swap attempt ${attempt} failed, retrying in ${delay}ms...`);
    }
  }

  throw new Error(`Swap failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

## Integráció tesztelése {#-testing-your-integration}

### Unit tesztek {#-unit-tests}

```typescript
describe('CLAMM Integration', () => {
  it('should handle slippage correctly', async () => {
    const quote = await getSwapQuote(usdcId, algoId, 1000000n);
    const minOutput = calculateMinimumReceive(quote.output, 50n); // 0,5%

    const result = await clammSwapSender({
      // ... paraméterek
      minimumToReceive: minOutput,
    });

    expect(result.amountOut).toBeGreaterThanOrEqual(minOutput);
  });

  it('should reject insufficient verification', async () => {
    // Mock felhasználó alacsony verifikációval
    await expect(clammSwapSender(/* params with low-ver user */)).rejects.toThrow('ERR-LOW-VER');
  });

  it('should handle price manipulation', async () => {
    const prices = [
      100n,
      101n,
      102n,
      150n, // Kiugró érték
    ];

    await expect(validatePrices(prices)).rejects.toThrow('Price manipulation detected');
  });
});
```

### Integrációs tesztek {#-integration-tests}

Tesztelés Algorand sandbox környezetben:

```bash
# Sandbox indítása
algokit localnet start

# Integrációs tesztek futtatása
npm run test:integration
```

### Biztonsági tesztelés {#-security-testing}

1. **Ármanipulációs tesztek**: Hajtsunk végre nagy swapokat, és ellenőrizzük, hogy a VWAP változása érzékelhető
2. **Csúszás tesztek**: Teszteljünk nulla vagy elégtelen csúszásvédelemmel
3. **Identitás tesztek**: Vizsgáljuk zárolt fiókokkal és alacsony verifikációval
4. **Szünet tesztek**: Győződjünk meg róla, hogy szüneteltetéskor minden művelet meghiúsul
5. **Túlcsordulás tesztek**: Próbáljuk ki maximális uint64 értékekkel

## Bevált gyakorlatok ellenőrzőlista {#-best-practices-checklist}

Telepítés előtt győződjön meg róla, hogy:

- [ ] Több árforrást használ, sosem egyetlen pool VWAP-ját
- [ ] Ár anomáliákra szolgáló vészleállítást implementált
- [ ] Legalább 0,5%-os minimális csúszásvédelmet alkalmaz
- [ ] Minden hibakód kezelését lefedi
- [ ] Exponenciális visszavonású újrapróbálkozást használ
- [ ] Minden kötelező box hivatkozást hozzáad
- [ ] Alaposan tesztelt testneten
- [ ] Folyamatosan figyeli az árfolyam feed egészségét
- [ ] Dokumentálja az integrációt az auditorok számára
- [ ] Rendelkezik incidenskezelési tervvel ármanipulációra
- [ ] Admin műveletekhez multi-sig-et alkalmaz
- [ ] Rendszeres biztonsági felülvizsgálatot végez
- [ ] Valós forgalommal végzett terheléses tesztet futtat
- [ ] Ellenőrizte, hogy a díjbecslés elegendő

## Biztonsági audit hivatkozások {#-security-audit-references}

A BiatecCLAMM több biztonsági auditon esett át. Integráció előtt tekintse át ezeket:

- `audits/2025-10-27-audit-report-ai-claude-3-5.md` – Átfogó biztonsági elemzés
- `audits/2025-10-27-audit-report-ai-gpt5-codex.md` – Oracle manipulációs kockázatok
- `audits/2025-10-27-audit-report-ai-gemini-2-5-pro.md` – VWAP sebezhetőségek

Fontos tanulságok integrátoroknak:

- A VWAP egy blokkon belül manipulálható
- Mindig több árforrást használjon
- Alkalmazzon vészleállító mechanizmusokat
- Futtasson kiterjedt teszteket mainnet indulás előtt

## Támogatás és erőforrások {#-support-and-resources}

- **GitHub**: [https://github.com/scholtz/BiatecCLAMM](https://github.com/scholtz/BiatecCLAMM)
- **Dokumentáció**: Lásd a `docs/` könyvtár részletes útmutatóit
- **Hibakódok**: `docs/error-codes.md` a teljes referencia
- **Biztonság**: `audits/` könyvtár az audit jelentésekhez
- **Példák**: `__test__/` könyvtár használati példákhoz

---

**Utolsó frissítés**: 2025-10-27
**Verzió**: 1.0
**Karbantartó**: BiatecCLAMM csapat
