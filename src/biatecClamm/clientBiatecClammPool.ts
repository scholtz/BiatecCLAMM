import { AlgorandClient } from '@algorandfoundation/algokit-utils/types/algorand-client';
import { BiatecClammPoolClient } from '../../contracts/clients/BiatecClammPoolClient';

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
