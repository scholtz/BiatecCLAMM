# Class: BiatecPoolProviderClient

A client to make calls to the BiatecPoolProvider smart contract

## Constructors

### Constructor

> **new BiatecPoolProviderClient**(`appClient`): `BiatecPoolProviderClient`

Creates a new instance of `BiatecPoolProviderClient`

#### Parameters

##### appClient

`AppClient`

An `AppClient` instance which has been created with the BiatecPoolProvider app spec

#### Returns

`BiatecPoolProviderClient`

### Constructor

> **new BiatecPoolProviderClient**(`params`): `BiatecPoolProviderClient`

Creates a new instance of `BiatecPoolProviderClient`

#### Parameters

##### params

`Omit`\<`AppClientParams`, `"appSpec"`\>

The parameters to initialise the app client with

#### Returns

`BiatecPoolProviderClient`

## Properties

### appClient

> `readonly` **appClient**: `AppClient`

The underlying `AppClient` for when you want to have more flexibility

***

### params

> `readonly` **params**: `object`

Get parameters to create transactions for the current app. A good mental model for this is that these parameters represent a deferred transaction creation.

#### update

> **update**: `object`

Gets available update methods

##### update.updateApplication()

> **updateApplication**: (`params`) => `Promise`\<`object` & `object`\>

Updates an existing instance of the BiatecPoolProvider smart contract using the `updateApplication(uint64,byte[])void` ABI method.

addressUdpater from global biatec configuration is allowed to update application

###### Parameters

###### params

`object` & `AppClientCompilationParams`

The params for the smart contract call

###### Returns

`Promise`\<`object` & `object`\>

The update params

#### clearState()

> **clearState**: (`params?`) => `AppCallParams`

Makes a clear_state call to an existing instance of the BiatecPoolProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`AppCallParams`

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `bootstrap(uint64)void` ABI method.

Biatec deploys single pool provider smart contract

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### getCurrentStatus()

