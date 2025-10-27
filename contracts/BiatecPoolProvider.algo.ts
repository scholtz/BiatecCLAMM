import { Contract } from '@algorandfoundation/tealscript';
import { BiatecClammPool } from './BiatecClammPool.algo';

// eslint-disable-next-line no-unused-vars
const version = 'BIATEC-PP-01-05-03';
const SCALE = 1_000_000_000;

type AppPoolInfo = {
  assetA: uint64;
  assetB: uint64;
  verificationClass: uint64;

  latestPrice: uint64;

  period1Duration: uint64;

  period1NowVolumeA: uint64;
  period1NowVolumeB: uint64;
  period1NowFeeA: uint64;
  period1NowFeeB: uint64;
  period1NowVWAP: uint64;
  period1NowTime: uint64;

  period1PrevVolumeA: uint64;
  period1PrevVolumeB: uint64;
  period1PrevFeeA: uint64;
  period1PrevFeeB: uint64;
  period1PrevVWAP: uint64;
  period1PrevTime: uint64;

  period2Duration: uint64;

  period2NowVolumeA: uint64;
  period2NowVolumeB: uint64;
  period2NowFeeA: uint64;
  period2NowFeeB: uint64;
  period2NowVWAP: uint64;
  period2NowTime: uint64;

  period2PrevVolumeA: uint64;
  period2PrevVolumeB: uint64;
  period2PrevFeeA: uint64;
  period2PrevFeeB: uint64;
  period2PrevVWAP: uint64;
  period2PrevTime: uint64;

  period3Duration: uint64;

  period3NowVolumeA: uint64;
  period3NowVolumeB: uint64;
  period3NowFeeA: uint64;
  period3NowFeeB: uint64;
  period3NowVWAP: uint64;
  period3NowTime: uint64;

  period3PrevVolumeA: uint64;
  period3PrevVolumeB: uint64;
  period3PrevFeeA: uint64;
  period3PrevFeeB: uint64;
  period3PrevVWAP: uint64;
  period3PrevTime: uint64;

  period4Duration: uint64;

  period4NowVolumeA: uint64;
  period4NowVolumeB: uint64;
  period4NowFeeA: uint64;
  period4NowFeeB: uint64;
  period4NowVWAP: uint64;
  period4NowTime: uint64;

  period4PrevVolumeA: uint64;
  period4PrevVolumeB: uint64;
  period4PrevFeeA: uint64;
  period4PrevFeeB: uint64;
  period4PrevVWAP: uint64;
  period4PrevTime: uint64;

  // period5Duration: uint64;

  // period5NowVolumeA: uint64;
  // period5NowVolumeB: uint64;
  // period5NowFeeA: uint64;
  // period5NowFeeB: uint64;
  // period5NowVWAP: uint64;
  // period5NowTime: uint64;

  // period5PrevVolumeA: uint64;
  // period5PrevVolumeB: uint64;
  // period5PrevFeeA: uint64;
  // period5PrevFeeB: uint64;
  // period5PrevVWAP: uint64;
  // period5PrevTime: uint64;

  // period6Duration: uint64;

  // period6NowVolumeA: uint64;
  // period6NowVolumeB: uint64;
  // period6NowFeeA: uint64;
  // period6NowFeeB: uint64;
  // period6NowVWAP: uint64;
  // period6NowTime: uint64;

  // period6PrevVolumeA: uint64;
  // period6PrevVolumeB: uint64;
  // period6PrevFeeA: uint64;
  // period6PrevFeeB: uint64;
  // period6PrevVWAP: uint64;
  // period6PrevTime: uint64;
};
type AssetsCombined = {
  assetA: uint64;
  assetB: uint64;
};
type PoolConfig = {
  assetA: uint64;
  assetB: uint64;
  min: uint64;
  max: uint64;
  fee: uint64;
  verificationClass: uint64;
};
type FullConfig = {
  appId: uint64; // app id of the pool
  assetA: uint64;
  assetB: uint64;
  min: uint64;
  max: uint64;
  fee: uint64;
  lpTokenId: uint64; // LP token id
  verificationClass: uint8;
};

type PoolRetVal = {
  appId: AppID;
  lpAssetId: AssetID;
};

export class BiatecPoolProvider extends Contract {
  /**
   * Each LP pool is registered in this contract. Each pool has custom box and stores there the trading stats.
   */
  pools = BoxMap<uint64, AppPoolInfo>({ prefix: 'p' });

  poolsByConfig = BoxMap<PoolConfig, uint64>({ prefix: 'pc' });

  fullConfigs = BoxMap<FullConfig, uint64>({ prefix: 'fc' });

  tradeEvent = new EventLogger<{
    appPoolId: AppID;
    assetA: AssetID;
    assetB: AssetID;
    priceFrom: uint64;
    priceTo: uint64;
    amountA: uint64;
    amountB: uint64;
    feeAmountA: uint64;
    feeAmountB: uint64;
    s: uint64;
  }>();

  poolsAggregated = BoxMap<AssetsCombined, AppPoolInfo>({ prefix: 's' });

  period1 = GlobalStateKey<uint64>({ key: 'p1' });

  period2 = GlobalStateKey<uint64>({ key: 'p2' });

  period3 = GlobalStateKey<uint64>({ key: 'p3' });

  period4 = GlobalStateKey<uint64>({ key: 'p4' });

  // period5 = GlobalStateKey<uint64>({ key: 'p5' });

  // period6 = GlobalStateKey<uint64>({ key: 'p6' });

  nativeTokenName = GlobalStateKey<bytes>({ key: 'nt' });

  /**
   * We cannot create application and store the appid to the chain in one app call, therefore we need to store it to the blobal storage of currently created apps. When we register the pool with the proper box id from the pool we can create infinite number of boxes, but we can create only 10 pools by any users at once.
   */
  recentPools1 = GlobalStateKey<uint64>({ key: 'rp1' });

  recentPools2 = GlobalStateKey<uint64>({ key: 'rp2' });

  recentPools3 = GlobalStateKey<uint64>({ key: 'rp3' });

  recentPools4 = GlobalStateKey<uint64>({ key: 'rp4' });

  recentPools5 = GlobalStateKey<uint64>({ key: 'rp5' });

