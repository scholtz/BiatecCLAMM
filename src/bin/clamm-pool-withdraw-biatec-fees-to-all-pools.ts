/* eslint-disable no-console */
import algosdk, { Transaction } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { BiatecClammPoolClient, BiatecPoolProviderClient, getPools } from '../../dist';
import clammAddLiquiditySender from '../biatecClamm/sender/clammAddLiquiditySender';
import calculateFeeWithdrawal from '../common/calculateFeeWithdrawal';
import ensureOptedIn from '../common/ensureOptedIn';
import executeRouterSwap from '../common/executeRouterSwap';
import getAssetPriceUSD from '../common/getAssetPriceUSD';
import parseExcludedSwapAssetIds from '../common/parseExcludedSwapAssetIds';
import pickNarrowestPool, { CandidatePool } from '../common/pickNarrowestPool';

// Below this USD valuation of the combined asset A + asset B biatec fee share, the withdrawal is skipped
// (the withdrawal transaction fee would not be worth it). Override with env var minWithdrawUsd.
const DEFAULT_MIN_WITHDRAW_USD = 1;

// Slippage tolerance applied to router quotes to derive an on-chain-enforced receiveMinimum. Override with env
// var routerSlippageBps (100 = 1%).
const DEFAULT_ROUTER_SLIPPAGE_BPS = 100;

const signers: algosdk.Account[] = [];
const accounts: string[] = [];
if (process.env.signer1) {
  if (algosdk.isValidAddress(process.env.signer1)) {
    accounts.push(process.env.signer1);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer1);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}
if (process.env.signer2) {
  if (algosdk.isValidAddress(process.env.signer2)) {
    accounts.push(process.env.signer2);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer2);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}

if (process.env.signer3) {
  if (algosdk.isValidAddress(process.env.signer3)) {
    accounts.push(process.env.signer3);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer3);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}
if (process.env.signer4) {
  if (algosdk.isValidAddress(process.env.signer4)) {
    accounts.push(process.env.signer4);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer4);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}
if (process.env.signer5) {
  if (algosdk.isValidAddress(process.env.signer5)) {
    accounts.push(process.env.signer5);
  } else {
    const acc = algosdk.mnemonicToSecretKey(process.env.signer5);
    signers.push(acc);
    accounts.push(acc.addr.toString());
  }
}
const deployerMsigParams: algosdk.MultisigMetadata = {
  addrs: accounts,
  threshold: parseInt(process.env.msigThreshold ?? '3', 10),
  version: 1,
};

const msigAddress = algosdk.multisigAddress(deployerMsigParams);
console.log('msigAddress', msigAddress.toString());

const signer: TransactionSignerAccount = {
  addr: msigAddress,
  // eslint-disable-next-line no-unused-vars
  signer: async (txnGroup: Transaction[], indexesToSign: number[]) => {
    return txnGroup.map((tx) => {
      let msigObject = algosdk.createMultisigTransaction(tx, deployerMsigParams);
      // eslint-disable-next-line no-restricted-syntax, no-shadow
      for (const signer of signers) {
        console.log(`signing ${tx.txID()} from ${signer.addr}`);
        msigObject = algosdk.appendSignMultisigTransaction(msigObject, deployerMsigParams, signer.sk).blob;
      }
      return msigObject;
    });
  },
};
const algorand = AlgorandClient.fromConfig({
  algodConfig: {
    server: process.env.ALGOD_SERVER ?? '',
    port: parseInt(process.env.ALGOD_PORT ?? '443', 10),
    token: process.env.ALGOD_TOKEN ?? '',
  },
  indexerConfig: {
    server: process.env.INDEXER_SERVER ?? '',
    port: parseInt(process.env.INDEXER_PORT ?? '443', 10),
    token: process.env.INDEXER_TOKEN ?? '',
  },
});
const dryRun = process.env.dryRun === 'true' || process.env.dryRun === '1';
const minWithdrawUsd = process.env.minWithdrawUsd ? Number(process.env.minWithdrawUsd) : DEFAULT_MIN_WITHDRAW_USD;

// Account used only to sign the (never submitted) ARC-14 auth transaction required by the Biatec Trade Reporter
// API - it does not need funds and is not the transaction sender for any on-chain call.
const priceApiAuthAccount = algosdk.generateAccount();

