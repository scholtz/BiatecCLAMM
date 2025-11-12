# Biatec CLAMM alap használati esetek

Ez az útmutató bemutatja a Biatec koncentrált likviditású AMM (CLAMM) által támogatott mindennapi folyamatokat. A kliens példányosítására, a likviditás finanszírozására egy ársávon belül vagy rögzített ár mellett, a likviditás visszavonására, swapokra és a pool szolgáltató oracle feedjének felhasználására összpontosít. Az olyan haladó témák, mint a kerekítési viselkedés vagy a stakingre jellemző folyamatok, a `docs/` könyvtár meglévő dokumentumaiban találhatók.

## Követelmények {#-prerequisites}

- Hozzáférés egy Algorand hálózathoz (Sandbox LocalNet, TestNet vagy MainNet) és egy `Algodv2` RPC végponthoz.
- A Biatec konfigurációs szolgáltató, identitásszolgáltató és pool szolgáltató szerződéseinek futó példányai. Az alábbi példák feltételezik, hogy ezek alkalmazásazonosítói már ismertek.
- Aláírás előtt mindig ellenőrizze, hogy a pool szolgáltató globális állapota (`key = 'B'`) megegyezik-e azzal a konfigurációs app ID-val, amelyre bármely telepítési csoportban hivatkozik. Ha az azonosítók eltérnek, szakítsa meg a tranzakciót, hogy elkerülje egy hamisított konfigurációval való interakciót.
- Egy feltöltött számla `Algokit` `TransactionSignerAccount` formátumban a tranzakciók aláírásához.
- Jártaság a szerződések által használt 1e9 alapléptékben (`SCALE = 1_000_000_000n`). A pontossággal kapcsolatos részletekért lásd a `docs/liquidity-rounding.md` fájlt.
- Opcionális, de ajánlott: használja a `getConfig(genesisId)` függvényt, hogy a támogatott hálózatok legfrissebb éles app ID-it töltse be a kódba égetés helyett.

## Közös inicializálás {#-shared-setup}

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

const { configAppId: configProviderAppId, identityAppId: identityProviderAppId, poolProviderAppId } = getConfig('testnet-v1.0');
const poolProviderClient = new BiatecPoolProviderClient({
  algorand,
  appId: poolProviderAppId,
});

// Állítsa be a CLAMM klienst egy létező poolra, amint ismert az app ID.
const poolAppId = 45678n;
const poolClient = clientBiatecClammPool({
  algorand,
  appId: poolAppId,
});
```

> **Tipp:** Használja a `src/biatecClamm/getPools.ts` segédet, ha csak egy eszközazonosítót vagy hitelesítési osztályt ismer, és fel kell fedeznie a pool szolgáltató által kezelt poolokat.

## Pool létrehozása (ársáv vs. konstans ár) {#-creating-a-pool-price-range-vs-constant-price}

A poolt a `clammCreateSender` hozza létre. Adja át a `priceMin`, `priceMax` és `currentPrice` értékeket alapléptékben (1e9). Ha `priceMin === priceMax`, a pool rögzített áras lesz, ami a staking poolok létrehozásának módja.

```typescript
import { clammCreateSender } from 'biatec-concentrated-liquidity-amm';

const SCALE = 1_000_000_000n;

await poolProviderClient.send.setNativeTokenName({
  args: {
    appBiatecConfigProvider: configProviderAppId,
    nativeTokenName: 'Algo',
  },
  appReferences: [configProviderAppId],
});

const poolClient = await clammCreateSender({
  transactionSigner: signerAccount,
  clientBiatecPoolProvider: poolProviderClient,
  appBiatecConfigProvider: configProviderAppId,
  assetA: 9581n,
  assetB: 0n, // a 0n a natív tokent jelöli
  fee: 10_000_000n, // 1% díj alapléptékben
  verificationClass: 0,
  priceMin: SCALE / 2n,
  priceMax: SCALE * 2n,
  currentPrice: SCALE,
});

// A clammCreateSender automatikusan meghívja a bootstrapStep2-t, így a pool betétekre kész.
```

Konstans áras staking poolhoz használja ugyanazt a kódrészletet, és állítsa a `priceMin`, `priceMax` és `currentPrice` mezőket azonos alapléptékű értékre (jellemzően `SCALE`). További részletekért lásd a `docs/staking-pools.md` dokumentumot.

## Likviditás biztosítása {#-supplying-liquidity}

A `clammAddLiquiditySender` csomagolja a letéthez szükséges összesített tranzakciót, beleértve az eszközök küldését és a pool szolgáltató metaadatainak hivatkozását.

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
  assetADeposit: 2_500_000n, // összeg az eszköz natív tizedeseiben
  assetBDeposit: 2_500_000n,
});
```

