/**
 * Audit 2026-09-07, missing test scenario (Low):
 * "Proxy calls either execute the requested shape or reject clearly"
 *
 * L-01: doAppCall only forwards when a payment is attached and always forwards exactly appArgs[0] and appArgs[1].
 * The target application below records how many arguments it actually received, so target-side effects are verified
 * instead of trusting the outer call's success.
 *
 * Tests marked `test.failing` document defects confirmed against the current contract. They pass while the defect
 * exists and start failing once it is fixed - at that point switch them to a plain `test`.
 */
import { describe, expect, test } from '@jest/globals';
import { setupPool, SCALE, algosdk, algokit, makePaymentTxnWithSuggestedParamsFromObject } from './shared-setup';

// records NumAppArgs under "nargs" and the first argument under "counter" on every NoOp call with arguments
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
byte "nargs"
txn NumAppArgs
app_global_put
byte "counter"
txna ApplicationArgs 0
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

const PAY_TO = algosdk.decodeAddress('ALGONAUTSPIUHDCX3SLFXOFDUKOE4VY36XV4JX2JHQTWJNKVBKPEBQACRY').publicKey;

const build = async () => {
  const ctx = await setupPool({ assetA: 1n, biatecFee: 0n, lpFee: BigInt(SCALE / 10), p: BigInt(SCALE), p1: BigInt(SCALE), p2: BigInt(SCALE) });
  const { algod, deployer } = ctx;
  const compile = async (source: string) => new Uint8Array(Buffer.from((await algod.compile(source).do()).result, 'base64'));
  const createTxn = algosdk.makeApplicationCreateTxnFromObject({
    sender: String(deployer.addr),
    approvalProgram: await compile(APPROVAL_PROGRAM),
    clearProgram: await compile(CLEAR_STATE_PROGRAM),
    numGlobalInts: 2,
    numGlobalByteSlices: 0,
    numLocalInts: 0,
    numLocalByteSlices: 0,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: await algod.getTransactionParams().do(),
  });
  await algod.sendRawTransaction(createTxn.signTxn(deployer.sk)).do();
  const confirmation = await algosdk.waitForConfirmation(algod, createTxn.txID(), 4);
  const targetAppId = BigInt(confirmation.applicationIndex ?? 0);
  expect(targetAppId).toBeGreaterThan(0n);

  // excess native balance in the pool so the proxied payment has something to spend
  const seed = makePaymentTxnWithSuggestedParamsFromObject({
    amount: 2_000_000,
    receiver: ctx.clientBiatecClammPoolProvider.appClient.appAddress,
    suggestedParams: await algod.getTransactionParams().do(),
    sender: deployer.addr,
  });
  await algod.sendRawTransaction(seed.signTxn(deployer.sk)).do();
  await algosdk.waitForConfirmation(algod, seed.txID(), 4);

  const readTarget = async () => {
    const info = await algod.getApplicationByID(targetAppId).do();
    const entries = info.params?.globalState ?? [];
    const value = (key: string) => entries.find((e) => Buffer.from(e.key).toString('utf8') === key)?.value?.uint;
    return { nargs: value('nargs'), counter: value('counter') };
  };

  const proxy = (payAmount: bigint, appArgs: Uint8Array[]) =>
    ctx.clientBiatecClammPoolProvider.appClient.send.doAppCall({
      args: {
        appBiatecConfigProvider: ctx.clientBiatecConfigProvider.appClient.appId,
        appCallParams: { applicationId: targetAppId, fee: 0n, note: 'audit-l01', payAmount, payToAddress: PAY_TO },
        apps: [],
        assets: [],
        accounts: [],
        appArgs,
      },
      appReferences: [ctx.clientBiatecConfigProvider.appClient.appId, targetAppId],
      extraFee: algokit.microAlgos(9_000),
    });

  return { ...ctx, targetAppId, readTarget, proxy };
};

const arg = (n: number) => algosdk.encodeUint64(n);

describe('Audit 2026-09-07 L-01 - doAppCall executes the requested shape or rejects clearly', () => {
  test('a paid two-argument request reaches the target with both arguments', async () => {
    const p = await build();
    await p.proxy(1_000n, [arg(7), arg(8)]);
    expect(await p.readTarget()).toEqual({ nargs: 2n, counter: 7n });
  });

  test.failing('a request without payment either reaches the target or is rejected, never silently dropped', async () => {
    const p = await build();
    let rejected = false;
    try {
      await p.proxy(0n, [arg(42), arg(42)]);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      // the outer call succeeded, so the target must have been invoked
      expect(await p.readTarget()).toEqual({ nargs: 2n, counter: 42n });
    }
  });

  test.failing('all supplied arguments are forwarded, not only the first two', async () => {
    const p = await build();
    let rejected = false;
    try {
      await p.proxy(1_000n, [arg(1), arg(2), arg(3)]);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      expect((await p.readTarget()).nargs).toBe(3n);
    }
  });

  test.failing('a single-argument request is forwarded as one argument or rejected, never padded', async () => {
    const p = await build();
    await p.proxy(1_000n, [arg(5), arg(6)]);
    let rejected = false;
    try {
      await p.proxy(1_000n, [arg(9)]);
    } catch {
      rejected = true;
    }
    if (rejected) {
      expect(await p.readTarget()).toEqual({ nargs: 2n, counter: 5n });
    } else {
      // the contract reads appArgs[1] past the end of the array; today this yields an empty byte string and the
      // target receives two arguments instead of one
      expect(await p.readTarget()).toEqual({ nargs: 1n, counter: 9n });
    }
  });
});
