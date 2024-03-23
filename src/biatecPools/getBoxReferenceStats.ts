import algosdk from 'algosdk';

interface IGetBoxReferenceInput {
  appBiatecCLAMMPool: number | bigint;
  appBiatecPoolProvider: number | bigint;
  assetA: number | bigint;
  assetB: number | bigint;
  includingAssetBoxes: boolean;
}

const getBoxReferenceStats = (input: IGetBoxReferenceInput) => {
  const ret = [
    {
      // single lp price feed
      appIndex: Number(input.appBiatecPoolProvider),
      name: new Uint8Array(
        Buffer.concat([Buffer.from('p', 'ascii'), algosdk.bigIntToBytes(input.appBiatecCLAMMPool, 8)])
      ), // data box
    },
    {
      // aggregated price feed
      appIndex: Number(input.appBiatecPoolProvider),
      name: new Uint8Array(
        Buffer.concat([
          Buffer.from('s', 'ascii'),
          algosdk.bigIntToBytes(input.assetA, 8),
          algosdk.bigIntToBytes(input.assetB, 8),
        ])
      ),
    },
  ];
  if (input.includingAssetBoxes) {
    ret.push({
      appIndex: Number(input.appBiatecPoolProvider),
      name: new Uint8Array(Buffer.concat([Buffer.from('a', 'ascii'), algosdk.bigIntToBytes(input.assetA, 8)])), // data box
    });
    ret.push({
      appIndex: Number(input.appBiatecPoolProvider),
      name: new Uint8Array(Buffer.concat([Buffer.from('a', 'ascii'), algosdk.bigIntToBytes(input.assetB, 8)])), // data box
    });
  }
  return ret;
};
export default getBoxReferenceStats;
