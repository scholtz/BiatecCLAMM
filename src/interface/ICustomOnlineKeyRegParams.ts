export interface ICustomOnlineKeyRegParams {
  votePk: Uint8Array;
  selectionPk: Uint8Array;
  stateProofPk: Uint8Array;
  voteFirst: number | bigint;
  voteLast: number | bigint;
  voteKeyDilution: number | bigint;
}
