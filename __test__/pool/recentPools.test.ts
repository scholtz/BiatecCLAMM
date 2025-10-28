import { describe, test, expect, jest } from '@jest/globals';
import { algosdk, clammCreateTxs, setupPool } from './shared-setup';

describe('BiatecPoolProvider recentPools ring buffer', () => {
  jest.setTimeout(180000);

  test('stores the last 10 deployed pool app ids in recentPools1..10', async () => {
    const { clientBiatecPoolProvider, clientBiatecConfigProvider, deployer, assetAId, assetBId, algod } = await setupPool({ p1: 1n, p2: 1n, p: 1n, assetA: 1n, biatecFee: 0n, lpFee: 0n });

    const createdIds: bigint[] = [];

    for (let i = 0; i < 11; i += 1) {
      const txsClammCreateTxs = await clammCreateTxs({
        sender: deployer.addr.toString(),
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        assetA: assetAId,
        assetB: assetBId,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        currentPrice: 1n,
        fee: 0n,
        params: await algod.getTransactionParams().do(),
        priceMax: 1n,
        priceMin: 1n,
        verificationClass: 0,
      });

      // sign and send
      const signed: Uint8Array[] = [];
      txsClammCreateTxs.forEach((t) => signed.push(t.signTxn(deployer.sk)));
      await algod.sendRawTransaction(signed).do();
      // wait for confirmation
      const confirmation = await algosdk.waitForConfirmation(algod, txsClammCreateTxs[txsClammCreateTxs.length - 1].txID(), 4);
      if (!(confirmation.logs && confirmation.logs.length > 0)) throw new Error('Logs not found');
      const lastLog = confirmation.logs[confirmation.logs.length - 1];
      const poolAppId = algosdk.decodeUint64(lastLog.subarray(4, 12));
      createdIds.push(BigInt(poolAppId));
    }

    // read recentPools1..10 from pool provider global state
    const recent: bigint[] = [];
    for (let i = 1; i <= 10; i += 1) {
      // keys are named recentPools1 .. recentPools10
      // use the generated state accessor methods (recentPools1(), recentPools2(), ...)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // @ts-ignore
      const accessor = (clientBiatecPoolProvider.appClient.state.global as any)[`recentPools${i}`];
      if (typeof accessor === 'function') {
        const val = (await accessor.call(clientBiatecPoolProvider.appClient.state.global)) as bigint | undefined;
        if (val !== undefined) recent.push(val);
      }
    }

    // Expect that the set of recent pools contains the last 10 created app ids (i.e., exclude the oldest of the 11)
    const expected = createdIds.slice(1).map((v) => v.toString());
    const recentSet = new Set(recent.map((v) => v.toString()));
    expected.forEach((id) => {
      expect(recentSet.has(id)).toBe(true);
    });
  });
});
