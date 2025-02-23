import { BiatecClammPoolClient, BiatecClammPoolFactory } from '../../contracts/clients/BiatecClammPoolClient';
import { AlgorandClient } from '@algorandfoundation/algokit-utils/types/algorand-client';

interface IGetClientInput {
  appId: bigint;
  algorand: AlgorandClient;
}

const clientBiatecClammPool = (input: IGetClientInput) => {
  return new BiatecClammPoolClient({
    algorand: input.algorand,
    appId: input.appId,
  });
};
export default clientBiatecClammPool;
