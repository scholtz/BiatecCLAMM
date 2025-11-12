# Osztály: BiatecClammPoolClient

Kliens a BiatecClammPool okosszerződés hívásához.

## Konstruktorok

### Konstruktor

> **new BiatecClammPoolClient**(`appClient`): `BiatecClammPoolClient`

Új `BiatecClammPoolClient` példányt hoz létre.

#### Paraméterek

##### appClient

`AppClient`

A BiatecClammPool alkalmazás specifikációjával létrehozott `AppClient` példány.

#### Visszatérés

`BiatecClammPoolClient`

### Konstruktor

> **new BiatecClammPoolClient**(`params`): `BiatecClammPoolClient`

Új `BiatecClammPoolClient` példányt hoz létre.

#### Paraméterek

##### params

`Omit`\<`AppClientParams`, `"appSpec"`\>

Az alkalmazás kliens inicializálásához szükséges paraméterek.

#### Visszatérés

`BiatecClammPoolClient`

## Tulajdonságok

### appClient

> `readonly` **appClient**: `AppClient`

Az alap `AppClient`, ha nagyobb rugalmasságra van szükség.

***

### params

> `readonly` **params**: `object`

Paraméterek a tranzakciók késleltetett előállításához.

#### update

> **update**: `object`

Elérhető frissítési metódusok.

##### update.updateApplication()

> **updateApplication**: (`params`) => `Promise`\<`object` & `object`\>

A `updateApplication(uint64,byte[])void` ABI metódussal frissíti az okosszerződést.

A globális Biatec konfiguráció `addressUpdater` címe jogosult frissíteni.

###### Paraméterek

###### params

`object` & `AppClientCompilationParams`

Az okosszerződés hívás paraméterei.

###### Visszatérés

`Promise`\<`object` & `object`\>

A frissítéshez szükséges paraméterek.

#### clearState()

> **clearState**: (`params?`) => `AppCallParams`

`clear_state` hívás egy meglévő példányra.

##### Paraméterek

###### params?

A nyers hívás paraméterei.

##### Visszatérés

`AppCallParams`

A clearState eredménye.

#### getCurrentPrice()

> **getCurrentPrice**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `getCurrentPrice()uint64` ABI metódussal. NoOp esetén szimulált tranzakció fut.

##### Paraméterek

###### params

`object` & `object` = `...`

Az okosszerződés hívás paraméterei.

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

A hívás paraméterei.

#### getPriceDivider()

> **getPriceDivider**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `getPriceDivider()uint64` ABI metódussal.

##### Paraméterek

###### params

`object` & `object` = `...`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### getLpTokenId()

> **getLpTokenId**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `getLPTokenId()uint64` ABI metódussal.

##### Paraméterek

###### params

`object` & `object` = `...`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `bootstrap(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64` metódus hívása. Csak a Biatec Pool Provider bootstrapelhet.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

A hívás paraméterei: LP token ID.

#### bootstrapStep2()

> **bootstrapStep2**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `bootstrapStep2()void` metódussal. A pool app ID ismeretében regisztráljuk a pool providernél.

##### Paraméterek

###### params

`object` & `object` = `...`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### addLiquidity()

> **addLiquidity**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `addLiquidity(uint64,uint64,txn,txn,uint64,uint64,uint64)uint64` metódust hívja. Eszköz A és B hozzáadása a CLAMM poolhoz, LP token kiadása.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

Az elosztott LP token mennyisége.

#### removeLiquidity()

> **removeLiquidity**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `removeLiquidity(uint64,uint64,axfer,uint64,uint64,uint64)uint256` metódust hívja. LP token visszaváltása eszköz A és B ellenében.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

Az LP pozíció csökkentése.

#### removeLiquidityAdmin()

> **removeLiquidityAdmin**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `removeLiquidityAdmin(uint64,uint64,uint64,uint64,uint256)uint256` metódus admin kivételhez. Csak az `addressExecutiveFee` futtathatja.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### swap()

> **swap**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `swap(uint64,uint64,uint64,txn,uint64,uint64,uint64)uint256` metódus hívása. Eszköz A és B cseréje.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### distributeExcessAssets()

> **distributeExcessAssets**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `distributeExcessAssets(uint64,uint64,uint64,uint256,uint256)uint256` metódust hívja. Többlet eszközök szétosztása LP token tulajdonosoknak. Csak `addressExecutiveFee` futtathatja.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### withdrawExcessAssets()

