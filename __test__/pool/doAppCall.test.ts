import { describe, expect, test } from '@jest/globals';
import { setupPool, SCALE, algosdk, algokit } from './shared-setup';
import { makePaymentTxnWithSuggestedParamsFromObject } from 'algosdk';

const COUNTER_KEY_B64 = Buffer.from('counter', 'ascii').toString('base64');

const APPROVAL_PROGRAM = `#pragma version 8
txn OnCompletion
int NoOp
==
bnz noop
int 1
return
noop:
txn NumAppArgs
int 1
<
bnz done
txna ApplicationArgs 0
len
int 8
<
bnz done
byte "counter"
txna ApplicationArgs 0
txna ApplicationArgs 0
len
int 8
-
int 8
extract3
btoi
app_global_put
done:
int 1
return
`;

const CLEAR_STATE_PROGRAM = `#pragma version 8
int 1
return
`;

describe('BiatecClammPool - doAppCall', () => {
  test('executive fee account can proxy arbitrary app calls', async () => {
    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, algod, deployer } = await setupPool({
      assetA: 1n,
      biatecFee: 0n,
      lpFee: BigInt(SCALE / 10),
      p: BigInt(1 * SCALE),
      p1: BigInt(1 * SCALE),
      p2: BigInt(1 * SCALE),
    });

    const compileProgram = async (source: string) => {
      const { result } = await algod.compile(source).do();
      return new Uint8Array(Buffer.from(result, 'base64'));
    };

    const approvalProgram = await compileProgram(APPROVAL_PROGRAM);
    const clearStateProgram = await compileProgram(CLEAR_STATE_PROGRAM);

    const suggestedParams = await algod.getTransactionParams().do();
    const createTxn = algosdk.makeApplicationCreateTxnFromObject({
      sender: String(deployer.addr),
      approvalProgram,
      clearProgram: clearStateProgram,
      numGlobalInts: 1,
      numGlobalByteSlices: 0,
      numLocalInts: 0,
      numLocalByteSlices: 0,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      suggestedParams,
    });

    const signedCreate = createTxn.signTxn(deployer.sk);
    const createTxId = createTxn.txID();
    await algod.sendRawTransaction(signedCreate).do();
    const confirmation = await algosdk.waitForConfirmation(algod, createTxId, 4);
    const counterAppId = confirmation.applicationIndex;
    if (counterAppId === undefined) {
      throw new Error('counterAppId not available after application creation');
    }

    expect(counterAppId).toBeGreaterThan(0);
    const counterAppIdBigInt = BigInt(counterAppId);

    const targetValue = 42n;
    const encodedValue = algosdk.encodeUint64(Number(targetValue));

    // make sure there are excess tokens to be spent
    const seedPayment = makePaymentTxnWithSuggestedParamsFromObject({
      amount: 1_000_000,
      receiver: clientBiatecClammPoolProvider.appClient.appAddress,
      suggestedParams: await algod.getTransactionParams().do(),
      sender: deployer.addr,
    }).signTxn(deployer.sk);
    await clientBiatecClammPoolProvider.appClient.algorand.client.algod.sendRawTransaction(seedPayment).do();

    // perform the payment and app call
    const callResult = await clientBiatecClammPoolProvider.appClient.send.doAppCall({
      args: {
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appCallParams: {
          applicationId: counterAppIdBigInt,
          fee: 0n,
          note: 'doAppCall-test',
          payAmount: 1000000n,
          payToAddress: algosdk.decodeAddress('ALGONAUTSPIUHDCX3SLFXOFDUKOE4VY36XV4JX2JHQTWJNKVBKPEBQACRY').publicKey,
        },
        apps: [],
        assets: [],
        accounts: [],
        appArgs: [encodedValue, encodedValue],
      },
      appReferences: [clientBiatecConfigProvider.appClient.appId, counterAppIdBigInt],
      assetReferences: [],
      extraFee: algokit.microAlgos(9_000),
    });

    if (callResult.confirmation) {
      await callResult.confirmation;
    } else if (callResult.return) {
      await callResult.return;
    }

    const appInfo = await algod.getApplicationByID(Number(counterAppId)).do();
    const globalState = appInfo.params?.globalState ?? [];
    const counterEntry = globalState.find((entry) => Buffer.from(entry.key).toString('base64') === COUNTER_KEY_B64);

    expect(counterEntry?.value?.uint).toBe(targetValue);
  });
});
