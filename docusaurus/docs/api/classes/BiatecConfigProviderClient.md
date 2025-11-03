# Class: BiatecConfigProviderClient

A client to make calls to the BiatecConfigProvider smart contract

## Constructors

### Constructor

> **new BiatecConfigProviderClient**(`appClient`): `BiatecConfigProviderClient`

Creates a new instance of `BiatecConfigProviderClient`

#### Parameters

##### appClient

`AppClient`

An `AppClient` instance which has been created with the BiatecConfigProvider app spec

#### Returns

`BiatecConfigProviderClient`

### Constructor

> **new BiatecConfigProviderClient**(`params`): `BiatecConfigProviderClient`

Creates a new instance of `BiatecConfigProviderClient`

#### Parameters

##### params

`Omit`\<`AppClientParams`, `"appSpec"`\>

The parameters to initialise the app client with

#### Returns

`BiatecConfigProviderClient`

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

Updates an existing instance of the BiatecConfigProvider smart contract using the `updateApplication(byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecConfigProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`AppCallParams`

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `bootstrap(uint256,uint64,uint64)void` ABI method.

Setup the contract

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setAddressUdpater()

> **setAddressUdpater**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressUdpater(address)void` ABI method.

Top secret account with which it is possible update contracts or identity provider

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setPaused()

> **setPaused**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `setPaused(uint64)void` ABI method.

Kill switch. In the extreme case all services (deposit, trading, withdrawal, identity modifications and more) can be suspended.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setAddressGov()

> **setAddressGov**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressGov(address)void` ABI method.

Execution address with which it is possible to opt in for governance

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setAddressExecutive()

> **setAddressExecutive**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressExecutive(address)void` ABI method.

Execution address with which it is possible to change global biatec fees

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setAddressExecutiveFee()

> **setAddressExecutiveFee**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressExecutiveFee(address)void` ABI method.

Execution fee address is address which can take fees from pools.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setBiatecIdentity()

> **setBiatecIdentity**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecIdentity(uint64)void` ABI method.

App identity setter

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setBiatecPool()

> **setBiatecPool**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecPool(uint64)void` ABI method.

App identity setter

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setBiatecFee()

> **setBiatecFee**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecFee(uint256)void` ABI method.

Fees in 9 decimals. 1_000_000_000 = 100%
Fees in 9 decimals. 10_000_000 = 1%
Fees in 9 decimals. 100_000 = 0,01%

