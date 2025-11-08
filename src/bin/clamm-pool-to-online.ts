/* eslint-disable no-console */
import algosdk, { assignGroupID, makePaymentTxnWithSuggestedParamsFromObject, Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { BiatecConfigProviderClient, BiatecConfigProviderFactory } from '../../contracts/clients/BiatecConfigProviderClient';
import { BiatecIdentityProviderClient, BiatecIdentityProviderFactory } from '../../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient, BiatecPoolProviderFactory } from '../../contracts/clients/BiatecPoolProviderClient';
import { BiatecClammPoolFactory } from '../../contracts/clients/BiatecClammPoolClient';
import { BiatecClammPoolClient } from '../../dist';

const biatecFee = BigInt(200_000_000);

const algod = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  process.env.ALGOD_SERVER ?? 'http://localhost',
  parseInt(process.env.ALGOD_PORT ?? '4001', 10)
);
const appBiatecConfigProvider = BigInt(process.env.appBiatecConfigProvider ?? '0');
const appBiatecIdentityProvider = BigInt(process.env.appBiatecIdentityProvider ?? '0');
const appBiatecPoolProvider = BigInt(process.env.appBiatecPoolProvider ?? '0');
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
  console.log(`making pool ${appBiatecClammPool} online`);

  const pool = new BiatecClammPoolClient({
    appId: appBiatecClammPool,
    algorand,
    defaultSender: signer.addr,
    defaultSigner: signer.signer,
  });

  // first find the app address .. for 3131562667 is 3FXLX4X6WP3NVGOXXZDIFKO6HSPV25EV6AZ6H2T66WUID3PIH4AAXH5IXE
  // then issue the participation key: ADDRESS=3FXLX4X6WP3NVGOXXZDIFKO6HSPV25EV6AZ6H2T66WUID3PIH4AAXH5IXE ROUNDS=16777215 ./create-participation-key.sh
  const participatiDetails = `Participation ID:          YIOBBK3PKPPJ7PBNMKVRHSO3NDGLGHOJDP2UQUOCBEAMZES7L6MQ
Parent address:            3FXLX4X6WP3NVGOXXZDIFKO6HSPV25EV6AZ6H2T66WUID3PIH4AAXH5IXE
Last vote round:           N/A
Last block proposal round: N/A
Effective first round:     N/A
Effective last round:      N/A
First round:               55313050
Last round:                72090265
Key dilution:              4096
Selection key:             lpYZ4kaeEk7uBeLEAE2LODRs7wc7dgs4dOUEwMLuO9k=
Voting key:                7PXBeZ+naNB83w8FVKJKDRYDwTkVhyI8VEH1pNCHAuM=
State proof key:           nyeiJ/5V3tq2QeW2bIt+aiMITIlwLW9LoURoIs9/ySvmuoDfbYMXR39wZ04MBpnXvdgPsg6gzFPHReXK8pHs1A==`;

  // Parse participatiDetails
  const parseDetail = (label: string) => {
    const match = participatiDetails.match(new RegExp(`${label}:\\s+(.+)`));
    return match ? match[1].trim() : '';
  };

  const voteFirst = BigInt(parseDetail('First round'));
  const voteLast = BigInt(parseDetail('Last round'));
  const voteKeyDilution = BigInt(parseDetail('Key dilution'));
  const selectionPk = Buffer.from(parseDetail('Selection key'), 'base64');
  const votePk = Buffer.from(parseDetail('Voting key'), 'base64');
  const stateProofPk = Buffer.from(parseDetail('State proof key'), 'base64');
  const fee = 2000000; // or set as needed

  await pool.send.sendOnlineKeyRegistration({
    args: {
      appBiatecConfigProvider,
      selectionPk,
      stateProofPk,
      voteFirst,
      voteLast,
      voteKeyDilution,
      votePk,
      fee,
    },
  });

  console.log(`${Date()} Deploy DONE`);
};

app();
