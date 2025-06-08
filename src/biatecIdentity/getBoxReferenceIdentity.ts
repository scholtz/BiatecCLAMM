import { BoxReference } from '@algorandfoundation/algokit-utils/types/app-manager';
import algosdk, { Address } from 'algosdk';

interface IBoxReferencePoolByConfigInput {
  appBiatecIdentity: number | bigint;
  address: Address;
}

const getBoxReferenceIdentity = (input: IBoxReferencePoolByConfigInput): BoxReference => {
  const ret: BoxReference = {
    appId: BigInt(input.appBiatecIdentity),
    name: new Uint8Array(Buffer.concat([Buffer.from('i', 'ascii'), input.address.publicKey])),
  };

  return ret;
};
export default getBoxReferenceIdentity;
