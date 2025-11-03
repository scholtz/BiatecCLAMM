# Class: BiatecIdentityProviderClient

A client to make calls to the BiatecIdentityProvider smart contract

## Constructors

### Constructor

> **new BiatecIdentityProviderClient**(`appClient`): `BiatecIdentityProviderClient`

Creates a new instance of `BiatecIdentityProviderClient`

#### Parameters

##### appClient

`AppClient`

An `AppClient` instance which has been created with the BiatecIdentityProvider app spec

#### Returns

`BiatecIdentityProviderClient`

### Constructor

> **new BiatecIdentityProviderClient**(`params`): `BiatecIdentityProviderClient`

Creates a new instance of `BiatecIdentityProviderClient`

#### Parameters

##### params

`Omit`\<`AppClientParams`, `"appSpec"`\>

The parameters to initialise the app client with

#### Returns

`BiatecIdentityProviderClient`

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

Updates an existing instance of the BiatecIdentityProvider smart contract using the `updateApplication(uint64,byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecIdentityProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`AppCallParams`

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecIdentityProvider smart contract using the `bootstrap(uint64,address,address,address)void` ABI method.

Biatec deploys single identity provider smart contract

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### selfRegistration()

> **selfRegistration**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecIdentityProvider smart contract using the `selfRegistration(address,(uint64,bool,uint64,uint64,uint64,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,bool))void` ABI method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### setInfo()

> **setInfo**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecIdentityProvider smart contract using the `setInfo(address,(uint64,bool,uint64,uint64,uint64,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,bool))void` ABI method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecIdentityProvider smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### getUser()

> **getUser**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecIdentityProvider smart contract using the `getUser(address,uint8)(uint8,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,bool,uint64,uint64,bool)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns user information - fee multiplier, verification class, engagement class ..

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### getUserShort()

> **getUserShort**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecIdentityProvider smart contract using the `getUserShort(address,uint8)(uint8,uint64,uint64,uint64,bool)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns short user information - fee multiplier, verification class, engagement class ..

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<`AppCallMethodCall`\>

The call params

#### withdrawExcessAssets()

> **withdrawExcessAssets**: (`params`) => `Promise`\<`AppCallMethodCall`\>

Makes a call to the BiatecIdentityProvider smart contract using the `withdrawExcessAssets(uint64,uint64,uint64)uint64` ABI method.

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

Updates an existing instance of the BiatecIdentityProvider smart contract using the `updateApplication(uint64,byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecIdentityProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`Promise`\<`Transaction`\>

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `bootstrap(uint64,address,address,address)void` ABI method.

Biatec deploys single identity provider smart contract

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### selfRegistration()

> **selfRegistration**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `selfRegistration(address,(uint64,bool,uint64,uint64,uint64,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,bool))void` ABI method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### setInfo()

> **setInfo**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `setInfo(address,(uint64,bool,uint64,uint64,uint64,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,bool))void` ABI method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### getUser()

> **getUser**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `getUser(address,uint8)(uint8,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,bool,uint64,uint64,bool)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns user information - fee multiplier, verification class, engagement class ..

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### getUserShort()

> **getUserShort**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `getUserShort(address,uint8)(uint8,uint64,uint64,uint64,bool)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns short user information - fee multiplier, verification class, engagement class ..

##### Parameters

###### params

`object` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ \}\>

The call transaction

#### withdrawExcessAssets()

