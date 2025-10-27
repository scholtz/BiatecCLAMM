import algosdk, { assignGroupID, makePaymentTxnWithSuggestedParamsFromObject, SuggestedParams } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';
import { BiatecPoolProviderClient } from '../../../contracts/clients/BiatecPoolProviderClient';

interface IClammBootstrapTxsInput {
  params: SuggestedParams;
  clientBiatecPoolProvider: BiatecPoolProviderClient;
  sender: string;

  appBiatecConfigProvider: bigint;
  assetA: bigint;
  assetB: bigint;
  fee: bigint;
  verificationClass: number;
  priceMin: bigint;
  priceMax: bigint;
  currentPrice: bigint;
  nativeTokenName?: string | Uint8Array; // Optional: defaults to 'ALGO' if not provided
}
/**
 * This method creates list of transactions to be signed to add liquidity to the concentrated liquidity amm
 * @returns List of transactions to sign
 */
const clammCreateTxs = async (input: IClammBootstrapTxsInput): Promise<algosdk.Transaction[]> => {
  const {
    params,
    clientBiatecPoolProvider,
    assetA,
    assetB,
    fee,
    verificationClass,
    priceMin,
    priceMax,
    currentPrice,
    sender,
    appBiatecConfigProvider,
    nativeTokenName = 'ALGO', // Default to 'ALGO' if not provided
  } = input;

  // Some older callers still pass bytes here; default back to 'ALGO' unless we get a real string.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let nativeTokenNameStr = 'ALGO';
  if (typeof nativeTokenName === 'string' && nativeTokenName.trim().length > 0) {
    nativeTokenNameStr = nativeTokenName.trim();
  } else if (nativeTokenName instanceof Uint8Array && nativeTokenName.length > 0) {
    const decoded = decoder.decode(nativeTokenName).trim();
    if (decoded.length > 0) nativeTokenNameStr = decoded;
  }
  const nativeTokenNameBytes = encoder.encode(nativeTokenNameStr);
  // eslint-disable-next-line no-console
  console.log('clammCreateTxs nativeTokenName', nativeTokenNameStr, nativeTokenNameBytes);

  const poolDeployTx = await clientBiatecPoolProvider.createTransaction.deployPool({
    args: {
      fee,
      assetA: BigInt(assetA),
      assetB: BigInt(assetB),
      verificationClass,
      appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appId),
      priceMin,
      priceMax,
      currentPrice,
      appBiatecConfigProvider: BigInt(appBiatecConfigProvider),
      nativeTokenName: nativeTokenNameBytes,
      txSeed: makePaymentTxnWithSuggestedParamsFromObject({
        amount: 5_000_000,
        receiver: clientBiatecPoolProvider.appClient.appAddress,
        sender,
        suggestedParams: params,
      }),
    },
    sender,
    staticFee: AlgoAmount.MicroAlgos(10000),
    boxReferences: [
      new Uint8Array(Buffer.from('capb1', 'ascii')),
      new Uint8Array(Buffer.from('capb2', 'ascii')),
      new Uint8Array(Buffer.from('capb3', 'ascii')),
      new Uint8Array(Buffer.from('capb4', 'ascii')),
    ],
    assetReferences: [assetA, assetB],
    appReferences: [clientBiatecPoolProvider.appId, appBiatecConfigProvider],
  });
  // expect(poolDeployTx.return).toBeGreaterThan(0n);
  const signed: Uint8Array[] = [];
  const boxRefA: BoxReference = {
    appId: clientBiatecPoolProvider.appId,
    name: new Uint8Array([...Buffer.from('a', 'ascii'), ...algosdk.encodeUint64(assetA)]),
  };
  const boxRefB: BoxReference = {
    appId: clientBiatecPoolProvider.appId,
    name: new Uint8Array([...Buffer.from('b', 'ascii'), ...algosdk.encodeUint64(assetB)]),
  };

  // When assetA equals assetB, we only need one box reference
  const boxReferences = assetA === assetB ? [boxRefA] : [boxRefA, boxRefB];

  const txsToGroup = [
    ...(
      await clientBiatecPoolProvider.createTransaction.noop({
        args: { i: 1 },
        boxReferences: [...boxReferences, new Uint8Array(Buffer.from('13', 'ascii')), new Uint8Array(Buffer.from('14', 'ascii'))],
        sender,
      })
    ).transactions,
    ...(
      await clientBiatecPoolProvider.createTransaction.noop({
        args: { i: 2 },
        boxReferences: [new Uint8Array(Buffer.from('21', 'ascii')), new Uint8Array(Buffer.from('22', 'ascii')), new Uint8Array(Buffer.from('23', 'ascii')), new Uint8Array(Buffer.from('24', 'ascii'))],
        sender,
      })
    ).transactions,
    ...poolDeployTx.transactions,
  ];
  const txsToGroupNoGroup = txsToGroup.map((tx: algosdk.Transaction) => {
    tx.group = undefined;
    return tx;
  });
  const txsToGroupNoGrouped = assignGroupID(txsToGroupNoGroup);
  return txsToGroupNoGrouped;
};
export default clammCreateTxs;
