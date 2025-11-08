import { describe, test, expect } from '@jest/globals';
import { setupPool, deployer, SCALE, algokit, assetAId, assetBId, fixture, setAssetAId, algosdk } from './shared-setup';
import type { BiatecClammPoolClient } from '../../contracts/clients/BiatecClammPoolClient';

type DistributeInput = {
  algod: algosdk.Algodv2;
  poolClient: { appClient: BiatecClammPoolClient };
  configAppId: bigint;
  assetA: bigint;
  assetB: bigint;
  amountA: bigint;
  amountB: bigint;
  errorCode: string;
};

const getPoolErrorMessage = async (error: any, algod: algosdk.Algodv2) => {
  const message = error?.response?.body?.message ?? error?.message ?? '';
  const explicitTxId = error?.response?.body?.data?.txid ?? error?.response?.body?.txid;
  const txIdMatch = message.match(/transaction ([A-Z0-9]+):/);
  const txId = explicitTxId ?? txIdMatch?.[1];

  if (!txId) {
    return message;
  }

  try {
    const pending = await algod.pendingTransactionInformation(txId).do();
    const poolError = (pending as any)['pool-error'];
    if (typeof poolError === 'string' && poolError.length > 0) {
      return poolError;
    }
    return message;
  } catch (lookupError) {
    const fallback = lookupError instanceof Error ? lookupError.message : String(lookupError);
    return `${message} | pendingTxError=${fallback}`;
  }
};

const ERROR_FRAGMENTS: Record<string, string[]> = {
  E_A_B: ['pc=1495'],
  E_B_B: ['pc=1495'],
  E_A0_B: ['pc=1469'],
  E_B0_B: ['pc=1469'],
};

const expectLogicError = async (send: () => Promise<unknown>, algod: algosdk.Algodv2, errorCode: string) => {
  try {
    await send();
    throw new Error(`Expected ${errorCode} failure`);
  } catch (error: any) {
    const detailedMessage = await getPoolErrorMessage(error, algod);
    const fragments = ERROR_FRAGMENTS[errorCode] ?? [errorCode];
    const matched = fragments.some((fragment) => detailedMessage.includes(fragment));
    if (!matched) {
      throw new Error(`Unexpected error message for ${errorCode}: ${detailedMessage}`);
    }
  }
};

const sendDistributeExpectingFailure = async ({ algod, poolClient, configAppId, assetA, assetB, amountA, amountB, errorCode }: DistributeInput) => {
  const appId = configAppId;
  const uniqueAssetRefs = Array.from(new Set([assetA, assetB].filter((id) => id !== 0n)));
  const { transactions } = await poolClient.appClient.createTransaction.distributeExcessAssets({
    args: {
      appBiatecConfigProvider: appId,
      assetA,
      assetB,
      amountA,
      amountB,
    },
    sender: deployer.addr,
    staticFee: algokit.microAlgos(12_000),
    appReferences: [appId],
    assetReferences: uniqueAssetRefs,
  });
  const signed = transactions.map((txn) => txn.signTxn(deployer.sk));
  await expectLogicError(() => algod.sendRawTransaction(signed).do(), algod, errorCode);
};