  recentPools6 = GlobalStateKey<uint64>({ key: 'rp6' });

  recentPools7 = GlobalStateKey<uint64>({ key: 'rp7' });

  recentPools8 = GlobalStateKey<uint64>({ key: 'rp8' });

  recentPools9 = GlobalStateKey<uint64>({ key: 'rp9' });

  recentPools10 = GlobalStateKey<uint64>({ key: 'rp10' });

  recentPoolsIndex = GlobalStateKey<uint64>({ key: 'rpi' });

  /**
   * Biatec config provider
   */
  appBiatecConfigProvider = GlobalStateKey<AppID>({ key: 'B' });

  /**
   * Anyone can deploy the CLAMM pool through this contract. When its done this way, we can be sure that the smart contract communicating with this contract to store the price feed is legit
   */
  clammApprovalProgram1 = BoxKey<bytes>({ key: 'capb1' });

  clammApprovalProgram2 = BoxKey<bytes>({ key: 'capb2' });

  clammApprovalProgram3 = BoxKey<bytes>({ key: 'capb3' });

  // clammApprovalProgram4 = BoxKey<bytes>({ key: 'capb4' });
  /**
   * Version of the smart contract
   */
  version = GlobalStateKey<bytes>({ key: 'scver' });

  /**
   * Biatec deploys single pool provider smart contract
   * @param appBiatecConfigProvider Biatec amm provider
   */
  bootstrap(appBiatecConfigProvider: AppID): void {
    assert(this.txn.sender === this.app.creator, 'Only creator of the app can set it up');
    this.appBiatecConfigProvider.value = appBiatecConfigProvider;
    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment
  }

  /**
   * Returns current status
   *
   * @param appPoolId Pool id to retrieve the stats
   * @returns Pool info statistics
   */
  @abi.readonly
  getCurrentStatus(appPoolId: AppID): AppPoolInfo {
    return this.pools(appPoolId.id).value;
  }

  /**
   * Initial setup
   */
  createApplication(): void {
    log(version);
    this.period1.value = 60;
    // this.period2.value = 3600;
    this.period2.value = 3600 * 24;
    this.period3.value = 3600 * 24 * 7;
    // this.period5.value = 3600 * 24 * 30;
    this.period4.value = 3600 * 24 * 365;
    this.recentPoolsIndex.value = 1;
    this.recentPools1.value = 0;
    this.recentPools2.value = 0;
    this.recentPools3.value = 0;
    this.recentPools4.value = 0;
    this.recentPools5.value = 0;
    this.recentPools6.value = 0;
    this.recentPools7.value = 0;
    this.recentPools8.value = 0;
    this.recentPools9.value = 0;
    this.recentPools10.value = 0;
    this.version.value = version;
    this.nativeTokenName.value = 'ALGO';
  }

