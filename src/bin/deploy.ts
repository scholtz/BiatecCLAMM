/* eslint-disable no-console */
import algosdk, { assignGroupID, makePaymentTxnWithSuggestedParamsFromObject, Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { BiatecConfigProviderClient, BiatecConfigProviderFactory } from '../../contracts/clients/BiatecConfigProviderClient';
import { BiatecIdentityProviderClient, BiatecIdentityProviderFactory } from '../../contracts/clients/BiatecIdentityProviderClient';
import { BiatecPoolProviderClient, BiatecPoolProviderFactory } from '../../contracts/clients/BiatecPoolProviderClient';
import { BiatecClammPoolFactory } from '../../contracts/clients/BiatecClammPoolClient';

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
  const biatecIdentityProviderFactory = new BiatecIdentityProviderFactory({
    defaultSender: signer.addr,
    defaultSigner: signer.signer,
    algorand,
  });

  const clientBiatecIdentityProvider = await biatecIdentityProviderFactory.send.create.createApplication().catch((e: Error) => {
    console.error(e);
    return undefined;
  });
  if (!clientBiatecIdentityProvider) throw Error('clientBiatecIdentityProvider is empty');

  const biatecPoolProviderFactory = new BiatecPoolProviderFactory({
    defaultSender: signer.addr,
    defaultSigner: signer.signer,
    algorand,
  });

  const clientBiatecPoolProvider = await biatecPoolProviderFactory.send.create.createApplication().catch((e: Error) => {
    console.error(e);
    return undefined;
  });
  if (!clientBiatecPoolProvider) throw Error('clientBiatecPoolProvider is empty');

  const biatecConfigProviderFactory = new BiatecConfigProviderFactory({
    defaultSender: signer.addr,
    defaultSigner: signer.signer,

    algorand,
  });

  const clientBiatecConfigProvider = await biatecConfigProviderFactory.send.create.createApplication().catch((e: Error) => {
    console.error(e);
    return undefined;
  });
  if (!clientBiatecConfigProvider) throw Error('clientBiatecConfigProvider is empty');

  const biatecClammPoolFactoryfactory = new BiatecClammPoolFactory({
    defaultSender: signer.addr,
    defaultSigner: signer.signer,
    algorand,
  });
  console.log('Config/Identity/PP', clientBiatecConfigProvider.appClient.appId, clientBiatecIdentityProvider.appClient.appId, clientBiatecPoolProvider.appClient.appId);
  const { approvalProgram: clammPoolApprovalProgram } = await biatecClammPoolFactoryfactory.appFactory.compile({});
  console.log('sending MBR to config addr');
  await algod
    .sendRawTransaction(
      await signer.signer(
        [
          makePaymentTxnWithSuggestedParamsFromObject({
            amount: 100000,
            receiver: clientBiatecConfigProvider.appClient.appAddress,
            sender: msigAddress.toString(),
            suggestedParams: await algod.getTransactionParams().do(),
          }),
        ],
        [0]
      )
    )
    .do();

  await clientBiatecConfigProvider.appClient.send.bootstrap({
    args: {
      appBiatecIdentityProvider: clientBiatecIdentityProvider.appClient.appId,
      appBiatecPoolProvider: clientBiatecPoolProvider.appClient.appId,
      biatecFee,
    },
    appReferences: [clientBiatecIdentityProvider.appClient.appId, clientBiatecPoolProvider.appClient.appId],
  });
  console.log('sending MBR to identity app addr');
  await algod
    .sendRawTransaction(
      await signer.signer(
        [
          makePaymentTxnWithSuggestedParamsFromObject({
            amount: 100000,
            receiver: clientBiatecIdentityProvider.appClient.appAddress,
            sender: msigAddress.toString(),
            suggestedParams: await algod.getTransactionParams().do(),
          }),
        ],
        [0]
      )
    )
    .do();
  await clientBiatecIdentityProvider.appClient.send.bootstrap({
    args: {
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
      governor: process.env.governor ?? '',
      engagementSetter: process.env.engagement ?? '',
      verificationSetter: process.env.verifier ?? '',
    },
    appReferences: [clientBiatecConfigProvider.appClient.appId],
  });
  console.log('sending MBR to PP app addr');

  await algod
    .sendRawTransaction(
      await signer.signer(
        [
          makePaymentTxnWithSuggestedParamsFromObject({
            amount: 3389500,
            receiver: clientBiatecPoolProvider.appClient.appAddress,
            sender: msigAddress.toString(),
            suggestedParams: await algod.getTransactionParams().do(),
          }),
        ],
        [0]
      )
    )
    .do();
  await clientBiatecPoolProvider.appClient.send.bootstrap({
    args: {
      appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
    },
    appReferences: [clientBiatecConfigProvider.appClient.appId],
  });
  console.log('clammPoolApprovalProgram.length', clammPoolApprovalProgram.length);
  // if (clammPoolApprovalProgram.length > 0)
  //   throw Error(`clammPoolApprovalProgram.length ${clammPoolApprovalProgram.length}`);
  // 8129
  for (let i = 0; i < clammPoolApprovalProgram.length; i += 1024) {
    console.log('deploying clammPoolApprovalProgram', i, i + 1024, clammPoolApprovalProgram.length);

    const tx = await clientBiatecPoolProvider.appClient.createTransaction.loadClammContractData({
      args: {
        appBiatecConfigProvider: clientBiatecConfigProvider.appClient.appId,
        approvalProgramSize: clammPoolApprovalProgram.length,
        data: clammPoolApprovalProgram.subarray(i, i + 1024),
        offset: i,
      },
      appReferences: [clientBiatecConfigProvider.appClient.appId],
      boxReferences: [
        new Uint8Array(Buffer.from('capb1', 'ascii')),
        new Uint8Array(Buffer.from('capb2', 'ascii')),
        new Uint8Array(Buffer.from('capb3', 'ascii')),
        new Uint8Array(Buffer.from('capb4', 'ascii')),
      ],
    });
    const txsToGroup = [
      ...(
        await clientBiatecPoolProvider.appClient.createTransaction.noop({
          args: { _i: 1 },
          boxReferences: [
            new Uint8Array(Buffer.from('11', 'ascii')),
            new Uint8Array(Buffer.from('12', 'ascii')),
            new Uint8Array(Buffer.from('13', 'ascii')),
            new Uint8Array(Buffer.from('14', 'ascii')),
          ],
        })
      ).transactions,
      ...(
        await clientBiatecPoolProvider.appClient.createTransaction.noop({
          args: { _i: 2 },
          boxReferences: [
            new Uint8Array(Buffer.from('21', 'ascii')),
            new Uint8Array(Buffer.from('22', 'ascii')),
            new Uint8Array(Buffer.from('23', 'ascii')),
            new Uint8Array(Buffer.from('24', 'ascii')),
          ],
        })
      ).transactions,
      // ...(
      //   await clientBiatecPoolProvider.appClient.createTransaction.noop({
      //     args: { i: 3 },
      //   })
      // ).transactions,
      ...tx.transactions,
    ];
    const txsToGroupNoGroup = txsToGroup.map((tx: algosdk.Transaction) => {
      tx.group = undefined;
      return tx;
    });
    const txsToGroupGrouped = assignGroupID(txsToGroupNoGroup);
    const signed = await signer.signer(
      txsToGroupGrouped,
      txsToGroupGrouped.map((k, v) => {
        return v;
      })
    );
    const poolDeployTxNetwork = await algod.sendRawTransaction(signed).do();
  }

  // if (!appBiatecConfigProvider) {
  //   await clientBiatecConfigProvider.create.createApplication({});
  //   const ref = await clientBiatecConfigProvider.appClient.getAppReference();
  //   appBiatecConfigProvider = BigInt(ref.appId);
  //   console.log(`Deployed appBiatecConfigProvider: ${appBiatecConfigProvider}`);
  // } else {
  //   console.log(`Using appBiatecConfigProvider: ${appBiatecConfigProvider}`);
  // }
  // if (!appBiatecIdentityProvider) {
  //   await clientBiatecIdentityProvider.create.createApplication({});
  //   const ref = await clientBiatecIdentityProvider.appClient.getAppReference();
  //   appBiatecIdentityProvider = BigInt(ref.appId);
  //   console.log(`Deployed appBiatecIdentityProvider: ${appBiatecIdentityProvider}`);
  // } else {
  //   console.log(`Using appBiatecIdentityProvider: ${appBiatecIdentityProvider}`);
  // }
  // if (!appBiatecPoolProvider) {
  //   await clientBiatecPoolProvider.create.createApplication({});
  //   const ref = await clientBiatecPoolProvider.appClient.getAppReference();
  //   appBiatecPoolProvider = BigInt(ref.appId);
  //   console.log(`Deployed appBiatecPoolProvider: ${appBiatecPoolProvider}`);
  // } else {
  //   console.log(`Using appBiatecPoolProvider: ${appBiatecPoolProvider}`);
  // }
  console.log(`${Date()} Deploy DONE`);
};

app();