describe('BiatecClammPool - balance guards', () => {
  test('emits E_A_B when recorded ASA balanceA exceeds holdings', async () => {
    const { algod, clientBiatecClammPoolProvider, clientBiatecConfigProvider } = await setupPool({
      assetA: 1n,
      biatecFee: 0n,
      lpFee: BigInt(SCALE / 100),
      p: BigInt(SCALE),
      p1: BigInt(SCALE),
      p2: BigInt(SCALE),
    });

    const currentAssetA = assetAId;
    const currentAssetB = assetBId;
    await sendDistributeExpectingFailure({
      algod,
      poolClient: clientBiatecClammPoolProvider,
      configAppId: BigInt(clientBiatecConfigProvider.appClient.appId),
      assetA: currentAssetA,
      assetB: currentAssetB,
      amountA: 10n * BigInt(SCALE),
      amountB: 0n,
      errorCode: 'E_A_B',
    });
  });

  test('emits E_B_B when recorded ASA balanceB exceeds holdings', async () => {
    const { algod, clientBiatecClammPoolProvider, clientBiatecConfigProvider } = await setupPool({
      assetA: 1n,
      biatecFee: 0n,
      lpFee: BigInt(SCALE / 100),
      p: BigInt(SCALE),
      p1: BigInt(SCALE),
      p2: BigInt(SCALE),
    });

    const currentAssetA = assetAId;
    const currentAssetB = assetBId;
    await sendDistributeExpectingFailure({
      algod,
      poolClient: clientBiatecClammPoolProvider,
      configAppId: BigInt(clientBiatecConfigProvider.appClient.appId),
      assetA: currentAssetA,
      assetB: currentAssetB,
      amountA: 0n,
      amountB: 10n * BigInt(SCALE),
      errorCode: 'E_B_B',
    });
  });

  test('emits E_A0_B when recorded ALGO balanceA exceeds holdings', async () => {
    await setAssetAId(0n);
    const { algod } = fixture.context;
    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider } = await setupPool({
      algod,
      assetA: 0n,
      assetB: 0n,
      biatecFee: 0n,
      lpFee: BigInt(SCALE / 100),
      p: BigInt(SCALE),
      p1: BigInt(SCALE),
      p2: BigInt(SCALE),
      useProvidedAssets: true,
    });

    const params = await algod.getTransactionParams().do();
    const fundingTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: 2_000_000,
      receiver: clientBiatecClammPoolProvider.appClient.appAddress,
      sender: deployer.addr,
      suggestedParams: params,
    });
    const fundingTxId = fundingTxn.txID();
    const signedFunding = algosdk.signTransaction(fundingTxn, deployer.sk);
    await algod.sendRawTransaction(signedFunding.blob).do();
    await algosdk.waitForConfirmation(algod, fundingTxId, 4);

    await sendDistributeExpectingFailure({
      algod,
      poolClient: clientBiatecClammPoolProvider,
      configAppId: BigInt(clientBiatecConfigProvider.appClient.appId),
      assetA: 0n,
      assetB: 0n,
      amountA: 10n * BigInt(SCALE),
      amountB: 0n,
      errorCode: 'E_A0_B',
    });
  });

  test('emits E_B0_B when recorded ALGO balanceB exceeds holdings', async () => {
    await setAssetAId(0n);
    const { algod } = fixture.context;
    const { clientBiatecClammPoolProvider, clientBiatecConfigProvider } = await setupPool({
      algod,
      assetA: 0n,
      assetB: 0n,
      biatecFee: 0n,
      lpFee: BigInt(SCALE / 100),
      p: BigInt(SCALE),
      p1: BigInt(SCALE),
      p2: BigInt(SCALE),
      useProvidedAssets: true,
    });

    const params = await algod.getTransactionParams().do();
    const fundingTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: 2_000_000,
      receiver: clientBiatecClammPoolProvider.appClient.appAddress,
      sender: deployer.addr,
      suggestedParams: params,
    });
    const fundingTxId = fundingTxn.txID();
    const signedFunding = algosdk.signTransaction(fundingTxn, deployer.sk);
    await algod.sendRawTransaction(signedFunding.blob).do();
    await algosdk.waitForConfirmation(algod, fundingTxId, 4);

    await sendDistributeExpectingFailure({
      algod,
      poolClient: clientBiatecClammPoolProvider,
      configAppId: BigInt(clientBiatecConfigProvider.appClient.appId),
      assetA: 0n,
      assetB: 0n,
      amountA: 0n,
      amountB: 10n * BigInt(SCALE),
      errorCode: 'E_B0_B',
    });
  });
});
