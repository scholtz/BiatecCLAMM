import algosdk from 'algosdk';
import { BiatecPoolProviderClient, FullConfig } from '../../contracts/clients/BiatecPoolProviderClient';

interface IGetPoolsInput {
  assetId: bigint;
  verificationClass?: bigint;
  fee?: bigint;
  clientPoolProvider: BiatecPoolProviderClient;
}

function uint8ArrayToBigInt(bytes: Uint8Array) {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return Number(result);
}
const getPools = async (input: IGetPoolsInput): Promise<FullConfig[]> => {
  var ret: FullConfig[] = [];
  const keys = await input.clientPoolProvider.algorand.client.algod
    .getApplicationBoxes(input.clientPoolProvider.appId)
    .do();
  // const keys = await input.clientPoolProvider.algorand.client.indexer
  //   .searchForApplicationBoxes(input.clientPoolProvider.appId)
  //   .do();
  console.log('keys', keys);
  for (const box of keys.boxes) {
    if (box.name) {
      if (box.name.length == 59) {
        if (Buffer.from(box.name.subarray(0, 2)).toString('ascii') == 'pl') {
          // its pool config

          // type FullConfig = {
          //   appId: uint64;
          //   assetA: uint64;
          //   assetB: uint64;
          //   min: uint64;
          //   max: uint64;
          //   fee: uint64;
          //   verificationClass: uint64;
          // };
          const appId = BigInt(algosdk.decodeUint64(box.name.subarray(2, 10)));
          const lpToken = BigInt(algosdk.decodeUint64(box.name.subarray(10, 18)));
          const assetA = BigInt(algosdk.decodeUint64(box.name.subarray(18, 26)));
          const assetB = BigInt(algosdk.decodeUint64(box.name.subarray(26, 34)));
          const min = BigInt(algosdk.decodeUint64(box.name.subarray(34, 42)));
          const max = BigInt(algosdk.decodeUint64(box.name.subarray(42, 50)));
          const fee = BigInt(algosdk.decodeUint64(box.name.subarray(50, 58)));
          const verificationClass = uint8ArrayToBigInt(box.name.subarray(58, 59));

          ret.push({
            appId: appId,
            lpToken: lpToken,
            assetA: assetA,
            assetB: assetB,
            fee: fee,
            max: max,
            min: min,
            verificationClass: verificationClass,
          });
        }
      }
    }
  }

  // console.log('configs', configs);
  // const configs = await input.clientPoolProvider.state.box.poolsByConfig.getMap();
  // for (let config of configs.keys()) {
  //   if (input.assetId != config.assetA && input.assetId != config.assetB) {
  //     continue;
  //   }
  //   if (input.verificationClass !== undefined && input.verificationClass != config.verificationClass) {
  //     continue;
  //   }
  //   if (input.fee !== undefined && input.fee != config.fee) {
  //     continue;
  //   }
  //   ret.push(config);
  // }
  console.log('ret', ret);
  return ret;
};
export default getPools;
