import { Algodv2 } from 'algosdk';
import { SendTransactionFrom } from '@algorandfoundation/algokit-utils/types/transaction';
import { BiatecClammPoolClient } from '../../contracts/clients/BiatecClammPoolClient';

interface IGetClientInput {
  appId: number | bigint;
  account: SendTransactionFrom | undefined;
  algod: Algodv2;
}

const clientBiatecClammPool = (input: IGetClientInput) => {
  return new BiatecClammPoolClient(
    {
      sender: input.account,
      resolveBy: 'id',
      id: input.appId,
    },
    input.algod
  );
};
export default clientBiatecClammPool;
