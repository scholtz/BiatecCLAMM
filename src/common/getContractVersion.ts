import fs from 'fs';

// Matches the 'BIATEC-<NAME>-XX-XX-XX' version literal TEALScript embeds as a byte constant
// (see e.g. `const version = 'BIATEC-CLAMM-01-06-07';` in contracts/BiatecClammPool.algo.ts).
const VERSION_PATTERN = /"(BIATEC-[A-Z]+-\d{2}-\d{2}-\d{2})"/;

/**
 * Reads the deployed version string directly out of a freshly built approval program, instead of relying on a
 * value hand-copied into a deploy/upgrade script (which silently goes stale whenever the contract's `version`
 * constant is bumped without also updating every script that references it).
 *
 * @param approvalTealPath path to a *.approval.teal file produced by `npm run build` / `npm run compile-contract`
 */
const getContractVersion = (approvalTealPath: string): string => {
  const teal = fs.readFileSync(approvalTealPath, 'utf-8');
  const match = teal.match(VERSION_PATTERN);
  if (!match) {
    throw new Error(`Could not find a BIATEC-* version string in ${approvalTealPath}. Rebuild the contracts with 'npm run build' first.`);
  }
  return match[1];
};
export default getContractVersion;
