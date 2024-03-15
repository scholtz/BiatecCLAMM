import { Contract } from '@algorandfoundation/tealscript';

// eslint-disable-next-line no-unused-vars
const version = 'BIATEC-PP-01-01-01';

type AppPoolInfo = {
  isVerified: boolean;
  assetA: AssetID;
  assetB: AssetID;
  fee: uint32;
  verificationClass: uint8;
  feeBase: uint32;
  period1Volume: uint64;
  period1VWAP: uint64;
  period1Time: uint64;
  period2Volume: uint64;
  period2VWAP: uint64;
  period2Time: uint64;
  period3Volume: uint64;
  period3VWAP: uint64;
  period3Time: uint64;
  period4Volume: uint64;
  period4VWAP: uint64;
  period4Time: uint64;
};

// eslint-disable-next-line no-unused-vars
class BiatecPoolProvider extends Contract {
  /**
   * Each LP pool is registered in this contract. Each pool has custom box and stores there the trading stats.
   */
  pools = BoxMap<AppID, AppPoolInfo>({ prefix: 'p' });

  governor = GlobalStateKey<Address>({ key: 'g' });

  verificationClassSetter = GlobalStateKey<Address>({ key: 'v' });

  engagementClassSetter = GlobalStateKey<Address>({ key: 'e' });

  /**
   * Initial setup
   */
  createApplication(): void {
    log(version);
  }

  registerPool(
    appPoolId: AppID
    // assetA: AssetID,
    // assetB: AssetID,
    // fee: uint32,
    // verificationClass: uint8,
    // feeBase: uint32
  ) {
    assert(this.pools(appPoolId).exists);
    this.pools(appPoolId).create();
    // const data: AppPoolInfo = {
    //   assetA: assetA,
    //   assetB: assetB,
    //   fee: fee,
    //   feeBase: feeBase,
    //   isVerified: false,
    //   period1Time: 0,
    //   period1Volume: 0,
    //   period1VWAP: 0,
    //   verificationClass: 0,
    //   period2Volume: 0,
    //   period2VWAP: 0,
    //   period2Time: 0,
    //   period3Volume: 0,
    //   period3VWAP: 0,
    //   period3Time: 0,
    //   period4Volume: 0,
    //   period4VWAP: 0,
    //   period4Time: 0,
    // };
    // this.pools(appPoolId).value = data;
  }
}
