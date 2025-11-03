# Class: BiatecClammPoolClient

A client to make calls to the BiatecClammPool smart contract

## Constructors

### Constructor

> **new BiatecClammPoolClient**(`appClient`): `BiatecClammPoolClient`

Creates a new instance of `BiatecClammPoolClient`

#### Parameters

##### appClient

`AppClient`

An `AppClient` instance which has been created with the BiatecClammPool app spec

#### Returns

`BiatecClammPoolClient`

### Constructor

> **new BiatecClammPoolClient**(`params`): `BiatecClammPoolClient`

Creates a new instance of `BiatecClammPoolClient`

#### Parameters

##### params

`Omit`\<`AppClientParams`, `"appSpec"`\>

The parameters to initialise the app client with

#### Returns

`BiatecClammPoolClient`

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

Updates an existing instance of the BiatecClammPool smart contract using the `updateApplication(uint64,byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecClammPool smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`AppCallParams`

The clearState result

#### getCurrentPrice()

> **getCurrentPrice**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `getCurrentPrice()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### getPriceDivider()

> **getPriceDivider**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `getPriceDivider()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### getLpTokenId()

> **getLpTokenId**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `getLPTokenId()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `bootstrap(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

Only Biatec Pool Provider can deploy and bootsrap this smart contract

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: LP token ID

#### bootstrapStep2()

> **bootstrapStep2**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `bootstrapStep2()void` ABI method.

When we know the app id of this pool, we can register it properly at the pool provider

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### addLiquidity()

> **addLiquidity**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `addLiquidity(uint64,uint64,txn,txn,uint64,uint64,uint64)uint64` ABI method.

This method adds Asset A and Asset B to the Automated Market Maker Concentrated Liqudidity Pool and send to the liqudidty provider the liquidity token

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: LP Token quantity distributed

#### removeLiquidity()

> **removeLiquidity**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `removeLiquidity(uint64,uint64,axfer,uint64,uint64,uint64)uint256` ABI method.

This method retrieves from the liquidity provider LP token and returns Asset A and Asset B from the Automated Market Maker Concentrated Liqudidity Pool

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: LP position reduced

#### removeLiquidityAdmin()

> **removeLiquidityAdmin**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `removeLiquidityAdmin(uint64,uint64,uint64,uint64,uint256)uint256` ABI method.

This method allows biatec admin to reduce the lp position created by lp fees allocation.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: LP position reduced

#### swap()

> **swap**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `swap(uint64,uint64,uint64,txn,uint64,uint64,uint64)uint256` ABI method.

Swap Asset A to Asset B or Asset B to Asst A

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### distributeExcessAssets()

> **distributeExcessAssets**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `distributeExcessAssets(uint64,uint64,uint64,uint256,uint256)uint256` ABI method.

If someone deposits excess assets to the LP pool, addressExecutiveFee can either distribute them to the lp tokens or withdraw it, depending on the use case.
If someone sent there assets in fault, the withrawing can be use to return them back. If the pool received assets for example for having its algo stake online and recieved rewards it is prefered to distribute them to the current LP holders.

This method is used to distribute amount a and amount b of asset a and asset b to holders as the fee income.

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

Makes a call to the BiatecClammPool smart contract using the `withdrawExcessAssets(uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

If someone deposits excess assets to the LP pool, addressExecutiveFee can either distribute them to the lp tokens or withdraw it, depending on the use case.
If someone sent there assets in fault, the withrawing can be use to return them back. If the pool received assets for example for having its algo stake online and recieved rewards it is prefered to distribute them to the current LP holders.

This method is used to distribute amount a and amount b of asset a and asset b to addressExecutiveFee account.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### sendOfflineKeyRegistration()

> **sendOfflineKeyRegistration**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `sendOfflineKeyRegistration(uint64)void` ABI method.

addressExecutiveFee can perform key unregistration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### doAppCall()

> **doAppCall**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `doAppCall(uint64,(uint64,address,uint64,uint64,string),uint64[],uint64[],address[],byte[][])void` ABI method.

doAppCall can call any other smart contract. mainly created for the xgov calls.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### calculateDistributedLiquidity()

> **calculateDistributedLiquidity**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateDistributedLiquidity(uint64,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the number of LP tokens issued to users

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### calculateLiquidityFlatPrice()

> **calculateLiquidityFlatPrice**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityFlatPrice(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### calculateLiquidityD()

> **calculateLiquidityD**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityD(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the liquidity  from the x - Asset A position and y - Asset B position
This method calculates discriminant - first part of the calculation.
It is divided so that the readonly method does not need to charge fees

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.

#### calculateLiquidityWithD()

> **calculateLiquidityWithD**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityWithD(uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the liquidity  from the x - Asset A position and y - Asset B position

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.

#### calculatePrice()

> **calculatePrice**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculatePrice(uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Get the current price when asset a has x

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: the price with specified quantity with the price range set in the contract

#### calculateAssetBWithdrawOnAssetADeposit()

> **calculateAssetBWithdrawOnAssetADeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetBWithdrawOnAssetADeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B will be taken from the smart contract on asset A deposit

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetAWithdrawOnAssetBDeposit()

> **calculateAssetAWithdrawOnAssetBDeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetAWithdrawOnAssetBDeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A will be taken from the smart contract on asset B deposit

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetAWithdrawOnLpDeposit()

> **calculateAssetAWithdrawOnLpDeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetAWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A will be taken from the smart contract on LP asset deposit

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetBDepositOnAssetADeposit()

> **calculateAssetBDepositOnAssetADeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetBDepositOnAssetADeposit(uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B should be deposited when user deposit asset a and b.

On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetADepositOnAssetBDeposit()

> **calculateAssetADepositOnAssetBDeposit**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetADepositOnAssetBDeposit(uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A should be deposited when user deposit asset a and b

On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params: Amount of asset A to be deposited. The result is in Base decimals (9)

#### status()

> **status**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecClammPool smart contract using the `status(uint64,uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

***

### createTransaction

> `readonly` **createTransaction**: `object`

Create transactions for the current app

#### update

> **update**: `object`

Gets available update methods

##### update.updateApplication()

> **updateApplication**: (`params`) => `Promise`\<\{ \}\>

Updates an existing instance of the BiatecClammPool smart contract using the `updateApplication(uint64,byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecClammPool smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`Promise`\<`Transaction`\>

The clearState result

#### getCurrentPrice()

> **getCurrentPrice**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `getCurrentPrice()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### getPriceDivider()

> **getPriceDivider**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `getPriceDivider()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### getLpTokenId()

> **getLpTokenId**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `getLPTokenId()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `bootstrap(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

Only Biatec Pool Provider can deploy and bootsrap this smart contract

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: LP token ID

#### bootstrapStep2()

> **bootstrapStep2**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `bootstrapStep2()void` ABI method.

When we know the app id of this pool, we can register it properly at the pool provider

##### Parameters

###### params

`object` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### addLiquidity()

> **addLiquidity**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `addLiquidity(uint64,uint64,txn,txn,uint64,uint64,uint64)uint64` ABI method.

This method adds Asset A and Asset B to the Automated Market Maker Concentrated Liqudidity Pool and send to the liqudidty provider the liquidity token

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: LP Token quantity distributed

#### removeLiquidity()

> **removeLiquidity**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `removeLiquidity(uint64,uint64,axfer,uint64,uint64,uint64)uint256` ABI method.

This method retrieves from the liquidity provider LP token and returns Asset A and Asset B from the Automated Market Maker Concentrated Liqudidity Pool

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: LP position reduced

#### removeLiquidityAdmin()

> **removeLiquidityAdmin**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `removeLiquidityAdmin(uint64,uint64,uint64,uint64,uint256)uint256` ABI method.

This method allows biatec admin to reduce the lp position created by lp fees allocation.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: LP position reduced

#### swap()

> **swap**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `swap(uint64,uint64,uint64,txn,uint64,uint64,uint64)uint256` ABI method.

Swap Asset A to Asset B or Asset B to Asst A

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### distributeExcessAssets()

> **distributeExcessAssets**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `distributeExcessAssets(uint64,uint64,uint64,uint256,uint256)uint256` ABI method.

If someone deposits excess assets to the LP pool, addressExecutiveFee can either distribute them to the lp tokens or withdraw it, depending on the use case.
If someone sent there assets in fault, the withrawing can be use to return them back. If the pool received assets for example for having its algo stake online and recieved rewards it is prefered to distribute them to the current LP holders.

This method is used to distribute amount a and amount b of asset a and asset b to holders as the fee income.

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

Makes a call to the BiatecClammPool smart contract using the `withdrawExcessAssets(uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

If someone deposits excess assets to the LP pool, addressExecutiveFee can either distribute them to the lp tokens or withdraw it, depending on the use case.
If someone sent there assets in fault, the withrawing can be use to return them back. If the pool received assets for example for having its algo stake online and recieved rewards it is prefered to distribute them to the current LP holders.

This method is used to distribute amount a and amount b of asset a and asset b to addressExecutiveFee account.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### sendOfflineKeyRegistration()

> **sendOfflineKeyRegistration**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `sendOfflineKeyRegistration(uint64)void` ABI method.

addressExecutiveFee can perform key unregistration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### doAppCall()

> **doAppCall**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `doAppCall(uint64,(uint64,address,uint64,uint64,string),uint64[],uint64[],address[],byte[][])void` ABI method.

doAppCall can call any other smart contract. mainly created for the xgov calls.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### calculateDistributedLiquidity()

> **calculateDistributedLiquidity**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateDistributedLiquidity(uint64,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the number of LP tokens issued to users

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### calculateLiquidityFlatPrice()

> **calculateLiquidityFlatPrice**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityFlatPrice(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### calculateLiquidityD()

> **calculateLiquidityD**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityD(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the liquidity  from the x - Asset A position and y - Asset B position
This method calculates discriminant - first part of the calculation.
It is divided so that the readonly method does not need to charge fees

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.

#### calculateLiquidityWithD()

> **calculateLiquidityWithD**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityWithD(uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the liquidity  from the x - Asset A position and y - Asset B position

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.

#### calculatePrice()

> **calculatePrice**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculatePrice(uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Get the current price when asset a has x

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: the price with specified quantity with the price range set in the contract

#### calculateAssetBWithdrawOnAssetADeposit()

> **calculateAssetBWithdrawOnAssetADeposit**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetBWithdrawOnAssetADeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B will be taken from the smart contract on asset A deposit

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetAWithdrawOnAssetBDeposit()

> **calculateAssetAWithdrawOnAssetBDeposit**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetAWithdrawOnAssetBDeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A will be taken from the smart contract on asset B deposit

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetAWithdrawOnLpDeposit()

> **calculateAssetAWithdrawOnLpDeposit**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetAWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A will be taken from the smart contract on LP asset deposit

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetBDepositOnAssetADeposit()

> **calculateAssetBDepositOnAssetADeposit**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetBDepositOnAssetADeposit(uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B should be deposited when user deposit asset a and b.

On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetADepositOnAssetBDeposit()

> **calculateAssetADepositOnAssetBDeposit**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetADepositOnAssetBDeposit(uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A should be deposited when user deposit asset a and b

On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction: Amount of asset A to be deposited. The result is in Base decimals (9)

#### status()

> **status**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecClammPool smart contract using the `status(uint64,uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

***

### send

> `readonly` **send**: `object`

Send calls to the current app

#### update

> **update**: `object`

Gets available update methods

##### update.updateApplication()

> **updateApplication**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Updates an existing instance of the BiatecClammPool smart contract using the `updateApplication(uint64,byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecClammPool smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`Promise`\<\{ \}\>

The clearState result

#### getCurrentPrice()

> **getCurrentPrice**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `getCurrentPrice()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `SendParams` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### getPriceDivider()

> **getPriceDivider**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `getPriceDivider()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `SendParams` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### getLpTokenId()

> **getLpTokenId**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `getLPTokenId()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `SendParams` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `bootstrap(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

Only Biatec Pool Provider can deploy and bootsrap this smart contract

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: LP token ID

#### bootstrapStep2()

> **bootstrapStep2**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `bootstrapStep2()void` ABI method.

When we know the app id of this pool, we can register it properly at the pool provider

##### Parameters

###### params

`object` & `SendParams` & `object` = `...`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### addLiquidity()

> **addLiquidity**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `addLiquidity(uint64,uint64,txn,txn,uint64,uint64,uint64)uint64` ABI method.

This method adds Asset A and Asset B to the Automated Market Maker Concentrated Liqudidity Pool and send to the liqudidty provider the liquidity token

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: LP Token quantity distributed

#### removeLiquidity()

> **removeLiquidity**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `removeLiquidity(uint64,uint64,axfer,uint64,uint64,uint64)uint256` ABI method.

This method retrieves from the liquidity provider LP token and returns Asset A and Asset B from the Automated Market Maker Concentrated Liqudidity Pool

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: LP position reduced

#### removeLiquidityAdmin()

> **removeLiquidityAdmin**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `removeLiquidityAdmin(uint64,uint64,uint64,uint64,uint256)uint256` ABI method.

This method allows biatec admin to reduce the lp position created by lp fees allocation.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: LP position reduced

#### swap()

> **swap**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `swap(uint64,uint64,uint64,txn,uint64,uint64,uint64)uint256` ABI method.

Swap Asset A to Asset B or Asset B to Asst A

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### distributeExcessAssets()

> **distributeExcessAssets**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `distributeExcessAssets(uint64,uint64,uint64,uint256,uint256)uint256` ABI method.

If someone deposits excess assets to the LP pool, addressExecutiveFee can either distribute them to the lp tokens or withdraw it, depending on the use case.
If someone sent there assets in fault, the withrawing can be use to return them back. If the pool received assets for example for having its algo stake online and recieved rewards it is prefered to distribute them to the current LP holders.

This method is used to distribute amount a and amount b of asset a and asset b to holders as the fee income.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### withdrawExcessAssets()

> **withdrawExcessAssets**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `withdrawExcessAssets(uint64,uint64,uint64,uint64,uint64)uint64` ABI method.

If someone deposits excess assets to the LP pool, addressExecutiveFee can either distribute them to the lp tokens or withdraw it, depending on the use case.
If someone sent there assets in fault, the withrawing can be use to return them back. If the pool received assets for example for having its algo stake online and recieved rewards it is prefered to distribute them to the current LP holders.

This method is used to distribute amount a and amount b of asset a and asset b to addressExecutiveFee account.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### sendOfflineKeyRegistration()

> **sendOfflineKeyRegistration**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `sendOfflineKeyRegistration(uint64)void` ABI method.

addressExecutiveFee can perform key unregistration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### doAppCall()

> **doAppCall**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `doAppCall(uint64,(uint64,address,uint64,uint64,string),uint64[],uint64[],address[],byte[][])void` ABI method.

doAppCall can call any other smart contract. mainly created for the xgov calls.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### calculateDistributedLiquidity()

> **calculateDistributedLiquidity**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateDistributedLiquidity(uint64,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the number of LP tokens issued to users

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### calculateLiquidityFlatPrice()

> **calculateLiquidityFlatPrice**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityFlatPrice(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

#### calculateLiquidityD()

> **calculateLiquidityD**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityD(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the liquidity  from the x - Asset A position and y - Asset B position
This method calculates discriminant - first part of the calculation.
It is divided so that the readonly method does not need to charge fees

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.

#### calculateLiquidityWithD()

> **calculateLiquidityWithD**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateLiquidityWithD(uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the liquidity  from the x - Asset A position and y - Asset B position

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.

#### calculatePrice()

> **calculatePrice**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculatePrice(uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Get the current price when asset a has x

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: the price with specified quantity with the price range set in the contract

#### calculateAssetBWithdrawOnAssetADeposit()

> **calculateAssetBWithdrawOnAssetADeposit**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetBWithdrawOnAssetADeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B will be taken from the smart contract on asset A deposit

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetAWithdrawOnAssetBDeposit()

> **calculateAssetAWithdrawOnAssetBDeposit**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetAWithdrawOnAssetBDeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A will be taken from the smart contract on asset B deposit

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetAWithdrawOnLpDeposit()

> **calculateAssetAWithdrawOnLpDeposit**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetAWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A will be taken from the smart contract on LP asset deposit

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetBDepositOnAssetADeposit()

> **calculateAssetBDepositOnAssetADeposit**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetBDepositOnAssetADeposit(uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B should be deposited when user deposit asset a and b.

On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

#### calculateAssetADepositOnAssetBDeposit()

> **calculateAssetADepositOnAssetBDeposit**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `calculateAssetADepositOnAssetBDeposit(uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A should be deposited when user deposit asset a and b

On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result: Amount of asset A to be deposited. The result is in Base decimals (9)

#### status()

> **status**: (`params`) => `Promise`\<\{ `return`: [`AmmStatus`](../type-aliases/AmmStatus.md) \| `undefined`; \}\>

Makes a call to the BiatecClammPool smart contract using the `status(uint64,uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: [`AmmStatus`](../type-aliases/AmmStatus.md) \| `undefined`; \}\>

The call result

***

### state

> **state**: `object`

Methods to access state for the current BiatecClammPool app

#### global

> **global**: `object`

Methods to access global state for the current BiatecClammPool app

##### global.getAll()

> **getAll**: () => `Promise`\<`Partial`\<\{ `setupFinished`: `boolean`; `assetA`: `bigint`; `assetADecimalsScaleFromBase`: `bigint`; `assetB`: `bigint`; `assetBDecimalsScaleFromBase`: `bigint`; `assetLp`: `bigint`; `assetABalanceBaseScale`: `bigint`; `assetBBalanceBaseScale`: `bigint`; `priceMin`: `bigint`; `priceMax`: `bigint`; `priceMinSqrt`: `bigint`; `priceMaxSqrt`: `bigint`; `liquidity`: `bigint`; `liquidityUsersFromFees`: `bigint`; `liquidityBiatecFromFees`: `bigint`; `fee`: `bigint`; `currentPrice`: `bigint`; `scale`: `bigint`; `appBiatecConfigProvider`: `bigint`; `verificationClass`: `bigint`; `version`: `BinaryState`; \}\>\>

Get all current keyed values from global state

###### Returns

`Promise`\<`Partial`\<\{ `setupFinished`: `boolean`; `assetA`: `bigint`; `assetADecimalsScaleFromBase`: `bigint`; `assetB`: `bigint`; `assetBDecimalsScaleFromBase`: `bigint`; `assetLp`: `bigint`; `assetABalanceBaseScale`: `bigint`; `assetBBalanceBaseScale`: `bigint`; `priceMin`: `bigint`; `priceMax`: `bigint`; `priceMinSqrt`: `bigint`; `priceMaxSqrt`: `bigint`; `liquidity`: `bigint`; `liquidityUsersFromFees`: `bigint`; `liquidityBiatecFromFees`: `bigint`; `fee`: `bigint`; `currentPrice`: `bigint`; `scale`: `bigint`; `appBiatecConfigProvider`: `bigint`; `verificationClass`: `bigint`; `version`: `BinaryState`; \}\>\>

##### global.setupFinished()

> **setupFinished**: () => `Promise`\<`boolean` \| `undefined`\>

Get the current value of the setupFinished key in global state

###### Returns

`Promise`\<`boolean` \| `undefined`\>

##### global.assetA()

> **assetA**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the assetA key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.assetADecimalsScaleFromBase()

> **assetADecimalsScaleFromBase**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the assetADecimalsScaleFromBase key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.assetB()

> **assetB**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the assetB key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.assetBDecimalsScaleFromBase()

> **assetBDecimalsScaleFromBase**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the assetBDecimalsScaleFromBase key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.assetLp()

> **assetLp**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the assetLp key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.assetABalanceBaseScale()

> **assetABalanceBaseScale**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the assetABalanceBaseScale key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.assetBBalanceBaseScale()

> **assetBBalanceBaseScale**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the assetBBalanceBaseScale key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.priceMin()

> **priceMin**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the priceMin key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.priceMax()

> **priceMax**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the priceMax key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.priceMinSqrt()

> **priceMinSqrt**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the priceMinSqrt key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.priceMaxSqrt()

> **priceMaxSqrt**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the priceMaxSqrt key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.liquidity()

> **liquidity**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the Liquidity key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.liquidityUsersFromFees()

> **liquidityUsersFromFees**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the LiquidityUsersFromFees key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.liquidityBiatecFromFees()

> **liquidityBiatecFromFees**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the LiquidityBiatecFromFees key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.fee()

> **fee**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the fee key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.currentPrice()

> **currentPrice**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the currentPrice key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.scale()

> **scale**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the scale key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.appBiatecConfigProvider()

> **appBiatecConfigProvider**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the appBiatecConfigProvider key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.verificationClass()

> **verificationClass**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the verificationClass key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.version()

> **version**: () => `Promise`\<`BinaryState`\>

Get the current value of the version key in global state

###### Returns

`Promise`\<`BinaryState`\>

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

`TSignature` *extends* `"getCurrentPrice()uint64"` \| `"getCurrentPrice"` \| `"getPriceDivider()uint64"` \| `"getPriceDivider"` \| `"getLPTokenId()uint64"` \| `"getLPTokenId"` \| `"bootstrap(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64"` \| `"bootstrap"` \| `"addLiquidity(uint64,uint64,txn,txn,uint64,uint64,uint64)uint64"` \| `"addLiquidity"` \| `"removeLiquidity(uint64,uint64,axfer,uint64,uint64,uint64)uint256"` \| `"removeLiquidity"` \| `"removeLiquidityAdmin(uint64,uint64,uint64,uint64,uint256)uint256"` \| `"removeLiquidityAdmin"` \| `"swap(uint64,uint64,uint64,txn,uint64,uint64,uint64)uint256"` \| `"swap"` \| `"distributeExcessAssets(uint64,uint64,uint64,uint256,uint256)uint256"` \| `"distributeExcessAssets"` \| `"withdrawExcessAssets(uint64,uint64,uint64,uint64,uint64)uint64"` \| `"withdrawExcessAssets"` \| `"calculateDistributedLiquidity(uint64,uint256)uint256"` \| `"calculateDistributedLiquidity"` \| `"calculateLiquidityFlatPrice(uint256,uint256,uint256)uint256"` \| `"calculateLiquidityFlatPrice"` \| `"calculateLiquidityD(uint256,uint256,uint256,uint256,uint256,uint256)uint256"` \| `"calculateLiquidityD"` \| `"calculateLiquidityWithD(uint256,uint256,uint256,uint256,uint256)uint256"` \| `"calculateLiquidityWithD"` \| `"calculatePrice(uint256,uint256,uint256,uint256,uint256)uint256"` \| `"calculatePrice"` \| `"calculateAssetBWithdrawOnAssetADeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256"` \| `"calculateAssetBWithdrawOnAssetADeposit"` \| `"calculateAssetAWithdrawOnAssetBDeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256"` \| `"calculateAssetAWithdrawOnAssetBDeposit"` \| `"calculateAssetAWithdrawOnLpDeposit(uint256,uint256,uint256)uint256"` \| `"calculateAssetAWithdrawOnLpDeposit"` \| `"calculateAssetBDepositOnAssetADeposit(uint256,uint256,uint256,uint256)uint256"` \| `"calculateAssetBDepositOnAssetADeposit"` \| `"calculateAssetADepositOnAssetBDeposit(uint256,uint256,uint256,uint256)uint256"` \| `"calculateAssetADepositOnAssetBDeposit"` \| `"status(uint64,uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)"` \| `"status"`

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

> `static` **fromCreatorAndName**(`params`): `Promise`\<`BiatecClammPoolClient`\>

Returns a new `BiatecClammPoolClient` client, resolving the app by creator address and name
using AlgoKit app deployment semantics (i.e. looking for the app creation transaction note).

#### Parameters

##### params

`Omit`\<`ResolveAppClientByCreatorAndName`, `"appSpec"`\>

The parameters to create the app client

#### Returns

`Promise`\<`BiatecClammPoolClient`\>

***

### fromNetwork()

> `static` **fromNetwork**(`params`): `Promise`\<`BiatecClammPoolClient`\>

Returns an `BiatecClammPoolClient` instance for the current network based on
pre-determined network-specific app IDs specified in the ARC-56 app spec.

If no IDs are in the app spec or the network isn't recognised, an error is thrown.

#### Parameters

##### params

`Omit`\<`ResolveAppClientByNetwork`, `"appSpec"`\>

The parameters to create the app client

#### Returns

`Promise`\<`BiatecClammPoolClient`\>

***

### clone()

> **clone**(`params`): `BiatecClammPoolClient`

Clone this app client with different params

#### Parameters

##### params

The params to use for the the cloned app client. Omit a param to keep the original value. Set a param to override the original value. Setting to undefined will clear the original value.

#### Returns

`BiatecClammPoolClient`

A new app client with the altered params

***

### getCurrentPrice()

> **getCurrentPrice**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `getCurrentPrice()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

#### Parameters

##### params

The params for the smart contract call

###### args

\[\] \| \{\[`key`: `string`\]: `never`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result

***

### getPriceDivider()

> **getPriceDivider**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `getPriceDivider()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

#### Parameters

##### params

The params for the smart contract call

###### args

\[\] \| \{\[`key`: `string`\]: `never`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result

***

### getLpTokenId()

> **getLpTokenId**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `getLPTokenId()uint64` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

#### Parameters

##### params

The params for the smart contract call

###### args

\[\] \| \{\[`key`: `string`\]: `never`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result

***

### calculateDistributedLiquidity()

> **calculateDistributedLiquidity**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateDistributedLiquidity(uint64,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the number of LP tokens issued to users

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`\] \| \{ `assetLp`: `number` \| `bigint`; `currentDeposit`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result

***

### calculateLiquidityFlatPrice()

> **calculateLiquidityFlatPrice**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateLiquidityFlatPrice(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `x`: `number` \| `bigint`; `y`: `number` \| `bigint`; `price`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result

***

### calculateLiquidityD()

> **calculateLiquidityD**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateLiquidityD(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the liquidity  from the x - Asset A position and y - Asset B position
This method calculates discriminant - first part of the calculation.
It is divided so that the readonly method does not need to charge fees

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `x`: `number` \| `bigint`; `y`: `number` \| `bigint`; `priceMin`: `number` \| `bigint`; `priceMax`: `number` \| `bigint`; `priceMinSqrt`: `number` \| `bigint`; `priceMaxSqrt`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.

***

### calculateLiquidityWithD()

> **calculateLiquidityWithD**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateLiquidityWithD(uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates the liquidity  from the x - Asset A position and y - Asset B position

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `x`: `number` \| `bigint`; `y`: `number` \| `bigint`; `priceMinSqrt`: `number` \| `bigint`; `priceMaxSqrt`: `number` \| `bigint`; `dSqrt`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.

***

### calculatePrice()

> **calculatePrice**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculatePrice(uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Get the current price when asset a has x

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `assetAQuantity`: `number` \| `bigint`; `assetBQuantity`: `number` \| `bigint`; `priceMinSqrt`: `number` \| `bigint`; `priceMaxSqrt`: `number` \| `bigint`; `liquidity`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: the price with specified quantity with the price range set in the contract

***

### calculateAssetBWithdrawOnAssetADeposit()

> **calculateAssetBWithdrawOnAssetADeposit**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateAssetBWithdrawOnAssetADeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B will be taken from the smart contract on asset A deposit

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `inAmount`: `number` \| `bigint`; `assetABalance`: `number` \| `bigint`; `assetBBalance`: `number` \| `bigint`; `priceMinSqrt`: `number` \| `bigint`; `priceMaxSqrt`: `number` \| `bigint`; `liquidity`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

***

### calculateAssetAWithdrawOnAssetBDeposit()

> **calculateAssetAWithdrawOnAssetBDeposit**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateAssetAWithdrawOnAssetBDeposit(uint256,uint256,uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A will be taken from the smart contract on asset B deposit

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `inAmount`: `number` \| `bigint`; `assetABalance`: `number` \| `bigint`; `assetBBalance`: `number` \| `bigint`; `priceMinSqrt`: `number` \| `bigint`; `priceMaxSqrt`: `number` \| `bigint`; `liquidity`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)

***

### calculateAssetAWithdrawOnLpDeposit()

> **calculateAssetAWithdrawOnLpDeposit**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateAssetAWithdrawOnLpDeposit(uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A will be taken from the smart contract on LP asset deposit

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `inAmount`: `number` \| `bigint`; `assetABalance`: `number` \| `bigint`; `liquidity`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)

***

### calculateAssetBDepositOnAssetADeposit()

> **calculateAssetBDepositOnAssetADeposit**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateAssetBDepositOnAssetADeposit(uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset B should be deposited when user deposit asset a and b.

On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `inAmountA`: `number` \| `bigint`; `inAmountB`: `number` \| `bigint`; `assetABalance`: `number` \| `bigint`; `assetBBalance`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)

***

### calculateAssetADepositOnAssetBDeposit()

> **calculateAssetADepositOnAssetBDeposit**(`params`): `Promise`\<`bigint`\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `calculateAssetADepositOnAssetBDeposit(uint256,uint256,uint256,uint256)uint256` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Calculates how much asset A should be deposited when user deposit asset a and b

On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `inAmountA`: `number` \| `bigint`; `inAmountB`: `number` \| `bigint`; `assetABalance`: `number` \| `bigint`; `assetBBalance`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<`bigint`\>

The call result: Amount of asset A to be deposited. The result is in Base decimals (9)

***

### status()

> **status**(`params`): `Promise`\<[`AmmStatus`](../type-aliases/AmmStatus.md)\>

Makes a readonly (simulated) call to the BiatecClammPool smart contract using the `status(uint64,uint64,uint64,uint64)(uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

#### Parameters

##### params

The params for the smart contract call

###### args

\[`number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`, `number` \| `bigint`\] \| \{ `appBiatecConfigProvider`: `number` \| `bigint`; `assetA`: `number` \| `bigint`; `assetB`: `number` \| `bigint`; `assetLp`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<[`AmmStatus`](../type-aliases/AmmStatus.md)\>

The call result

***

### newGroup()

> **newGroup**(): `BiatecClammPoolComposer`

#### Returns

`BiatecClammPoolComposer`