  /**
   * addressUdpater from global biatec configuration is allowed to update application
   */
  updateApplication(appBiatecConfigProvider: AppID, newVersion: bytes): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressUdpater = appBiatecConfigProvider.globalState('u') as Address;
    assert(this.txn.sender === addressUdpater, 'Only addressUdpater setup in the config can update application');
    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment
    log(version);
    log(newVersion);
    this.version.value = version;
  }

  setNativeTokenName(appBiatecConfigProvider: AppID, nativeTokenName: bytes): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressUdpater = appBiatecConfigProvider.globalState('u') as Address;
    assert(this.txn.sender === addressUdpater, 'Only addressUdpater setup in the config can update application');
    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED');
    let trimmedName = nativeTokenName;
    if (trimmedName.length >= 2 && substring3(nativeTokenName, 0, 1) === '\x00') {
      trimmedName = substring3(nativeTokenName, 2, nativeTokenName.length);
    }
    assert(trimmedName.length > 0, 'Native token name must not be empty');
    this.nativeTokenName.value = trimmedName;
  }

  loadCLAMMContractData(
    appBiatecConfigProvider: AppID,
    approvalProgramSize: uint64,
    offset: uint64,
    data: bytes
  ): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressUdpater = appBiatecConfigProvider.globalState('u') as Address;
    assert(
      this.txn.sender === addressUdpater,
      'Only addressUdpater setup in the config can update the AMM application'
    );
    if (this.clammApprovalProgram1.exists && offset == 0) {
      this.clammApprovalProgram1.delete();
      this.clammApprovalProgram2.delete();
      this.clammApprovalProgram3.delete();
      // this.clammApprovalProgram4.delete();
    }
    if (!this.clammApprovalProgram1.exists) {
      this.clammApprovalProgram1.create(approvalProgramSize < 4096 ? approvalProgramSize : 4096);
      this.clammApprovalProgram2.create(
        approvalProgramSize < 4096 ? 0 : approvalProgramSize < 8192 ? approvalProgramSize - 4096 : 4096
      );
      this.clammApprovalProgram3.create(
        approvalProgramSize < 8192 ? 0 : approvalProgramSize < 12288 ? approvalProgramSize - 8192 : 4096
      );
      // this.clammApprovalProgram4.create(approvalProgramSize < 16384 ? approvalProgramSize - 12288 : 4096);
    }
    if (offset < 4096) {
      this.clammApprovalProgram1.replace(offset, data);
    } else if (offset < 8192) {
      this.clammApprovalProgram2.replace(offset - 4096, data);
    } else if (offset < 12288) {
      this.clammApprovalProgram3.replace(offset - 8192, data);
    }
    //  else {
    //   this.clammApprovalProgram4.replace(offset - 12288, data);
    // }
  }

  /**
   * No op tx to increase the app call and box size limits
   */
  noop(i: uint64): void {}

  /**
   * Anybody can call this method to bootstrap new clamm pool
   *
   * @param assetA Asset A ID must be lower then Asset B ID
   * @param assetB Asset B
   * @param appBiatecConfigProvider Biatec amm provider
   * @param appBiatecPoolProvider Pool provider
   * @param txSeed Seed transaction so that smart contract can opt in to the assets
   * @param fee Fee in base level (9 decimals). value 1_000_000_000 = 1 = 100%. 10_000_000 = 1%. 1_000_000 = 0.1%
   * @param priceMin Min price range. At this point all assets are in asset A.
   * @param priceMax Max price range. At this point all assets are in asset B.
   * @param currentPrice Deployer can specify the current price for easier deployemnt.
   * @param verificationClass Minimum verification level from the biatec identity. Level 0 means no kyc.
   * @returns LP token ID
   */
  deployPool(
    assetA: AssetID,
    assetB: AssetID,
    appBiatecConfigProvider: AppID,
    appBiatecPoolProvider: AppID,
    txSeed: PayTxn,
    fee: uint64,
    priceMin: uint64,
    priceMax: uint64,
    currentPrice: uint64,
    verificationClass: uint64
  ): uint64 {
    verifyPayTxn(txSeed, { receiver: this.app.address, amount: { greaterThanEqualTo: 5_000_000 } });
    assert(verificationClass <= 4); // verificationClass

    // Create the actual staker pool contract instance
    this.pendingGroup.addAppCall({
      onCompletion: OnCompletion.NoOp,
      approvalProgram: [
        this.clammApprovalProgram1.value,
        this.clammApprovalProgram2.value,
        // this.clammApprovalProgram3.value,
        // this.clammApprovalProgram4.value,
      ],
      clearStateProgram: BiatecClammPool.clearProgram(),
      globalNumUint: BiatecClammPool.schema.global.numUint,
      globalNumByteSlice: BiatecClammPool.schema.global.numByteSlice,
      extraProgramPages: 3,
      applicationArgs: [
        // no args
        method('createApplication()void'),
      ],
      isFirstTxn: true,
    });

    this.pendingGroup.submit();
    const appId = this.itxn.createdApplicationID.id;
    this.pendingGroup.addPayment({
      receiver: AppID.fromUint64(appId).address,
      amount: 400_000,
      fee: 0,
      isFirstTxn: true,
    });
    // Create the actual staker pool contract instance
    this.pendingGroup.addAppCall({
      applicationID: AppID.fromUint64(appId),
      applicationArgs: [
        // assetA, assetB, appBiatecConfigProvider, appBiatecPoolProvider, txSeed, fee, priceMin, priceMax, currentPrice, verificationClass
        method('bootstrap(uint64,uint64,uint64,uint64,pay,uint64,uint64,uint64,uint64,uint64)uint64'),
        itob(assetA.id),
        itob(assetB.id),
        itob(appBiatecConfigProvider.id),
        itob(appBiatecPoolProvider.id),
        itob(fee as uint64),
        itob(priceMin as uint64),
        itob(priceMax as uint64),
        itob(currentPrice as uint64),
        itob(verificationClass as uint64),
      ],
      assets: [assetA, assetB],
      applications: [appBiatecConfigProvider, appBiatecPoolProvider],
      fee: 0,
    });
    this.pendingGroup.submit();
    // this.registerPool(AppID.fromUint64(appId), assetA, assetB, verificationClass);

    this.recentPoolsIndex.value = this.recentPoolsIndex.value + 1;
    if (this.recentPoolsIndex.value > 10) this.recentPoolsIndex.value = 1;
    const storeTo = this.recentPoolsIndex.value;
    if (storeTo == 1) {
      this.recentPools1.value = appId;
    } else if (storeTo == 2) {
      this.recentPools2.value = appId;
    } else if (storeTo == 3) {
      this.recentPools1.value = appId;
    } else if (storeTo == 4) {
      this.recentPools1.value = appId;
    } else if (storeTo == 5) {
      this.recentPools1.value = appId;
    } else if (storeTo == 6) {
      this.recentPools1.value = appId;
    } else if (storeTo == 7) {
      this.recentPools1.value = appId;
    } else if (storeTo == 8) {
      this.recentPools1.value = appId;
    } else if (storeTo == 9) {
      this.recentPools1.value = appId;
    } else if (storeTo == 10) {
      this.recentPools1.value = appId;
    }
    return appId;
  }

  /**
   * This method is called by constructor of the luquidity pool
   */
  registerPool(): void {
    const appClammPool = globals.callerApplicationID as AppID;
    const assetA = AssetID.fromUint64(appClammPool.globalState('a') as uint64);
    const assetB = AssetID.fromUint64(appClammPool.globalState('b') as uint64);
    const verificationClass = appClammPool.globalState('c') as uint64;
    const pMin = appClammPool.globalState('pMin') as uint64;
    const pMax = appClammPool.globalState('pMax') as uint64;
    const fee = appClammPool.globalState('f') as uint64;
    const lpToken = appClammPool.globalState('lp') as uint64;
    const ammPoolPrice = appClammPool.globalState('price') as uint64;
    assert(!this.pools(appClammPool.id).exists);
    const config: PoolConfig = {
      assetA: assetA.id,
      assetB: assetB.id,
      min: pMin,
      max: pMax,
      fee: fee,
      verificationClass: verificationClass,
    };
    assert(!this.poolsByConfig(config).exists, 'Pool with the same configuration is already registered');
    this.poolsByConfig(config).value = appClammPool.id;

    const fullConfig: FullConfig = {
      appId: appClammPool.id,
      assetA: assetA.id,
      assetB: assetB.id,
      lpTokenId: lpToken,
      min: pMin,
      max: pMax,
      fee: fee,
      verificationClass: verificationClass as uint8,
    };
    this.fullConfigs(fullConfig).value = appClammPool.id;

    const appPoolUintId = appClammPool.id;
    if (
      appPoolUintId != this.recentPools1.value &&
      appPoolUintId != this.recentPools2.value &&
      appPoolUintId != this.recentPools3.value &&
      appPoolUintId != this.recentPools4.value &&
      appPoolUintId != this.recentPools5.value &&
      appPoolUintId != this.recentPools6.value &&
      appPoolUintId != this.recentPools7.value &&
      appPoolUintId != this.recentPools8.value &&
      appPoolUintId != this.recentPools9.value &&
      appPoolUintId != this.recentPools10.value
    ) {
      assert(false, 'App not in recently created apps');
    }
    const aggregatedIndex: AssetsCombined = {
      assetA: assetA.id,
      assetB: assetB.id,
    };
    let latestPrice: uint64 = 0;
    if (this.poolsAggregated(aggregatedIndex).exists) {
      latestPrice = this.poolsAggregated(aggregatedIndex).value.latestPrice;
    } else {
      latestPrice = ammPoolPrice;
    }
    const data: AppPoolInfo = {
      assetA: assetA.id,
      assetB: assetB.id,
      verificationClass: verificationClass as uint64,

      latestPrice: latestPrice,

      period1Duration: this.period1.value,

      period1NowFeeA: <uint64>0,
      period1NowFeeB: <uint64>0,
      period1NowTime: 0,
      period1NowVolumeA: <uint64>0,
      period1NowVolumeB: <uint64>0,
      period1NowVWAP: <uint64>0,
      period1PrevFeeA: <uint64>0,
      period1PrevFeeB: <uint64>0,
      period1PrevTime: 0,
      period1PrevVolumeA: <uint64>0,
      period1PrevVolumeB: <uint64>0,
      period1PrevVWAP: <uint64>0,

      period2Duration: this.period2.value,

      period2NowFeeA: <uint64>0,
      period2NowFeeB: <uint64>0,
      period2NowTime: 0,
      period2NowVolumeA: <uint64>0,
      period2NowVolumeB: <uint64>0,
      period2NowVWAP: <uint64>0,
      period2PrevFeeA: <uint64>0,
      period2PrevFeeB: <uint64>0,
      period2PrevTime: 0,
      period2PrevVolumeA: <uint64>0,
      period2PrevVolumeB: <uint64>0,
      period2PrevVWAP: <uint64>0,

      period3Duration: this.period3.value,

      period3NowFeeA: <uint64>0,
      period3NowFeeB: <uint64>0,
      period3NowTime: 0,
      period3NowVolumeA: <uint64>0,
      period3NowVolumeB: <uint64>0,
      period3NowVWAP: <uint64>0,
      period3PrevFeeA: <uint64>0,
      period3PrevFeeB: <uint64>0,
      period3PrevTime: 0,
      period3PrevVolumeA: <uint64>0,
      period3PrevVolumeB: <uint64>0,
      period3PrevVWAP: <uint64>0,

      period4Duration: this.period4.value,

      period4NowFeeA: <uint64>0,
      period4NowFeeB: <uint64>0,
      period4NowTime: 0,
      period4NowVolumeA: <uint64>0,
      period4NowVolumeB: <uint64>0,
      period4NowVWAP: <uint64>0,
      period4PrevFeeA: <uint64>0,
      period4PrevFeeB: <uint64>0,
      period4PrevTime: 0,
      period4PrevVolumeA: <uint64>0,
      period4PrevVolumeB: <uint64>0,
      period4PrevVWAP: <uint64>0,

      // period5Duration: this.period5.value,

      // period5NowFeeA: <uint64>0,
      // period5NowFeeB: <uint64>0,
      // period5NowTime: 0,
      // period5NowVolumeA: <uint64>0,
      // period5NowVolumeB: <uint64>0,
      // period5NowVWAP: <uint64>0,
      // period5PrevFeeA: <uint64>0,
      // period5PrevFeeB: <uint64>0,
      // period5PrevTime: 0,
      // period5PrevVolumeA: <uint64>0,
      // period5PrevVolumeB: <uint64>0,
      // period5PrevVWAP: <uint64>0,

      // period6Duration: this.period6.value,

      // period6NowFeeA: <uint64>0,
      // period6NowFeeB: <uint64>0,
      // period6NowTime: 0,
      // period6NowVolumeA: <uint64>0,
      // period6NowVolumeB: <uint64>0,
      // period6NowVWAP: <uint64>0,
      // period6PrevFeeA: <uint64>0,
      // period6PrevFeeB: <uint64>0,
      // period6PrevTime: 0,
      // period6PrevVolumeA: <uint64>0,
      // period6PrevVolumeB: <uint64>0,
      // period6PrevVWAP: <uint64>0,
    };
    this.pools(appClammPool.id).value = data;

    if (!this.poolsAggregated(aggregatedIndex).exists) {
      this.poolsAggregated(aggregatedIndex).value = data;
    }
  }

  private updatePriceBoxInfo(
    appPoolId: AppID,
    assetA: AssetID,
    assetB: AssetID,
    priceFrom: uint64,
    priceTo: uint64,
    amountA: uint64,
    amountB: uint64,
    feeAmountA: uint64,
    feeAmountB: uint64
  ): AppPoolInfo {
    const info = this.pools(appPoolId.id).value;
    assert(assetA.id === info.assetA);
    assert(assetB.id === info.assetB);
    assert(amountA > 0 && amountB > 0);

    const netAmountA = amountA - feeAmountA;
    const netAmountB = amountB - feeAmountB;

    const price = (priceFrom + priceTo) / <uint64>2;
    const priceUint256 = price as uint256;
    const amountBUint256 = netAmountB as uint256;
    info.latestPrice = price;
    const period1IterFromNowObj = info.period1NowTime / this.period1.value;
    const period1IterFromCurrTime = globals.latestTimestamp / this.period1.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period1IterFromNowObj !== period1IterFromCurrTime) {
      // update prev object
      info.period1PrevFeeA = info.period1NowFeeA;
      info.period1NowFeeA = 0;
      info.period1PrevFeeB = info.period1NowFeeB;
      info.period1NowFeeB = 0;
      info.period1PrevVWAP = info.period1NowVWAP;
      info.period1PrevVolumeA = info.period1NowVolumeA;
      info.period1NowVolumeA = 0;
      info.period1PrevVolumeB = info.period1NowVolumeB;
      info.period1NowVolumeB = 0;
      info.period1PrevTime = info.period1NowTime;
      if (info.period1NowTime === 0) {
        info.period1NowTime = globals.latestTimestamp;
      } else {
        info.period1NowTime = period1IterFromCurrTime * this.period1.value;
      }
    }
    // update current object
    info.period1NowFeeA = info.period1NowFeeA + feeAmountA;
    info.period1NowFeeB = info.period1NowFeeB + feeAmountB;
    const period1NowVolumeBUint256 = info.period1NowVolumeB as uint256;
    const period1NowVWAPUint256 = info.period1NowVWAP as uint256;
    info.period1NowVWAP = ((period1NowVolumeBUint256 * period1NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period1NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period1NowVolumeA = info.period1NowVolumeA + netAmountA;
    info.period1NowVolumeB = info.period1NowVolumeB + netAmountB;

    // 2
    const period2IterFromNowObj = info.period2NowTime / this.period2.value;
    const period2IterFromCurrTime = globals.latestTimestamp / this.period2.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period2IterFromNowObj !== period2IterFromCurrTime) {
      // update prev object
      info.period2PrevFeeA = info.period2NowFeeA;
      info.period2NowFeeA = 0;
      info.period2PrevFeeB = info.period2NowFeeB;
      info.period2NowFeeB = 0;
      info.period2PrevVWAP = info.period2NowVWAP;
      info.period2PrevVolumeA = info.period2NowVolumeA;
      info.period2NowVolumeA = 0;
      info.period2PrevVolumeB = info.period2NowVolumeB;
      info.period2NowVolumeB = 0;
      info.period2PrevTime = info.period2NowTime;
      if (info.period2NowTime === 0) {
        info.period2NowTime = globals.latestTimestamp;
      } else {
        info.period2NowTime = period2IterFromCurrTime * this.period2.value;
      }
    }
    // update current object
    info.period2NowFeeA = info.period2NowFeeA + feeAmountA;
    info.period2NowFeeB = info.period2NowFeeB + feeAmountB;
    const period2NowVolumeBUint256 = info.period2NowVolumeB as uint256;
    const period2NowVWAPUint256 = info.period2NowVWAP as uint256;
    info.period2NowVWAP = ((period2NowVolumeBUint256 * period2NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period2NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period2NowVolumeA = info.period2NowVolumeA + netAmountA;
    info.period2NowVolumeB = info.period2NowVolumeB + netAmountB;

    // 3
    const period3IterFromNowObj = info.period3NowTime / this.period3.value;
    const period3IterFromCurrTime = globals.latestTimestamp / this.period3.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period3IterFromNowObj !== period3IterFromCurrTime) {
      // update prev object
      info.period3PrevFeeA = info.period3NowFeeA;
      info.period3NowFeeA = 0;
      info.period3PrevFeeB = info.period3NowFeeB;
      info.period3NowFeeB = 0;
      info.period3PrevVWAP = info.period3NowVWAP;
      info.period3PrevVolumeA = info.period3NowVolumeA;
      info.period3NowVolumeA = 0;
      info.period3PrevVolumeB = info.period3NowVolumeB;
      info.period3NowVolumeB = 0;
      info.period3PrevTime = info.period3NowTime;
      if (info.period3NowTime === 0) {
        info.period3NowTime = globals.latestTimestamp;
      } else {
        info.period3NowTime = period3IterFromCurrTime * this.period3.value;
      }
    }
    // update current object
    info.period3NowFeeA = info.period3NowFeeA + feeAmountA;
    info.period3NowFeeB = info.period3NowFeeB + feeAmountB;
    const period3NowVolumeBUint256 = info.period3NowVolumeB as uint256;
    const period3NowVWAPUint256 = info.period3NowVWAP as uint256;
    info.period3NowVWAP = ((period3NowVolumeBUint256 * period3NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period3NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period3NowVolumeA = info.period3NowVolumeA + netAmountA;
    info.period3NowVolumeB = info.period3NowVolumeB + netAmountB;
    // 4
    const period4IterFromNowObj = info.period4NowTime / this.period4.value;
    const period4IterFromCurrTime = globals.latestTimestamp / this.period4.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period4IterFromNowObj !== period4IterFromCurrTime) {
      // update prev object
      info.period4PrevFeeA = info.period4NowFeeA;
      info.period4NowFeeA = 0;
      info.period4PrevFeeB = info.period4NowFeeB;
      info.period4NowFeeB = 0;
      info.period4PrevVWAP = info.period4NowVWAP;
      info.period4PrevVolumeA = info.period4NowVolumeA;
      info.period4NowVolumeA = 0;
      info.period4PrevVolumeB = info.period4NowVolumeB;
      info.period4NowVolumeB = 0;
      info.period4PrevTime = info.period4NowTime;
      if (info.period4NowTime === 0) {
        info.period4NowTime = globals.latestTimestamp;
      } else {
        info.period4NowTime = period4IterFromCurrTime * this.period4.value;
      }
    }
    // update current object
    info.period4NowFeeA = info.period4NowFeeA + feeAmountA;
    info.period4NowFeeB = info.period4NowFeeB + feeAmountB;
    const period4NowVolumeBUint256 = info.period4NowVolumeB as uint256;
    const period4NowVWAPUint256 = info.period4NowVWAP as uint256;
    info.period4NowVWAP = ((period4NowVolumeBUint256 * period4NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period4NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period4NowVolumeA = info.period4NowVolumeA + netAmountA;
    info.period4NowVolumeB = info.period4NowVolumeB + netAmountB;
    // 5
    // const period5IterFromNowObj = info.period5NowTime / this.period5.value;
    // const period5IterFromCurrTime = globals.latestTimestamp / this.period5.value;
    // // 1710960395 / 86400 = 19802
    // // 19802 * 86400 = 1710892800
    // if (period5IterFromNowObj !== period5IterFromCurrTime) {
    //   // update prev object
    //   info.period5PrevFeeA = info.period5NowFeeA;
    //   info.period5NowFeeA = 0;
    //   info.period5PrevFeeB = info.period5NowFeeB;
    //   info.period5NowFeeB = 0;
    //   info.period5PrevVWAP = info.period5NowVWAP;
    //   info.period5PrevVolumeA = info.period5NowVolumeA;
    //   info.period5NowVolumeA = 0;
    //   info.period5PrevVolumeB = info.period5NowVolumeB;
    //   info.period5NowVolumeB = 0;
    //   info.period5PrevTime = info.period5NowTime;
    //   if (info.period5NowTime === 0) {
    //     info.period5NowTime = globals.latestTimestamp;
    //   } else {
    //     info.period5NowTime = period5IterFromCurrTime * this.period5.value;
    //   }
    // }
    // // update current object
    // info.period5NowFeeA = info.period5NowFeeA + feeAmountA;
    // info.period5NowFeeB = info.period5NowFeeB + feeAmountB;
    // const period5NowVolumeBUint256 = info.period5NowVolumeB as uint256;
    // const period5NowVWAPUint256 = info.period5NowVWAP as uint256;
    // info.period5NowVWAP = ((period5NowVolumeBUint256 * period5NowVWAPUint256 + amountBUint256 * priceUint256) /
    //   (period5NowVolumeBUint256 + amountBUint256)) as uint64;
    // info.period5NowVolumeA = info.period5NowVolumeA + netAmountA;
    // info.period5NowVolumeB = info.period5NowVolumeB + netAmountB;

    // // 6
    // const period6IterFromNowObj = info.period6NowTime / this.period6.value;
    // const period6IterFromCurrTime = globals.latestTimestamp / this.period6.value;

    // if (period6IterFromNowObj !== period6IterFromCurrTime) {
    //   // update prev object
    //   info.period6PrevFeeA = info.period6NowFeeA;
    //   info.period6NowFeeA = 0;
    //   info.period6PrevFeeB = info.period6NowFeeB;
    //   info.period6NowFeeB = 0;
    //   info.period6PrevVWAP = info.period6NowVWAP;
    //   info.period6PrevVolumeA = info.period6NowVolumeA;
    //   info.period6NowVolumeA = 0;
    //   info.period6PrevVolumeB = info.period6NowVolumeB;
    //   info.period6NowVolumeB = 0;
    //   info.period6PrevTime = info.period6NowTime;
    //   if (info.period6NowTime === 0) {
    //     info.period6NowTime = globals.latestTimestamp;
    //   } else {
    //     info.period6NowTime = period6IterFromCurrTime * this.period6.value;
    //   }
    // }
    // // update current object
    // info.period6NowFeeA = info.period6NowFeeA + feeAmountA;
    // info.period6NowFeeB = info.period6NowFeeB + feeAmountB;
    // const period6NowVolumeBUint256 = info.period6NowVolumeB as uint256;
    // const period6NowVWAPUint256 = info.period6NowVWAP as uint256;
    // info.period6NowVWAP = ((period6NowVolumeBUint256 * period6NowVWAPUint256 + amountBUint256 * priceUint256) /
    //   (period6NowVolumeBUint256 + amountBUint256)) as uint64;
    // info.period6NowVolumeA = info.period6NowVolumeA + netAmountA;
    // info.period6NowVolumeB = info.period6NowVolumeB + netAmountB;
    return info;
  }

  private updatePriceBoxAggregated(
    assetA: AssetID,
    assetB: AssetID,
    priceFrom: uint64,
    priceTo: uint64,
    amountA: uint64,
    amountB: uint64,
    feeAmountA: uint64,
    feeAmountB: uint64
  ): AppPoolInfo {
    const aggregatedIndex: AssetsCombined = { assetA: assetA.id, assetB: assetB.id };
    const info = this.poolsAggregated(aggregatedIndex).value;
    assert(assetA.id === info.assetA);
    assert(assetB.id === info.assetB);
    assert(amountA > 0 && amountB > 0);

    const netAmountA = amountA - feeAmountA;
    const netAmountB = amountB - feeAmountB;

    const price = (priceFrom + priceTo) / <uint64>2;
    const priceUint256 = price as uint256;
    const amountBUint256 = netAmountB as uint256;
    info.latestPrice = price;
    const period1IterFromNowObj = info.period1NowTime / this.period1.value;
    const period1IterFromCurrTime = globals.latestTimestamp / this.period1.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period1IterFromNowObj !== period1IterFromCurrTime) {
      // update prev object
      info.period1PrevFeeA = info.period1NowFeeA;
      info.period1NowFeeA = 0;
      info.period1PrevFeeB = info.period1NowFeeB;
      info.period1NowFeeB = 0;
      info.period1PrevVWAP = info.period1NowVWAP;
      info.period1PrevVolumeA = info.period1NowVolumeA;
      info.period1NowVolumeA = 0;
      info.period1PrevVolumeB = info.period1NowVolumeB;
      info.period1NowVolumeB = 0;
      info.period1PrevTime = info.period1NowTime;
      if (info.period1NowTime === 0) {
        info.period1NowTime = globals.latestTimestamp;
      } else {
        info.period1NowTime = period1IterFromCurrTime * this.period1.value;
      }
    }
    // update current object
    info.period1NowFeeA = info.period1NowFeeA + feeAmountA;
    info.period1NowFeeB = info.period1NowFeeB + feeAmountB;
    const period1NowVolumeBUint256 = info.period1NowVolumeB as uint256;
    const period1NowVWAPUint256 = info.period1NowVWAP as uint256;
    info.period1NowVWAP = ((period1NowVolumeBUint256 * period1NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period1NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period1NowVolumeA = info.period1NowVolumeA + netAmountA;
    info.period1NowVolumeB = info.period1NowVolumeB + netAmountB;

    // 2
    const period2IterFromNowObj = info.period2NowTime / this.period2.value;
    const period2IterFromCurrTime = globals.latestTimestamp / this.period2.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period2IterFromNowObj !== period2IterFromCurrTime) {
      // update prev object
      info.period2PrevFeeA = info.period2NowFeeA;
      info.period2NowFeeA = 0;
      info.period2PrevFeeB = info.period2NowFeeB;
      info.period2NowFeeB = 0;
      info.period2PrevVWAP = info.period2NowVWAP;
      info.period2PrevVolumeA = info.period2NowVolumeA;
      info.period2NowVolumeA = 0;
      info.period2PrevVolumeB = info.period2NowVolumeB;
      info.period2NowVolumeB = 0;
      info.period2PrevTime = info.period2NowTime;
      if (info.period2NowTime === 0) {
        info.period2NowTime = globals.latestTimestamp;
      } else {
        info.period2NowTime = period2IterFromCurrTime * this.period2.value;
      }
    }
    // update current object
    info.period2NowFeeA = info.period2NowFeeA + feeAmountA;
    info.period2NowFeeB = info.period2NowFeeB + feeAmountB;
    const period2NowVolumeBUint256 = info.period2NowVolumeB as uint256;
    const period2NowVWAPUint256 = info.period2NowVWAP as uint256;
    info.period2NowVWAP = ((period2NowVolumeBUint256 * period2NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period2NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period2NowVolumeA = info.period2NowVolumeA + netAmountA;
    info.period2NowVolumeB = info.period2NowVolumeB + netAmountB;

    // 3
    const period3IterFromNowObj = info.period3NowTime / this.period3.value;
    const period3IterFromCurrTime = globals.latestTimestamp / this.period3.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period3IterFromNowObj !== period3IterFromCurrTime) {
      // update prev object
      info.period3PrevFeeA = info.period3NowFeeA;
      info.period3NowFeeA = 0;
      info.period3PrevFeeB = info.period3NowFeeB;
      info.period3NowFeeB = 0;
      info.period3PrevVWAP = info.period3NowVWAP;
      info.period3PrevVolumeA = info.period3NowVolumeA;
      info.period3NowVolumeA = 0;
      info.period3PrevVolumeB = info.period3NowVolumeB;
      info.period3NowVolumeB = 0;
      info.period3PrevTime = info.period3NowTime;
      if (info.period3NowTime === 0) {
        info.period3NowTime = globals.latestTimestamp;
      } else {
        info.period3NowTime = period3IterFromCurrTime * this.period3.value;
      }
    }
    // update current object
    info.period3NowFeeA = info.period3NowFeeA + feeAmountA;
    info.period3NowFeeB = info.period3NowFeeB + feeAmountB;
    const period3NowVolumeBUint256 = info.period3NowVolumeB as uint256;
    const period3NowVWAPUint256 = info.period3NowVWAP as uint256;
    info.period3NowVWAP = ((period3NowVolumeBUint256 * period3NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period3NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period3NowVolumeA = info.period3NowVolumeA + netAmountA;
    info.period3NowVolumeB = info.period3NowVolumeB + netAmountB;
    // 4
    const period4IterFromNowObj = info.period4NowTime / this.period4.value;
    const period4IterFromCurrTime = globals.latestTimestamp / this.period4.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period4IterFromNowObj !== period4IterFromCurrTime) {
      // update prev object
      info.period4PrevFeeA = info.period4NowFeeA;
      info.period4NowFeeA = 0;
      info.period4PrevFeeB = info.period4NowFeeB;
      info.period4NowFeeB = 0;
      info.period4PrevVWAP = info.period4NowVWAP;
      info.period4PrevVolumeA = info.period4NowVolumeA;
      info.period4NowVolumeA = 0;
      info.period4PrevVolumeB = info.period4NowVolumeB;
      info.period4NowVolumeB = 0;
      info.period4PrevTime = info.period4NowTime;
      if (info.period4NowTime === 0) {
        info.period4NowTime = globals.latestTimestamp;
      } else {
        info.period4NowTime = period4IterFromCurrTime * this.period4.value;
      }
    }
    // update current object
    info.period4NowFeeA = info.period4NowFeeA + feeAmountA;
    info.period4NowFeeB = info.period4NowFeeB + feeAmountB;
    const period4NowVolumeBUint256 = info.period4NowVolumeB as uint256;
    const period4NowVWAPUint256 = info.period4NowVWAP as uint256;
    info.period4NowVWAP = ((period4NowVolumeBUint256 * period4NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period4NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period4NowVolumeA = info.period4NowVolumeA + netAmountA;
    info.period4NowVolumeB = info.period4NowVolumeB + netAmountB;
    // 5
    // const period5IterFromNowObj = info.period5NowTime / this.period5.value;
    // const period5IterFromCurrTime = globals.latestTimestamp / this.period5.value;
    // // 1710960395 / 86400 = 19802
    // // 19802 * 86400 = 1710892800
    // if (period5IterFromNowObj !== period5IterFromCurrTime) {
    //   // update prev object
    //   info.period5PrevFeeA = info.period5NowFeeA;
    //   info.period5NowFeeA = 0;
    //   info.period5PrevFeeB = info.period5NowFeeB;
    //   info.period5NowFeeB = 0;
    //   info.period5PrevVWAP = info.period5NowVWAP;
    //   info.period5PrevVolumeA = info.period5NowVolumeA;
    //   info.period5NowVolumeA = 0;
    //   info.period5PrevVolumeB = info.period5NowVolumeB;
    //   info.period5NowVolumeB = 0;
    //   info.period5PrevTime = info.period5NowTime;
    //   if (info.period5NowTime === 0) {
    //     info.period5NowTime = globals.latestTimestamp;
    //   } else {
    //     info.period5NowTime = period5IterFromCurrTime * this.period5.value;
    //   }
    // }
    // // update current object
    // info.period5NowFeeA = info.period5NowFeeA + feeAmountA;
    // info.period5NowFeeB = info.period5NowFeeB + feeAmountB;
    // const period5NowVolumeBUint256 = info.period5NowVolumeB as uint256;
    // const period5NowVWAPUint256 = info.period5NowVWAP as uint256;
    // info.period5NowVWAP = ((period5NowVolumeBUint256 * period5NowVWAPUint256 + amountBUint256 * priceUint256) /
    //   (period5NowVolumeBUint256 + amountBUint256)) as uint64;
    // info.period5NowVolumeA = info.period5NowVolumeA + netAmountA;
    // info.period5NowVolumeB = info.period5NowVolumeB + netAmountB;

    // // 6
    // const period6IterFromNowObj = info.period6NowTime / this.period6.value;
    // const period6IterFromCurrTime = globals.latestTimestamp / this.period6.value;

    // if (period6IterFromNowObj !== period6IterFromCurrTime) {
    //   // update prev object
    //   info.period6PrevFeeA = info.period6NowFeeA;
    //   info.period6NowFeeA = 0;
    //   info.period6PrevFeeB = info.period6NowFeeB;
    //   info.period6NowFeeB = 0;
    //   info.period6PrevVWAP = info.period6NowVWAP;
    //   info.period6PrevVolumeA = info.period6NowVolumeA;
    //   info.period6NowVolumeA = 0;
    //   info.period6PrevVolumeB = info.period6NowVolumeB;
    //   info.period6NowVolumeB = 0;
    //   info.period6PrevTime = info.period6NowTime;
    //   if (info.period6NowTime === 0) {
    //     info.period6NowTime = globals.latestTimestamp;
    //   } else {
    //     info.period6NowTime = period6IterFromCurrTime * this.period6.value;
    //   }
    // }
    // // update current object
    // info.period6NowFeeA = info.period6NowFeeA + feeAmountA;
    // info.period6NowFeeB = info.period6NowFeeB + feeAmountB;
    // const period6NowVolumeBUint256 = info.period6NowVolumeB as uint256;
    // const period6NowVWAPUint256 = info.period6NowVWAP as uint256;
    // info.period6NowVWAP = ((period6NowVolumeBUint256 * period6NowVWAPUint256 + amountBUint256 * priceUint256) /
    //   (period6NowVolumeBUint256 + amountBUint256)) as uint64;
    // info.period6NowVolumeA = info.period6NowVolumeA + netAmountA;
    // info.period6NowVolumeB = info.period6NowVolumeB + netAmountB;
    return info;
  }

  /**
   * This metod registers the trade and calculates and store the trade statistics
   *
   * @param appPoolId Liquidity pool smart contract
   * @param assetA Asset A
   * @param assetB Asset B
   * @param priceFrom The original price
   * @param priceTo The new price
   * @param amountA Asset A amount spent or received
   * @param amountB Asset B amount spent or received
   * @param feeAmountA Fees paid in asset A if any
   * @param feeAmountB Fees paid in asset B if any
   * @param s Scale multiplier
   */
  registerTrade(
    appPoolId: AppID,
    assetA: AssetID,
    assetB: AssetID,
    priceFrom: uint64,
    priceTo: uint64,
    amountA: uint64,
    amountB: uint64,
    feeAmountA: uint64,
    feeAmountB: uint64,
    s: uint64
  ) {
    // increaseOpcodeBudget();
    // increaseOpcodeBudget();
    // increaseOpcodeBudget();
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    assert(appPoolId === globals.callerApplicationID);
    assert(s === SCALE);

    this.tradeEvent.log({
      appPoolId: appPoolId,
      assetA: assetA,
      assetB: assetB,
      priceFrom: priceFrom,
      priceTo: priceTo,
      amountA: amountA,
      amountB: amountB,
      feeAmountA: feeAmountA,
      feeAmountB: feeAmountB,
      s: s,
    });

    this.updatePriceBoxInfo(appPoolId, assetA, assetB, priceFrom, priceTo, amountA, amountB, feeAmountA, feeAmountB);
    this.updatePriceBoxAggregated(assetA, assetB, priceFrom, priceTo, amountA, amountB, feeAmountA, feeAmountB);
  }

  /**
   * addressExecutiveFee can perfom key registration for this LP pool
   *
   * Only addressExecutiveFee is allowed to execute this method.
   */
  sendOnlineKeyRegistration(
    appBiatecConfigProvider: AppID,
    votePK: bytes,
    selectionPK: bytes,
    stateProofPK: bytes,
    voteFirst: uint64,
    voteLast: uint64,
    voteKeyDilution: uint64,
    fee: uint64
  ): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef') as Address;
    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment
    assert(
      this.txn.sender === addressExecutiveFee,
      'Only fee executor setup in the config can take the collected fees'
    );
    sendOnlineKeyRegistration({
      selectionPK: selectionPK,
      stateProofPK: stateProofPK,
      voteFirst: voteFirst,
      voteKeyDilution: voteKeyDilution,
      voteLast: voteLast,
      votePK: votePK,
      fee: fee,
    });
  }

  /**
   * If someone deposits excess assets to this smart contract biatec can use them.
   *
   * Only addressExecutiveFee is allowed to execute this method.
   *
   * @param appBiatecConfigProvider Biatec config app. Only addressExecutiveFee is allowed to execute this method.
   * @param asset Asset to withdraw. If native token, then zero
   * @param amount Amount of the asset to be withdrawn
   */
  withdrawExcessAssets(appBiatecConfigProvider: AppID, asset: AssetID, amount: uint64): uint64 {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef') as Address;
    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment
    assert(
      this.txn.sender === addressExecutiveFee,
      'Only fee executor setup in the config can take the collected fees'
    );

    this.doAxfer(this.txn.sender, asset, amount);

    return amount;
  }

  /**
   * Executes xfer of pay payment methods to specified receiver from smart contract aggregated account with specified asset and amount in tokens decimals
   * @param receiver Receiver
   * @param asset Asset. Zero for algo
   * @param amount Amount to transfer
   */
  private doAxfer(receiver: Address, asset: AssetID, amount: uint64): void {
    if (asset.id === 0) {
      sendPayment({
        receiver: receiver,
        amount: amount,
        fee: 0,
      });
    } else {
      sendAssetTransfer({
        assetReceiver: receiver,
        xferAsset: asset,
        assetAmount: amount,
        fee: 0,
      });
    }
  }

  /**
   * Retuns the full price info for the asset pair. If app pool is defined, then it returns the pool info.
   * @param assetA Asset A must be less than Asset B
   * @param assetB Asset B
   * @param appPoolId Liquidity pool app id. If zero, then aggregated price info is returned.
   * @returns AppPoolInfo with the price info for the asset pair
   */
  @abi.readonly
  public getPrice(assetA: AssetID, assetB: AssetID, appPoolId: AppID): AppPoolInfo {
    if (appPoolId.id > 0) {
      // if pool is defined, then return the pool info
      const info = this.pools(appPoolId.id).value;
      assert(assetA.id === info.assetA);
      assert(assetB.id === info.assetB);
      return info;
    }

    const aggregatedIndex: AssetsCombined = {
      assetA: assetA.id,
      assetB: assetB.id,
    };
    assert(this.poolsAggregated(aggregatedIndex).exists, 'The asset pair is not registered');
    return this.poolsAggregated(aggregatedIndex).value;
  }

  /**
   * Calculates how much asset B will be taken from the smart contract on LP asset deposit
   * @param inAmount LP Asset amount in Base decimal representation..
   * @param assetBBalance Asset B balance. Variable ab, in base scale
   * @param liquidity Current liquidity. Variable L, in base scale
   *
   * @returns Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)
   */
  @abi.readonly
  calculateAssetBWithdrawOnLpDeposit(inAmount: uint256, assetBBalance: uint256, liquidity: uint256): uint256 {
    // const s = SCALE as uint256;
    // const percentageOfL = (inAmount * s) / liquidity;
    // const ret = (assetBBalance * percentageOfL) / s;
    const ret = (assetBBalance * inAmount) / liquidity;
    return ret;
  }
}
