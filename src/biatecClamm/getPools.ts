import algosdk from 'algosdk';
import { BiatecPoolProviderClient, PoolConfig } from '../../contracts/clients/BiatecPoolProviderClient';

interface IGetPoolsInput {
  assetId: bigint;
  verificationClass?: bigint;
  fee?: bigint;
  clientPoolProvider: BiatecPoolProviderClient;
}
const getPools = async (input: IGetPoolsInput): Promise<PoolConfig[]> => {
  var ret: PoolConfig[] = [];
  const keys = await input.clientPoolProvider.algorand.client.algod
    .getApplicationBoxes(input.clientPoolProvider.appId)
    .do();
  // const keys = await input.clientPoolProvider.algorand.client.indexer
  //   .searchForApplicationBoxes(input.clientPoolProvider.appId)
  //   .do();
  console.log('keys', keys);
  for (const box of keys.boxes) {
    if (box.name) {
      if (box.name.length == 58) {
        if (Buffer.from(box.name.subarray(0, 2)).toString('ascii') == 'pc') {
          // its pool config

          // type PoolConfig = {
          //   appId: uint64;
          //   assetA: uint64;
          //   assetB: uint64;
          //   min: uint64;
          //   max: uint64;
          //   fee: uint64;
          //   verificationClass: uint64;
          // };
          const appId = BigInt(algosdk.decodeUint64(box.name.subarray(2, 10)));
          const assetA = BigInt(algosdk.decodeUint64(box.name.subarray(10, 18)));
          const assetB = BigInt(algosdk.decodeUint64(box.name.subarray(18, 26)));
          const min = BigInt(algosdk.decodeUint64(box.name.subarray(26, 34)));
          const max = BigInt(algosdk.decodeUint64(box.name.subarray(34, 42)));
          const fee = BigInt(algosdk.decodeUint64(box.name.subarray(42, 50)));
          const verificationClass = BigInt(algosdk.decodeUint64(box.name.subarray(50, 58)));

          ret.push({
            appId: appId,
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
