/* eslint-disable no-console */
import algosdk, { Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgorandClient, microAlgo, microAlgos } from '@algorandfoundation/algokit-utils';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { BiatecClammPoolClient, getPools } from '../../dist';

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
      // console.log('deployerMsigParams', deployerMsigParams);
      let msigObject = algosdk.createMultisigTransaction(tx, deployerMsigParams);
      // console.log('msigObject', msigObject);
      // eslint-disable-next-line no-restricted-syntax, no-shadow
      for (const signer of signers) {
        console.log(`signing ${tx.txID()} from ${signer.addr}`);
        msigObject = algosdk.appendSignMultisigTransaction(msigObject, deployerMsigParams, signer.sk).blob;
      }
      // console.log('decoded', algosdk.decodeSignedTransaction(msigObject).msig);
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
const app = async () => {
  console.log(`${Date()} App started - Deployer: ${signer.addr}`);
  const t = true;
  if (t) {
    // return;
  }

  const appBiatecConfigProvider = BigInt(process.env.appBiatecConfigProvider ?? '0');
  const appBiatecPoolProvider = BigInt(process.env.appBiatecPoolProvider ?? '0');

  const pools = await getPools({ algod: algorand.client.algod, assetId: 0n, poolProviderAppId: appBiatecPoolProvider });
  console.log(`Found ${pools.length} pools`);

  const distributionTrhreshold = {
    '0': 1,
    '452399768': 100,
  } as { [key: string]: number };
  const decimals = {
    '0': 6,
    '452399768': 6,
  } as { [key: string]: number };

  for (const pool of pools) {
    console.log(`checking pool`, pool.appId);

    // wait 100 ms in start of the loop to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));

    const appBiatecClammPool = pool.appId;

    if (!appBiatecConfigProvider) {
      throw new Error('Please set appBiatecConfigProvider env variables');
    }
    if (!appBiatecClammPool) {
      throw new Error('Please set appBiatecClammPool env variables');
    }

    const poolClient = new BiatecClammPoolClient({
      appId: appBiatecClammPool,
      algorand,
      defaultSender: signer.addr,
      defaultSigner: signer.signer,
    });

    const assetA = await poolClient.state.global.assetA();
    const assetB = await poolClient.state.global.assetB();
    const assetLp = await poolClient.state.global.assetLp();
    const status = await poolClient.status({
      args: {
        appBiatecConfigProvider,
        assetA: assetA ?? 0n,
        assetB: assetB ?? 0n,
        assetLp: assetLp ?? 0n,
      },
    });

    let aBalanceData = Number(status.assetABalance) / 1_000_000_000;
    let aBalanceReal = Number(status.realABalance) / Math.pow(10, decimals[status.assetA?.toString()] ?? 6);

    let bBalanceData = Number(status.assetBBalance) / 1_000_000_000;
    let bBalanceReal = Number(status.realBBalance) / Math.pow(10, decimals[status.assetB?.toString()] ?? 6);

    let doRebalance = false;
    const extraTokensA = aBalanceReal - aBalanceData;
    //console.log('extraTokens', extraTokensA, 'tokenA', status.assetA, 'threshold', distributionTrhreshold[status.assetA?.toString()]);
    if (distributionTrhreshold[status.assetA?.toString()] !== undefined) {
      if (extraTokensA > distributionTrhreshold[status.assetA?.toString()]) {
        doRebalance = true;
      }
    }
    const extraTokensB = bBalanceReal - bBalanceData;
    //console.log('extraTokens', extraTokensB, 'tokenB', status.assetB, 'threshold', distributionTrhreshold[status.assetB?.toString()]);
    if (distributionTrhreshold[status.assetB?.toString()] !== undefined) {
      if (extraTokensB > distributionTrhreshold[status.assetB?.toString()]) {
        doRebalance = true;
      }
    }

    if (doRebalance) {
      console.log(`extra ${status.assetA?.toString()} in assetA: ${extraTokensA}`);
      console.log(`extra ${status.assetB?.toString()} in assetB: ${extraTokensB}`);
      console.log('going to rebalance pool ', appBiatecClammPool);
      await poolClient.send.distributeExcessAssets({
        args: {
          appBiatecConfigProvider,
          amountA: 1n,
          amountB: 1n,
          assetA: assetA ?? 0n,
          assetB: assetB ?? 0n,
        },
        staticFee: AlgoAmount.MicroAlgos(3000),
      });
    }
  }
};

app();
