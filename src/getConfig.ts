export type BiatecNetworkConfig = {
  configAppId: bigint;
  identityAppId: bigint;
  poolProviderAppId: bigint;
};

const NETWORK_CONFIGS: Record<string, BiatecNetworkConfig> = {
  'mainnet-v1.0': {
    configAppId: 3074197827n,
    identityAppId: 3074197744n,
    poolProviderAppId: 3074197785n,
  },
  'voimain-v1.0': {
    configAppId: 40133596n,
    identityAppId: 40133594n,
    poolProviderAppId: 40133595n,
  },
  'testnet-v1.0': {
    configAppId: 741107917n,
    identityAppId: 741107914n,
    poolProviderAppId: 741107916n,
  },
};

const normalizeGenesisId = (genesisId: string): string => genesisId.trim().toLowerCase();

export const getConfig = (genesisId: string): BiatecNetworkConfig => {
  const normalized = normalizeGenesisId(genesisId);
  const config = NETWORK_CONFIGS[normalized];
  if (!config) {
    throw new Error(`Unsupported genesis id: ${genesisId}`);
  }
  return { ...config };
};

export default getConfig;
