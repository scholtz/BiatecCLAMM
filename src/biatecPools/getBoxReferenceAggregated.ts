import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';
import algosdk from 'algosdk';

interface IBoxReferenceAggregatedInput {
  appBiatecPoolProvider: number | bigint;
  assetA: number | bigint;
  assetB: number | bigint;
}

const getBoxReferenceAggregated = (input: IBoxReferenceAggregatedInput): BoxReference => {
  const ret: BoxReference = {
    appId: BigInt(input.appBiatecPoolProvider),
    name: new Uint8Array(
      Buffer.concat([
        Buffer.from('s', 'ascii'),
        algosdk.bigIntToBytes(input.assetA, 8),
        algosdk.bigIntToBytes(input.assetB, 8),
      ])
    ),
  };

  return ret;
};
export default getBoxReferenceAggregated;
