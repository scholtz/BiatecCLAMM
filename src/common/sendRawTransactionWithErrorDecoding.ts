import algosdk from 'algosdk';
import { AppClient } from '@algorandfoundation/algokit-utils/types/app-client';

/**
 * Sends signed transactions to algod. On failure the error is passed through the
 * app client's ARC56 source info, so callers receive the human readable assert
 * message (e.g. 'Minimum to receive is not met') instead of the raw
 * 'logic eval error: assert failed pc=...' string.
 *
 * @returns txid of the first transaction in the submitted group
 */
const sendRawTransactionWithErrorDecoding = async (algod: algosdk.Algodv2, signed: Uint8Array | Uint8Array[], appClient: AppClient): Promise<string> => {
  try {
    const { txid } = await algod.sendRawTransaction(signed).do();
    return txid;
  } catch (e) {
    throw await appClient.exposeLogicError(e as Error);
  }
};
export default sendRawTransactionWithErrorDecoding;
