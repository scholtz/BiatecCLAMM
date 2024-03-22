import algosdk from 'algosdk';

interface IGetBoxReferenceInput {
  appBiatecCLAMMPool: number | bigint;
  appBiatecPoolProvider: number | bigint;
  assetA: number | bigint;
  assetB: number | bigint;
}

const getBoxReferenceStats = (input: IGetBoxReferenceInput) => {
  return [
    {
      appIndex: Number(input.appBiatecPoolProvider),
      name: new Uint8Array(
        Buffer.concat([Buffer.from('p', 'ascii'), algosdk.bigIntToBytes(input.appBiatecCLAMMPool, 8)])
      ), // data box
    },
    {
      appIndex: Number(input.appBiatecPoolProvider),
      name: new Uint8Array(Buffer.concat([Buffer.from('a', 'ascii'), algosdk.bigIntToBytes(input.assetA, 8)])), // data box
    },
    {
      appIndex: Number(input.appBiatecPoolProvider),
      name: new Uint8Array(Buffer.concat([Buffer.from('a', 'ascii'), algosdk.bigIntToBytes(input.assetB, 8)])), // data box
    },
  ];
};
export default getBoxReferenceStats;
