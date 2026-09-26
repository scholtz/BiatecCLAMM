/* eslint-disable no-console, no-restricted-syntax, no-await-in-loop */
/**
 * Lists every pool registered in the Biatec pool provider and reports liquidity which is owned by nobody:
 *   unowned = Liquidity - distributedLp - LiquidityUsersFromFees - LiquidityBiatecFromFees
 *
 * Pools deployed with BIATEC-CLAMM-01-06-04 or earlier could accumulate such liquidity in addLiquidity
 * (see docusaurus/docs/liquidity-fee-protection.md). Positive values are recovered with reconcileLiquidity
 * after the pool is upgraded to BIATEC-CLAMM-01-06-05 or later.
 *
 * Usage: ALGOD_SERVER=https://mainnet-api.algonode.cloud ALGOD_PORT=443 ALGOD_TOKEN= appBiatecPoolProvider=3074197785 \
 *        npx ts-node scripts/survey-orphaned-liquidity.ts
 */
import algosdk from 'algosdk';
import getPools from '../src/biatecClamm/getPools';

const TOTAL_LP_SUPPLY = 18_000_000_000_000_000_000n;
const LP_SCALE = 1000n;

const algod = new algosdk.Algodv2(process.env.ALGOD_TOKEN ?? '', process.env.ALGOD_SERVER ?? 'https://mainnet-api.algonode.cloud', process.env.ALGOD_PORT ?? 443);
const poolProviderAppId = BigInt(process.env.appBiatecPoolProvider ?? '3074197785');

const u256 = (bytes: Uint8Array) => BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`);

(async () => {
  const pools = await getPools({ algod, poolProviderAppId, assetId: 0n });
  console.log(`appId,version,assetA,assetB,L,distributedLp,Lu,Lb,unowned,unownedPct`);
  let total = 0;
  for (const pool of pools) {
    const app = await algod.getApplicationByID(pool.appId).do();
    const gs: Record<string, bigint | string> = {};
    for (const kv of app.params?.globalState ?? []) {
      const key = Buffer.from(kv.key).toString();
      if (kv.value.type === 2) gs[key] = BigInt(kv.value.uint);
      else gs[key] = kv.value.bytes.length === 32 && key !== 'scver' ? u256(kv.value.bytes) : Buffer.from(kv.value.bytes).toString();
    }
    const address = algosdk.getApplicationAddress(pool.appId).toString();
    let lpInPool = 0n;
    try {
      const holding = await algod.accountAssetInformation(address, pool.lpTokenId).do();
      lpInPool = BigInt(holding.assetHolding?.amount ?? 0n);
    } catch {
      lpInPool = 0n;
    }
    const distributed = (TOTAL_LP_SUPPLY - lpInPool) * LP_SCALE;
    const L = (gs.L as bigint) ?? 0n;
    const Lu = (gs.Lu as bigint) ?? 0n;
    const Lb = (gs.Lb as bigint) ?? 0n;
    const unowned = L - distributed - Lu - Lb;
    if (unowned > 0n) total += 1;
    const pct = L > 0n ? Number((unowned * 10000n) / L) / 100 : 0;
    console.log(`${pool.appId},${gs.scver},${pool.assetA},${pool.assetB},${L},${distributed},${Lu},${Lb},${unowned},${pct}`);
  }
  console.log(`pools: ${pools.length}, pools with unowned liquidity: ${total}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
