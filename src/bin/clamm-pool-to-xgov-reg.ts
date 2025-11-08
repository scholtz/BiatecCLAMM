/* eslint-disable no-console */
import algosdk, { Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgorandClient, microAlgo, microAlgos } from '@algorandfoundation/algokit-utils';
import { BiatecClammPoolClient } from '../../dist';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';

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
    'iqNhbXTOAJiWgKNmZWXNA+iiZnbOA0zFYaNnZW6sbWFpbm5ldC12MS4womdoxCDAYcTY/B293tLXYEvkVo4/bQQZh6w3veS2ILWrOSSK36NncnDEIFCde6VFDcaFY/mpQc0+5t1qvD/75tExl2yJRUW2d7Poomx2zgNMyUmjcmN2xCA0f0fh6qin8iMFAZCcT2tZ85VtsWWDdufyuAAtOe28JqNzbmTEIIz6oCgZzL6HmmO6n6+uX0aZ2ob737AN1fyiiDlqlXWOpHR5cGWjcGF5',
    'i6RhcGFhksQEoILO+MQgjPqgKBnMvoeaY7qfr65fRpnahvvfsA3V/KKIOWqVdY6kYXBieJGBoW7EIXiM+qAoGcy+h5pjup+vrl9GmdqG+9+wDdX8oog5apV1jqRhcGlkzrufdJKjZmVlzQPoomZ2zgNMxWGjZ2VurG1haW5uZXQtdjEuMKJnaMQgwGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit+jZ3JwxCBQnXulRQ3GhWP5qUHNPubdarw/++bRMZdsiUVFtnez6KJsds4DTMXZo3NuZMQgjPqgKBnMvoeaY7qfr65fRpnahvvfsA3V/KKIOWqVdY6kdHlwZaRhcHBs',
  ];

  const decodedTxs = signUpTxs.map((s) => Buffer.from(s, 'base64'));
  const decodedAlgoTxs = decodedTxs.map((dt) => algosdk.decodeUnsignedTransaction(dt));
  console.log('args', {
    appBiatecConfigProvider,
    accounts: decodedAlgoTxs[1].applicationCall?.accounts.map((a) => a.toString()) ?? [],
    appArgs: decodedAlgoTxs[1].applicationCall?.appArgs?.map((a) => a) ?? [],
    appCallParams: {
      applicationId: decodedAlgoTxs[1].applicationCall?.appIndex ?? 0n,
      fee: decodedAlgoTxs[1].fee,
      note: Buffer.from(decodedAlgoTxs[1].note).toString('utf-8'),
      payAmount: decodedAlgoTxs[0].payment?.amount ?? 0n,
      payToAddress: decodedAlgoTxs[0].payment?.receiver.publicKey ?? algosdk.decodeAddress(address).publicKey,
    },
    apps: decodedAlgoTxs[1].applicationCall?.foreignApps?.map((a) => a) ?? [],
    assets: decodedAlgoTxs[1].applicationCall?.foreignAssets?.map((a) => a) ?? [],
  });
  await pool.send.doAppCall({
    args: {
      appBiatecConfigProvider,
      accounts: decodedAlgoTxs[1].applicationCall?.accounts.map((a) => a.toString()) ?? [],
      appArgs: decodedAlgoTxs[1].applicationCall?.appArgs?.map((a) => a) ?? [],
      appCallParams: {
        applicationId: decodedAlgoTxs[1].applicationCall?.appIndex ?? 0n,
        fee: decodedAlgoTxs[1].fee,
        note: Buffer.from(decodedAlgoTxs[1].note).toString('utf-8'),
        payAmount: decodedAlgoTxs[0].payment?.amount ?? 0n,
        payToAddress: decodedAlgoTxs[0].payment?.receiver.publicKey ?? algosdk.decodeAddress(address).publicKey,
      },
      apps: decodedAlgoTxs[1].applicationCall?.foreignApps?.map((a) => a) ?? [],
      assets: decodedAlgoTxs[1].applicationCall?.foreignAssets?.map((a) => a) ?? [],
    },
    accountReferences: [address],
    appReferences: [appBiatecClammPool, decodedAlgoTxs[1].applicationCall?.appIndex ?? 0n],
    staticFee: AlgoAmount.MicroAlgo(3_000),
  });

  console.log(`${Date()} Deploy DONE`);
};

app();
