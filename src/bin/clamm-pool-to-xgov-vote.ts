/* eslint-disable no-console */
import algosdk, { Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgorandClient, microAlgo, microAlgos } from '@algorandfoundation/algokit-utils';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { BiatecClammPoolClient } from '../../dist';

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
  const appBiatecClammPool = BigInt(process.env.appBiatecClammPool ?? '0');

  if (!appBiatecConfigProvider) {
    throw new Error('Please set appBiatecConfigProvider env variables');
  }
  if (!appBiatecClammPool) {
    throw new Error('Please set appBiatecClammPool env variables');
  }
  console.log(`registering pool ${appBiatecClammPool} to xGov`);

  const pool = new BiatecClammPoolClient({
    appId: appBiatecClammPool,
    algorand,
    defaultSender: signer.addr,
    defaultSigner: signer.signer,
  });

  const address = 'RT5KAKAZZS7IPGTDXKP27LS7I2M5VBX336YA3VP4UKEDS2UVOWHPTKR5QE';
  // watch address at biatec wallet. for example 3FXLX4X6WP3NVGOXXZDIFKO6HSPV25EV6AZ6H2T66WUID3PIH4AAXH5IXE
  // then connect with this address to xgov portal and signup at https://xgov.algorand.co/profile/3FXLX4X6WP3NVGOXXZDIFKO6HSPV25EV6AZ6H2T66WUID3PIH4AAXH5IXE
  // then copy tx content here to signUpTxs variable
  const signUpTxs = [
    'jKRhcGFhlcQEFY+N1sQIAAAAAMj9MgXEIIz6oCgZzL6HmmO6n6+uX0aZ2ob737AN1fyiiDlqlXWOxAgAAAAAAAAAeMQIAAAAAAAAAACkYXBhdJHEIIz6oCgZzL6HmmO6n6+uX0aZ2ob737AN1fyiiDlqlXWOpGFwYniSgaFuxCF4jPqgKBnMvoeaY7qfr65fRpnahvvfsA3V/KKIOWqVdY6CoWkBoW7EIVaM+qAoGcy+h5pjup+vrl9GmdqG+9+wDdX8oog5apV1jqRhcGZhkc7I/TIFpGFwaWTOu590kqNmZWXNB9CiZnbOA298HqNnZW6sbWFpbm5ldC12MS4womdoxCDAYcTY/B293tLXYEvkVo4/bQQZh6w3veS2ILWrOSSK36Jsds4Db3yWo3NuZMQgjPqgKBnMvoeaY7qfr65fRpnahvvfsA3V/KKIOWqVdY6kdHlwZaRhcHBs',
  ];

  const decodedTxs = signUpTxs.map((s) => Buffer.from(s, 'base64'));
  const decodedAlgoTxs = decodedTxs.map((dt) => algosdk.decodeUnsignedTransaction(dt));
  console.log('args', {
    appBiatecConfigProvider,
    accounts: decodedAlgoTxs[0].applicationCall?.accounts.map((a) => a.toString()) ?? [],
    appArgs: decodedAlgoTxs[0].applicationCall?.appArgs?.map((a) => a) ?? [],
    appCallParams: {
      applicationId: decodedAlgoTxs[0].applicationCall?.appIndex ?? 0n,
      fee: decodedAlgoTxs[0].fee,
      note: Buffer.from('').toString('utf-8'),
      payAmount: 1n,
      payToAddress: algosdk.decodeAddress(address).publicKey,
    },
    apps: decodedAlgoTxs[0].applicationCall?.foreignApps?.map((a) => a) ?? [],
    assets: decodedAlgoTxs[0].applicationCall?.foreignAssets?.map((a) => a) ?? [],
  });
  await pool.send.doAppCall({
    args: {
      appBiatecConfigProvider,
      accounts: decodedAlgoTxs[0].applicationCall?.accounts.map((a) => a.toString()) ?? [],
      appArgs: decodedAlgoTxs[0].applicationCall?.appArgs?.map((a) => a) ?? [],
      appCallParams: {
        applicationId: decodedAlgoTxs[0].applicationCall?.appIndex ?? 0n,
        fee: decodedAlgoTxs[0].fee,
        note: Buffer.from('').toString('utf-8'),
        payAmount: 1n,
        payToAddress: algosdk.decodeAddress(address).publicKey,
      },
      apps: decodedAlgoTxs[0].applicationCall?.foreignApps?.map((a) => a) ?? [],
      assets: decodedAlgoTxs[0].applicationCall?.foreignAssets?.map((a) => a) ?? [],
    },
    accountReferences: [address],
    appReferences: [appBiatecClammPool, decodedAlgoTxs[0].applicationCall?.appIndex ?? 0n],
    staticFee: AlgoAmount.MicroAlgo(3_000),
  });

  console.log(`${Date()} Deploy DONE`);
};

app();