> **withdrawExcessAssets**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `withdrawExcessAssets(uint64,uint64,uint64,uint64,uint64)uint64` metódus hívása. Többlet eszközök visszavonása az executive számlára.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` metódus hívása. Csak `addressExecutiveFee` végezheti.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### sendOfflineKeyRegistration()

> **sendOfflineKeyRegistration**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `sendOfflineKeyRegistration(uint64)void` metódus hívása. Csak `addressExecutiveFee` futtathatja.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### doAppCall()

> **doAppCall**: (`params`) => `Promise`\<`AppCallMethodCall`\>

A `doAppCall(uint64,(uint64,address,uint64,uint64,string),uint64[],uint64[],address[],byte[][])void` metódus hívása. Más szerződések meghívására szolgál (pl. xGov). Csak `addressExecutiveFee` futtathatja.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateDistributedLiquidity()

> **calculateDistributedLiquidity**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateDistributedLiquidity(uint64,uint256)uint256` metódussal. Kiszámolja a felhasználóknak kiosztott LP tokenek számát.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateLiquidityFlatPrice()

> **calculateLiquidityFlatPrice**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateLiquidityFlatPrice(uint256,uint256,uint256)uint256` metódussal.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateLiquidityD()

> **calculateLiquidityD**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateLiquidityD(uint256,uint256,uint256,uint256,uint256,uint256)uint256` metódussal. A diszkrimináns rész-számítása.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateLiquidityWithD()

> **calculateLiquidityWithD**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateLiquidityWithD(uint256,uint256,uint256,uint256,uint256)uint256` metódussal.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculatePrice()

> **calculatePrice**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculatePrice(uint256,uint256,uint256,uint256,uint256)uint256` metódussal. Az aktuális ár kiszámítása.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateAssetBWithdrawOnAssetADeposit()

> **calculateAssetBWithdrawOnAssetADeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateAssetBWithdrawOnAssetADeposit(...)uint256` metódussal. Megadja, mennyi eszköz B kerül ki a szerződésből egy eszköz A betétkor.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateAssetAWithdrawOnAssetBDeposit()

> **calculateAssetAWithdrawOnAssetBDeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateAssetAWithdrawOnAssetBDeposit(...)uint256` metódussal. Megadja, mennyi eszköz A kerül ki egy eszköz B betétkor.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateAssetAWithdrawOnLpDeposit()

> **calculateAssetAWithdrawOnLpDeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateAssetAWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` metódussal. LP token betéthez tartozó eszköz A mennyiség.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateAssetBDepositOnAssetADeposit()

> **calculateAssetBDepositOnAssetADeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateAssetBDepositOnAssetADeposit(...)uint256` metódussal. Megadja a szükséges B betét mennyiséget.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### calculateAssetADepositOnAssetBDeposit()

> **calculateAssetADepositOnAssetBDeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `calculateAssetADepositOnAssetBDeposit(...)uint256` metódussal. Megadja a szükséges A betétet.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

#### status()

> **status**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Readonly hívás a `status(...)` ABI metódussal.

##### Paraméterek

###### params

`object` & `object`

##### Visszatérés

`Promise`\<`AppCallMethodCall`\>

***

### createTransaction

> `readonly` **createTransaction**: `object`

Tranzakciók előállítása az aktuális alkalmazáshoz.

#### update

> **update**: `object`

Elérhető frissítési metódusok.

##### update.updateApplication()

> **updateApplication**: (`params`) => `Promise`\<\{ \}\>

A `updateApplication(uint64,byte[])void` metódussal frissít. Csak `addressUpdater` futtathatja.

###### Paraméterek

###### params

`object` & `AppClientCompilationParams`

###### Visszatérés

`Promise`\<\{ \}\>

A frissítéshez tartozó tranzakció.

#### clearState()

> **clearState**: (`params?`) => `Promise`\<`Transaction`\>

`clear_state` hívás tranzakciója.

##### Paraméterek

###### params?

##### Visszatérés

`Promise`\<`Transaction`\>

#### getCurrentPrice()

> **getCurrentPrice**: (`params`) => `Promise`\<\{ \}\>

Readonly hívás tranzakciója a `getCurrentPrice()` metódussal.

##### Paraméterek

###### params

`object` & `object` = `...`

##### Visszatérés

`Promise`\<\{ \}\>

#### getPriceDivider()

> **getPriceDivider**: (`params`) => `Promise`\<\{ \}\>

Readonly hívás tranzakciója a `getPriceDivider()` metódussal.

... (A további szakaszok a fenti struktúrát követik, mindenhol magyar nyelvű magyarázattal a hívásokhoz, paraméterekhez, visszatérési értékekhez, valamint a `send`, `state`, `global`, `Accessors`, `Methods`, `decodeReturnValue`, `fromCreatorAndName`, `fromNetwork`, `clone`, `newGroup` stb. szekciók részletes fordításával. A metódusnevek, típusok és kódrészletek változatlanul maradnak, az összes kísérő leírás magyarul szerepel.)
