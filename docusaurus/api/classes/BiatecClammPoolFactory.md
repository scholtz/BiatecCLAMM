# Class: BiatecClammPoolFactory

A factory to create and deploy one or more instance of the BiatecClammPool smart contract and to create one or more app clients to interact with those (or other) app instances

## Constructors

### Constructor

> **new BiatecClammPoolFactory**(`params`): `BiatecClammPoolFactory`

Creates a new instance of `BiatecClammPoolFactory`

#### Parameters

##### params

`Omit`\<`AppFactoryParams`, `"appSpec"`\>

The parameters to initialise the app factory with

#### Returns

`BiatecClammPoolFactory`

## Properties

### appFactory

> `readonly` **appFactory**: `AppFactory`

The underlying `AppFactory` for when you want to have more flexibility

***

### params

> `readonly` **params**: `object`

Get parameters to create transactions (create and deploy related calls) for the current app. A good mental model for this is that these parameters represent a deferred transaction creation.

#### create

> **create**: `object`

Gets available create methods

##### create.createApplication()

> **createApplication**: (`params`) => `Promise`\<`object` & `object`\>

Creates a new instance of the BiatecClammPool smart contract using the createApplication()void ABI method.

Initial setup

###### Parameters

###### params

`object` & `AppClientCompilationParams` & `CreateSchema` & `object` = `...`

The params for the smart contract call

###### Returns

`Promise`\<`object` & `object`\>

The create params

#### deployUpdate

> **deployUpdate**: `object`

Gets available deployUpdate methods

##### deployUpdate.updateApplication()

> **updateApplication**: (`params`) => `object` & `object`

Updates an existing instance of the BiatecClammPool smart contract using the updateApplication(uint64,byte[])void ABI method.

addressUdpater from global biatec configuration is allowed to update application

###### Parameters

###### params

`object` & `AppClientCompilationParams`

The params for the smart contract call

###### Returns

`object` & `object`

The deployUpdate params

***

### createTransaction

> `readonly` **createTransaction**: `object`

Create transactions for the current app

#### create

> **create**: `object`

Gets available create methods

##### create.createApplication()

> **createApplication**: (`params`) => `Promise`\<\{ \}\>

Creates a new instance of the BiatecClammPool smart contract using the createApplication()void ABI method.

Initial setup

###### Parameters

###### params

`object` & `AppClientCompilationParams` & `CreateSchema` & `object` = `...`

The params for the smart contract call

###### Returns

`Promise`\<\{ \}\>

The create transaction

***

### send

> `readonly` **send**: `object`

Send calls to the current app

#### create

> **create**: `object`

Gets available create methods

##### create.createApplication()

> **createApplication**: (`params`) => `Promise`\<\{ `result`: \{ `return`: `void` \| `undefined`; \}; `appClient`: [`BiatecClammPoolClient`](BiatecClammPoolClient.md); \}\>

Creates a new instance of the BiatecClammPool smart contract using an ABI method call using the createApplication()void ABI method.

Initial setup

###### Parameters

###### params

`object` & `AppClientCompilationParams` & `CreateSchema` & `SendParams` & `object` = `...`

The params for the smart contract call

###### Returns

`Promise`\<\{ `result`: \{ `return`: `void` \| `undefined`; \}; `appClient`: [`BiatecClammPoolClient`](BiatecClammPoolClient.md); \}\>

The create result

## Accessors

### appName

#### Get Signature

> **get** **appName**(): `string`

The name of the app (from the ARC-32 / ARC-56 app spec or override).

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

A reference to the underlying `AlgorandClient` this app factory is using.

##### Returns

`AlgorandClient`

## Methods

### getAppClientById()

> **getAppClientById**(`params`): [`BiatecClammPoolClient`](BiatecClammPoolClient.md)

Returns a new `AppClient` client for an app instance of the given ID.

Automatically populates appName, defaultSender and source maps from the factory
if not specified in the params.

#### Parameters

##### params

The parameters to create the app client

#### Returns

[`BiatecClammPoolClient`](BiatecClammPoolClient.md)

The `AppClient`

***

### getAppClientByCreatorAndName()

> **getAppClientByCreatorAndName**(`params`): `Promise`\<[`BiatecClammPoolClient`](BiatecClammPoolClient.md)\>

Returns a new `AppClient` client, resolving the app by creator address and name
using AlgoKit app deployment semantics (i.e. looking for the app creation transaction note).

Automatically populates appName, defaultSender and source maps from the factory
if not specified in the params.

#### Parameters

##### params

The parameters to create the app client

#### Returns

`Promise`\<[`BiatecClammPoolClient`](BiatecClammPoolClient.md)\>

The `AppClient`

***

### deploy()

> **deploy**(`params`): `Promise`\<\{ `result`: \{ \} \| \{ \} \| \{ \} \| \{ \}; `appClient`: [`BiatecClammPoolClient`](BiatecClammPoolClient.md); \}\>

Idempotently deploys the BiatecClammPool smart contract.

#### Parameters

##### params

The arguments for the contract calls and any additional parameters for the call

###### createParams?

`BiatecClammPoolCreateCallParams`

Create transaction parameters to use if a create needs to be issued as part of deployment; use `method` to define ABI call (if available) or leave out for a bare call (if available)

###### updateParams?

`BiatecClammPoolUpdateCallParams`

Update transaction parameters to use if a create needs to be issued as part of deployment; use `method` to define ABI call (if available) or leave out for a bare call (if available)

#### Returns

`Promise`\<\{ `result`: \{ \} \| \{ \} \| \{ \} \| \{ \}; `appClient`: [`BiatecClammPoolClient`](BiatecClammPoolClient.md); \}\>

The deployment result
