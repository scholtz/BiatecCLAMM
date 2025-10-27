import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import algosdk, { Transaction } from 'algosdk';
import { FakePoolFactory } from '../../contracts/clients/FakePoolClient';
import { SCALE, fixture, initDeployer, setupPool } from './setup';

describe('clamm deployment', () => {
  beforeEach(fixture.newScope);
  beforeAll(async () => {
    await initDeployer();
  });

  test('I can deploy the concentrated liquidity pool', async () => {
    const { algod } = fixture.context;
    const { clientBiatecClammPoolProvider } = await setupPool({
      algod,
      assetA: 1n,
      biatecFee: BigInt(SCALE / 10),
      lpFee: BigInt(SCALE / 10),
      p: BigInt(1.5 * SCALE),
      p1: BigInt(1 * SCALE),
      p2: BigInt(2 * SCALE),
    });

    expect(clientBiatecClammPoolProvider).toBeTruthy();
    expect(clientBiatecClammPoolProvider.appClient.appId).toBeGreaterThan(0);
  });

  test('CantMixPP: I cannot register a fake pool with the pool provider', async () => {
    const { algod } = fixture.context;
    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider, assetAId, assetBId, deployer } = await setupPool({
      algod,
      assetA: 1n,
      biatecFee: BigInt(SCALE / 10),
      lpFee: BigInt(SCALE / 10),
      p: BigInt(1.5 * SCALE),
      p1: BigInt(1 * SCALE),
      p2: BigInt(2 * SCALE),
    });

    const defaultSigner = async (txnGroup: Transaction[], _indexesToSign: number[]) => txnGroup.map((tx) => tx.signTxn(deployer.sk));

    const fakePoolFactory = new FakePoolFactory({
      defaultSender: deployer.addr,
      defaultSigner,
      algorand: clientBiatecClammPoolProvider.appClient.algorand,
    });

    const fakeClientProvider = await fakePoolFactory.send.create.createApplication({ args: {} });
    expect(fakeClientProvider.appClient.appId).toBeGreaterThan(0n);

    await expect(
      fakeClientProvider.appClient.send.bootstrapStep2({
        args: {
          appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
          assetA: assetAId,
          assetB: assetBId,
          verificationClass: 0,
        },
        staticFee: AlgoAmount.MicroAlgo(2_000),
      })
    ).rejects.toThrow();
  });
});
