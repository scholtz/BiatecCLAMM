import algosdk from 'algosdk';
import { Buffer } from 'buffer';

interface IGetBoxReferenceReservesInput {
  app: number | bigint;
  goldToken: number;
}
const getBoxReferenceReserves = (input: IGetBoxReferenceReservesInput) => {
  const box: algosdk.BoxReference = {
    appIndex: Number(input.app),
    name: new Uint8Array(Buffer.concat([Buffer.from('r'), algosdk.bigIntToBytes(input.goldToken, 8)])), // data box
  };
  return box;
};
export default getBoxReferenceReserves;
