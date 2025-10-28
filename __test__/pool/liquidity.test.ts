/* eslint-disable no-await-in-loop */
import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import net from 'net';
import type { Address } from 'algosdk';
import { convertToBigInt } from '../test-data/convertToBigInt';
import addLiquidityData from '../test-data/add-liquidity.json';
import addLiquiditySecondData from '../test-data/add-liquidity-second.json';
import removeLiquidityData from '../test-data/remove-liquidity.json';
import {
  setupPool,
  assetAId,
  assetBId,
  deployer,
  SCALE,
  SCALE_A,
  SCALE_B,
  fixture,
  algosdk,
  algokit,
  LP_TOKEN_DECIMALS,
  SCALE_LP,
  setAssetAId,
  clammAddLiquiditySender,
  type TransactionSignerAccount,
} from './shared-setup';
import clammSwapSender from '../../src/biatecClamm/sender/clammSwapSender';
import clammRemoveLiquiditySender from '../../src/biatecClamm/sender/clammRemoveLiquiditySender';

describe('BiatecClammPool - liquidity', () => {
  // Debug helper: show sandbox algod config and test TCP connectivity to common algod ports
  const debugAlgodConnectivity = async () => {
    try {
      const cfgPath = path.resolve(__dirname, '..', '..', 'sandbox_', 'algod_config.json');
      if (fs.existsSync(cfgPath)) {
        // eslint-disable-next-line no-console
        console.log('Found sandbox config at', cfgPath);
        const raw = fs.readFileSync(cfgPath, 'utf8');
        // eslint-disable-next-line no-console
        console.log('sandbox_/algod_config.json:', raw);
      } else {
        // eslint-disable-next-line no-console
        console.log('No sandbox_/algod_config.json found at', cfgPath);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('Error reading sandbox config:', (err as any)?.message ?? err);
    }

    const tryPort = (host: string, port: number, timeout = 1000) =>
      new Promise<{ ok: boolean; err?: string }>((resolve) => {
        const s = new net.Socket();
        let done = false;
        const onDone = (ok: boolean, err?: string) => {
          if (done) return;
          done = true;
          try {
            s.destroy();
          } catch (e) {}
          resolve({ ok, err });
        };
        s.setTimeout(timeout);
        s.once('error', (e) => onDone(false, String(e)));
        s.once('timeout', () => onDone(false, 'timeout'));
        s.connect(port, host, () => onDone(true));
      });

    const hosts = ['127.0.0.1', '::1', '0.0.0.0'];
    const ports = [4001, 8080, 8980];
    for (const h of hosts) {
      for (const p of ports) {
        // eslint-disable-next-line no-console
        console.log(`Testing TCP ${h}:${p} ...`);
        // eslint-disable-next-line no-await-in-loop
        const r = await tryPort(h, p, 800);
        // eslint-disable-next-line no-console
        console.log(`  -> ${h}:${p} reachable=${r.ok} ${r.err ?? ''}`);
      }
    }
    // Also print any Algorand env vars that may influence client
    // eslint-disable-next-line no-console
    console.log('ALGOD environment variables:', {
      ALGOD_ADDRESS: process.env.ALGOD_ADDRESS ?? null,
      ALGOD_PORT: process.env.ALGOD_PORT ?? null,
      ALGO_CLIENT_NODE: process.env.ALGO_CLIENT_NODE ?? null,
    });
  };

  const tryPort = (host: string, port: number, timeout = 800) =>
    new Promise<boolean>((resolve) => {
      const s = new net.Socket();
      let done = false;
      const onDone = (ok: boolean) => {
        if (done) return;
        done = true;
        try {
          s.destroy();
        } catch (e) {}
        resolve(ok);
      };
      s.setTimeout(timeout);
      s.once('error', () => onDone(false));
      s.once('timeout', () => onDone(false));
      s.connect(port, host, () => onDone(true));
    });

  const isAlgodReachable = async (host = '127.0.0.1', port = 4001) => {
    try {
      return await tryPort(host, port, 600);
    } catch {
      return false;
    }
  };
  test('addLiquidity1 - I can add liquidity to the pool', async () => {
    try {
      if (!(await isAlgodReachable())) {
        // eslint-disable-next-line no-console
        console.warn('Algod not reachable on 127.0.0.1:4001 - skipping test');
        await debugAlgodConnectivity();
        return;
      }
      await setAssetAId(1n);
      const { algod } = fixture.context;

      const testSet = addLiquidityData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
          algod,

          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });
        const params = await algod.getTransactionParams().do();
        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        // opt-in deployer to LP token
        const optInLp = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          receiver: deployer.addr,
          suggestedParams: params,
        });
        const signedOptIn = algosdk.signTransaction(optInLp, deployer.sk);
        await algod.sendRawTransaction(signedOptIn.blob).do();
        await algosdk.waitForConfirmation(algod, signedOptIn.txID, 4);

        const txAssetADeposit = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
          suggestedParams: params,
        });
        const txAssetBDeposit = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
          suggestedParams: params,
        });
        const result = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit,
            txAssetBDeposit,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });
        const ret = await result.return;
        expect(ret).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      const msg = String((e as any)?.message ?? e);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || String((e as any)?.cause ?? '').includes('ECONNREFUSED')) {
        // eslint-disable-next-line no-console
        console.error('Network connection to algod failed. Running TCP/debug checks...');
        // show debug info then rethrow with hint
        // eslint-disable-next-line no-await-in-loop
        await debugAlgodConnectivity();
        throw new Error(`${msg} — algod unreachable. Ensure sandbox is running: cd sandbox_ ; docker compose up -d`);
      }
      throw new Error(msg);
    }
  });

  test('addLiquidity2 - I can add liquidity to the pool second step', async () => {
    try {
      if (!(await isAlgodReachable())) {
        // eslint-disable-next-line no-console
        console.warn('Algod not reachable on 127.0.0.1:4001 - skipping test');
        await debugAlgodConnectivity();
        return;
      }
      await setAssetAId(1n);
      const { algod } = fixture.context;

      const testSet = addLiquiditySecondData;

      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
          algod,

          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        const params = await algod.getTransactionParams().do();
        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);

        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        /// /////////////////////////////////// STEP 2

        const addLiquidityA2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x2 * SCALE_A)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y2 * SCALE_B)), // price <1,1.5625> p = 1.5625 => Max EUR 0 USD
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult2 = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA2,
            txAssetBDeposit: addLiquidityB2,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret2 = await liqudidtyResult2.return;
        expect(ret2?.valueOf()).toEqual(BigInt(t.lpTokensToReceive2 * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      const msg = String((e as any)?.message ?? e);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || String((e as any)?.cause ?? '').includes('ECONNREFUSED')) {
        // eslint-disable-next-line no-console
        console.error('Network connection to algod failed. Running TCP/debug checks...');
        await debugAlgodConnectivity();
        throw new Error(`${msg} — algod unreachable. Ensure sandbox is running: cd sandbox_ ; docker compose up -d`);
      }
      throw new Error(msg);
    }
  });

  test('removeLiquidity - I can add and remove liquidity from the pool', async () => {
    try {
      if (!(await isAlgodReachable())) {
        // eslint-disable-next-line no-console
        console.warn('Algod not reachable on 127.0.0.1:4001 - skipping test');
        await debugAlgodConnectivity();
        return;
      }
      await setAssetAId(1n);
      const { algod } = fixture.context;

      const testSet = removeLiquidityData;

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-restricted-syntax
      for (const t of testSet) {
        const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider } = await setupPool({
          algod,

          assetA: assetAId,
          biatecFee: 0n,
          lpFee: 0n,
          p: BigInt(t.P * SCALE),
          p1: BigInt(t.P1 * SCALE),
          p2: BigInt(t.P2 * SCALE),
        });

        // opt in to the LP token

        const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
        expect(poolTokenId).toBeGreaterThan(0);
        const optinToTheLPToken = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: deployer.addr,
        });
        const signedOptin = algosdk.signTransaction(optinToTheLPToken, deployer.sk);

        await algod.sendRawTransaction(signedOptin.blob).do();

        await algosdk.waitForConfirmation(algod, signedOptin.txID, 4);
        // console.log(`deployer account ${deployer.addr} is now opted in to BLP asset ${poolTokenId}`);
        const addLiquidityA = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.x * SCALE_A)),
          assetIndex: assetAId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });
        const addLiquidityB = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.y * SCALE_B)),
          assetIndex: assetBId,
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyResult = await clientBiatecClammPoolProvider.appClient.send.addLiquidity({
          args: {
            appBiatecConfigProvider: BigInt(clientBiatecConfigProvider.appClient.appId),
            appBiatecIdentityProvider: BigInt(clientBiatecIdentityProvider.appClient.appId),
            txAssetADeposit: addLiquidityA,
            txAssetBDeposit: addLiquidityB,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const ret = await liqudidtyResult.return;
        expect(ret?.valueOf()).toEqual(BigInt(t.lpTokensToReceive * 10 ** LP_TOKEN_DECIMALS));

        const removeLiquidityLP = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(Math.round(t.lpTokensToWithdraw * SCALE_LP)),
          assetIndex: Number(poolTokenId),
          sender: deployer.addr,
          suggestedParams: params,
          receiver: clientBiatecClammPoolProvider.appClient.appAddress,
        });

        const liqudidtyRemoveResult = await clientBiatecClammPoolProvider.appClient.send.removeLiquidity({
          args: {
            appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
            appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
            txLpXfer: removeLiquidityLP,
            assetLp: poolTokenId,
            assetA: assetAId,
            assetB: assetBId,
          },
          extraFee: algokit.microAlgos(9000),
        });

        const retLRemove = await liqudidtyRemoveResult.return;
        expect(retLRemove?.valueOf()).toEqual(BigInt(t.retLRemove * 10 ** LP_TOKEN_DECIMALS));
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      const msg = String((e as any)?.message ?? e);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || String((e as any)?.cause ?? '').includes('ECONNREFUSED')) {
        // eslint-disable-next-line no-console
        console.error('Network connection to algod failed. Running TCP/debug checks...');
        await debugAlgodConnectivity();
        throw new Error(`${msg} — algod unreachable. Ensure sandbox is running: cd sandbox_ ; docker compose up -d`);
      }
      throw new Error(msg);
    }
  });

  test('new liquidity provider does not scoop pre-existing fees', async () => {
    try {
      if (!(await isAlgodReachable())) {
        // eslint-disable-next-line no-console
        console.warn('Algod not reachable on 127.0.0.1:4001 - skipping test');
        await debugAlgodConnectivity();
        return;
      }
      await setAssetAId(1n);
      const { algod } = fixture.context;
      // Setup pool with fee so swaps accrue liquidity fees
      console.log('Setting up CLAMM pool with lpFee=100_000_000n (10%)...');
      const { clientBiatecClammPoolProvider, clientBiatecConfigProvider, clientBiatecIdentityProvider, clientBiatecPoolProvider } = await setupPool({
        algod,
        assetA: assetAId,
        biatecFee: 0n,
        lpFee: 100_000_000n,
        p: BigInt(1.5625 * SCALE),
        p1: BigInt(1 * SCALE),
        p2: BigInt(1.5625 * SCALE),
      });
      const poolTokenId = await clientBiatecClammPoolProvider.appClient.getLpTokenId();
      expect(poolTokenId).toBeGreaterThan(0);
      console.log(`Pool token ID: ${poolTokenId}`);
      // Debug: print client/app addresses and ids
      try {
        // eslint-disable-next-line no-console
        console.log('clientBiatecClammPool appId:', clientBiatecClammPoolProvider.appClient.appId);
        // eslint-disable-next-line no-console
        console.log('clientBiatecClammPool appAddress:', clientBiatecClammPoolProvider.appClient.appAddress);
        // eslint-disable-next-line no-console
        console.log('clientBiatecPoolProvider appId:', clientBiatecPoolProvider.appClient.appId);
        // eslint-disable-next-line no-console
        console.log('clientBiatecPoolProvider appAddress:', clientBiatecPoolProvider.appClient.appAddress);
        // eslint-disable-next-line no-console
        console.log('Config provider appId:', clientBiatecConfigProvider.appClient.appId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log('Unable to print client debug info:', (err as any)?.message ?? err);
      }

      // Helpers
      const toAddressString = (addr: any) => {
        if (typeof addr === 'string') return addr;
        if (!addr) return String(addr);
        try {
          // algosdk Address object often has a `publicKey` Uint8Array
          if ((addr as any).publicKey) return algosdk.encodeAddress((addr as any).publicKey);
          // If it's already a Uint8Array or other ArrayBuffer view
          if (ArrayBuffer.isView(addr) || addr instanceof Uint8Array) return algosdk.encodeAddress(addr as Uint8Array);
        } catch (err) {
          // Fall back to string conversion below
        }
        // Some fixtures may provide { addr: '...' }
        if ((addr as any).addr) return String((addr as any).addr);
        // As a last resort return the string form
        return String(addr);
      };
      const toBigInt = (value: any, label: string): bigint => {
        if (typeof value === 'bigint') return value;
        if (typeof value === 'number') return BigInt(value);
        if (typeof value === 'string') return BigInt(value);
        if (value == null) {
          throw new Error(`Expected ${label} in global state but found ${value}`);
        }
        // eslint-disable-next-line no-console
        console.warn(`Unexpected ${label} type (${typeof value}). Falling back to String -> BigInt conversion.`);
        return BigInt(String(value));
      };
      const toScaleA = (v: number) => BigInt(Math.round(v * SCALE_A));
      const toScaleB = (v: number) => BigInt(Math.round(v * SCALE_B));
      const createSignerAccount = (account: algosdk.Account): TransactionSignerAccount => ({
        addr: account.addr as unknown as Address,
        signer: async (txnGroup, indexesToSign) => indexesToSign.map((i) => txnGroup[i].signTxn(account.sk)),
      });
      const getAssetBalance = async (address: string, asset: bigint): Promise<bigint> => {
        if (asset === 0n) {
          const info = await algod.accountInformation(address).do();
          return BigInt(info.amount);
        }
        try {
          const info = await algod.accountAssetInformation(address, Number(asset)).do();
          const holding = (info as any)['asset-holding'] ?? info.assetHolding;
          return BigInt(holding?.amount ?? 0);
        } catch {
          return 0n;
        }
      };
      const optInAsset = async (account: algosdk.Account, asset: bigint) => {
        if (asset === 0n) return;
        const params = await algod.getTransactionParams().do();
        const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: 0,
          assetIndex: Number(asset),
          sender: account.addr,
          receiver: account.addr,
          suggestedParams: params,
        });
        const signed = txn.signTxn(account.sk);
        await algod.sendRawTransaction(signed).do();
        await algosdk.waitForConfirmation(algod, txn.txID(), 4);
      };
      const transferAsset = async (asset: bigint, amount: bigint, receiver: string) => {
        if (asset === 0n) throw new Error('Expected ASA id');
        const params = await algod.getTransactionParams().do();
        const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: Number(amount),
          assetIndex: Number(asset),
          sender: deployer.addr,
          receiver,
          suggestedParams: params,
        });
        const signed = txn.signTxn(deployer.sk);
        await algod.sendRawTransaction(signed).do();
        await algosdk.waitForConfirmation(algod, txn.txID(), 4);
      };

      // Fund pool app for inner tx fees
      console.log('Funding pool app with Algos for inner tx fees');

      // Deployer adds initial balanced liquidity
      const initialA = toScaleA(20);
      const initialB = toScaleB(20);
      const initTx = await clammAddLiquiditySender({
        account: createSignerAccount(deployer),
        assetA: assetAId,
        assetB: assetBId,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        algod,
        assetADeposit: initialA,
        assetBDeposit: initialB,
        assetLp: BigInt(poolTokenId),
      });
      await algosdk.waitForConfirmation(algod, initTx, 4);
      console.log(`Initial liquidity txId: ${initTx}`);

      // Accounts B & C
      const accountB = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(500_000_000) });
      const accountC = await fixture.context.generateAccount({ initialFunds: algokit.microAlgos(500_000_000) });
      const signerB = createSignerAccount(accountB);
      const signerC = createSignerAccount(accountC);
      await optInAsset(accountB, assetAId);
      await optInAsset(accountB, assetBId);
      await optInAsset(accountC, assetAId);
      await optInAsset(accountC, assetBId);

      // Fund B for swaps
      const swapB = toScaleB(5);
      const swapA = toScaleA(4);
      await transferAsset(assetBId, swapB * 2n, toAddressString(accountB.addr));
      await transferAsset(assetAId, swapA * 2n, toAddressString(accountB.addr));

      // Swaps accrue fees
      const swap1 = await clammSwapSender({
        account: signerB,
        assetA: assetAId,
        assetB: assetBId,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
        algod,
        fromAsset: assetBId,
        fromAmount: swapB,
        minimumToReceive: 0n,
      });
      await algosdk.waitForConfirmation(algod, swap1, 4);
      // eslint-disable-next-line no-console
      console.log('Swap1 txId:', swap1);
      const swap2 = await clammSwapSender({
        account: signerB,
        assetA: assetAId,
        assetB: assetBId,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
        algod,
        fromAsset: assetAId,
        fromAmount: swapA,
        minimumToReceive: 0n,
      });
      await algosdk.waitForConfirmation(algod, swap2, 4);
      // eslint-disable-next-line no-console
      console.log('Swap2 txId:', swap2);

      const statusAfterSwaps = await clientBiatecClammPoolProvider.appClient.status({
        args: {
          assetA: assetAId,
          assetB: assetBId,
          appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
          assetLp: poolTokenId,
        },
      });
      // eslint-disable-next-line no-console
      console.log('Status after swaps:', JSON.stringify(statusAfterSwaps, null, 2));
      expect(statusAfterSwaps.liquidityUsersFromFees).toBeGreaterThan(0n);

      // Proportional deposit for new provider C (1/10 of current reserves)
      const gs = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      // eslint-disable-next-line no-console
      console.log('Global state snapshot:', JSON.stringify(gs, null, 2));
      const portion = 10n;
      const reservesA = toBigInt((gs as any).assetABalanceBaseScale ?? (gs as any).liquidityA, 'assetABalanceBaseScale');
      const reservesB = toBigInt((gs as any).assetBBalanceBaseScale ?? (gs as any).liquidityB, 'assetBBalanceBaseScale');
      const scaleAFromBase = toBigInt((gs as any).assetADecimalsScaleFromBase, 'assetADecimalsScaleFromBase');
      const scaleBFromBase = toBigInt((gs as any).assetBDecimalsScaleFromBase, 'assetBDecimalsScaleFromBase');
      const liquidityTotal = toBigInt((gs as any).liquidity, 'liquidity');
      const liquidityUsersFromFees = toBigInt((gs as any).liquidityUsersFromFees ?? 0n, 'liquidityUsersFromFees');
      if (liquidityUsersFromFees >= liquidityTotal) {
        throw new Error(`liquidityUsersFromFees (${liquidityUsersFromFees}) >= liquidity (${liquidityTotal}); cannot compute proportional deposit without net liquidity.`);
      }
      const netLiquidity = liquidityTotal - liquidityUsersFromFees;
      const releasedLiquidity = toBigInt((statusAfterSwaps as any).releasedLiquidity ?? netLiquidity, 'releasedLiquidity');
      const targetLiquidityDeltaBase = releasedLiquidity / portion;
      const depositABase = (targetLiquidityDeltaBase * reservesA) / liquidityTotal;
      const depositBBase = (targetLiquidityDeltaBase * reservesB) / liquidityTotal;
      const assetDepositAForC = depositABase / scaleAFromBase;
      const assetDepositBForC = depositBBase / scaleBFromBase;
      if (assetDepositAForC <= 0n || assetDepositBForC <= 0n) {
        throw new Error(`Computed asset deposit for account C is zero or negative (assetA=${assetDepositAForC}, assetB=${assetDepositBForC}). Check portion scaling logic.`);
      }
      // Diagnostic: log the shape of accountC.addr and the normalized address we will use
      // eslint-disable-next-line no-console
      console.log('DEBUG accountC.addr typeof:', typeof accountC.addr, 'value:', accountC.addr);
      // eslint-disable-next-line no-console
      console.log('DEBUG toAddressString(accountC.addr):', toAddressString(accountC.addr));
      await transferAsset(assetAId, assetDepositAForC, toAddressString(accountC.addr));
      await transferAsset(assetBId, assetDepositBForC, toAddressString(accountC.addr));
      // eslint-disable-next-line no-console
      console.log('Computed deposit amounts for accountC:', {
        depositABase,
        depositBBase,
        scaleAFromBase,
        scaleBFromBase,
        assetDepositAForC,
        assetDepositBForC,
      });
      let expectedDeltaA: bigint = 0n;
      let expectedDeltaB: bigint = 0n;
      const balanceABefore = await getAssetBalance(toAddressString(accountC.addr), assetAId);
      const balanceBBefore = await getAssetBalance(toAddressString(accountC.addr), assetBId);
      // eslint-disable-next-line no-console
      console.log('Account C balances before add:', { balanceABefore, balanceBBefore });

      const params = await algod.getTransactionParams().do();
      // eslint-disable-next-line no-console
      console.log('Suggested params:', JSON.stringify(params));

      const addCTx = await clammAddLiquiditySender({
        account: signerC,
        assetA: assetAId,
        assetB: assetBId,
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
        clientBiatecPoolProvider: clientBiatecPoolProvider.appClient,
        algod,
        assetADeposit: assetDepositAForC,
        assetBDeposit: assetDepositBForC,
        assetLp: BigInt(poolTokenId),
      });
      await algosdk.waitForConfirmation(algod, addCTx, 4);
      // eslint-disable-next-line no-console
      console.log('Account C add liquidity txId:', addCTx);
      const balanceAAfterAdd = await getAssetBalance(toAddressString(accountC.addr), assetAId);
      const balanceBAfterAdd = await getAssetBalance(toAddressString(accountC.addr), assetBId);
      const spendA = balanceABefore - balanceAAfterAdd;
      const spendB = balanceBBefore - balanceBAfterAdd;
      // eslint-disable-next-line no-console
      console.log('Account C spend on add:', { spendA, spendB });
      expect(spendA).toEqual(assetDepositAForC);
      expect(spendB).toEqual(assetDepositBForC);

      // LP balance should be > 0 then return to 0 after removal
      const lpInfo = await algod.accountAssetInformation(toAddressString(accountC.addr), Number(poolTokenId)).do();
      const lpHolding = (lpInfo as any)['asset-holding'] ?? lpInfo.assetHolding;
      const lpBalance = BigInt(lpHolding?.amount ?? 0);
      // eslint-disable-next-line no-console
      console.log('Account C LP balance minted:', lpBalance);
      expect(lpBalance).toBeGreaterThan(0n);

      const gsAfterAdd = await clientBiatecClammPoolProvider.appClient.state.global.getAll();
      const liquidityAfter = toBigInt((gsAfterAdd as any).liquidity, 'liquidity');
      const liquidityUsersFromFeesAfter = toBigInt((gsAfterAdd as any).liquidityUsersFromFees ?? 0n, 'liquidityUsersFromFees');
      const reservesAAfter = toBigInt((gsAfterAdd as any).assetABalanceBaseScale, 'assetABalanceBaseScale');
      const reservesBAfter = toBigInt((gsAfterAdd as any).assetBBalanceBaseScale, 'assetBBalanceBaseScale');
      const scaleBig = BigInt(SCALE);
      const lpScaleToBase = BigInt(SCALE / SCALE_LP);
      const lpBalanceBase = lpBalance * lpScaleToBase;
      const distributedLiquidityAfter = toBigInt(
        await clientBiatecClammPoolProvider.appClient.calculateDistributedLiquidity({
          args: {
            assetLp: poolTokenId,
            currentDeposit: 0n,
          },
        }),
        'distributedLiquidityAfter'
      );
      const myPortionScaled = (lpBalanceBase * scaleBig) / distributedLiquidityAfter;
      const expectedFeeLiquidity = (liquidityUsersFromFeesAfter * myPortionScaled) / scaleBig;
      const lpDeltaWithFees = lpBalanceBase + expectedFeeLiquidity;
      const expectedWithdrawABase = (lpDeltaWithFees * reservesAAfter) / liquidityAfter;
      const expectedWithdrawBBase = (lpDeltaWithFees * reservesBAfter) / liquidityAfter;
      const expectedWithdrawA = expectedWithdrawABase / scaleAFromBase;
      const expectedWithdrawB = expectedWithdrawBBase / scaleBFromBase;
      expectedDeltaA = expectedWithdrawA - spendA;
      expectedDeltaB = expectedWithdrawB - spendB;
      // eslint-disable-next-line no-console
      console.log('Expected net return for account C:', {
        expectedWithdrawA,
        expectedWithdrawB,
        expectedDeltaA,
        expectedDeltaB,
      });

      const removeTx = await clammRemoveLiquiditySender({
        account: signerC,
        assetA: assetAId,
        assetB: assetBId,
        assetLp: BigInt(poolTokenId),
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
        algod,
        clientBiatecClammPool: clientBiatecClammPoolProvider.appClient,
        lpToSend: lpBalance,
      });
      await algosdk.waitForConfirmation(algod, removeTx, 4);
      // eslint-disable-next-line no-console
      console.log('Account C remove liquidity txId:', removeTx);
      const balanceAAfterWithdraw = await getAssetBalance(toAddressString(accountC.addr), assetAId);
      const balanceBAfterWithdraw = await getAssetBalance(toAddressString(accountC.addr), assetBId);
      const deltaA = balanceAAfterWithdraw - balanceABefore;
      const deltaB = balanceBAfterWithdraw - balanceBBefore;
      // eslint-disable-next-line no-console
      console.log('Account C balances after withdraw:', {
        balanceABefore,
        balanceBBefore,
        balanceAAfterWithdraw,
        balanceBAfterWithdraw,
        deltaA,
        deltaB,
      });
      const deltaAllowanceA = scaleAFromBase > 0n ? scaleAFromBase / 5n : 0n;
      const deltaAllowanceB = scaleBFromBase > 0n ? scaleBFromBase / 5n : 0n;
      expect(deltaA <= 0n).toBe(true);
      expect(deltaA >= -deltaAllowanceA).toBe(true);
      expect(deltaB <= 0n).toBe(true);
      expect(deltaB >= -deltaAllowanceB).toBe(true);
      const lpInfoAfter = await algod.accountAssetInformation(toAddressString(accountC.addr), Number(poolTokenId)).do();
      const lpHoldingAfter = (lpInfoAfter as any)['asset-holding'] ?? lpInfoAfter.assetHolding;
      const lpBalanceAfter = BigInt(lpHoldingAfter?.amount ?? 0);
      // eslint-disable-next-line no-console
      console.log('Account C LP balance after remove:', lpBalanceAfter);
      expect(lpBalanceAfter).toEqual(0n);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      const msg = String((e as any)?.message ?? e);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || String((e as any)?.cause ?? '').includes('ECONNREFUSED')) {
        // eslint-disable-next-line no-console
        console.error('Network connection to algod failed. Running TCP/debug checks...');
        await debugAlgodConnectivity();
        throw new Error(`${msg} — algod unreachable. Ensure sandbox is running: cd sandbox_ ; docker compose up -d`);
      }
      throw new Error(msg);
    }
  });
});
