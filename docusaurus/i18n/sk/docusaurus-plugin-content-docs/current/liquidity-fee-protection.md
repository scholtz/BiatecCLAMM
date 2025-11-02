# Ochrana akumulácie poplatkov keď sa pripoja noví LP

Dátum: 2025-10-26
Repository: BiatecCLAMM (projects/BiatecCLAMM)
Primárny súbor: `contracts/BiatecClammPool.algo.ts`

## Pozadie {#-pozadie}

Keď pool nazbiera swap poplatky, on-chain stav ich sleduje ako dodatočnú likviditu (`LiquidityUsersFromFees`) bez mintovania extra LP tokenov. Predchádzajúci add-liquidity flow mintoval nové LP tokeny z raw liquidity delta (`newLiquidity - oldLiquidity`). Výsledkom bolo, že nováčik mohol pridať likviditu a okamžite ju odobrať, aby harvestoval pro-rata podiel z historických poplatkov, ktoré by mali patriť incumbent LP.

Regresia sa objavila v pool teste "new liquidity provider does not scoop pre-existing fees" kde účet C pridá likviditu po swap-fee scenári a odoberie ju priamo. Očakávané správanie je, že účet dostane presne to, čo vložil (net zero profit).

## Súhrn fixu {#-suhrn-fixu}

`processAddLiquidity` teraz rieši kvadratickú reláciu vynútenú immediate withdrawal parity a flooruje pozitívny root pred mintovaním LP tokenov:

```
X^2 + X(sumDistributedAndFees − Q) − Q * distributedBefore = 0
```

kde:

- `distributedBefore` je predtým distribuovaný LP supply (škálovaný na base precision),
- `LiquidityUsersFromFees` zachytáva historickú fee likviditu stále vlastnenú incumbents,
- `Q = depositShare * newLiquidity` s `depositShare` odvodeným z callerovej base-scale contribúcie,
- `X` je base-scale LP delta, ktoré riešime.

Floorovaním root (a tým pádom zaokrúhľovaním v prospech poolu) zaistíme, že nováčikovia nikdy nemintujú dosť LP na odomknutie pre-existujúcich fees. Keď pool nemá nahromadené fees, kvadratická sa zrúti na pôvodné "mint the liquidity delta" správanie.

Rovnaká proporcionálna aritmetika sa znovu používa na exit: fee shares sú kalkulované s single multiply/divide pass takže rounding drift zostáva predvídateľný a vždy benefituje contract.

## Očakávania zaokrúhľovania {#-ocakavania-zaokruhlovania}

- Výbery môžu trailovať vklady o pár base units kvôli mandatory flooring step. Rozdiel je bounded frakciou assetovej škály (≤ 20% z base škály v súčasných testoch) a zostáva vnútri poolu, favorizujúc existujúcich LP.
- Jest suite teraz assertuje, že newcomer balance nikdy nenarastie a toleruje iba tiny deficit. Akékoľvek rozšírenie gapu zlyhá test, dávajúc early warning ak maths regredujú.

## Pozorovateľné efekty {#-pozorovatelne-efekty}

- Čerstvý LP kto pridá a immediate odstráni likviditu teraz dostane exact množstvá vložené (až do očakávaného integer zaokrúhľovania), takže už nededia historické fees.
- Incumbent LP si zachovajú full ownership `LiquidityUsersFromFees`. Fees nahromadené po tom, čo sa newcomer pripojí sú stále zdieľané fair, pretože kvadratické riešenie iba neutralizuje pre-existujúcu komponentu.

## Test coverage {#-test-coverage}

- `npm run test:1:build` (a focused Jest case "new liquidity provider does not scoop pre-existing fees") teraz passuje s updated contract a relaxed rounding tolerance.
- Iné liquidity testy zostávajú green pretože adjustment zachováva pôvodné správanie keď pool nemá accrued user fees.

## Operačné poznámky {#-operacne-poznamky}

- Akákoľvek contract zmena vyžaduje recomputing TEAL artifacts (`npm run compile-contract`) a regenerating clients (`npm run generate-client` alebo `npm run build`) pred publishing packages.
- Off-chain helpers alebo simulácie, ktoré sa spoliehali na raw `newLiquidity - oldLiquidity` mint formula musia byť updated na mirrorovanie kvadratického riešenia, aby sa vyhlo drift medzi client-side estimates a on-chain results.
- Pool deployments musia teraz používať pool provider's registered configuration app ID. Pool provider to vynucuje on-chain, takže double-checknite `B` global state key pred initiating deploy.

## Ďalšie kroky {#-dalsie-kroky}

- Rozšíriť off-chain math utilities v `src/biatecClamm/` na expose rovnakého LP token kalkulácie takže front-end previews zostanú accurate.
- Pridať regression testy na cover asymetrické vklady a scenáre s non-zero `LiquidityBiatecFromFees` na ensure, že formula generalizuje.