> **withdrawExcessAssets**: (`params`) => `Promise`\<\{ \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `withdrawExcessAssets(uint64,uint64,uint64)uint64` ABI method.

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

Updates an existing instance of the BiatecIdentityProvider smart contract using the `updateApplication(uint64,byte[])void` ABI method.

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

Makes a clear_state call to an existing instance of the BiatecIdentityProvider smart contract.

##### Parameters

###### params?

The params for the bare (raw) call

##### Returns

`Promise`\<\{ \}\>

The clearState result

#### bootstrap()

> **bootstrap**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `bootstrap(uint64,address,address,address)void` ABI method.

Biatec deploys single identity provider smart contract

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### selfRegistration()

> **selfRegistration**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `selfRegistration(address,(uint64,bool,uint64,uint64,uint64,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,bool))void` ABI method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### setInfo()

> **setInfo**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `setInfo(address,(uint64,bool,uint64,uint64,uint64,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,bool))void` ABI method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### sendOnlineKeyRegistration()

> **sendOnlineKeyRegistration**: (`params`) => `Promise`\<\{ `return`: `void` \| `undefined`; \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `sendOnlineKeyRegistration(uint64,byte[],byte[],byte[],uint64,uint64,uint64,uint64)void` ABI method.

addressExecutiveFee can perfom key registration for this LP pool

Only addressExecutiveFee is allowed to execute this method.

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: `void` \| `undefined`; \}\>

The call result

#### getUser()

> **getUser**: (`params`) => `Promise`\<\{ `return`: [`UserInfoV1`](../type-aliases/UserInfoV1.md) \| `undefined`; \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `getUser(address,uint8)(uint8,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,bool,uint64,uint64,bool)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns user information - fee multiplier, verification class, engagement class ..

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: [`UserInfoV1`](../type-aliases/UserInfoV1.md) \| `undefined`; \}\>

The call result

#### getUserShort()

> **getUserShort**: (`params`) => `Promise`\<\{ `return`: [`UserInfoShortV1`](../type-aliases/UserInfoShortV1.md) \| `undefined`; \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `getUserShort(address,uint8)(uint8,uint64,uint64,uint64,bool)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns short user information - fee multiplier, verification class, engagement class ..

##### Parameters

###### params

`object` & `SendParams` & `object`

The params for the smart contract call

##### Returns

`Promise`\<\{ `return`: [`UserInfoShortV1`](../type-aliases/UserInfoShortV1.md) \| `undefined`; \}\>

The call result

#### withdrawExcessAssets()

> **withdrawExcessAssets**: (`params`) => `Promise`\<\{ `return`: `bigint` \| `undefined`; \}\>

Makes a call to the BiatecIdentityProvider smart contract using the `withdrawExcessAssets(uint64,uint64,uint64)uint64` ABI method.

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

Methods to access state for the current BiatecIdentityProvider app

#### global

> **global**: `object`

Methods to access global state for the current BiatecIdentityProvider app

##### global.getAll()

> **getAll**: () => `Promise`\<`Partial`\<\{ `governor`: `string`; `verificationSetter`: `string`; `engagementSetter`: `string`; `appBiatecConfigProvider`: `bigint`; `version`: `BinaryState`; \}\>\>

Get all current keyed values from global state

###### Returns

`Promise`\<`Partial`\<\{ `governor`: `string`; `verificationSetter`: `string`; `engagementSetter`: `string`; `appBiatecConfigProvider`: `bigint`; `version`: `BinaryState`; \}\>\>

##### global.governor()

> **governor**: () => `Promise`\<`string` \| `undefined`\>

Get the current value of the governor key in global state

###### Returns

`Promise`\<`string` \| `undefined`\>

##### global.verificationSetter()

> **verificationSetter**: () => `Promise`\<`string` \| `undefined`\>

Get the current value of the verificationSetter key in global state

###### Returns

`Promise`\<`string` \| `undefined`\>

##### global.engagementSetter()

> **engagementSetter**: () => `Promise`\<`string` \| `undefined`\>

Get the current value of the engagementSetter key in global state

###### Returns

`Promise`\<`string` \| `undefined`\>

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

Methods to access box state for the current BiatecIdentityProvider app

##### box.getAll()

> **getAll**: () => `Promise`\<`Partial`\<\{ \}\>\>

Get all current keyed values from box state

###### Returns

`Promise`\<`Partial`\<\{ \}\>\>

##### box.identities

> **identities**: `object`

Get values from the identities map in box state

##### box.identities.getMap()

> **getMap**: () => `Promise`\<`Map`\<`string`, [`IdentityInfo`](../type-aliases/IdentityInfo.md)\>\>

Get all current values of the identities map in box state

###### Returns

`Promise`\<`Map`\<`string`, [`IdentityInfo`](../type-aliases/IdentityInfo.md)\>\>

##### box.identities.value()

> **value**: (`key`) => `Promise`\<[`IdentityInfo`](../type-aliases/IdentityInfo.md) \| `undefined`\>

Get a current value of the identities map by key from box state

###### Parameters

###### key

`string`

###### Returns

`Promise`\<[`IdentityInfo`](../type-aliases/IdentityInfo.md) \| `undefined`\>

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

`TSignature` *extends* `"withdrawExcessAssets"` \| `"getUser(address,uint8)(uint8,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,bool,uint64,uint64,bool)"` \| `"getUser"` \| `"getUserShort(address,uint8)(uint8,uint64,uint64,uint64,bool)"` \| `"getUserShort"` \| `"withdrawExcessAssets(uint64,uint64,uint64)uint64"`

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

> `static` **fromCreatorAndName**(`params`): `Promise`\<`BiatecIdentityProviderClient`\>

Returns a new `BiatecIdentityProviderClient` client, resolving the app by creator address and name
using AlgoKit app deployment semantics (i.e. looking for the app creation transaction note).

#### Parameters

##### params

`Omit`\<`ResolveAppClientByCreatorAndName`, `"appSpec"`\>

The parameters to create the app client

#### Returns

`Promise`\<`BiatecIdentityProviderClient`\>

***

### fromNetwork()

> `static` **fromNetwork**(`params`): `Promise`\<`BiatecIdentityProviderClient`\>

Returns an `BiatecIdentityProviderClient` instance for the current network based on
pre-determined network-specific app IDs specified in the ARC-56 app spec.

If no IDs are in the app spec or the network isn't recognised, an error is thrown.

#### Parameters

##### params

`Omit`\<`ResolveAppClientByNetwork`, `"appSpec"`\>

The parameters to create the app client

#### Returns

`Promise`\<`BiatecIdentityProviderClient`\>

***

### clone()

> **clone**(`params`): `BiatecIdentityProviderClient`

Clone this app client with different params

#### Parameters

##### params

The params to use for the the cloned app client. Omit a param to keep the original value. Set a param to override the original value. Setting to undefined will clear the original value.

#### Returns

`BiatecIdentityProviderClient`

A new app client with the altered params

***

### getUser()

> **getUser**(`params`): `Promise`\<[`UserInfoV1`](../type-aliases/UserInfoV1.md)\>

Makes a readonly (simulated) call to the BiatecIdentityProvider smart contract using the `getUser(address,uint8)(uint8,uint64,uint64,bool,string,string,uint64,uint64,uint64,uint64,uint64,uint64,uint64,uint64,bool,uint64,uint64,bool)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns user information - fee multiplier, verification class, engagement class ..

#### Parameters

##### params

The params for the smart contract call

###### args

\[`string`, `number` \| `bigint`\] \| \{ `user`: `string`; `v`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<[`UserInfoV1`](../type-aliases/UserInfoV1.md)\>

The call result

***

### getUserShort()

> **getUserShort**(`params`): `Promise`\<[`UserInfoShortV1`](../type-aliases/UserInfoShortV1.md)\>

Makes a readonly (simulated) call to the BiatecIdentityProvider smart contract using the `getUserShort(address,uint8)(uint8,uint64,uint64,uint64,bool)` ABI method.

This method is a readonly method; calling it with onComplete of NoOp will result in a simulated transaction rather than a real transaction.

Returns short user information - fee multiplier, verification class, engagement class ..

#### Parameters

##### params

The params for the smart contract call

###### args

\[`string`, `number` \| `bigint`\] \| \{ `user`: `string`; `v`: `number` \| `bigint`; \}

The args for the ABI method call, either as an ordered array or an object

#### Returns

`Promise`\<[`UserInfoShortV1`](../type-aliases/UserInfoShortV1.md)\>

The call result

***

### newGroup()

> **newGroup**(): `BiatecIdentityProviderComposer`

#### Returns

`BiatecIdentityProviderComposer`
