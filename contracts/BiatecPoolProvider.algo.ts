import { Contract } from '@algorandfoundation/tealscript';

// eslint-disable-next-line no-unused-vars
const version = 'BIATEC-PP-01-01-01';
const SCALE = 1_000_000_000;

type AppPoolInfo = {
  isVerified: uint64;
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

  period5Duration: uint64;

  period5NowVolumeA: uint64;
  period5NowVolumeB: uint64;
  period5NowFeeA: uint64;
  period5NowFeeB: uint64;
  period5NowVWAP: uint64;
  period5NowTime: uint64;

  period5PrevVolumeA: uint64;
  period5PrevVolumeB: uint64;
  period5PrevFeeA: uint64;
  period5PrevFeeB: uint64;
  period5PrevVWAP: uint64;
  period5PrevTime: uint64;

  period6Duration: uint64;

  period6NowVolumeA: uint64;
  period6NowVolumeB: uint64;
  period6NowFeeA: uint64;
  period6NowFeeB: uint64;
  period6NowVWAP: uint64;
  period6NowTime: uint64;

  period6PrevVolumeA: uint64;
  period6PrevVolumeB: uint64;
  period6PrevFeeA: uint64;
  period6PrevFeeB: uint64;
  period6PrevVWAP: uint64;
  period6PrevTime: uint64;
};
type AssetsCombined = {
  assetA: uint64;
  assetB: uint64;
};
// eslint-disable-next-line no-unused-vars
class BiatecPoolProvider extends Contract {
  /**
   * Each LP pool is registered in this contract. Each pool has custom box and stores there the trading stats.
   */
  pools = BoxMap<uint64, AppPoolInfo>({ prefix: 'p' });

  poolsAggregated = BoxMap<AssetsCombined, AppPoolInfo>({ prefix: 's' });

  assets = BoxMap<uint64, AppID[]>({ prefix: 'a' });

  governor = GlobalStateKey<Address>({ key: 'g' });

  verificationClassSetter = GlobalStateKey<Address>({ key: 'v' });

  engagementClassSetter = GlobalStateKey<Address>({ key: 'e' });

  period1 = GlobalStateKey<uint64>({ key: 'p1' });

  period2 = GlobalStateKey<uint64>({ key: 'p2' });

  period3 = GlobalStateKey<uint64>({ key: 'p3' });

  period4 = GlobalStateKey<uint64>({ key: 'p4' });

  period5 = GlobalStateKey<uint64>({ key: 'p5' });

  period6 = GlobalStateKey<uint64>({ key: 'p6' });

  defaultVerified = GlobalStateKey<uint64>({ key: 'ver' });

  verifyRequirement = GlobalStateKey<uint64>({ key: 'verr' });

