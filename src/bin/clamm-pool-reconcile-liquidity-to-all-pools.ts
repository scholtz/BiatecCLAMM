/* eslint-disable no-console */
import algosdk, { Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { BiatecClammPoolClient, getPools } from '../../dist';
import isReconcileLiquiditySupported from '../common/isReconcileLiquiditySupported';

// Same constants used by scripts/survey-orphaned-liquidity.ts to compute LP tokens distributed to holders.
const TOTAL_LP_SUPPLY = 18_000_000_000_000_000_000n;
const LP_SCALE = 1000n;

const signers: algosdk.Account[] = [];
const accounts: string[] = [];
if (process.env.signer1) {
  if (algosdk.isValidAddress(process.env.signer1)) {
    accounts.push(process.env.signer1);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer1);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}
if (process.env.signer2) {
  if (algosdk.isValidAddress(process.env.signer2)) {
    accounts.push(process.env.signer2);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer2);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}

if (process.env.signer3) {
  if (algosdk.isValidAddress(process.env.signer3)) {
    accounts.push(process.env.signer3);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer3);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}
if (process.env.signer4) {
  if (algosdk.isValidAddress(process.env.signer4)) {
    accounts.push(process.env.signer4);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer4);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}
if (process.env.signer5) {
  if (algosdk.isValidAddress(process.env.signer5)) {
    accounts.push(process.env.signer5);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer5);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}
const deployerMsigParams: algosdk.MultisigMetadata = {
  addrs: accounts,
  threshold: parseInt(process.env.msigThreshold ?? '3', 10),
  version: 1,
};

const msigAddress = algosdk.multisigAddress(deployerMsigParams);
console.log('msigAddress', msigAddress.toString());

const signer: TransactionSignerAccount = {
  addr: msigAddress,
  // eslint-disable-next-line no-unused-vars
  signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
    return txnGroup.map((tx) => {
      let msigObject = algosdk.createMultisigTransaction(tx, deployerMsigParams);
      // eslint-disable-next-line no-restricted-syntax, no-shadow
      for (const signer of signers) {
        console.log(`signing ${tx.txID()} from ${signer.addr}`);
        msigObject = algosdk.appendSignMultisigTransaction(msigObject, deployerMsigParams, signer.sk).blob;
      }
      return msigObject;
    });
  },
};
const algorand = AlgorandClient.fromConfig({
  algodConfig: {
    server: process.env.ALGOD_SERVER ?? '',
    port: parseInt(process.env.ALGOD_PORT ?? '443', 10),
    token: process.env.ALGOD_TOKEN ?? '',
  },
  indexerConfig: {
    server: process.env.INDEXER_SERVER ?? '',
    port: parseInt(process.env.INDEXER_PORT ?? '443', 10),
    token: process.env.INDEXER_TOKEN ?? '',
  },
});
const dryRun = process.env.dryRun === 'true' || process.env.dryRun === '1';

const app = async () => {
  console.log(`${Date()} App started - Deployer: ${signer.addr}${dryRun ? ' (DRY RUN)' : ''}`);

  const appBiatecConfigProvider = BigInt(process.env.appBiatecConfigProvider ?? '0');
  const appBiatecPoolProvider = BigInt(process.env.appBiatecPoolProvider ?? '0');

  if (!appBiatecConfigProvider) {
    throw new Error('Please set appBiatecConfigProvider env variable');
  }
  if (!appBiatecPoolProvider) {
    throw new Error('Please set appBiatecPoolProvider env variable');
  }

  const pools = await getPools({ algod: algorand.client.algod, assetId: 0n, poolProviderAppId: appBiatecPoolProvider });
  console.log(`Found ${pools.length} pools`);

  for (const pool of pools) {
    console.log(`checking pool`, pool.appId);

    // wait 100 ms in start of the loop to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));

    const appBiatecClammPool = pool.appId;

    const poolClient = new BiatecClammPoolClient({
      appId: appBiatecClammPool,
      algorand,
      defaultSender: signer.addr,
      defaultSigner: signer.signer,
    });

    const globalState = await poolClient.state.global.getAll();
    const assetA = globalState.assetA;
    const assetB = globalState.assetB;
    const assetLp = globalState.assetLp;
    const liquidity = globalState.liquidity ?? 0n;
    const liquidityUsersFromFees = globalState.liquidityUsersFromFees ?? 0n;
    const liquidityBiatecFromFees = globalState.liquidityBiatecFromFees ?? 0n;
    const scver = globalState.version?.asString();

    if (!assetLp) {
      console.log(`pool ${appBiatecClammPool} has no assetLp set yet, skipping`);
      continue;
    }

    if (!isReconcileLiquiditySupported(scver)) {
      console.log(`pool ${appBiatecClammPool} is on version ${scver ?? 'unknown'}, which does not implement reconcileLiquidity yet - upgrade the pool first, skipping`);
      continue;
    }

    let lpInPool = 0n;
    try {
      const holding = await algorand.client.algod.accountAssetInformation(algosdk.getApplicationAddress(appBiatecClammPool), Number(assetLp)).do();
      lpInPool = BigInt(holding.assetHolding?.amount ?? 0n);
    } catch {
      lpInPool = 0n;
    }
    const distributed = (TOTAL_LP_SUPPLY - lpInPool) * LP_SCALE;
    const unowned = liquidity - distributed - liquidityUsersFromFees - liquidityBiatecFromFees;

    if (unowned <= 0n) {
      console.log(`pool ${appBiatecClammPool} does not need reconciliation`);
      continue;
    }
    console.log(`pool ${appBiatecClammPool} has unowned liquidity (base scale): ${unowned}, reconciling`);

    if (dryRun) {
      console.log(`pool ${appBiatecClammPool} dry run - would credit ${unowned} (base scale) to ${distributed > 0n ? 'LiquidityUsersFromFees' : 'LiquidityBiatecFromFees'}, skipping actual call`);
      continue;
    }

    try {
      const ret = await poolClient.send.reconcileLiquidity({
        args: {
          appBiatecConfigProvider,
          assetA: assetA ?? 0n,
          assetB: assetB ?? 0n,
          assetLp: assetLp ?? 0n,
        },
        staticFee: AlgoAmount.MicroAlgos(3000),
      });
      const credited = ret.return ?? 0n;
      console.log(`pool ${appBiatecClammPool} reconciled, liquidity credited (base scale): ${credited}`);
    } catch (e) {
      console.error(`failed to reconcile pool ${appBiatecClammPool}`, e);
    }
  }
};

app();