interface AssetInfo {
  decimals: number;
  unitName: string;
}
const assetInfoCache = new Map<string, AssetInfo>();
const getAssetInfo = async (assetId: bigint): Promise<AssetInfo> => {
  const key = assetId.toString();
  const cached = assetInfoCache.get(key);
  if (cached) return cached;
  let info: AssetInfo;
  if (assetId === 0n) {
    info = { decimals: 6, unitName: 'ALGO' };
  } else {
    const { params } = await algorand.client.algod.getAssetByID(assetId).do();
    if (!params) {
      throw new Error(`Could not fetch asset params for asset ${key}`);
    }
    info = { decimals: params.decimals, unitName: params.unitName ?? key };
  }
  assetInfoCache.set(key, info);
  return info;
};

const priceCache = new Map<string, number | undefined>();
const getCachedAssetPriceUSD = async (baseUrl: string, assetId: bigint): Promise<number | undefined> => {
  const key = assetId.toString();
  if (priceCache.has(key)) return priceCache.get(key);
  const price = await getAssetPriceUSD({ algod: algorand.client.algod, baseUrl, assetId, authAccount: priceApiAuthAccount });
  priceCache.set(key, price);
  return price;
};

const getAssetBalance = async (assetId: bigint): Promise<bigint> => {
  if (assetId === 0n) {
    const info = await algorand.client.algod.accountInformation(signer.addr).do();
    return info.amount;
  }
  try {
    const holding = await algorand.client.algod.accountAssetInformation(signer.addr, Number(assetId)).do();
    return holding.assetHolding?.amount ?? 0n;
  } catch {
    return 0n;
  }
};

interface PoolSummaryRow {
  appId: bigint;
  assetASymbol: string;
  assetAAmount: number;
  assetBSymbol: string;
  assetBAmount: number;
  usdValue: number;
  status: 'withdrawn' | 'skipped-below-threshold' | 'skipped-no-fees' | 'dry-run';
}

