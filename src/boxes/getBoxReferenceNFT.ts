import algosdk from 'algosdk';
import { Buffer } from 'buffer';

interface IGetBoxReferenceNFTInput {
  app: number | bigint;
  nftAsset: number;
}
const getBoxReferenceNFT = (input: IGetBoxReferenceNFTInput) => {
  const box: algosdk.BoxReference = {
    appIndex: Number(input.app),
    name: new Uint8Array(Buffer.concat([Buffer.from('d'), algosdk.bigIntToBytes(input.nftAsset, 8)])), // data box
  };
  return box;
};
export default getBoxReferenceNFT;
