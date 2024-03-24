export interface ICustomOnlineKeyRegParams {
  votePK: Uint8Array;
  selectionPK: Uint8Array;
  stateProofPK: Uint8Array;
  voteFirst: number | bigint;
  voteLast: number | bigint;
  voteKeyDilution: number | bigint;
}
