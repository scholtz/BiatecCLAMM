/**
 * Audit 2026-09-07, missing test scenario (Medium):
 * "Retired creators lose setup authority; approved governance retains only documented powers"
 *
 * Acceptance criterion from M-02: after setup and authority rotation, the retired creator cannot change provider
 * configuration or identity roles; the documented current authority can perform supported changes.
 *
 * The defects documented here were fixed on 2026-09-26; these tests now guard the fixed behaviour.
 */
import { describe, expect, test } from '@jest/globals';
import { setupPool, deployer, SCALE, AlgorandClient, BiatecConfigProviderFactory } from './shared-setup';
import { decodeStateBytes as decodeName, expectLogicError, newFundedAccount, signerFor } from './audit-2026-09-07-helpers';

const standardPool = () =>
  setupPool({
    assetA: 1n,
    biatecFee: 0n,
    lpFee: BigInt(SCALE / 100),
    p: BigInt(SCALE),
    p1: BigInt(SCALE),
    p2: BigInt(SCALE),
  });

const NOT_AUTHORIZED = /E_UPDATER|Only creator|Only addressUdpater|Only updater|assert failed|logic eval error|rejected/;

describe('Audit 2026-09-07 M-02 - provider bootstrap authority after governance handover', () => {
  test('accounts other than the creator can never (re)bootstrap the providers', async () => {
    const { algod, clientBiatecPoolProvider, clientBiatecIdentityProvider, clientBiatecConfigProvider } = await standardPool();
    const configId = clientBiatecConfigProvider.appClient.appId;
    const { account: stranger, signer } = await newFundedAccount(algod, deployer, 5_000_000n, []);

    await expectLogicError(() => clientBiatecPoolProvider.appClient.send.bootstrap({ args: { appBiatecConfigProvider: configId }, sender: stranger.addr, signer: signer.signer }), NOT_AUTHORIZED);
    await expectLogicError(
      () =>
        clientBiatecIdentityProvider.appClient.send.bootstrap({
          args: {
            appBiatecConfigProvider: configId,
            governor: stranger.addr.toString(),
            verificationSetter: stranger.addr.toString(),
            engagementSetter: stranger.addr.toString(),
          },
          sender: stranger.addr,
          signer: signer.signer,
        }),
      NOT_AUTHORIZED
    );
    const identityState = await clientBiatecIdentityProvider.appClient.state.global.getAll();
    expect(String(identityState.engagementSetter)).toBe(deployer.addr.toString());
  });

  test('after updater rotation the new updater holds the documented powers and the retired updater loses them', async () => {
    const { algod, clientBiatecPoolProvider, clientBiatecConfigProvider } = await standardPool();
    const configId = clientBiatecConfigProvider.appClient.appId;
    const { account: newUpdater, signer } = await newFundedAccount(algod, deployer, 5_000_000n, []);

    await clientBiatecConfigProvider.appClient.send.setAddressUdpater({ args: { a: newUpdater.addr.toString() } });

    // retired updater (still the app creator) can no longer use updater-gated setters
    await expectLogicError(
      () =>
        clientBiatecPoolProvider.appClient.send.setNativeTokenName({
          args: { appBiatecConfigProvider: configId, nativeTokenName: Buffer.from('Voi', 'utf8') },
          appReferences: [configId],
        }),
      NOT_AUTHORIZED
    );
    await expectLogicError(() => clientBiatecConfigProvider.appClient.send.setPaused({ args: { a: 1n } }), NOT_AUTHORIZED);

    // the new updater can
    await clientBiatecPoolProvider.appClient.send.setNativeTokenName({
      args: { appBiatecConfigProvider: configId, nativeTokenName: Buffer.from('Voi', 'utf8') },
      appReferences: [configId],
      sender: newUpdater.addr,
      signer: signer.signer,
    });
    const providerState = await clientBiatecPoolProvider.appClient.state.global.getAll();
    expect(decodeName(providerState.nativeTokenName)).toBe('Voi');
    await clientBiatecConfigProvider.appClient.send.setPaused({ args: { a: 1n }, sender: newUpdater.addr, signer: signer.signer });
    await clientBiatecConfigProvider.appClient.send.setPaused({ args: { a: 0n }, sender: newUpdater.addr, signer: signer.signer });
  });

  test('a retired creator cannot re-point the pool provider at a different configuration', async () => {
    const { algod, clientBiatecPoolProvider, clientBiatecConfigProvider } = await standardPool();
    const originalConfigId = BigInt(clientBiatecConfigProvider.appClient.appId);
    const { account: newUpdater } = await newFundedAccount(algod, deployer, 5_000_000n, []);
    await clientBiatecConfigProvider.appClient.send.setAddressUdpater({ args: { a: newUpdater.addr.toString() } });

    // the retired creator deploys its own configuration contract, where it is still the updater ...
    const algorand = await AlgorandClient.fromEnvironment();
    const rogueFactory = new BiatecConfigProviderFactory({
      defaultSender: deployer.addr,
      defaultSigner: async (txnGroup) => txnGroup.map((tx) => tx.signTxn(deployer.sk)),
      algorand,
    });
    const rogue = await rogueFactory.send.create.createApplication();
    const rogueConfigId = BigInt(rogue.appClient.appId);
    expect(rogueConfigId).not.toBe(originalConfigId);

    // ... and re-runs bootstrap: after setup only the updater of the currently trusted configuration may do that
    await expectLogicError(() => clientBiatecPoolProvider.appClient.send.bootstrap({ args: { appBiatecConfigProvider: rogueConfigId } }), /E_UPDATER/);
    const state = await clientBiatecPoolProvider.appClient.state.global.getAll();
    // the pool provider still trusts the governance-approved configuration
    expect(BigInt(state.appBiatecConfigProvider ?? 0n)).toBe(originalConfigId);
  });

  test('a retired creator cannot overwrite the identity provider roles', async () => {
    const { algod, clientBiatecIdentityProvider, clientBiatecConfigProvider } = await standardPool();
    const configId = clientBiatecConfigProvider.appClient.appId;
    const { account: newUpdater } = await newFundedAccount(algod, deployer, 5_000_000n, []);
    const { account: stranger } = await newFundedAccount(algod, deployer, 1_000_000n, []);
    await clientBiatecConfigProvider.appClient.send.setAddressUdpater({ args: { a: newUpdater.addr.toString() } });

    const roles = {
      appBiatecConfigProvider: configId,
      governor: stranger.addr.toString(),
      verificationSetter: stranger.addr.toString(),
      engagementSetter: stranger.addr.toString(),
    };
    await expectLogicError(() => clientBiatecIdentityProvider.appClient.send.bootstrap({ args: roles }), /E_UPDATER/);
    const state = await clientBiatecIdentityProvider.appClient.state.global.getAll();
    expect(String(state.engagementSetter)).toBe(deployer.addr.toString());
    expect(String(state.governor)).toBe(deployer.addr.toString());

    // the documented current authority can rotate the roles
    const updaterSigner = signerFor(newUpdater);
    await clientBiatecIdentityProvider.appClient.send.bootstrap({ args: roles, sender: newUpdater.addr, signer: updaterSigner.signer });
    const rotated = await clientBiatecIdentityProvider.appClient.state.global.getAll();
    expect(String(rotated.engagementSetter)).toBe(stranger.addr.toString());
  });
});
