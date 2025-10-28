import algosdk, { Algodv2 } from 'algosdk';
import { FullConfig } from '../../contracts/clients/BiatecPoolProviderClient';

interface IGetPoolsInput {
  assetId: bigint;
  verificationClass?: bigint;
  fee?: bigint;
  poolProviderAppId: number | bigint;
  algod: Algodv2;
}
function uint8ArrayToBigInt(bytes: Uint8Array) {
  let result = 0n;
  for (let i = 0; i < bytes.length; i += 1) {
    result = result * 256n + BigInt(bytes[i]);
  }
  return Number(result);
}
const getPools = async (input: IGetPoolsInput): Promise<FullConfig[]> => {
  const ret: FullConfig[] = [];
  const keys = await input.algod.getApplicationBoxes(input.poolProviderAppId).do();
  keys.boxes.forEach((box) => {
    if (box.name) {
      if (box.name.length === 59) {
        if (Buffer.from(box.name.subarray(0, 2)).toString('ascii') === 'fc') {
          // its pool config

          // type FullConfig = {
          // appId: uint64; // app id of the pool
          // assetA: uint64;
          // assetB: uint64;
          // min: uint64;
          // max: uint64;
          // fee: uint64;
          // lpTokenId: uint64; // LP token id
          // verificationClass: uint8;
          // };
          const appId = BigInt(algosdk.decodeUint64(box.name.subarray(2, 10)));
          const assetA = BigInt(algosdk.decodeUint64(box.name.subarray(10, 18)));
          const assetB = BigInt(algosdk.decodeUint64(box.name.subarray(18, 26)));
          const min = BigInt(algosdk.decodeUint64(box.name.subarray(26, 34)));
          const max = BigInt(algosdk.decodeUint64(box.name.subarray(34, 42)));
          const fee = BigInt(algosdk.decodeUint64(box.name.subarray(42, 50)));
          const lpTokenId = BigInt(algosdk.decodeUint64(box.name.subarray(50, 58)));
          const verificationClass = uint8ArrayToBigInt(box.name.subarray(58, 59));

          ret.push({
            appId,
            assetA,
            assetB,
            fee,
            max,
            min,
            lpTokenId,
            verificationClass,
          });
        }
      }
    }
  });
  return ret;
};
export default getPools;
