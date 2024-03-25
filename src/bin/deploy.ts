/* eslint-disable no-console */
import algosdk, { Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecConfigProviderClient } from '../../contracts/clients/BiatecConfigProviderClient';
import { BiatecIdentityProviderClient } from '../../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient } from '../../contracts/clients/BiatecPoolProviderClient';

const algod = new algosdk.Algodv2(
  process.env.algodToken ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  process.env.algodHost ?? 'http://localhost',
  process.env.algodPort ?? '4001'
);
let appBiatecConfigProvider = BigInt(process.env.appBiatecConfigProvider ?? '0');
let appBiatecIdentityProvider = BigInt(process.env.appBiatecIdentityProvider ?? '0');
let appBiatecPoolProvider = BigInt(process.env.appBiatecPoolProvider ?? '0');
const x = JSON.stringify(JSON.parse(process.env.deployerMsigParams ?? ''));
console.log('x', x);
const deployerMsigParams: algosdk.MultisigMetadata = JSON.parse(x);
console.log('deployerMsigParams.addrs', deployerMsigParams.addrs);
const signers: algosdk.Account[] = [];
if (process.env.signer1) {
  signers.push(algosdk.mnemonicToSecretKey(process.env.signer1));
}
if (process.env.signer2) {
  signers.push(algosdk.mnemonicToSecretKey(process.env.signer2));
}
if (process.env.signer3) {
  signers.push(algosdk.mnemonicToSecretKey(process.env.signer3));
}
if (process.env.signer4) {
  signers.push(algosdk.mnemonicToSecretKey(process.env.signer4));
}
if (process.env.signer5) {
  signers.push(algosdk.mnemonicToSecretKey(process.env.signer5));
}

const signer: TransactionSignerAccount = {
  addr: process.env.deployerAddr ?? '',
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

const app = async () => {
  console.log(`${Date()} App started - Deployer: ${signer.addr}`);

  const biatecFee = BigInt(200_000_000);
  const clientBiatecIdentityProvider = new BiatecIdentityProviderClient(
    {
      sender: signer,
      resolveBy: 'id',
      id: Number(appBiatecIdentityProvider),
    },
    algod
  );
  const clientBiatecPoolProvider = new BiatecPoolProviderClient(
    {
      sender: signer,
      resolveBy: 'id',
      id: Number(appBiatecPoolProvider),
    },
    algod
  );
  const clientBiatecConfigProvider = new BiatecConfigProviderClient(
    {
      sender: signer,
      resolveBy: 'id',
      id: Number(appBiatecConfigProvider),
    },
    algod
  );

  if (!appBiatecConfigProvider) {
    await clientBiatecConfigProvider.create.createApplication({});
    const ref = await clientBiatecConfigProvider.appClient.getAppReference();
    appBiatecConfigProvider = BigInt(ref.appId);
    console.log(`Deployed appBiatecConfigProvider: ${appBiatecConfigProvider}`);
  } else {
    console.log(`Using appBiatecConfigProvider: ${appBiatecConfigProvider}`);
  }
  if (!appBiatecIdentityProvider) {
    await clientBiatecIdentityProvider.create.createApplication({});
    const ref = await clientBiatecIdentityProvider.appClient.getAppReference();
    appBiatecIdentityProvider = BigInt(ref.appId);
    console.log(`Deployed appBiatecIdentityProvider: ${appBiatecIdentityProvider}`);
  } else {
    console.log(`Using appBiatecIdentityProvider: ${appBiatecIdentityProvider}`);
  }
  if (!appBiatecPoolProvider) {
    await clientBiatecPoolProvider.create.createApplication({});
    const ref = await clientBiatecPoolProvider.appClient.getAppReference();
    appBiatecPoolProvider = BigInt(ref.appId);
    console.log(`Deployed appBiatecPoolProvider: ${appBiatecPoolProvider}`);
  } else {
    console.log(`Using appBiatecPoolProvider: ${appBiatecPoolProvider}`);
  }
  await clientBiatecConfigProvider.bootstrap({ appBiatecIdentityProvider, appBiatecPoolProvider, biatecFee });
  await clientBiatecIdentityProvider.bootstrap({ appBiatecConfigProvider });
  await clientBiatecPoolProvider.bootstrap({ appBiatecConfigProvider });
};

app();