Fees are respectful from the all fees taken to the LP providers. If LPs charge 1% fee, and biatec charges 10% fee, LP will receive 0.09% fee and biatec 0.01% fee

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecConfigProvider smart contract using the `sendOnlineKeyRegistration(byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

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

Makes a call to the BiatecConfigProvider smart contract using the `withdrawExcessAssets(uint64,uint64)uint64` ABI method.

If someone deposits excess assets to this smart contract biatec can use them.

Only addressExecutiveFee is allowed to execute this method.

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

Updates an existing instance of the BiatecConfigProvider smart contract using the `updateApplication(byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecConfigProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`Promise`\<`Transaction`\>

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `bootstrap(uint256,uint64,uint64)void` ABI method.

Setup the contract

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setAddressUdpater()

> **setAddressUdpater**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressUdpater(address)void` ABI method.

Top secret account with which it is possible update contracts or identity provider

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setPaused()

> **setPaused**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setPaused(uint64)void` ABI method.

Kill switch. In the extreme case all services (deposit, trading, withdrawal, identity modifications and more) can be suspended.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setAddressGov()

> **setAddressGov**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressGov(address)void` ABI method.

Execution address with which it is possible to opt in for governance

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setAddressExecutive()

> **setAddressExecutive**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressExecutive(address)void` ABI method.

Execution address with which it is possible to change global biatec fees

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setAddressExecutiveFee()

> **setAddressExecutiveFee**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressExecutiveFee(address)void` ABI method.

Execution fee address is address which can take fees from pools.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setBiatecIdentity()

> **setBiatecIdentity**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecIdentity(uint64)void` ABI method.

App identity setter

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setBiatecPool()

> **setBiatecPool**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecPool(uint64)void` ABI method.

App identity setter

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setBiatecFee()

> **setBiatecFee**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecFee(uint256)void` ABI method.

Fees in 9 decimals. 1_000_000_000 = 100%
Fees in 9 decimals. 10_000_000 = 1%
Fees in 9 decimals. 100_000 = 0,01%

Fees are respectful from the all fees taken to the LP providers. If LPs charge 1% fee, and biatec charges 10% fee, LP will receive 0.09% fee and biatec 0.01% fee

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecConfigProvider smart contract using the `sendOnlineKeyRegistration(byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

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

Makes a call to the BiatecConfigProvider smart contract using the `withdrawExcessAssets(uint64,uint64)uint64` ABI method.

If someone deposits excess assets to this smart contract biatec can use them.

Only addressExecutiveFee is allowed to execute this method.

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

Updates an existing instance of the BiatecConfigProvider smart contract using the `updateApplication(byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecConfigProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`Promise`\<\{ \}\>

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `bootstrap(uint256,uint64,uint64)void` ABI method.

Setup the contract

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setAddressUdpater()

> **setAddressUdpater**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressUdpater(address)void` ABI method.

Top secret account with which it is possible update contracts or identity provider

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setPaused()

> **setPaused**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setPaused(uint64)void` ABI method.

Kill switch. In the extreme case all services (deposit, trading, withdrawal, identity modifications and more) can be suspended.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setAddressGov()

> **setAddressGov**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressGov(address)void` ABI method.

Execution address with which it is possible to opt in for governance

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setAddressExecutive()

> **setAddressExecutive**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressExecutive(address)void` ABI method.

Execution address with which it is possible to change global biatec fees

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setAddressExecutiveFee()

> **setAddressExecutiveFee**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setAddressExecutiveFee(address)void` ABI method.

Execution fee address is address which can take fees from pools.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setBiatecIdentity()

> **setBiatecIdentity**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecIdentity(uint64)void` ABI method.

App identity setter

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setBiatecPool()

> **setBiatecPool**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecPool(uint64)void` ABI method.

App identity setter

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setBiatecFee()

> **setBiatecFee**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `setBiatecFee(uint256)void` ABI method.

Fees in 9 decimals. 1_000_000_000 = 100%
Fees in 9 decimals. 10_000_000 = 1%
Fees in 9 decimals. 100_000 = 0,01%

Fees are respectful from the all fees taken to the LP providers. If LPs charge 1% fee, and biatec charges 10% fee, LP will receive 0.09% fee and biatec 0.01% fee

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecConfigProvider smart contract using the `sendOnlineKeyRegistration(byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

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

Makes a call to the BiatecConfigProvider smart contract using the `withdrawExcessAssets(uint64,uint64)uint64` ABI method.

If someone deposits excess assets to this smart contract biatec can use them.

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

The call result

***

### state

> **state**: `object`

Methods to access state for the current BiatecConfigProvider app

#### global

> **global**: `object`

Methods to access global state for the current BiatecConfigProvider app

##### global.getAll()

> **getAll**: () => `Promise`\<`Partial`\<\{ `addressUdpater`: `string`; `addressGov`: `string`; `addressExecutive`: `string`; `addressExecutiveFee`: `string`; `appBiatecIdentityProvider`: `bigint`; `appBiatecPoolProvider`: `bigint`; `suspended`: `bigint`; `biatecFee`: `bigint`; `version`: `BinaryState`; \}\>\>

Get all current keyed values from global state

###### Returns

`Promise`\<`Partial`\<\{ `addressUdpater`: `string`; `addressGov`: `string`; `addressExecutive`: `string`; `addressExecutiveFee`: `string`; `appBiatecIdentityProvider`: `bigint`; `appBiatecPoolProvider`: `bigint`; `suspended`: `bigint`; `biatecFee`: `bigint`; `version`: `BinaryState`; \}\>\>

##### global.addressUdpater()

> **addressUdpater**: () => `Promise`\<`string` \| `undefined`\>

Get the current value of the addressUdpater key in global state

###### Returns

`Promise`\<`string` \| `undefined`\>

##### global.addressGov()

> **addressGov**: () => `Promise`\<`string` \| `undefined`\>

Get the current value of the addressGov key in global state

###### Returns

`Promise`\<`string` \| `undefined`\>

##### global.addressExecutive()

> **addressExecutive**: () => `Promise`\<`string` \| `undefined`\>

Get the current value of the addressExecutive key in global state

###### Returns

`Promise`\<`string` \| `undefined`\>

##### global.addressExecutiveFee()

> **addressExecutiveFee**: () => `Promise`\<`string` \| `undefined`\>

Get the current value of the addressExecutiveFee key in global state

###### Returns

`Promise`\<`string` \| `undefined`\>

##### global.appBiatecIdentityProvider()

> **appBiatecIdentityProvider**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the appBiatecIdentityProvider key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.appBiatecPoolProvider()

> **appBiatecPoolProvider**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the appBiatecPoolProvider key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.suspended()

> **suspended**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the suspended key in global state

###### Returns

`Promise`\<`bigint` \| `undefined`\>

##### global.biatecFee()

> **biatecFee**: () => `Promise`\<`bigint` \| `undefined`\>

Get the current value of the biatecFee key in global state

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

`TSignature` *extends* `"withdrawExcessAssets"` \| `"withdrawExcessAssets(uint64,uint64)uint64"`

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

> `static` **fromCreatorAndName**(`params`): `Promise`\<`BiatecConfigProviderClient`\>

Returns a new `BiatecConfigProviderClient` client, resolving the app by creator address and name
using AlgoKit app deployment semantics (i.e. looking for the app creation transaction note).

#### Parameters

##### params

`Omit`\<`ResolveAppClientByCreatorAndName`, `"appSpec"`\>

The parameters to create the app client

#### Returns

`Promise`\<`BiatecConfigProviderClient`\>

***

### fromNetwork()

> `static` **fromNetwork**(`params`): `Promise`\<`BiatecConfigProviderClient`\>

Returns an `BiatecConfigProviderClient` instance for the current network based on
pre-determined network-specific app IDs specified in the ARC-56 app spec.

If no IDs are in the app spec or the network isn't recognised, an error is thrown.

#### Parameters

##### params

`Omit`\<`ResolveAppClientByNetwork`, `"appSpec"`\>

The parameters to create the app client

#### Returns

`Promise`\<`BiatecConfigProviderClient`\>

***

### clone()

> **clone**(`params`): `BiatecConfigProviderClient`

Clone this app client with different params

#### Parameters

##### params

The params to use for the the cloned app client. Omit a param to keep the original value. Set a param to override the original value. Setting to undefined will clear the original value.

#### Returns

`BiatecConfigProviderClient`

A new app client with the altered params

***

### newGroup()

> **newGroup**(): `BiatecConfigProviderComposer`

#### Returns

`BiatecConfigProviderComposer`