const app = async () => {
  console.log(`${Date()} App started - Deployer: ${signer.addr}${dryRun ? ' (DRY RUN)' : ''}`);

  const appBiatecConfigProvider = BigInt(process.env.appBiatecConfigProvider ?? '0');
  const appBiatecIdentityProvider = BigInt(process.env.appBiatecIdentityProvider ?? '0');
  const appBiatecPoolProvider = BigInt(process.env.appBiatecPoolProvider ?? '0');
  const tradeReporterApi = process.env.BIATEC_TRADE_REPORTER_API;
  const routerApi = process.env.BIATEC_ROUTER_API;
  const voteAssetId = process.env.voteAssetId ? BigInt(process.env.voteAssetId) : undefined;
  const goldAssetId = process.env.goldAssetId ? BigInt(process.env.goldAssetId) : undefined;
  const routerSlippageBps = process.env.routerSlippageBps ? Number(process.env.routerSlippageBps) : DEFAULT_ROUTER_SLIPPAGE_BPS;
  const excludedSwapAssetIds = parseExcludedSwapAssetIds(process.env.excludeSwapAssetIds);

  if (!appBiatecConfigProvider) {
    throw new Error('Please set appBiatecConfigProvider env variable');
  }
  if (!appBiatecIdentityProvider) {
    throw new Error('Please set appBiatecIdentityProvider env variable');
  }
  if (!appBiatecPoolProvider) {
    throw new Error('Please set appBiatecPoolProvider env variable');
  }
  if (!tradeReporterApi) {
    throw new Error('Please set BIATEC_TRADE_REPORTER_API env variable (base URL of the Biatec Trade Reporter API)');
  }
  if (!routerApi) {
    throw new Error('Please set BIATEC_ROUTER_API env variable (base URL of the Biatec Router API)');
  }
  if (!voteAssetId) {
    throw new Error('Please set voteAssetId env variable (asset id of the VOTE token, kept unswapped)');
  }
  if (!goldAssetId) {
    throw new Error('Please set goldAssetId env variable (asset id of the GOLD token, kept unswapped)');
  }
  console.log(`Using Biatec Trade Reporter API at ${tradeReporterApi}, minimum withdrawal valuation $${minWithdrawUsd}`);
  console.log(`Using Biatec Router API at ${routerApi}, keeping VOTE (${voteAssetId}) and GOLD (${goldAssetId}) unswapped`);
  console.log(`Assets excluded from swapping: ${[...excludedSwapAssetIds].join(', ')}`);

  const pools = await getPools({ algod: algorand.client.algod, assetId: 0n, poolProviderAppId: appBiatecPoolProvider });
  console.log(`Found ${pools.length} pools`);

  const summary: PoolSummaryRow[] = [];
  const allPoolAssetIds = new Set<bigint>();

  for (const pool of pools) {
    console.log(`checking pool`, pool.appId);

    // wait 100 ms in start of the loop to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));

    const appBiatecClammPool = pool.appId;

    const poolClient = new BiatecClammPoolClient({
      appId: appBiatecClammPool,
      algorand,
      defaultSender: signer.addr,
      defaultSigner: signer.signer,
    });

    const globalState = await poolClient.state.global.getAll();
    const { assetA } = globalState;
    const { assetB } = globalState;
    const { assetLp } = globalState;
    const liquidity = globalState.liquidity ?? 0n;
    const liquidityBiatecFromFees = globalState.liquidityBiatecFromFees ?? 0n;
    const assetABalanceBaseScale = globalState.assetABalanceBaseScale ?? 0n;
    const assetBBalanceBaseScale = globalState.assetBBalanceBaseScale ?? 0n;
    const assetADecimalsScaleFromBase = globalState.assetADecimalsScaleFromBase ?? 1n;
    const assetBDecimalsScaleFromBase = globalState.assetBDecimalsScaleFromBase ?? 1n;

    if (!assetLp || assetA === undefined || assetB === undefined) {
      console.log(`pool ${appBiatecClammPool} has no assetLp set yet, skipping`);
      continue;
    }

    allPoolAssetIds.add(assetA);
    allPoolAssetIds.add(assetB);

    if (liquidityBiatecFromFees === 0n) {
      console.log(`pool ${appBiatecClammPool} has no collected biatec fees, skipping`);
      continue;
    }

    const { assetAAmount, assetBAmount } = calculateFeeWithdrawal({
      liquidityBiatecFromFees,
      liquidity,
      assetABalanceBaseScale,
      assetBBalanceBaseScale,
      assetADecimalsScaleFromBase,
      assetBDecimalsScaleFromBase,
    });

    if (assetAAmount === 0n && assetBAmount === 0n) {
      console.log(`pool ${appBiatecClammPool} has collected biatec fees below one asset unit, skipping`);
      continue;
    }

    const assetAInfo = await getAssetInfo(assetA);
    const assetBInfo = await getAssetInfo(assetB);
    const assetAHuman = Number(assetAAmount) / 10 ** assetAInfo.decimals;
    const assetBHuman = Number(assetBAmount) / 10 ** assetBInfo.decimals;

    const [assetAPriceUsd, assetBPriceUsd] = await Promise.all([getCachedAssetPriceUSD(tradeReporterApi, assetA), getCachedAssetPriceUSD(tradeReporterApi, assetB)]);
    if (assetAPriceUsd === undefined) console.log(`pool ${appBiatecClammPool} - no USD price found for asset ${assetA}, treating it as $0 for the valuation`);
    if (assetBPriceUsd === undefined) console.log(`pool ${appBiatecClammPool} - no USD price found for asset ${assetB}, treating it as $0 for the valuation`);

    const usdValue = assetAHuman * (assetAPriceUsd ?? 0) + assetBHuman * (assetBPriceUsd ?? 0);
    console.log(`pool ${appBiatecClammPool} collected biatec fees: ${assetAHuman} ${assetAInfo.unitName} + ${assetBHuman} ${assetBInfo.unitName} = $${usdValue.toFixed(2)}`);

    if (usdValue < minWithdrawUsd) {
      console.log(`pool ${appBiatecClammPool} withdrawal skipped because valuation of the biatec fees is $${usdValue.toFixed(2)} usd`);
      summary.push({
        appId: appBiatecClammPool,
        assetASymbol: assetAInfo.unitName,
        assetAAmount: assetAHuman,
        assetBSymbol: assetBInfo.unitName,
        assetBAmount: assetBHuman,
        usdValue,
        status: 'skipped-below-threshold',
      });
      continue;
    }

    if (dryRun) {
      console.log(`pool ${appBiatecClammPool} dry run - would withdraw biatec fees worth $${usdValue.toFixed(2)}, skipping actual call`);
      summary.push({
        appId: appBiatecClammPool,
        assetASymbol: assetAInfo.unitName,
        assetAAmount: assetAHuman,
        assetBSymbol: assetBInfo.unitName,
        assetBAmount: assetBHuman,
        usdValue,
        status: 'dry-run',
      });
      continue;
    }

    try {
      // the payout is an axfer straight to signer.addr - it must already hold the asset before we send it
      await ensureOptedIn(algorand.client.algod, signer, assetA);
      await ensureOptedIn(algorand.client.algod, signer, assetB);

      await poolClient.send.removeLiquidityAdmin({
        args: {
          appBiatecConfigProvider,
          assetA,
          assetB,
          assetLp,
          amount: 0n, // 0 = withdraw everything currently booked in LiquidityBiatecFromFees
        },
        // covers this call's own fee plus every inner transaction removeLiquidityAdmin can trigger: two
        // itxn_submits from increaseOpcodeBudget() (each a zero-fee self app-call/delete, pooled from this fee)
        // plus up to 2 inner axfers (payout of assetA and assetB) - worst case 1 (own) + 2 + 2 = 5 fee units.
        staticFee: AlgoAmount.MicroAlgos(5000),
        // appBiatecConfigProvider/assetA/assetB/assetLp are plain uint64 on the ABI wire (TEALScript's
        // AppID/AssetID types do not surface as ARC4 reference types), so the SDK cannot auto-derive foreign
        // references from the method args alone. Supplying them explicitly lets us skip algokit's
        // resource-population simulate probe, which builds its own zero-fee transaction that algod rejects for
        // insufficient fee, independently of the staticFee set above on the real transaction.
        populateAppCallResources: false,
        appReferences: [appBiatecConfigProvider],
        assetReferences: [assetA, assetB, assetLp].filter((id) => id !== 0n),
      });
      console.log(`pool ${appBiatecClammPool} withdrawn biatec fees worth $${usdValue.toFixed(2)}`);
      summary.push({
        appId: appBiatecClammPool,
        assetASymbol: assetAInfo.unitName,
        assetAAmount: assetAHuman,
        assetBSymbol: assetBInfo.unitName,
        assetBAmount: assetBHuman,
        usdValue,
        status: 'withdrawn',
      });
    } catch (e) {
      console.error(`failed to withdraw biatec fees from pool ${appBiatecClammPool}`, e);
    }
  }

  console.log('');
  console.log('=== Biatec DEX fees valuation summary ===');
  let total = 0;
  for (const row of summary) {
    console.log(`pool ${row.appId}: ${row.assetAAmount} ${row.assetASymbol} + ${row.assetBAmount} ${row.assetBSymbol} = $${row.usdValue.toFixed(2)} (${row.status})`);
    total += row.usdValue;
  }
  console.log(`Total biatec fees valuation across ${summary.length} pool(s): $${total.toFixed(2)}`);

  console.log('');
  console.log('=== Rebalancing collected fees into VOTE/GOLD via Biatec Router ===');
  for (const assetId of allPoolAssetIds) {
    if (assetId === voteAssetId || assetId === goldAssetId) continue;
    if (excludedSwapAssetIds.has(assetId)) {
      console.log(`asset ${assetId} is excluded from swapping, skipping`);
      continue;
    }

    if (!dryRun) await ensureOptedIn(algorand.client.algod, signer, assetId);

    const balance = await getAssetBalance(assetId);
    if (balance <= 0n) {
      console.log(`no spare balance of asset ${assetId} to rebalance, skipping`);
      continue;
    }

    const half = balance / 2n;
    const otherHalf = balance - half; // remainder (if any) goes to the GOLD leg

    if (dryRun) {
      console.log(`dry run - would swap ${half} of asset ${assetId} -> VOTE and ${otherHalf} -> GOLD via the Biatec Router`);
      continue;
    }

    try {
      if (half > 0n) {
        const voteResult = await executeRouterSwap({
          algod: algorand.client.algod,
          routerApiBaseUrl: routerApi,
          signer,
          fromAsset: assetId,
          toAsset: voteAssetId,
          amount: half,
          slippageBps: routerSlippageBps,
        });
        console.log(`swapped ${half} of asset ${assetId} -> ~${voteResult.quotedOutputAmount} VOTE (tx ${voteResult.txId})`);
      }
      if (otherHalf > 0n) {
        const goldResult = await executeRouterSwap({
          algod: algorand.client.algod,
          routerApiBaseUrl: routerApi,
          signer,
          fromAsset: assetId,
          toAsset: goldAssetId,
          amount: otherHalf,
          slippageBps: routerSlippageBps,
        });
        console.log(`swapped ${otherHalf} of asset ${assetId} -> ~${goldResult.quotedOutputAmount} GOLD (tx ${goldResult.txId})`);
      }
    } catch (e) {
      console.error(`failed to rebalance asset ${assetId} into VOTE/GOLD`, e);
    }
  }

  console.log('');
  console.log('=== Adding rebalanced VOTE/GOLD liquidity to the narrowest pool ===');
  if (dryRun) {
    console.log('dry run - would find the narrowest VOTE/GOLD pool and add the remaining VOTE/GOLD balance to it');
  } else {
    await ensureOptedIn(algorand.client.algod, signer, voteAssetId);
    await ensureOptedIn(algorand.client.algod, signer, goldAssetId);

    const candidatePools: CandidatePool[] = [];
    for (const pool of pools) {
      const isVoteGoldPair = (pool.assetA === voteAssetId && pool.assetB === goldAssetId) || (pool.assetA === goldAssetId && pool.assetB === voteAssetId);
      if (!isVoteGoldPair) continue;
      const poolClient = new BiatecClammPoolClient({ appId: pool.appId, algorand, defaultSender: signer.addr, defaultSigner: signer.signer });
      const gs = await poolClient.state.global.getAll();
      candidatePools.push({ appId: pool.appId, priceMin: gs.priceMin ?? 0n, priceMax: gs.priceMax ?? 0n, liquidity: gs.liquidity ?? 0n });
    }

    const narrowest = pickNarrowestPool(candidatePools);
    if (!narrowest) {
      console.log('no VOTE/GOLD pool with liquidity found, skipping add-liquidity step');
    } else {
      console.log(`narrowest VOTE/GOLD pool: ${narrowest.appId} (price range ${narrowest.priceMin} - ${narrowest.priceMax})`);

      const narrowestPoolClient = new BiatecClammPoolClient({ appId: narrowest.appId, algorand, defaultSender: signer.addr, defaultSigner: signer.signer });
      const poolProviderClient = new BiatecPoolProviderClient({ appId: appBiatecPoolProvider, algorand, defaultSender: signer.addr, defaultSigner: signer.signer });
      const narrowestState = await narrowestPoolClient.state.global.getAll();
      const { assetA: narrowestAssetA, assetB: narrowestAssetB, assetLp: narrowestAssetLp } = narrowestState;

      const voteBalance = await getAssetBalance(voteAssetId);
      const goldBalance = await getAssetBalance(goldAssetId);
      const assetADeposit = narrowestAssetA === voteAssetId ? voteBalance : goldBalance;
      const assetBDeposit = narrowestAssetB === voteAssetId ? voteBalance : goldBalance;

      if (narrowestAssetA === undefined || narrowestAssetB === undefined || !narrowestAssetLp) {
        console.log(`pool ${narrowest.appId} is missing asset configuration, skipping add-liquidity step`);
      } else if (assetADeposit <= 0n && assetBDeposit <= 0n) {
        console.log(`no VOTE/GOLD balance left to add as liquidity, skipping`);
      } else {
        try {
          const txId = await clammAddLiquiditySender({
            clientBiatecClammPool: narrowestPoolClient,
            clientBiatecPoolProvider: poolProviderClient,
            account: signer,
            algod: algorand.client.algod,
            appBiatecConfigProvider,
            appBiatecIdentityProvider,
            assetA: narrowestAssetA,
            assetB: narrowestAssetB,
            assetLp: narrowestAssetLp,
            assetADeposit,
            assetBDeposit,
          });
          console.log(`added ${assetADeposit} of asset ${narrowestAssetA} + ${assetBDeposit} of asset ${narrowestAssetB} as liquidity to pool ${narrowest.appId} (tx ${txId})`);
        } catch (e) {
          console.error(`failed to add liquidity to pool ${narrowest.appId}`, e);
        }
      }
    }
  }

  console.log('');
  console.log('=== Final VOTE/GOLD holdings ===');
  const finalVoteBalance = await getAssetBalance(voteAssetId);
  const finalGoldBalance = await getAssetBalance(goldAssetId);
  const [voteInfo, goldInfo] = await Promise.all([getAssetInfo(voteAssetId), getAssetInfo(goldAssetId)]);
  const [votePriceUsd, goldPriceUsd] = await Promise.all([getCachedAssetPriceUSD(tradeReporterApi, voteAssetId), getCachedAssetPriceUSD(tradeReporterApi, goldAssetId)]);
  const voteHuman = Number(finalVoteBalance) / 10 ** voteInfo.decimals;
  const goldHuman = Number(finalGoldBalance) / 10 ** goldInfo.decimals;
  const voteUsdValue = voteHuman * (votePriceUsd ?? 0);
  const goldUsdValue = goldHuman * (goldPriceUsd ?? 0);
  console.log(
    `${signer.addr}: ${voteHuman} ${voteInfo.unitName} ($${voteUsdValue.toFixed(2)}) + ${goldHuman} ${goldInfo.unitName} ($${goldUsdValue.toFixed(2)}) = $${(voteUsdValue + goldUsdValue).toFixed(2)}`
  );

  console.log(`${Date()} Done`);
};

app();