  /**
   * Biatec config provider
   */
  appBiatecConfigProvider = GlobalStateKey<AppID>({ key: 'B' });

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
    this.period2.value = 3600;
    this.period3.value = 3600 * 24;
    this.period4.value = 3600 * 24 * 7;
    this.period5.value = 3600 * 24 * 30;
    this.period6.value = 3600 * 24 * 365;
    this.defaultVerified.value = 0;
    this.verifyRequirement.value = 0;
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
    this.version.value = newVersion;
  }

  /**
   * This method is called by constructor of the luquidity pool
   *
   * @param appPoolId Luquidity pool id
   * @param assetA Asset A
   * @param assetB Asset B
   * @param verificationClass Verification class
   */
  registerPool(appPoolId: AppID, assetA: AssetID, assetB: AssetID, verificationClass: uint8): void {
    assert(!this.pools(appPoolId.id).exists);
    assert(globals.callerApplicationID === appPoolId);
    if (this.assets(assetA.id).exists) {
      this.assets(assetA.id).value.push(appPoolId);
    } else {
      const newWhitelist: AppID[] = [appPoolId];
      this.assets(assetA.id).value = newWhitelist;
    }

    if (this.assets(assetB.id).exists) {
      this.assets(assetB.id).value.push(appPoolId);
    } else {
      const newWhitelist: AppID[] = [appPoolId];
      this.assets(assetB.id).value = newWhitelist;
    }
    const data: AppPoolInfo = {
      assetA: assetA.id,
      assetB: assetB.id,
      isVerified: this.defaultVerified.value,
      verificationClass: verificationClass as uint64,

      latestPrice: 0,

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

      period5Duration: this.period5.value,

      period5NowFeeA: <uint64>0,
      period5NowFeeB: <uint64>0,
      period5NowTime: 0,
      period5NowVolumeA: <uint64>0,
      period5NowVolumeB: <uint64>0,
      period5NowVWAP: <uint64>0,
      period5PrevFeeA: <uint64>0,
      period5PrevFeeB: <uint64>0,
      period5PrevTime: 0,
      period5PrevVolumeA: <uint64>0,
      period5PrevVolumeB: <uint64>0,
      period5PrevVWAP: <uint64>0,

      period6Duration: this.period6.value,

      period6NowFeeA: <uint64>0,
      period6NowFeeB: <uint64>0,
      period6NowTime: 0,
      period6NowVolumeA: <uint64>0,
      period6NowVolumeB: <uint64>0,
      period6NowVWAP: <uint64>0,
      period6PrevFeeA: <uint64>0,
      period6PrevFeeB: <uint64>0,
      period6PrevTime: 0,
      period6PrevVolumeA: <uint64>0,
      period6PrevVolumeB: <uint64>0,
      period6PrevVWAP: <uint64>0,
    };
    this.pools(appPoolId.id).value = data;
    const aggregatedIndex: AssetsCombined = {
      assetA: assetA.id,
      assetB: assetB.id,
    };
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
    const period5IterFromNowObj = info.period5NowTime / this.period5.value;
    const period5IterFromCurrTime = globals.latestTimestamp / this.period5.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period5IterFromNowObj !== period5IterFromCurrTime) {
      // update prev object
      info.period5PrevFeeA = info.period5NowFeeA;
      info.period5NowFeeA = 0;
      info.period5PrevFeeB = info.period5NowFeeB;
      info.period5NowFeeB = 0;
      info.period5PrevVWAP = info.period5NowVWAP;
      info.period5PrevVolumeA = info.period5NowVolumeA;
      info.period5NowVolumeA = 0;
      info.period5PrevVolumeB = info.period5NowVolumeB;
      info.period5NowVolumeB = 0;
      info.period5PrevTime = info.period5NowTime;
      if (info.period5NowTime === 0) {
        info.period5NowTime = globals.latestTimestamp;
      } else {
        info.period5NowTime = period5IterFromCurrTime * this.period5.value;
      }
    }
    // update current object
    info.period5NowFeeA = info.period5NowFeeA + feeAmountA;
    info.period5NowFeeB = info.period5NowFeeB + feeAmountB;
    const period5NowVolumeBUint256 = info.period4NowVolumeB as uint256;
    const period5NowVWAPUint256 = info.period4NowVWAP as uint256;
    info.period5NowVWAP = ((period5NowVolumeBUint256 * period5NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period5NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period5NowVolumeA = info.period5NowVolumeA + netAmountA;
    info.period5NowVolumeB = info.period5NowVolumeB + netAmountB;

    // 6
    const period6IterFromNowObj = info.period6NowTime / this.period6.value;
    const period6IterFromCurrTime = globals.latestTimestamp / this.period6.value;

    if (period6IterFromNowObj !== period6IterFromCurrTime) {
      // update prev object
      info.period6PrevFeeA = info.period6NowFeeA;
      info.period6NowFeeA = 0;
      info.period6PrevFeeB = info.period6NowFeeB;
      info.period6NowFeeB = 0;
      info.period6PrevVWAP = info.period6NowVWAP;
      info.period6PrevVolumeA = info.period6NowVolumeA;
      info.period6NowVolumeA = 0;
      info.period6PrevVolumeB = info.period6NowVolumeB;
      info.period6NowVolumeB = 0;
      info.period6PrevTime = info.period6NowTime;
      if (info.period6NowTime === 0) {
        info.period6NowTime = globals.latestTimestamp;
      } else {
        info.period6NowTime = period6IterFromCurrTime * this.period6.value;
      }
    }
    // update current object
    info.period6NowFeeA = info.period6NowFeeA + feeAmountA;
    info.period6NowFeeB = info.period6NowFeeB + feeAmountB;
    const period6NowVolumeBUint256 = info.period4NowVolumeB as uint256;
    const period6NowVWAPUint256 = info.period4NowVWAP as uint256;
    info.period6NowVWAP = ((period6NowVolumeBUint256 * period6NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period6NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period6NowVolumeA = info.period6NowVolumeA + netAmountA;
    info.period6NowVolumeB = info.period6NowVolumeB + netAmountB;
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
    const period5IterFromNowObj = info.period5NowTime / this.period5.value;
    const period5IterFromCurrTime = globals.latestTimestamp / this.period5.value;
    // 1710960395 / 86400 = 19802
    // 19802 * 86400 = 1710892800
    if (period5IterFromNowObj !== period5IterFromCurrTime) {
      // update prev object
      info.period5PrevFeeA = info.period5NowFeeA;
      info.period5NowFeeA = 0;
      info.period5PrevFeeB = info.period5NowFeeB;
      info.period5NowFeeB = 0;
      info.period5PrevVWAP = info.period5NowVWAP;
      info.period5PrevVolumeA = info.period5NowVolumeA;
      info.period5NowVolumeA = 0;
      info.period5PrevVolumeB = info.period5NowVolumeB;
      info.period5NowVolumeB = 0;
      info.period5PrevTime = info.period5NowTime;
      if (info.period5NowTime === 0) {
        info.period5NowTime = globals.latestTimestamp;
      } else {
        info.period5NowTime = period5IterFromCurrTime * this.period5.value;
      }
    }
    // update current object
    info.period5NowFeeA = info.period5NowFeeA + feeAmountA;
    info.period5NowFeeB = info.period5NowFeeB + feeAmountB;
    const period5NowVolumeBUint256 = info.period4NowVolumeB as uint256;
    const period5NowVWAPUint256 = info.period4NowVWAP as uint256;
    info.period5NowVWAP = ((period5NowVolumeBUint256 * period5NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period5NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period5NowVolumeA = info.period5NowVolumeA + netAmountA;
    info.period5NowVolumeB = info.period5NowVolumeB + netAmountB;

    // 6
    const period6IterFromNowObj = info.period6NowTime / this.period6.value;
    const period6IterFromCurrTime = globals.latestTimestamp / this.period6.value;

    if (period6IterFromNowObj !== period6IterFromCurrTime) {
      // update prev object
      info.period6PrevFeeA = info.period6NowFeeA;
      info.period6NowFeeA = 0;
      info.period6PrevFeeB = info.period6NowFeeB;
      info.period6NowFeeB = 0;
      info.period6PrevVWAP = info.period6NowVWAP;
      info.period6PrevVolumeA = info.period6NowVolumeA;
      info.period6NowVolumeA = 0;
      info.period6PrevVolumeB = info.period6NowVolumeB;
      info.period6NowVolumeB = 0;
      info.period6PrevTime = info.period6NowTime;
      if (info.period6NowTime === 0) {
        info.period6NowTime = globals.latestTimestamp;
      } else {
        info.period6NowTime = period6IterFromCurrTime * this.period6.value;
      }
    }
    // update current object
    info.period6NowFeeA = info.period6NowFeeA + feeAmountA;
    info.period6NowFeeB = info.period6NowFeeB + feeAmountB;
    const period6NowVolumeBUint256 = info.period4NowVolumeB as uint256;
    const period6NowVWAPUint256 = info.period4NowVWAP as uint256;
    info.period6NowVWAP = ((period6NowVolumeBUint256 * period6NowVWAPUint256 + amountBUint256 * priceUint256) /
      (period6NowVolumeBUint256 + amountBUint256)) as uint64;
    info.period6NowVolumeA = info.period6NowVolumeA + netAmountA;
    info.period6NowVolumeB = info.period6NowVolumeB + netAmountB;
    return info;
  }

  /**
   * This metod registers the trade and calculates and store the trade statistics
   *
   * @param appPoolId Liqudity pool smart contract
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
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    assert(appPoolId === globals.callerApplicationID);
    assert(s === SCALE);

    this.updatePriceBoxInfo(appPoolId, assetA, assetB, priceFrom, priceTo, amountA, amountB, feeAmountA, feeAmountB);
    const info = this.pools(appPoolId.id).value;

    if (info.isVerified >= this.verifyRequirement.value) {
      // allow aggregated stats to be updated only after the smart contract has been checked it is legit
      this.updatePriceBoxAggregated(assetA, assetB, priceFrom, priceTo, amountA, amountB, feeAmountA, feeAmountB);
    }
  }

  setGlobalVerifiedValues(defaultVerified: uint64, requirement: uint64) {
    assert(this.txn.sender === this.governor.value, 'Only governor can run setup verification status');
    this.verifyRequirement.value = requirement;
    this.defaultVerified.value = defaultVerified;
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
    voteKeyDilution: uint64
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
      fee: 0,
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
}
