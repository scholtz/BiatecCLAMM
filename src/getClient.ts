import { Algodv2 } from 'algosdk';
import { SendTransactionFrom } from '@algorandfoundation/algokit-utils/types/transaction';
import { BiatecClammClient } from '../contracts/clients/BiatecCLAMMClient';

interface IGetClientInput {
  appId: number | bigint;
  sender: SendTransactionFrom | undefined;
  algod: Algodv2;
}

const getClient = (input: IGetClientInput) => {
  return new BiatecClammClient(
    {
      sender: input.sender,
      resolveBy: 'id',
      id: input.appId,
    },
    input.algod
  );
};
export default getClient;
