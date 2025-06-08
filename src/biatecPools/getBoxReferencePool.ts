import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';
import algosdk from 'algosdk';

interface IBoxReferencePoolInput {
  appBiatecPoolProvider: number | bigint;
  ammPool: number | bigint;
}

const getBoxReferencePool = (input: IBoxReferencePoolInput): BoxReference => {
  const ret: BoxReference = {
    appId: BigInt(input.appBiatecPoolProvider),
    name: new Uint8Array(Buffer.concat([Buffer.from('p', 'ascii'), algosdk.bigIntToBytes(input.ammPool, 8)])),
  };

  return ret;
};
export default getBoxReferencePool;