> **getCurrentStatus**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `getCurrentStatus(uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns current status

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Pool info statistics

#### setNativeTokenName()

> **setNativeTokenName**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `setNativeTokenName(uint64,byte[])void` ABI method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### loadClammContractData()

> **loadClammContractData**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `loadCLAMMContractData(uint64,uint64,uint64,byte[])void` ABI method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### noop()

> **noop**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `noop(uint64)void` ABI method.

No op tx to increase the app call and box size limits

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### deployPool()

> **deployPool**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `deployPool(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

Anybody can call this method to bootstrap new clamm pool

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: LP token ID

#### registerPool()

> **registerPool**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `registerPool()void` ABI method.

This method is called by constructor of the luquidity pool

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### registerTrade()

> **registerTrade**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `registerTrade(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)void` ABI method.

This metod registers the trade and calculates and store the trade statistics

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### withdrawExcessAssets()

> **withdrawExcessAssets**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `withdrawExcessAssets(uint64,uint64,uint64)uint64` ABI method.

If someone deposits excess assets to this smart contract biatec can use them.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### getPrice()

> **getPrice**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `getPrice(uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Retuns the full price info for the asset pair. If app pool is defined, then it returns the pool info.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: AppPoolInfo with the price info for the asset pair

#### calculateAssetBWithdrawOnLpDeposit()

> **calculateAssetBWithdrawOnLpDeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecPoolProvider smart contract using the `calculateAssetBWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B will be taken from the smart contract on LP asset deposit

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

***

### createTransaction

> `readonly` **createTransaction**: `object`

Create transactions for the current app

#### update

> **update**: `object`

Gets available update methods

##### update.updateApplication()

> **updateApplication**: (`params`) => `Promise`\<\{ \}\>

Updates an existing instance of the BiatecPoolProvider smart contract using the `updateApplication(uint64,byte[])void` ABI method.

addressUdpater from global biatec configuration is allowed to update application

###### Parameters

###### params

`object` & `AppClientCompilationParams`

The params for the smart contract call

###### Returns

`Promise`\<\{ \}\>

The update transaction

#### clearState()

> **clearState**: (`params?`) => `Promise`\<`Transaction`\>

Makes a clear_state call to an existing instance of the BiatecPoolProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`Promise`\<`Transaction`\>

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `bootstrap(uint64)void` ABI method.

Biatec deploys single pool provider smart contract

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### getCurrentStatus()

> **getCurrentStatus**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `getCurrentStatus(uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns current status

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Pool info statistics

#### setNativeTokenName()

> **setNativeTokenName**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `setNativeTokenName(uint64,byte[])void` ABI method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### loadClammContractData()

> **loadClammContractData**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `loadCLAMMContractData(uint64,uint64,uint64,byte[])void` ABI method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### noop()

> **noop**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `noop(uint64)void` ABI method.

No op tx to increase the app call and box size limits

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### deployPool()

> **deployPool**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `deployPool(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

Anybody can call this method to bootstrap new clamm pool

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: LP token ID

#### registerPool()

> **registerPool**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `registerPool()void` ABI method.

This method is called by constructor of the luquidity pool

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### registerTrade()

> **registerTrade**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `registerTrade(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)void` ABI method.

This metod registers the trade and calculates and store the trade statistics

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### withdrawExcessAssets()

> **withdrawExcessAssets**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `withdrawExcessAssets(uint64,uint64,uint64)uint64` ABI method.

If someone deposits excess assets to this smart contract biatec can use them.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### getPrice()

> **getPrice**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `getPrice(uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Retuns the full price info for the asset pair. If app pool is defined, then it returns the pool info.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: AppPoolInfo with the price info for the asset pair

#### calculateAssetBWithdrawOnLpDeposit()

> **calculateAssetBWithdrawOnLpDeposit**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecPoolProvider smart contract using the `calculateAssetBWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B will be taken from the smart contract on LP asset deposit

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

***

### send

> `readonly` **send**: `object`

Send calls to the current app

#### update

> **update**: `object`

Gets available update methods

##### update.updateApplication()

> **updateApplication**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Updates an existing instance of the BiatecPoolProvider smart contract using the `updateApplication(uint64,byte[])void` ABI method.

addressUdpater from global biatec configuration is allowed to update application

###### Parameters

###### params

`object` & `AppClientCompilationParams` & `SendParams`

The params for the smart contract call

###### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The update result

#### clearState()

> **clearState**: (`params?`) => `Promise`\<\{ \}\>

Makes a clear_state call to an existing instance of the BiatecPoolProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`Promise`\<\{ \}\>

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `bootstrap(uint64)void` ABI method.

Biatec deploys single pool provider smart contract

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### getCurrentStatus()

> **getCurrentStatus**: (`params`) => `Promise`\<\{ `return`: [`AppPoolInfo`](../type-aliases/AppPoolInfo.md) \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `getCurrentStatus(uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns current status

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: [`AppPoolInfo`](../type-aliases/AppPoolInfo.md) \| `undefined`; \}\>

The call result: Pool info statistics

#### setNativeTokenName()

> **setNativeTokenName**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `setNativeTokenName(uint64,byte[])void` ABI method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### loadClammContractData()

> **loadClammContractData**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `loadCLAMMContractData(uint64,uint64,uint64,byte[])void` ABI method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### noop()

> **noop**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `noop(uint64)void` ABI method.

No op tx to increase the app call and box size limits

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### deployPool()

> **deployPool**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `deployPool(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

Anybody can call this method to bootstrap new clamm pool

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: LP token ID

#### registerPool()

> **registerPool**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `registerPool()void` ABI method.

This method is called by constructor of the luquidity pool

##### Parameters

###### params

`object` & `SendParams` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### registerTrade()

> **registerTrade**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `registerTrade(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)void` ABI method.

This metod registers the trade and calculates and store the trade statistics

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### withdrawExcessAssets()

> **withdrawExcessAssets**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `withdrawExcessAssets(uint64,uint64,uint64)uint64` ABI method.

If someone deposits excess assets to this smart contract biatec can use them.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### getPrice()

> **getPrice**: (`params`) => `Promise`\<\{ `return`: [`AppPoolInfo`](../type-aliases/AppPoolInfo.md) \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `getPrice(uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Retuns the full price info for the asset pair. If app pool is defined, then it returns the pool info.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: [`AppPoolInfo`](../type-aliases/AppPoolInfo.md) \| `undefined`; \}\>

The call result: AppPoolInfo with the price info for the asset pair

#### calculateAssetBWithdrawOnLpDeposit()

> **calculateAssetBWithdrawOnLpDeposit**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecPoolProvider smart contract using the `calculateAssetBWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B will be taken from the smart contract on LP asset deposit

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

***

### state

> **state**: `object`

Methods to access state for the current BiatecPoolProvider app

#### global

> **global**: `object`

Methods to access global state for the current BiatecPoolProvider app

##### global.getAll()

> **getAll**: () => `Promise`\<`Partial`\<\{ `period1`: `bigint`; `period2`: `bigint`; `period3`: `bigint`; `period4`: `bigint`; `nativeTokenName`: `BinaryState`; `recentPools1`: `bigint`; `recentPools2`: `bigint`; `recentPools3`: `bigint`; `recentPools4`: `bigint`; `recentPools5`: `bigint`; `recentPools6`: `bigint`; `recentPools7`: `bigint`; `recentPools8`: `bigint`; `recentPools9`: `bigint`; `recentPools10`: `bigint`; `recentPoolsIndex`: `bigint`; `appBiatecConfigProvider`: `bigint`; `version`: `BinaryState`; \}\>\>

Get all current keyed values from global state

###### Returns

`Promise`\<`Partial`\<\{ `period1`: `bigint`; `period2`: `bigint`; `period3`: `bigint`; `period4`: `bigint`; `nativeTokenName`: `BinaryState`; `recentPools1`: `bigint`; `recentPools2`: `bigint`; `recentPools3`: `bigint`; `recentPools4`: `bigint`; `recentPools5`: `bigint`; `recentPools6`: `bigint`; `recentPools7`: `bigint`; `recentPools8`: `bigint`; `recentPools9`: `bigint`; `recentPools10`: `bigint`; `recentPoolsIndex`: `bigint`; `appBiatecConfigProvider`: `bigint`; `version`: `BinaryState`; \}\>\>

##### global.period1()

> **period1**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the period1 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.period2()

> **period2**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the period2 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.period3()

> **period3**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the period3 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.period4()

> **period4**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the period4 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.nativeTokenName()

> **nativeTokenName**: () => `Promise`\<`BinaryState`\>

Get the current value of the nativeTokenName key in global state

###### Returns

`Promise`\<`BinaryState`\>

##### global.recentPools1()

> **recentPools1**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools1 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools2()

> **recentPools2**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools2 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools3()

> **recentPools3**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools3 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools4()

> **recentPools4**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools4 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools5()

> **recentPools5**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools5 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools6()

> **recentPools6**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools6 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools7()

> **recentPools7**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools7 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools8()

> **recentPools8**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools8 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools9()

> **recentPools9**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools9 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPools10()

> **recentPools10**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPools10 key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.recentPoolsIndex()

> **recentPoolsIndex**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the recentPoolsIndex key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.appBiatecConfigProvider()

> **appBiatecConfigProvider**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the appBiatecConfigProvider key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.version()

> **version**: () => `Promise`\<`BinaryState`\>

Get the current value of the version key in global state

###### Returns

`Promise`\<`BinaryState`\>

#### box

> **box**: `object`

Methods to access box state for the current BiatecPoolProvider app

##### box.getAll()

> **getAll**: () => `Promise`\<`Partial`\<\{ `clammApprovalProgram1`: `BinaryState`; `clammApprovalProgram2`: `BinaryState`; `clammApprovalProgram3`: `BinaryState`; \}\>\>

Get all current keyed values from box state

###### Returns

`Promise`\<`Partial`\<\{ `clammApprovalProgram1`: `BinaryState`; `clammApprovalProgram2`: `BinaryState`; `clammApprovalProgram3`: `BinaryState`; \}\>\>

##### box.clammApprovalProgram1()

> **clammApprovalProgram1**: () => `Promise`\<`BinaryState`\>

Get the current value of the clammApprovalProgram1 key in box state

###### Returns

`Promise`\<`BinaryState`\>

##### box.clammApprovalProgram2()

> **clammApprovalProgram2**: () => `Promise`\<`BinaryState`\>

Get the current value of the clammApprovalProgram2 key in box state

###### Returns

`Promise`\<`BinaryState`\>

##### box.clammApprovalProgram3()

> **clammApprovalProgram3**: () => `Promise`\<`BinaryState`\>

Get the current value of the clammApprovalProgram3 key in box state

###### Returns

`Promise`\<`BinaryState`\>

##### box.pools

> **pools**: `object`

Get values from the pools map in box state

##### box.pools.getMap()

> **getMap**: () => `Promise`\<`Map`\<`bigint`, [`AppPoolInfo`](../type-aliases/AppPoolInfo.md)\>\>

Get all current values of the pools map in box state

###### Returns

`Promise`\<`Map`\<`bigint`, [`AppPoolInfo`](../type-aliases/AppPoolInfo.md)\>\>

##### box.pools.value()

> **value**: (`key`) => `Promise`\<[`AppPoolInfo`](../type-aliases/AppPoolInfo.md) \| `undefined`\>

Get a current value of the pools map by key from box state

###### Parameters

###### key

`number` | `bigint`

###### Returns

`Promise`\<[`AppPoolInfo`](../type-aliases/AppPoolInfo.md) \| `undefined`\>

##### box.poolsByConfig

> **poolsByConfig**: `object`

Get values from the poolsByConfig map in box state

##### box.poolsByConfig.getMap()

> **getMap**: () => `Promise`\<`Map`\<[`PoolConfig`](../type-aliases/PoolConfig.md), `bigint`\>\>

Get all current values of the poolsByConfig map in box state

###### Returns

`Promise`\<`Map`\<[`PoolConfig`](../type-aliases/PoolConfig.md), `bigint`\>\>

##### box.poolsByConfig.value()

> **value**: (`key`) => `Promise`\<`bigint` \| `undefined`\>

Get a current value of the poolsByConfig map by key from box state

###### Parameters

###### key

[`PoolConfig`](../type-aliases/PoolConfig.md)

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### box.fullConfigs

> **fullConfigs**: `object`

Get values from the fullConfigs map in box state

##### box.fullConfigs.getMap()

> **getMap**: () => `Promise`\<`Map`\<[`FullConfig`](../type-aliases/FullConfig.md), `bigint`\>\>

Get all current values of the fullConfigs map in box state

###### Returns

`Promise`\<`Map`\<[`FullConfig`](../type-aliases/FullConfig.md), `bigint`\>\>

##### box.fullConfigs.value()

> **value**: (`key`) => `Promise`\<`bigint` \| `undefined`\>

Get a current value of the fullConfigs map by key from box state

###### Parameters

###### key

[`FullConfig`](../type-aliases/FullConfig.md)

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### box.poolsAggregated

> **poolsAggregated**: `object`

Get values from the poolsAggregated map in box state

##### box.poolsAggregated.getMap()

> **getMap**: () => `Promise`\<`Map`\<`AssetsCombined`, [`AppPoolInfo`](../type-aliases/AppPoolInfo.md)\>\>

Get all current values of the poolsAggregated map in box state

###### Returns

`Promise`\<`Map`\<`AssetsCombined`, [`AppPoolInfo`](../type-aliases/AppPoolInfo.md)\>\>

##### box.poolsAggregated.value()

> **value**: (`key`) => `Promise`\<[`AppPoolInfo`](../type-aliases/AppPoolInfo.md) \| `undefined`\>

Get a current value of the poolsAggregated map by key from box state

###### Parameters

###### key

`AssetsCombined`

###### Returns

`Promise`\<[`AppPoolInfo`](../type-aliases/AppPoolInfo.md) \| `undefined`\>

## Accessors

### appId

#### Get Signature

> **get** **appId**(): `bigint`

The ID of the app instance this client is linked to.

##### Returns

`bigint`

***

### appAddress

#### Get Signature

> **get** **appAddress**(): `Address`

The app address of the app instance this client is linked to.

##### Returns

`Address`

***

### appName

#### Get Signature

> **get** **appName**(): `string`

The name of the app.

##### Returns

`string`

***

### appSpec

#### Get Signature

> **get** **appSpec**(): `Arc56Contract`

The ARC-56 app spec being used

##### Returns

`Arc56Contract`

***

### algorand

#### Get Signature

> **get** **algorand**(): `AlgorandClient`

A reference to the underlying `AlgorandClient` this app client is using.

##### Returns

`AlgorandClient`

## Methods

### decodeReturnValue()

> **decodeReturnValue**\<`TSignature`\>(`method`, `returnValue`): `MethodReturn`\<`TSignature`\> \| `undefined`

Checks for decode errors on the given return value and maps the return value to the return type for the given method

#### Type Parameters

##### TSignature

`TSignature` *extends* `"withdrawExcessAssets"` \| `"withdrawExcessAssets(uint64,uint64,uint64)uint64"` \| `"getCurrentStatus(uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)"` \| `"getCurrentStatus"` \| `"deployPool(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64"` \| `"deployPool"` \| `"getPrice(uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)"` \| `"getPrice"` \| `"calculateAssetBWithdrawOnLpDeposit(uint256,uint256,uint256)uint256"` \| `"calculateAssetBWithdrawOnLpDeposit"`

#### Parameters

##### method

`TSignature`

##### returnValue

`ABIReturn` | `undefined`

#### Returns

`MethodReturn`\<`TSignature`\> \| `undefined`

The typed return value or undefined if there was no value

***

### fromCreatorAndName()

> `static` **fromCreatorAndName**(`params`): `Promise`\<`BiatecPoolProviderClient`\>

Returns a new `BiatecPoolProviderClient` client, resolving the app by creator address and name
using AlgoKit app deployment semantics (i.e. looking for the app creation transaction note).

#### Parameters

##### params

`Omit`\<`ResolveAppClientByCreatorAndName`, `"appSpec"`\>

The parameters to create the app client

#### Returns

`Promise`\<`BiatecPoolProviderClient`\>

***

### fromNetwork()

> `static` **fromNetwork**(`params`): `Promise`\<`BiatecPoolProviderClient`\>

Returns an `BiatecPoolProviderClient` instance for the current network based on
pre-determined network-specific app IDs specified in the ARC-56 app spec.

If no IDs are in the app spec or the network isn't recognised, an error is thrown.

#### Parameters

##### params

`Omit`\<`ResolveAppClientByNetwork`, `"appSpec"`\>

The parameters to create the app client

#### Returns

`Promise`\<`BiatecPoolProviderClient`\>

***

### clone()

> **clone**(`params`): `BiatecPoolProviderClient`

Clone this app client with different params

#### Parameters

##### params

The params to use for the the cloned app client. Omit a param to keep the original value. Set a param to override the original value. Setting to undefined will clear the original value.

#### Returns

`BiatecPoolProviderClient`

A new app client with the altered params

***

### getCurrentStatus()

> **getCurrentStatus**(`params`): `Promise`\<[`AppPoolInfo`](../type-aliases/AppPoolInfo.md)\>

Makes a readonly (simulated) call to the BiatecPoolProvider smart contract using the `getCurrentStatus(uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns current status

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`\] \| \{ `appPoolId`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<[`AppPoolInfo`](../type-aliases/AppPoolInfo.md)\>

The call result: Pool info statistics

***

### getPrice()

> **getPrice**(`params`): `Promise`\<[`AppPoolInfo`](../type-aliases/AppPoolInfo.md)\>

Makes a readonly (simulated) call to the BiatecPoolProvider smart contract using the `getPrice(uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Retuns the full price info for the asset pair. If app pool is defined, then it returns the pool info.

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `assetA`: `number` \| `bigint`; `assetB`: `number` \| `bigint`; `appPoolId`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<[`AppPoolInfo`](../type-aliases/AppPoolInfo.md)\>

The call result: AppPoolInfo with the price info for the asset pair

***

### calculateAssetBWithdrawOnLpDeposit()

> **calculateAssetBWithdrawOnLpDeposit**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecPoolProvider smart contract using the `calculateAssetBWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B will be taken from the smart contract on LP asset deposit

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `inAmount`: `number` \| `bigint`; `assetBBalance`: `number` \| `bigint`; `liquidity`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

***

### newGroup()

> **newGroup**(): `BiatecPoolProviderComposer`

#### Returns

`BiatecPoolProviderComposer`
