import algosdk, { assignGroupID, makePaymentTxnWithSuggestedParamsFromObject, SuggestedParams } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { BiatecPoolProviderClient } from '../../../contracts/clients/BiatecPoolProviderClient';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';

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
  } = input;
  const poolDeployTx = await clientBiatecPoolProvider.createTransaction.deployPool({
    args: {
      fee: fee,
      assetA: BigInt(assetA),
      assetB: BigInt(assetB),
      verificationClass: verificationClass,
      appBiatecPoolProvider: BigInt(clientBiatecPoolProvider.appId),
      priceMin: priceMin,
      priceMax: priceMax,
      currentPrice: currentPrice,
      appBiatecConfigProvider: BigInt(appBiatecConfigProvider),
      txSeed: makePaymentTxnWithSuggestedParamsFromObject({
        amount: 1_500_000,
        receiver: clientBiatecPoolProvider.appClient.appAddress,
        sender: sender,
        suggestedParams: params,
      }),
    },
    sender: sender,
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
  //expect(poolDeployTx.return).toBeGreaterThan(0n);
  var signed: Uint8Array[] = [];
  const boxRefA: BoxReference = {
    appId: clientBiatecPoolProvider.appId,
    name: new Uint8Array([...Buffer.from('a', 'ascii'), ...algosdk.encodeUint64(assetA)]),
  };
  const boxRefB: BoxReference = {
    appId: clientBiatecPoolProvider.appId,
    name: new Uint8Array([...Buffer.from('b', 'ascii'), ...algosdk.encodeUint64(assetB)]),
  };
  const txsToGroup = [
    ...(
      await clientBiatecPoolProvider.createTransaction.noop({
        args: { i: 1 },
        boxReferences: [
          boxRefA,
          boxRefB,
          new Uint8Array(Buffer.from('13', 'ascii')),
          new Uint8Array(Buffer.from('14', 'ascii')),
        ],
        sender: sender,
      })
    ).transactions,
    ...(
      await clientBiatecPoolProvider.createTransaction.noop({
        args: { i: 2 },
        boxReferences: [
          new Uint8Array(Buffer.from('21', 'ascii')),
          new Uint8Array(Buffer.from('22', 'ascii')),
          new Uint8Array(Buffer.from('23', 'ascii')),
          new Uint8Array(Buffer.from('24', 'ascii')),
        ],
        sender: sender,
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
