import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';
import algosdk from 'algosdk';

interface IBoxReferencePoolByConfigInput {
  appBiatecPoolProvider: number | bigint;
  assetA: number | bigint;
  assetB: number | bigint;
  min: number | bigint;
  max: number | bigint;
  fee: number | bigint;
  verificationClass: number | bigint;
}

const getBoxReferencePoolByConfig = (input: IBoxReferencePoolByConfigInput): BoxReference => {
  const ret: BoxReference = {
    appId: BigInt(input.appBiatecPoolProvider),
    name: new Uint8Array(
      Buffer.concat([
        Buffer.from('pc', 'ascii'),
        algosdk.bigIntToBytes(input.assetA, 8),
        algosdk.bigIntToBytes(input.assetB, 8),
        algosdk.bigIntToBytes(input.min, 8),
        algosdk.bigIntToBytes(input.max, 8),
        algosdk.bigIntToBytes(input.fee, 8),
        algosdk.bigIntToBytes(input.verificationClass, 8),
      ])
    ),
  };

  return ret;
};
export default getBoxReferencePoolByConfig;
