import algosdk from 'algosdk';
import buildArc14AuthHeader from './buildArc14AuthHeader';

interface GetAssetPriceUSDInput {
  algod: algosdk.Algodv2;
  /** Base URL of the Biatec Trade Reporter API (AVM Trade Reporter), e.g. https://api.algorand.scan.biatec.io */
  baseUrl: string;
  assetId: bigint;
  /** Any account able to sign; the ARC-14 transaction is never submitted on chain. */
  authAccount: algosdk.Account;
}

/**
 * Fetches the current USD price of an asset from the Biatec Trade Reporter API:
 * GET {baseUrl}/api/asset-stat/{assetId} -> AssetStat.priceUSD
 *
 * @returns priceUSD, or undefined if the API has no price recorded for this asset
 */
const getAssetPriceUSD = async ({ algod, baseUrl, assetId, authAccount }: GetAssetPriceUSDInput): Promise<number | undefined> => {
  const suggestedParams = await algod.getTransactionParams().do();
  const authorization = buildArc14AuthHeader(authAccount, suggestedParams);
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/asset-stat/${assetId.toString()}`, {
    headers: { Authorization: authorization },
  });
  if (!res.ok) {
    throw new Error(`Biatec Trade Reporter API returned HTTP ${res.status} for asset ${assetId}`);
  }
  const data = (await res.json()) as { priceUSD?: number | null };
  return data.priceUSD ?? undefined;
};
export default getAssetPriceUSD;
