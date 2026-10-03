import crypto from 'crypto';
import fs from 'fs';
import algosdk from 'algosdk';

const sha256Hex = (bytes: Uint8Array): string => crypto.createHash('sha256').update(bytes).digest('hex');

/**
 * Reads the compiled approval program bytecode from an ARC-56 artifact (no recompilation) and returns it with its sha256.
 * Log it before sending the update so the signers can compare it with the hash verified after deploy.
 */
export const loadApprovalFromArc56 = (arc56Path: string) => {
  const spec = JSON.parse(fs.readFileSync(arc56Path, 'utf-8'));
  const base64: string | undefined = spec.byteCode?.approval;
  if (!base64) {
    throw new Error(`No byteCode.approval found in ${arc56Path}. Build the contracts first.`);
  }
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  return { bytes, sha256: sha256Hex(bytes) };
};

/** Loads the application from the blockchain and returns the sha256 of its on-chain approval program. */
export const getOnChainApprovalSha256 = async (algod: algosdk.Algodv2, appId: bigint): Promise<string> => {
  const app = await algod.getApplicationByID(appId).do();
  return sha256Hex(new Uint8Array(app.params!.approvalProgram));
};

/** Checks the on-chain approval program of the app equals the expected one. Throws on mismatch. */
export const verifyDeployedApproval = async (algod: algosdk.Algodv2, appId: bigint, expected: { sha256: string }) => {
  const onChainSha256 = await getOnChainApprovalSha256(algod, appId);
  if (onChainSha256 !== expected.sha256) {
    throw new Error(`App ${appId} approval program sha256 mismatch after deploy: expected ${expected.sha256}, on chain ${onChainSha256}`);
  }
  console.log(`App ${appId} verified: on-chain approval program sha256 ${onChainSha256} matches the expected one`);
  return onChainSha256;
};
