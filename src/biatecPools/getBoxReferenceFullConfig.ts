import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';
import algosdk from 'algosdk';

interface IBoxReferenceFullConfigInput {
  appBiatecPoolProvider: number | bigint;
  ammPool: number | bigint;
  assetA: number | bigint;
  assetB: number | bigint;
  min: number | bigint;
  max: number | bigint;
  fee: number | bigint;
  lpTokenId: number | bigint;
  verificationClass: number | bigint;
}

const getBoxReferenceFullConfig = (input: IBoxReferenceFullConfigInput): BoxReference => {
  const ret: BoxReference = {
    appId: BigInt(input.appBiatecPoolProvider),
    name: new Uint8Array(
      Buffer.concat([
        Buffer.from('fc', 'ascii'),
        algosdk.bigIntToBytes(input.ammPool, 8),
        algosdk.bigIntToBytes(input.assetA, 8),
        algosdk.bigIntToBytes(input.assetB, 8),
        algosdk.bigIntToBytes(input.min, 8),
        algosdk.bigIntToBytes(input.max, 8),
        algosdk.bigIntToBytes(input.fee, 8),
        algosdk.bigIntToBytes(input.lpTokenId, 8),
        algosdk.bigIntToBytes(input.verificationClass, 1),
      ])
    ),
  };

  return ret;
};
export default getBoxReferenceFullConfig;
