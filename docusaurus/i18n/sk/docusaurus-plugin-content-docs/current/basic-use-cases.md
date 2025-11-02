# Základné prípady použitia Biatec CLAMM

Táto príručka vás prevedie každodennými tokmi podporovanými Biatec koncentrovanou likviditou AMM (CLAMM). Zameriava sa na inštancovanie klientov, financovanie likvidity v cenovom pásme alebo pri konštantnej cene, odstraňovanie likvidity, vykonávanie swapov a spotrebu pool-provider oracle feedu. Pokročilé témy ako správanie zaokrúhľovania a staking-specifické toky sú pokryté v existujúcich dokumentoch v `docs/`.

## Predpoklady {#-predpoklady}

- Prístup k Algorand sieti (Sandbox LocalNet, TestNet alebo MainNet) a `Algodv2` RPC endpoint.
- Deployované inštancie Biatec konfiguračného providera, identity providera a pool provider kontraktov. Príklady nižšie predpokladajú, že ich app ID sú už známe.
- Vždy potvrďte, že pool-provider globálny stav (`key = 'B'`) zodpovedá konfiguračnému app ID, na ktoré odkazujete v akejkoľvek deploy skupine pred podpísaním. Ak sa ID rozchádzajú, prerušte transakciu, aby ste sa vyhli interakcii s falošným configom.
- Financovaný účet reprezentovaný ako `Algokit` `TransactionSignerAccount` na podpísanie transakcií.
- Znalosť 1e9 základnej škály (`SCALE = 1_000_000_000n`) používané kontraktmi. Pozrite si `docs/liquidity-rounding.md` pre detaily presnosti.
- Voliteľné, ale odporúčané: použite `getConfig(genesisId)` na stiahnutie najnovších produkčných app ID pre podporované siete namiesto hard-kódovania.

## Zdieľané nastavenie {#-zdielane-nastavenie}

```typescript
import algosdk from 'algosdk';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { mnemonicToSecretKey } from 'algosdk';
import { clientBiatecClammPool, BiatecPoolProviderClient, getConfig } from 'biatec-concentrated-liquidity-amm';

const ALGOD_URL = 'http://localhost:4001';
const ALGOD_TOKEN = 'a'.repeat(64);
const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');

const algorand = AlgorandClient.fromConfig({ algod });

const { addr, sk } = mnemonicToSecretKey(process.env.MNEMONIC!);
const signerAccount = {
  addr,
  signer: async (txs: algosdk.Transaction[], indexes: number[]) => {
    const signed = txs.map((tx) => tx.signTxn(sk));
    return indexes.map((i) => signed[i]);
  },
};

const {
  configAppId: configProviderAppId,
  identityAppId: identityProviderAppId,
  poolProviderAppId,
} = getConfig('testnet-v1.0');
const poolProviderClient = new BiatecPoolProviderClient({
  algorand,
  appId: poolProviderAppId,
});

// Nasmerujte CLAMM klienta na existujúci pool, keď poznáte jeho app ID.
const poolAppId = 45678n;
const poolClient = clientBiatecClammPool({
  algorand,
  appId: poolAppId,
});
```

> **Tip:** Použite helper v `src/biatecClamm/getPools.ts` na objavenie poolov spravovaných pool providerom, keď poznáte iba asset ID alebo verifikačnú triedu.

## Vytvorenie poolu (cenové rozpätie vs konštantná cena) {#-vytvorenie-poolu-cenove-rozpatie-vs-konstantna-cena}

Vytvorenie poolu je spracované `clammCreateSender`. Prejdite `priceMin`, `priceMax` a `currentPrice` v základnej škále (1e9). Nastavenie `priceMin === priceMax` pripne pool na konštantnú cenu, čo je ako sa vytvárajú staking pooly.

```typescript
import { clammCreateSender } from 'biatec-concentrated-liquidity-amm';

const SCALE = 1_000_000_000n;

await poolProviderClient.send.setNativeTokenName({
  args: {
    appBiatecConfigProvider: configProviderAppId,
    nativeTokenName: 'ALGO',
  },
  appReferences: [configProviderAppId],
});

const poolClient = await clammCreateSender({
  transactionSigner: signerAccount,
  clientBiatecPoolProvider: poolProviderClient,
  appBiatecConfigProvider: configProviderAppId,
  assetA: 9581n,
  assetB: 0n, // 0n indikuje natívny token
  fee: 10_000_000n, // 1% poplatok vyjadrený v základnej škále
  verificationClass: 0,
  priceMin: SCALE / 2n,
  priceMax: SCALE * 2n,
  currentPrice: SCALE,
});

// clammCreateSender automaticky volá bootstrapStep2, takže pool je pripravený na vklady.
```

Pre konštantno-cenové staking pooly, znovu použite snippet vyššie a nastavte `priceMin`, `priceMax` a `currentPrice` na rovnakú hodnotu základnej škály (zvyčajne `SCALE`). Pozrite si `docs/staking-pools.md` pre dodatočné staking-specifické vedenie.

## Poskytovanie likvidity {#-poskytovanie-likvidity}

`clammAddLiquiditySender` obaľuje skupinu transakcií potrebnú na vklad oboch aktív a odkaz na pool-provider metadata.

