import { TransactionSigner, Address } from 'algosdk';
import { BiatecClammPoolClient, BiatecClammPoolFactory } from '../../contracts/clients/BiatecClammPoolClient';
import { AlgorandClient } from '@algorandfoundation/algokit-utils/types/algorand-client';

interface IGetClientInput {
  appId: bigint;
  algorand: AlgorandClient;
  defaultSender: string | Address | undefined;
  defaultSigner: TransactionSigner | undefined;
}

const clientBiatecClammPool = (input: IGetClientInput) => {
  return new BiatecClammPoolClient({
    algorand: input.algorand,
    appId: input.appId,
    defaultSender: input.defaultSender,
    defaultSigner: input.defaultSigner,
  });
};
export default clientBiatecClammPool;