- A küldő automatikusan belépteti a számlát az LP tokenre, ha szükséges.
- A letéteknek tiszteletben kell tartaniuk a pool ársávját. Széles sávba történő belépéskor igazítsa a két letétet a `contracts/clients/BiatecPoolProviderClient.ts` fájlban található off-chain kalkulátorok (`calculateAsset*` lekérdezések) által meghatározott arányokhoz.
- A kerekítési elvárások részletei a `docs/liquidity-rounding.md` és `docs/liquidity-fee-protection.md` dokumentumokban olvashatók.

## Likviditás visszavonása {#-withdrawing-liquidity}

A `clammRemoveLiquiditySender` LP tokeneket éget, és visszaadja a mögöttes eszközöket a felhalmozott díjakkal együtt.

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

Adminisztratív likviditás-kivonáshoz használja a `clammRemoveLiquidityAdminSender` segédfüggvényt, amely megkerüli az identitás ellenőrzéseket (kormányzati folyamatokra fenntartva).

## Eszközök cseréje {#-swapping-assets}

A `clammSwapSender` mindkét irányba végrehajtja a swapot. Adja meg, hogy melyik eszközt és mennyit küld, illetve mekkora minimális ellenértéket fogad el (díjak után) a másik eszközben.

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

A swap segédfüggvény automatikusan csatolja a pool szolgáltató és az identitásszolgáltató box hivatkozásait. A swap beadása előtt a várható kimenet becsléséhez hívja meg a `BiatecPoolProviderClient` által elérhető read-only kalkulátorokat (például `clientBiatecPoolProvider.getPrice` vagy a `calculateAsset*` függvénycsalád).

## A pool szolgáltató oracle feedje {#-consuming-the-pool-provider-oracle-feed}

A Biatec pool szolgáltató on-chain oracle adatokat tart karban minden eszközpárra. Hívja meg a generált `getPrice` metódust `appPoolId = 0n` paraméterrel, hogy megkapja az összesített metrikákat. A visszatérési érték már camelCase mezőkre van dekódolva.

```typescript
const priceInfo = await poolProviderClient.appClient.getPrice({
  args: {
    assetA: 0n,
    assetB: 9581n,
    appPoolId: 0n, // nulla => az adott pár összes pooljára aggregálva
  },
});

console.log('legutóbbi ár (alaplépték):', priceInfo.latestPrice);
console.log('period1 VWAP (alaplépték):', priceInfo.period1NowVwap);
console.log('legutóbbi kereskedési díj (asset A):', priceInfo.period1NowFeeA);
```

Ha pool-specifikus oracle adatokra van szüksége, adja át a CLAMM app ID-t `appPoolId` értékként a nulla helyett. A metódus mindkét esetben ugyanazt az `AppPoolInfo` struktúrát szolgáltatja.

## További műveletek {#-additional-operations}

- **Jutalmak kiosztása:** a `clammDistributeExcessAssetsSender` staking vagy díj jutalmakat ír jóvá az LP tulajdonosoknak. Az összegeket 1e9 alapléptékben kell megadni.
- **Protokolldíjak felvétele:** a `clammWithdrawExcessAssetsSender` lehetővé teszi a díj végrehajtó számára a felhalmozott protokollbevétel begyűjtését.
- **Validátor státusz kapcsolása:** a `clammSendOnlineKeyRegistrationSender` és `clammSendOfflineKeyRegistrationSender` csomagolja az AVM kulcsregisztrációs folyamatokat, amikor a pool számla konszenzusláncokon stakingel.
- **Pool felderítés és árazás:** a `getPools` (`src/biatecClamm/getPools.ts`) felsorolja a regisztrációs bejegyzéseket; a generált pool szolgáltató kliens tiszta függvényeket biztosít a betétek és kivonások méretezéséhez (például `calculateAssetADepositOnAssetBDeposit`).

## Ajánlott olvasmányok {#-recommended-reading}

- `docs/liquidity-rounding.md` a kerekítési és pontossági szabályokról.
- `docs/liquidity-fee-protection.md` a díjszámítási garanciákról.
- `docs/staking-pools.md` a konstans áras (azonos eszközű) staking forgatókönyvekről.

Ezek az építőkockák lefedik a tipikus felhasználói utat: pool létrehozása vagy felfedezése, likviditás biztosítása a megfelelő ársávban, díjak gyűjtése, swapok végrehajtása és a pool szolgáltató oracle szintű áradataira támaszkodás.