```typescript
import { clammAddLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammAddLiquiditySender({
  clientBiatecClammPool: poolClient,
  clientBiatecPoolProvider: poolProviderClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  assetADeposit: 2_500_000n, // množstvo v natívnych desatinných miestach aktíva
  assetBDeposit: 2_500_000n,
});
```

- Sender automaticky optuje do LP tokenu, ak je potrebné.
- Vklady musia rešpektovať cenové rozpätie poolu. Pri pridávaní likvidity do širokého rozpätia, veľkosť oboch vkladov podľa pomerov exponovaných off-chain kalkulátormi pod `contracts/clients/BiatecPoolProviderClient.ts` (`calculateAsset*` queries).
- Pre detailné očakávania zaokrúhľovania, prečítajte si `docs/liquidity-rounding.md` a `docs/liquidity-fee-protection.md`.

## Výber likvidity {#-vyber-likvidity}

`clammRemoveLiquiditySender` spaľuje LP tokeny výmennou za základné aktíva plus nahromadené poplatky.

```typescript
import { clammRemoveLiquiditySender } from 'biatec-concentrated-liquidity-amm';

await clammRemoveLiquiditySender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  assetLp: 9619n,
  lpToSend: 3_000_000n,
});
```

Použite `clammRemoveLiquidityAdminSender` helper, ak potrebujete administratívny výber, ktorý obchádza identity kontroly (rezervované pre governance toky).

## Swapovanie aktív {#-swapovanie-aktiv}

`clammSwapSender` vykoná swap v oboch smeroch. Poskytnite aktívum, ktoré posielate, množstvo a minimálne množstvo, ktoré ste ochotní prijať (po poplatkoch) v proti aktívume.

```typescript
import { clammSwapSender } from 'biatec-concentrated-liquidity-amm';

await clammSwapSender({
  clientBiatecClammPool: poolClient,
  account: signerAccount,
  algod,
  appBiatecConfigProvider: configProviderAppId,
  appBiatecIdentityProvider: identityProviderAppId,
  appBiatecPoolProvider: poolProviderAppId,
  assetA: 9581n,
  assetB: 0n,
  fromAsset: 9581n,
  fromAmount: 10_000_000n,
  minimumToReceive: 9_800_000n,
});
```

Swap helper pripája pool-provider a identity box referencie automaticky. Na odhad výstupných množstiev pred odoslaním swapu, zavolajte read-only kalkulačné metódy exponované na `BiatecPoolProviderClient` (napríklad `clientBiatecPoolProvider.getPrice` alebo `calculateAsset*` rodinu metód).

## Spotreba pool-provider oracle feedu {#-spotreba-pool-provider-oracle-feedu}

Biatec pool provider udržiava on-chain oracle dáta pre každý pár aktív. Zavolajte generovanú `getPrice` metódu s `appPoolId = 0n` na získanie agregovaných metrík. Návratová hodnota je už dekódovaná do camelCase polí.

```typescript
const priceInfo = await poolProviderClient.appClient.getPrice({
  args: {
    assetA: 0n,
    assetB: 9581n,
    appPoolId: 0n, // nula => agregované cez všetky pooly pre pár
  },
});

console.log('najnovšia cena (základná škála):', priceInfo.latestPrice);
console.log('period1 VWAP (základná škála):', priceInfo.period1NowVwap);
console.log('najnovší obchodný poplatok (aktívum A):', priceInfo.period1NowFeeA);
```

Keď potrebujete pool-specifické oracle dáta, prejdite CLAMM app ID ako `appPoolId` namiesto nuly. Metóda vracia rovnakú `AppPoolInfo` štruktúru v oboch prípadoch.

## Dodatočné operácie {#-dodatocne-operacie}

- **Distribuovať odmeny:** `clammDistributeExcessAssetsSender` pripisuje staking alebo fee odmeny LP držiteľom. Množstvá musia byť vyjadrené v 1e9 základnej škále.
- **Vybrať protokol poplatky:** `clammWithdrawExcessAssetsSender` umožňuje fee executorovi získať nahromadený protokol príjem.
- **Prepnúť stav validátora:** `clammSendOnlineKeyRegistrationSender` a `clammSendOfflineKeyRegistrationSender` obaľujú AVM key registration toky, keď pool účet stakuje na consensus sieťach.
- **Pool discovery a quotovanie:** `getPools` (z `src/biatecClamm/getPools.ts`) enumeruje registry záznamy; generovaný pool-provider klient exponuje pure funkcie pre sizing vklady a výbery (napr. `calculateAssetADepositOnAssetBDeposit`).

## Odporúčané čítanie {#-odporucane-citanie}

- `docs/liquidity-rounding.md` pre pravidlá zaokrúhľovania a presnosti.
- `docs/liquidity-fee-protection.md` pre fee accounting záruky.
- `docs/staking-pools.md` pre konštantno-cenové (same-asset) staking scenáre.

Tieto stavebné bloky pokrývajú štandardnú používateľskú cestu: vytvorte alebo objavte pool, poskytnite likviditu so správnymi cenovými hranicami, zarábajte poplatky, vykonajte swapy a spoliehajte sa na pool provider pre oracle-grade cenové dáta.
