import { Contract } from '@algorandfoundation/tealscript';

// eslint-disable-next-line no-unused-vars
const version = 'BIATEC-CLAMM-01-01-01';
const LP_TOKEN_DECIMALS = 6;
// const TOTAL_SUPPLY = 18_000_000_000_000_000_000n;
const TOTAL_SUPPLY = '18000000000000000000';
const SCALE = 1_000_000_000;
const s = <uint256>1_000_000_000;
// const SCALEUINT256 = <uint256>1_000_000_000;
const SCALE_DECIMALS = 9;

/**
 * Object returned by getUser(user: Address): UserInfo
 * Holds information about the user registered to Biatec Identity.
 */
type UserInfoV1 = {
  /**
   * Version of this structure.
   */
  version: uint8;
  verificationStatus: uint64;
  verificationClass: uint64;
  /**
   * Each user who interacts with Biatec services will receive engagement points
   */
  biatecEngagementPoints: uint64;
  biatecEngagementRank: uint64;
  avmEngagementPoints: uint64;
  avmEngagementRank: uint64;
  tradingEngagementPoints: uint64;
  tradingEngagementRank: uint64;
  feeMultiplier: uint256;
  base: uint256;
  isLocked: boolean;
  kycExpiration: uint64;
  investorForExpiration: uint64;
  isProfessionalInvestor: boolean;
};

type AmmStatus = {
  scale: uint64;
  assetABalance: uint64;
  assetBBalance: uint64;
  realABalance: uint64;
  realBBalance: uint64;
  priceMinSqrt: uint64;
  priceMaxSqrt: uint64;
  currentLiqudity: uint64;
  releasedLiqudity: uint64;
  liqudityUsersFromFees: uint64;
  liqudityBiatecFromFees: uint64;
  assetA: uint64;
  assetB: uint64;
  poolToken: uint64;
  price: uint64;
  fee: uint64;
  biatecFee: uint64;
  verificationClass: uint64;
};
// eslint-disable-next-line no-unused-vars
class BiatecClammPool extends Contract {
  assetA = GlobalStateKey<uint64>({ key: 'a' });

  assetB = GlobalStateKey<uint64>({ key: 'b' });

  assetLp = GlobalStateKey<uint64>({ key: 'lp' });

  assetABalance = GlobalStateKey<uint256>({ key: 'ab' });

  assetBBalance = GlobalStateKey<uint256>({ key: 'bb' });

  priceMin = GlobalStateKey<uint64>({ key: 'pMin' });

  priceMax = GlobalStateKey<uint64>({ key: 'pMax' });

  priceMinSqrt = GlobalStateKey<uint256>({ key: 'pMinS' });

  priceMaxSqrt = GlobalStateKey<uint256>({ key: 'pMaxS' });

  Liqudity = GlobalStateKey<uint256>({ key: 'L' });

  LiqudityUsersFromFees = GlobalStateKey<uint256>({ key: 'Lu' });

  LiqudityBiatecFromFees = GlobalStateKey<uint256>({ key: 'Lb' });

  fee = GlobalStateKey<uint64>({ key: 'f' });

  currentPrice = GlobalStateKey<uint64>({ key: 'price' });

  scale = GlobalStateKey<uint64>({ key: 'scale' });

  appBiatecConfigProvider = GlobalStateKey<AppID>({ key: 'bc' });

  verificationClass = GlobalStateKey<uint64>({ key: 'c' });

  version = GlobalStateKey<bytes>({ key: 'scver' });

  createApplication(): void {
    log(version);
    this.scale.value = SCALE;
    this.fee.value = <uint64>0;
    this.Liqudity.value = <uint256>0;
    this.LiqudityBiatecFromFees.value = <uint256>0;
    this.LiqudityUsersFromFees.value = <uint256>0;
    this.priceMax.value = 0;
    this.version.value = version;
  }

  updateApplication(appBiatecConfigProvider: AppID, newVersion: bytes): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'ERR_CONFIG'); // assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressUdpater = appBiatecConfigProvider.globalState('u') as Address;
    assert(this.txn.sender === addressUdpater, 'ERR_UPDATER'); // 'Only addressUdpater setup in the config can update application');
    this.version.value = newVersion;
  }

  @abi.readonly
  getCurrentPrice(): uint64 {
    return this.currentPrice.value;
  }

  @abi.readonly
  getPriceDivider(): uint64 {
    return this.scale.value;
  }

  @abi.readonly
  getLPTokenId(): uint64 {
    return this.assetLp.value;
  }

  bootstrap(
    assetA: AssetID,
    assetB: AssetID,
    appBiatecConfigProvider: AppID,
    appBiatecPoolProvider: AppID,
    txSeed: PayTxn,
    fee: uint64,
    priceMin: uint64,
    priceMax: uint64,
    currentPrice: uint64,
    verificationClass: uint8
  ): uint64 {
    verifyPayTxn(txSeed, { receiver: this.app.address, amount: { greaterThanEqualTo: 300_000 } });
    assert(this.priceMax.value === 0, 'ERR_PRICE_MAX'); // It is not possible to call bootrap twice
    assert(this.txn.sender === this.app.creator, 'ERR_SENDER'); // 'Only creator of the app can set it up'
    assert(priceMax > 0, 'ERR_PRICE'); // 'You must set price'
    assert(assetA < assetB);
    assert(fee <= SCALE / 10); // fee must be lower then 10%
    assert(verificationClass <= 4); // verificationClass
    assert(!this.currentPrice.exists);
    if (assetA.id > 0) {
      assert(assetA.decimals <= SCALE_DECIMALS); // asset A can be algo
    }
    assert(assetB.decimals <= SCALE_DECIMALS);

    assert(this.fee.value <= 0, 'ERR_FEE'); // , 'You can bootstrap contract only once'); // check that this contract deployment was not yet initialized

    const poolProviderFromConfig = appBiatecConfigProvider.globalState('p') as AppID;
    assert(
      appBiatecPoolProvider === poolProviderFromConfig,
      'ERR_CONFIG' // 'appBiatecPoolProvider must match to the config in appBiatecConfigProvider'
    );
    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment

    this.appBiatecConfigProvider.value = appBiatecConfigProvider;

    this.priceMin.value = priceMin;
    this.priceMax.value = priceMax;
    this.priceMinSqrt.value = sqrt((priceMin as uint256) * s);
    this.priceMaxSqrt.value = sqrt((priceMax as uint256) * s);
    this.assetABalance.value = <uint256>0;
    this.assetBBalance.value = <uint256>0;
    this.currentPrice.value = currentPrice;

    this.assetA.value = assetA.id;
    this.assetB.value = assetB.id;
    this.assetLp.value = this.doCreatePoolToken(assetA, assetB).id;
    this.fee.value = fee;
    this.doOptIn(assetA);
    this.doOptIn(assetB);

    sendMethodCall<[AppID, AssetID, AssetID, uint8], void>({
      name: 'registerPool',
      methodArgs: [globals.currentApplicationID, assetA, assetB, verificationClass],
      fee: 0,
      applicationID: appBiatecPoolProvider,
    });

    return this.assetLp.value;
  }

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

  private doOptIn(asset: AssetID): void {
    if (asset.id > 0) {
      // if asset id = 0 we do not have to opt in to native token
      this.doAxfer(this.app.address, asset, 0);
    }
  }

  private doCreatePoolToken(assetA: AssetID, assetB: AssetID): AssetID {
    let nameAssetA = 'ALGO';
    if (assetA.id > 0) {
      nameAssetA = assetA.unitName;
    }

    const name =
      'B-' + itob(this.verificationClass.value) + '-' + nameAssetA + '-' + assetB.unitName + '-' + itob(this.fee.value); // TODO

    return sendAssetCreation({
      configAssetName: name,
      configAssetUnitName: 'BLP', // Biatec LP token
      // eslint-disable-next-line no-loss-of-precision
      configAssetTotal: Uint<64>(TOTAL_SUPPLY),
      configAssetDecimals: LP_TOKEN_DECIMALS,
      configAssetManager: this.app.address,
      configAssetReserve: this.app.address,
    });
  }

  private checkAssetsAB(assetA: AssetID, assetB: AssetID) {
    assert(assetA.id === this.assetA.value, 'assetA does not match');
    assert(assetB.id === this.assetB.value, 'assetB does not match');
  }

  private checkAssets(assetA: AssetID, assetB: AssetID, assetLp: AssetID) {
    this.checkAssetsAB(assetA, assetB);
    assert(assetLp.id === this.assetLp.value, 'assetLp does not match');
  }

  addLiquidity(
    appBiatecConfigProvider: AppID,
    appBiatecIdentityProvider: AppID,
    txAssetADeposit: Txn,
    txAssetBDeposit: Txn,
    assetA: AssetID,
    assetB: AssetID,
    assetLp: AssetID
  ): uint64 {
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    /// well formed mint
    this.checkAssets(assetA, assetB, assetLp);

    this.verifyIdentity(appBiatecConfigProvider, appBiatecIdentityProvider);

    let assetADecimals = 6;
    if (assetA.id > 0) assetADecimals = assetA.decimals;
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetADecimals)) as uint256;
    // if assetB.decimals == 6 then assetBDelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;
    // if assetLp.decimals == 6 then assetLpDelicmalScale2Scale = 1000
    const assetLpDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;

    const aDepositInBaseScale = (txAssetADeposit.assetAmount as uint256) * assetADelicmalScale2Scale;
    const bDepositInBaseScale = (txAssetBDeposit.assetAmount as uint256) * assetBDelicmalScale2Scale;

    if (assetA.id > 0) {
      assert(txAssetADeposit.typeEnum === TransactionType.AssetTransfer);
    } else {
      assert(txAssetADeposit.typeEnum === TransactionType.Payment);
    }

    if (txAssetADeposit.typeEnum === TransactionType.AssetTransfer) {
      const xfer = txAssetADeposit as AssetTransferTxn;
      verifyAssetTransferTxn(xfer, {
        assetReceiver: this.app.address,
        xferAsset: assetA,
        assetAmount: { greaterThanEqualTo: 0 },
      });
    } else if (txAssetADeposit.typeEnum === TransactionType.Payment) {
      const payTx = txAssetADeposit as PayTxn;
      verifyPayTxn(payTx, {
        receiver: this.app.address,
        amount: { greaterThanEqualTo: 0 },
      });
    } else {
      assert(false, 'Unsupported tx type of the asset A');
    }

    if (txAssetBDeposit.typeEnum === TransactionType.AssetTransfer) {
      const xfer = txAssetBDeposit as AssetTransferTxn;
      verifyAssetTransferTxn(xfer, {
        assetReceiver: this.app.address,
        xferAsset: assetB,
        assetAmount: { greaterThanEqualTo: 0 },
      });
    } else if (txAssetBDeposit.typeEnum === TransactionType.Payment) {
      const payTx = txAssetBDeposit as PayTxn;
      verifyPayTxn(payTx, {
        receiver: this.app.address,
        amount: { greaterThanEqualTo: 0 },
      });
    } else {
      assert(false, 'Unsupported tx type of the asset B');
    }

    // if minprice == maxprice

    if (this.priceMinSqrt.value === this.priceMaxSqrt.value) {
      return this.processAddLiqudity(aDepositInBaseScale, bDepositInBaseScale, assetLpDelicmalScale2Scale, assetLp);
    }

    // else

    if (this.assetABalance.value === <uint256>0 && this.assetBBalance.value === <uint256>0) {
      // calculate LP position
      // this.assetABalance.value = aDepositInBaseScale;
      // this.assetBBalance.value = bDepositInBaseScale;

      const ret = this.processAddLiqudity(
        aDepositInBaseScale,
        bDepositInBaseScale,
        assetLpDelicmalScale2Scale,
        assetLp
      );

      const newPrice = this.calculatePrice(
        this.assetABalance.value, // assetAQuantity: uint256,
        this.assetBBalance.value, // assetBQuantity: uint256,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value, // priceMaxSqrt: uint256,
        this.Liqudity.value // liquidity: uint256
      );

      this.currentPrice.value = newPrice as uint64;
      return ret;
    }

    // add asset to LP position

    // first we need to find if user sent more asset a or asset b
    // inAmountA: uint256, assetABalance: uint256, assetBBalance: uint256
    const a = this.calculateAssetADepositOnAssetBDeposit(
      aDepositInBaseScale,
      bDepositInBaseScale,
      this.assetABalance.value,
      this.assetBBalance.value
    );

    const b = this.calculateAssetBDepositOnAssetADeposit(
      aDepositInBaseScale,
      bDepositInBaseScale,
      this.assetABalance.value,
      this.assetBBalance.value
    );
    const expectedADepositB64 = (a / assetADelicmalScale2Scale) as uint64;
    const expectedBDepositB64 = (b / assetBDelicmalScale2Scale) as uint64;

    if (expectedADepositB64 > txAssetADeposit.assetAmount) {
      if (expectedBDepositB64 > txAssetBDeposit.assetAmount) {
        assert(false, 'Dominant is asset B'); // there should not be case to return bot asset a and asset b
      }
      if (txAssetBDeposit.assetAmount - expectedBDepositB64 > 0) {
        // return excess asset B to the user
        this.doAxfer(this.txn.sender, assetB, txAssetBDeposit.assetAmount - expectedBDepositB64);
      }
      const realAssetADeposit = aDepositInBaseScale;
      const realAssetBDeposit = (expectedBDepositB64 as uint256) * assetBDelicmalScale2Scale;
      return this.processAddLiqudity(realAssetADeposit, realAssetBDeposit, assetLpDelicmalScale2Scale, assetLp);
    }

    if (expectedBDepositB64 > txAssetBDeposit.assetAmount) {
      if (expectedADepositB64 > txAssetADeposit.assetAmount) {
        assert(false, 'Dominant is asset A'); // there should not be case to return bot asset a and asset b
      }
      if (txAssetADeposit.assetAmount - expectedADepositB64 > 0) {
        // return excess asset A to the user
        this.doAxfer(this.txn.sender, assetB, txAssetADeposit.assetAmount - expectedADepositB64);
      }
      const realAssetADeposit = (expectedADepositB64 as uint256) * assetADelicmalScale2Scale;
      const realAssetBDeposit = bDepositInBaseScale;
      return this.processAddLiqudity(realAssetADeposit, realAssetBDeposit, assetLpDelicmalScale2Scale, assetLp);
    }
    if (expectedADepositB64 === txAssetADeposit.assetAmount && expectedBDepositB64 === txAssetBDeposit.assetAmount) {
      const realAssetADeposit = aDepositInBaseScale;
      const realAssetBDeposit = bDepositInBaseScale;
      return this.processAddLiqudity(realAssetADeposit, realAssetBDeposit, assetLpDelicmalScale2Scale, assetLp);
    }

    if (expectedADepositB64 === txAssetADeposit.assetAmount && expectedBDepositB64 === txAssetBDeposit.assetAmount) {
      const realAssetADeposit = aDepositInBaseScale;
      const realAssetBDeposit = bDepositInBaseScale;
      return this.processAddLiqudity(realAssetADeposit, realAssetBDeposit, assetLpDelicmalScale2Scale, assetLp);
    }

    if (expectedADepositB64 === 0 && expectedBDepositB64 === 0) {
      // return all assets to the user.. he deposited asset other asset then is currently being fully used in the pool
      if (txAssetADeposit.assetAmount > 0) {
        this.doAxfer(this.txn.sender, assetA, txAssetADeposit.assetAmount);
      }
      if (txAssetBDeposit.assetAmount > 0) {
        this.doAxfer(this.txn.sender, assetB, txAssetBDeposit.assetAmount);
      }
      return 0;
    }
    assert(false, 'failed to calculate exact liqudidity'); // we should not get here
    return expectedBDepositB64; //
  }

  /**
   * This method is used in addLiquidity to process the liquidity addition from calculated values
   * @param realAssetADeposit Real asset a deposit
   * @param realAssetBDeposit Real asset b deposit
   * @param assetLpDelicmalScale2Scale LP decimal scale
   * @param assetLp LP Asset
   * @returns LP Token quantity distributed
   */
  private processAddLiqudity(
    realAssetADeposit: uint256,
    realAssetBDeposit: uint256,
    assetLpDelicmalScale2Scale: uint256,
    assetLp: AssetID
  ): uint64 {
    increaseOpcodeBudget();
    // SET NEW ASSET A AND B VALUES
    this.assetABalance.value = this.assetABalance.value + realAssetADeposit;
    this.assetBBalance.value = this.assetBBalance.value + realAssetBDeposit;

    // CALCULATE NEW LIQUIDITY
    const x = this.assetABalance.value;
    const y = this.assetBBalance.value;
    const priceMin = this.priceMin.value as uint256;
    const priceMax = this.priceMax.value as uint256;
    const priceMinSqrt = this.priceMinSqrt.value;
    const priceMaxSqrt = this.priceMaxSqrt.value;
    let newLiqudity = <uint256>0;
    if (priceMin === priceMax) {
      newLiqudity = this.calculateLiquidityFlatPrice(x, y, priceMin);
    } else {
      const D_SQRT = this.calculateLiquidityD(x, y, priceMin, priceMax, priceMinSqrt, priceMaxSqrt);
      newLiqudity = this.calculateLiquidityWithD(x, y, priceMinSqrt, priceMaxSqrt, D_SQRT);
    }
    // SEND NEW LP TOKENS TO USER
    const lpTokensToSend = ((newLiqudity - this.Liqudity.value) / assetLpDelicmalScale2Scale) as uint64;

    this.Liqudity.value = newLiqudity;
    // send LP tokens to user
    this.doAxfer(this.txn.sender, assetLp, lpTokensToSend);
    // return lpTokensToSend;
    // 2000000000n
    // 2000000000n

    // assert(lpTokensToSend > 0, 'Adding the liqudity would lead to zero LP tokens deposited to the user'); // Liquidity provider protection.. He must receive at least 1 LP token
    assert(lpTokensToSend > 0, 'LP-ZERO-ERR'); // Liquidity provider protection.. He must receive at least 1 LP token
    return lpTokensToSend as uint64;
  }

  /**
   * This method retrieves from the liquidity provider LP token and returns Asset A and Asset B from the Automated Market Maker Concentrated Liqudidity Pool
   * @param appBiatecConfigProvider Configuration reference
   * @param appBiatecIdentityProvider Identity service reference
   * @param txLpXfer Transfer of the LP token
   * @param assetLp LP pool asset
   * @param assetA Asset A
   * @param assetB Asset B
   * @returns LP position reduced
   */
  removeLiquidity(
    appBiatecConfigProvider: AppID,
    appBiatecIdentityProvider: AppID,
    txLpXfer: AssetTransferTxn,
    assetA: AssetID,
    assetB: AssetID,
    assetLp: AssetID
  ): uint256 {
    /// well formed mint
    this.checkAssets(assetA, assetB, assetLp);
    verifyAssetTransferTxn(txLpXfer, {
      assetReceiver: this.app.address,
      xferAsset: assetLp,
      assetAmount: { greaterThanEqualTo: 0 },
    });

    this.verifyIdentity(appBiatecConfigProvider, appBiatecIdentityProvider);

    // increase the budget by 1
    increaseOpcodeBudget();
    increaseOpcodeBudget();

    let assetADecimals = 6;
    if (assetA.id > 0) assetADecimals = assetA.decimals;
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetADecimals)) as uint256;
    // if assetB.decimals == 6 then assetBDelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;
    // if assetLp.decimals == 6 then assetLpDelicmalScale2Scale = 1000
    const assetLpDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;

    const lpDelta = txLpXfer.assetAmount as uint256;
    const lpDeltaBase = lpDelta * assetLpDelicmalScale2Scale;
    let lpDeltaWithFees = lpDeltaBase;
    const lpWithOthers = this.calculateDistributedLiquidity(assetLp, lpDelta);
    if (lpWithOthers > <uint256>0) {
      // 10 / 1000
      const myPortion = (lpDeltaBase * s) / lpWithOthers;
      const myPortionOfFeesCollected = (this.LiqudityUsersFromFees.value * myPortion) / s;
      lpDeltaWithFees = lpDeltaBase + myPortionOfFeesCollected;
      this.LiqudityUsersFromFees.value = this.LiqudityUsersFromFees.value - myPortionOfFeesCollected;
    }
    const aToSend = this.calculateAssetAWithdrawOnLpDeposit(
      lpDeltaWithFees,
      this.assetABalance.value,
      this.Liqudity.value
    );
    const aToSend64 = (aToSend / assetADelicmalScale2Scale) as uint64;
    if (aToSend64 > 0) {
      this.doAxfer(this.txn.sender, assetA, aToSend64);
    }
    const bToSend = this.calculateAssetAWithdrawOnLpDeposit(
      lpDeltaWithFees,
      this.assetBBalance.value,
      this.Liqudity.value
    );
    const bToSend64 = (bToSend / assetBDelicmalScale2Scale) as uint64;
    if (bToSend64 > 0) {
      this.doAxfer(this.txn.sender, assetB, bToSend64);
    }

    // assert(aToSend64 > 0 || bToSend64 > 0, 'Removal of the liquidity would lead to zero withdrawal');
    assert(aToSend64 > 0 || bToSend64 > 0, 'ERR-REM-ZERO');

    const newAssetA = this.assetABalance.value - aToSend;
    const newAssetB = this.assetBBalance.value - bToSend;
    this.assetABalance.value = newAssetA;
    this.assetBBalance.value = newAssetB;

    // verify that L with new x and y is correctly calculated
    // this part can be removed if all tests goes through to lower cost by 1 tx
    let lAfter = <uint256>0;
    if (this.priceMin.value === this.priceMax.value) {
      lAfter = this.calculateLiquidityFlatPrice(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMin.value as uint256
      );
    } else {
      const D_SQRT = this.calculateLiquidityD(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMin.value as uint256, // priceMin: uint256,
        this.priceMax.value as uint256, // priceMax: uint256,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value // priceMaxSqrt: uint256,
      );
      lAfter = this.calculateLiquidityWithD(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value, // priceMaxSqrt: uint256,
        D_SQRT
      );
    }
    this.Liqudity.value = lAfter;
    return lpDeltaWithFees / assetLpDelicmalScale2Scale;
  }

  removeLiquidityAdmin(
    appBiatecConfigProvider: AppID,
    assetA: AssetID,
    assetB: AssetID,
    assetLp: AssetID,
    amount: uint256
  ): uint256 {
    /// well formed mint
    this.checkAssets(assetA, assetB, assetLp);

    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value);
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef') as Address;

    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment

    // assert(
    //   this.txn.sender === addressExecutiveFee,
    //   'Only fee executor setup in the config can take the collected fees'
    // );
    assert(this.txn.sender === addressExecutiveFee, 'ERR-EXEC-ONLY');
    // increase the budget by 1
    increaseOpcodeBudget();
    increaseOpcodeBudget();

    let assetADecimals = 6;
    if (assetA.id > 0) assetADecimals = assetA.decimals;
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetADecimals)) as uint256;
    // if assetB.decimals == 6 then assetBDelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;
    // if assetLp.decimals == 6 then assetLpDelicmalScale2Scale = 1000
    const assetLpDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;

    let lpDeltaWithFees = amount;
    if (lpDeltaWithFees === <uint256>0) lpDeltaWithFees = this.LiqudityBiatecFromFees.value;
    assert(
      lpDeltaWithFees <= this.LiqudityBiatecFromFees.value,
      'ERR-TOO-MUCH' // 'Biatec cannot take more lp then is collected in fees'
    );
    this.LiqudityBiatecFromFees.value = this.LiqudityBiatecFromFees.value - lpDeltaWithFees;
    const aToSend = this.calculateAssetAWithdrawOnLpDeposit(
      lpDeltaWithFees,
      this.assetABalance.value,
      this.Liqudity.value
    );
    const aToSend64 = (aToSend / assetADelicmalScale2Scale) as uint64;
    if (aToSend64 > 0) {
      this.doAxfer(this.txn.sender, assetA, aToSend64);
    }
    const bToSend = this.calculateAssetAWithdrawOnLpDeposit(
      lpDeltaWithFees,
      this.assetBBalance.value,
      this.Liqudity.value
    );
    const bToSend64 = (bToSend / assetBDelicmalScale2Scale) as uint64;
    if (bToSend64 > 0) {
      this.doAxfer(this.txn.sender, assetB, bToSend64);
    }

    const newAssetA = this.assetABalance.value - aToSend;
    const newAssetB = this.assetBBalance.value - bToSend;
    this.assetABalance.value = newAssetA;
    this.assetBBalance.value = newAssetB;

    let lAfter = <uint256>0;
    if (this.priceMin.value === this.priceMax.value) {
      lAfter = this.calculateLiquidityFlatPrice(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMin.value as uint256 // priceMin: uint256,
      );
    } else {
      const D_SQRT = this.calculateLiquidityD(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMin.value as uint256, // priceMin: uint256,
        this.priceMax.value as uint256, // priceMax: uint256,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value // priceMaxSqrt: uint256,
      );
      lAfter = this.calculateLiquidityWithD(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value, // priceMaxSqrt: uint256,
        D_SQRT
      );
    }
    this.Liqudity.value = lAfter;
    return lpDeltaWithFees / assetLpDelicmalScale2Scale;
  }

  private verifyIdentity(appBiatecConfigProvider: AppID, appBiatecIdentityProvider: AppID): UserInfoV1 {
    assert(
      appBiatecConfigProvider === this.appBiatecConfigProvider.value,
      'ERR-INVALID-CONFIG' // 'Configuration app does not match'
    );
    const identityFromConfig = appBiatecConfigProvider.globalState('i') as AppID;
    assert(
      appBiatecIdentityProvider === identityFromConfig,
      'ERR-WRONG-IDENT' // appBiatecIdentityProvider must match to the config in appBiatecConfigProvider'
    );

    const user = sendMethodCall<[Address, uint8], UserInfoV1>({
      name: 'getUser',
      methodArgs: [this.txn.sender, <uint8>1],
      fee: 0,
      applicationID: appBiatecIdentityProvider,
    });
    assert(
      !user.isLocked,
      'ERR-USER-LOCKED' // 'User must not be locked'
    );
    assert(
      user.verificationClass >= this.verificationClass.value, // if(user.verificationClass >= this.verificationClass.value) then ok
      'ERR-LOW-VER' // 'User cannot interact with this smart contract as his verification class is lower then required here'
    );

    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment

    return user;
  }

  swap(
    appBiatecConfigProvider: AppID,
    appBiatecIdentityProvider: AppID,
    appBiatecPoolProvider: AppID,
    txSwap: Txn,
    assetA: AssetID,
    assetB: AssetID,
    minimumToReceive: uint64
  ): uint256 {
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    /// well formed swap
    this.checkAssetsAB(assetA, assetB);

    if (txSwap.typeEnum === TransactionType.Payment) {
      assert(assetA.id === 0);

      verifyPayTxn(txSwap, {
        amount: { greaterThan: 0 },
        receiver: this.app.address,
        sender: this.txn.sender,
      });
    } else {
      assert(txSwap.typeEnum === TransactionType.AssetTransfer);

      verifyAssetTransferTxn(txSwap, {
        assetAmount: { greaterThan: 0 },
        assetReceiver: this.app.address,
        sender: this.txn.sender,
        xferAsset: { includedIn: [assetA, assetB] },
      });
    }

    const poolProviderFromConfig = appBiatecConfigProvider.globalState('p') as AppID;
    assert(
      appBiatecPoolProvider === poolProviderFromConfig,
      'ERR-INVALID-PP' // appBiatecPoolProvider must match to the config in appBiatecConfigProvider'
    );
    const user = this.verifyIdentity(appBiatecConfigProvider, appBiatecIdentityProvider);

    let assetADecimals = 6;
    if (assetA.id > 0) assetADecimals = assetA.decimals;
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetADecimals)) as uint256;
    // if assetA.decimals == 6 then assetADelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;

    const feesMultiplier = (s - ((this.fee.value as uint256) * user.feeMultiplier) / user.base) as uint256;
    let ret: uint64 = 0;
    let amountAForStats = 0;
    let amountBForStats = 0;
    let feeAmountAForStats = 0;
    let feeAmountBForStats = 0;

    let isAssetA = false;
    if (txSwap.typeEnum === TransactionType.Payment) {
      isAssetA = true;
    } else {
      isAssetA = txSwap.xferAsset === assetA;
    }
    let realSwapBaseDecimals = <uint256>0;
    let inAsset = <uint256>0;
    if (isAssetA) {
      let assetInAssetDecimals = <uint256>0;
      if (txSwap.typeEnum === TransactionType.Payment) {
        assetInAssetDecimals = txSwap.amount as uint256;
        amountAForStats = txSwap.amount;
      } else {
        assetInAssetDecimals = txSwap.assetAmount as uint256;
        amountAForStats = txSwap.assetAmount;
      }
      inAsset = (assetInAssetDecimals * assetADelicmalScale2Scale) as uint256;
      const inAssetAfterFee = (inAsset * feesMultiplier) / s;

      const toSwap = this.calculateAssetBWithdrawOnAssetADeposit(
        inAssetAfterFee,
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMinSqrt.value,
        this.priceMaxSqrt.value,
        this.Liqudity.value
      );
      realSwapBaseDecimals = toSwap;
      let realSwapBDecimals = (toSwap / assetBDelicmalScale2Scale) as uint256;

      if (realSwapBDecimals * assetBDelicmalScale2Scale !== toSwap) {
        realSwapBDecimals = realSwapBDecimals - <uint256>1; // rounding issue.. do not allow the LP to bleed
        realSwapBaseDecimals = realSwapBDecimals * assetBDelicmalScale2Scale;
      }
      const toSwapBDecimals = realSwapBDecimals as uint64;
      ret = toSwapBDecimals;
      if (minimumToReceive > 0) {
        // if minimumToReceive == 0, do not restrict the price
        assert(minimumToReceive >= toSwapBDecimals);
      }
      amountBForStats = toSwapBDecimals;
      this.doAxfer(this.txn.sender, assetB, toSwapBDecimals);

      this.assetABalance.value = this.assetABalance.value + inAsset;
      this.assetBBalance.value = this.assetBBalance.value - realSwapBaseDecimals;
    }
    // SWAP B to A
    if (!isAssetA) {
      const assetInAssetDecimals = txSwap.assetAmount as uint256;
      amountBForStats = txSwap.assetAmount;
      inAsset = (assetInAssetDecimals * assetBDelicmalScale2Scale) as uint256;
      const inAssetAfterFee = (inAsset * feesMultiplier) / s;
      const toSwap = this.calculateAssetAWithdrawOnAssetBDeposit(
        inAssetAfterFee,
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMinSqrt.value,
        this.priceMaxSqrt.value,
        this.Liqudity.value
      );
      realSwapBaseDecimals = toSwap;
      let realSwapADecimals = toSwap / assetADelicmalScale2Scale;

      if (realSwapADecimals * assetADelicmalScale2Scale !== toSwap) {
        realSwapADecimals = realSwapADecimals - <uint256>1; // rounding issue.. do not allow the LP to bleed
        realSwapBaseDecimals = realSwapADecimals * assetADelicmalScale2Scale;
      }
      const toSwapADecimals = realSwapADecimals as uint64;
      ret = toSwapADecimals;
      if (minimumToReceive > 0) {
        // if minimumToReceive == 0, do not restrict the price
        assert(minimumToReceive >= toSwapADecimals);
      }
      amountAForStats = toSwapADecimals;
      this.doAxfer(this.txn.sender, assetA, toSwapADecimals);

      this.assetBBalance.value = this.assetBBalance.value + inAsset;
      this.assetABalance.value = this.assetABalance.value - realSwapBaseDecimals;
    }
    let newL = <uint256>0;
    if (this.priceMin.value === this.priceMax.value) {
      newL = this.calculateLiquidityFlatPrice(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMin.value as uint256 // priceMin: uint256,
      );
    } else {
      const D_SQRT = this.calculateLiquidityD(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMin.value as uint256, // priceMin: uint256,
        this.priceMax.value as uint256, // priceMax: uint256,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value // priceMaxSqrt: uint256,
      );
      newL = this.calculateLiquidityWithD(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value, // priceMaxSqrt: uint256,
        D_SQRT
      );
    }

    if (newL > this.Liqudity.value) {
      // liquidity increase is the result of the fees

      const diff = (newL - this.Liqudity.value) as uint256; // difference is the lp increment by fees .. ready to be split between users and biatec
      this.Liqudity.value = newL; // new liquidity is liquidity increase by users fees and biatec fees

      if (isAssetA) {
        // fee is in asset A ( incomming tx )
        const feeB256 = (this.assetABalance.value * diff) / newL;
        feeAmountAForStats = feeB256 as uint64;
        feeAmountBForStats = 0;
      } else {
        // fee is in asset B ( incomming tx )
        const feeB256 = (this.assetBBalance.value * diff) / newL;
        feeAmountAForStats = 0;
        feeAmountBForStats = feeB256 as uint64;
      }

      const biatecFee = this.appBiatecConfigProvider.value.globalState('f') as uint256;
      if (biatecFee === <uint256>0) {
        const usersLiquidityFromFeeIncrement = diff;
        this.LiqudityUsersFromFees.value = this.LiqudityUsersFromFees.value + usersLiquidityFromFeeIncrement;
      } else {
        const usersLiquidityFromFeeIncrement = (diff * (s - biatecFee)) / s;
        const biatecLiquidityFromFeeIncrement = diff - usersLiquidityFromFeeIncrement;
        this.LiqudityUsersFromFees.value = this.LiqudityUsersFromFees.value + usersLiquidityFromFeeIncrement;
        this.LiqudityBiatecFromFees.value = this.LiqudityBiatecFromFees.value + biatecLiquidityFromFeeIncrement;
      }
    }
    const newPrice = this.calculatePrice(
      this.assetABalance.value, // assetAQuantity: uint256,
      this.assetBBalance.value, // assetBQuantity: uint256,
      this.priceMinSqrt.value, // priceMinSqrt: uint256,
      this.priceMaxSqrt.value, // priceMaxSqrt: uint256,
      this.Liqudity.value // liquidity: uint256
    );
    assert(amountAForStats > 0 && amountBForStats > 0, 'Stats to register must not be empty');
    sendMethodCall<[AppID, AssetID, AssetID, uint64, uint64, uint64, uint64, uint64, uint64, uint64], void>({
      name: 'registerTrade',
      methodArgs: [
        globals.currentApplicationID,
        assetA,
        assetB,
        this.currentPrice.value as uint64,
        newPrice as uint64,
        amountAForStats * (assetADelicmalScale2Scale as uint64),
        amountBForStats * (assetBDelicmalScale2Scale as uint64),
        feeAmountAForStats,
        feeAmountBForStats,
        SCALE,
      ],
      fee: 0,
      applicationID: appBiatecPoolProvider,
    });

    this.currentPrice.value = newPrice as uint64;
    // uncomment after extraPages must be an Integer between and including 0 to 3
    // if (assetA.id === 0) {
    //   assert(
    //     ((this.assetABalance.value / assetADelicmalScale2Scale) as uint64) <= this.app.address.balance,
    //     'ERR-BALANCE-CHECK-1' // current algo balance must be above the assetABalance value'
    //   );
    // } else {
    //   assert(
    //     ((this.assetABalance.value / assetADelicmalScale2Scale) as uint64) <= this.app.address.assetBalance(assetA),
    //     'ERR-BALANCE-CHECK-2' // 'current a balance must be above the assetABalance value'
    //   );
    // }

    // assert(
    //   ((this.assetBBalance.value / assetBDelicmalScale2Scale) as uint64) <= this.app.address.assetBalance(assetB),
    //   'ERR-BALANCE-CHECK-3' // 'current B balance must be above the assetBBalance value'
    // );
    // assert(
    //   ret > 1,
    //   'ERR-ZERO-DEPOSIT' // 'The result would lead to deposit but zero withdrawal'
    // ); // protection of the client
    return ret as uint256;
  }

  distributeExcessAssets(
    appBiatecConfigProvider: AppID,
    assetA: AssetID,
    assetB: AssetID,
    amountA: uint256,
    amountB: uint256
  ): uint256 {
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    this.checkAssetsAB(assetA, assetB);

    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'ERR_CONFIG'); // assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef') as Address;

    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment

    assert(
      this.txn.sender === addressExecutiveFee,
      'ERR_SENDER' // 'Only fee executor setup in the config can take the collected fees'
    );

    let assetADecimals = 6;
    if (assetA.id > 0) assetADecimals = assetA.decimals;
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetADecimals)) as uint256;
    // if assetA.decimals == 6 then assetADelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;

    this.assetABalance.value = this.assetABalance.value + amountA;
    this.assetBBalance.value = this.assetBBalance.value + amountB;
    if (assetA.id === 0) {
      assert(
        ((this.app.address.balance - 1_000_000) as uint256) * assetADelicmalScale2Scale >= this.assetABalance.value,
        'ERR_A0_B' // 'It is not possible to set higher assetABalance in algos then is in the app balance'
      );
    } else {
      assert(
        (this.app.address.assetBalance(assetA) as uint256) * assetADelicmalScale2Scale >= this.assetABalance.value,
        'ERR_A_B' // 'It is not possible to set higher assetABalance then is in the app balance'
      );
    }
    assert(
      (this.app.address.assetBalance(assetB) as uint256) * assetBDelicmalScale2Scale >= this.assetBBalance.value,
      'ERR_B_B' // 'It is not possible to set higher assetBBalance then is in the app balance'
    );
    let newL = <uint256>0;
    if (this.priceMin.value === this.priceMax.value) {
      newL = this.calculateLiquidityFlatPrice(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMin.value as uint256 // priceMin: uint256,
      );
    } else {
      const D_SQRT = this.calculateLiquidityD(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMin.value as uint256, // priceMin: uint256,
        this.priceMax.value as uint256, // priceMax: uint256,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value // priceMaxSqrt: uint256,
      );
      newL = this.calculateLiquidityWithD(
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMinSqrt.value, // priceMinSqrt: uint256,
        this.priceMaxSqrt.value, // priceMaxSqrt: uint256,
        D_SQRT
      );
    }
    // liquidity increase is the result of the asset a and asset b deposit
    const diff = (newL - this.Liqudity.value) as uint256; // difference is the lp increment by fees .. ready to be split between users and biatec
    this.Liqudity.value = newL; // new liquidity is liquidity increase by users fees and biatec fees

    const biatecFee = this.appBiatecConfigProvider.value.globalState('f') as uint256;
    if (biatecFee === <uint256>0) {
      const usersLiquidityFromFeeIncrement = diff;
      this.LiqudityUsersFromFees.value = this.LiqudityUsersFromFees.value + usersLiquidityFromFeeIncrement;
    } else {
      const usersLiquidityFromFeeIncrement = (diff * (s - biatecFee)) / s;
      const biatecLiquidityFromFeeIncrement = diff - usersLiquidityFromFeeIncrement;
      this.LiqudityUsersFromFees.value = this.LiqudityUsersFromFees.value + usersLiquidityFromFeeIncrement;
      this.LiqudityBiatecFromFees.value = this.LiqudityBiatecFromFees.value + biatecLiquidityFromFeeIncrement;
    }

    const newPrice = this.calculatePrice(
      this.assetABalance.value, // assetAQuantity: uint256,
      this.assetBBalance.value, // assetBQuantity: uint256,
      this.priceMinSqrt.value, // priceMinSqrt: uint256,
      this.priceMaxSqrt.value, // priceMaxSqrt: uint256,
      this.Liqudity.value // liquidity: uint256
    );
    this.currentPrice.value = newPrice as uint64;
    return diff;
  }

  withdrawExcessAssets(
    appBiatecConfigProvider: AppID,
    assetA: AssetID,
    assetB: AssetID,
    amountA: uint64,
    amountB: uint64
  ): uint64 {
    this.checkAssetsAB(assetA, assetB);

    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'ERR_CONFIG'); // assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef') as Address;

    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment

    assert(
      this.txn.sender === addressExecutiveFee,
      'ERR_SENDER' // 'Only fee executor setup in the config can take the collected fees'
    );
    let assetADecimals = 6;
    if (assetA.id > 0) assetADecimals = assetA.decimals;
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetADecimals)) as uint256;
    // if assetA.decimals == 6 then assetADelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;

    if (amountA > 0) {
      this.doAxfer(this.txn.sender, assetA, amountA);
    }
    if (amountB > 0) {
      this.doAxfer(this.txn.sender, assetB, amountB);
    }

    if (assetA.id === 0) {
      assert(
        ((this.app.address.balance - 1_000_000) as uint256) * assetADelicmalScale2Scale >= this.assetABalance.value,
        'ERR_A0_B' // 'It is not possible to set higher assetABalance in algos then is in the app balance'
      );
    } else {
      assert(
        (this.app.address.assetBalance(assetA) as uint256) * assetADelicmalScale2Scale >= this.assetABalance.value,
        'ERR_A_B' // 'It is not possible to set higher assetABalance then is in the app balance'
      );
    }
    assert(
      (this.app.address.assetBalance(assetB) as uint256) * assetBDelicmalScale2Scale >= this.assetBBalance.value,
      'ERR_B_B' // 'It is not possible to set higher assetBBalance then is in the app balance'
    );

    return amountA + amountB;
  }

  sendOnlineKeyRegistration(
    appBiatecConfigProvider: AppID,
    votePk: bytes,
    selectionPk: bytes,
    stateProofPk: bytes,
    voteFirst: uint64,
    voteLast: uint64,
    voteKeyDilution: uint64
  ): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'ERR_CONFIG'); // assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef') as Address;
    assert(
      this.txn.sender === addressExecutiveFee,
      'ERR_SENDER' // 'Only fee executor setup in the config can take the collected fees'
    );
    sendOnlineKeyRegistration({
      selectionPK: selectionPk,
      stateProofPK: stateProofPk,
      voteFirst: voteFirst,
      voteKeyDilution: voteKeyDilution,
      voteLast: voteLast,
      votePK: votePk,
      fee: 0,
    });
  }

  sendOfflineKeyRegistration(appBiatecConfigProvider: AppID): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'ERR_CONFIG'); // assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef') as Address;

    const paused = appBiatecConfigProvider.globalState('s') as uint64;
    assert(paused === 0, 'ERR_PAUSED'); // services are paused at the moment

    assert(
      this.txn.sender === addressExecutiveFee,
      'ERR_SENDER' // 'Only fee executor setup in the config can take the collected fees'
    );
    sendOfflineKeyRegistration({ fee: 0 });
  }

  @abi.readonly
  calculateDistributedLiquidity(assetLp: AssetID, currentDeposit: uint256): uint256 {
    const current = (this.app.address.assetBalance(assetLp) as uint256) - currentDeposit;
    const minted = Uint<256>(TOTAL_SUPPLY) as uint256;
    const distributedLPTokens = minted - current;
    // if assetLp.decimals == 6 then assetLpDelicmalScale2Scale = 1000
    const assetLpDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;
    const ret = distributedLPTokens * assetLpDelicmalScale2Scale;
    return ret;
  }

  @abi.readonly
  calculateLiquidityFlatPrice(x: uint256, y: uint256, price: uint256): uint256 {
    return (x * price) / s + y;
  }

  @abi.readonly
  calculateLiquidityD(
    x: uint256,
    y: uint256,
    priceMin: uint256,
    priceMax: uint256,
    priceMinSqrt: uint256,
    priceMaxSqrt: uint256
  ): uint256 {
    const D1 = (x * x * priceMin) / s / s;
    // D2 = y^2/P2
    const D2 = (y * y) / priceMax;
    // D3 = 2*x*y*sqrt(P1)/sqrt(P2)
    const D3_1 = <uint256>2 * x * y * priceMinSqrt;
    const D3 = D3_1 / priceMaxSqrt / s;
    // sqrt(10000/1000) = sqrt(10000)/sqrt(1000)
    // D4 = 4*x*y
    const D4 = (<uint256>4 * x * y) / s;
    // D5 = -4*x*y*sqrt(P1)/sqrt(P2)
    const D5_1 = <uint256>4 * x * y * priceMinSqrt;
    const D5 = D5_1 / priceMaxSqrt / s;
    const D = D1 + D2 + D3 + D4 - D5;
    const D_SQRT = sqrt(s * D);
    return D_SQRT;
  }

  @abi.readonly
  calculateLiquidityWithD(
    x: uint256,
    y: uint256,
    priceMinSqrt: uint256,
    priceMaxSqrt: uint256,
    dSqrt: uint256
  ): uint256 {
    const L1 = (x * priceMinSqrt) / s;
    // L2 = 0 * 1000000000n / 1250000000n
    // L2 = y /sqrt(P2)
    const L2 = (y * s) / priceMaxSqrt;
    // L = ( x * P1 + y /sqrt(P2) +- sqrt(D)) / (2  - 2 * P1 / sqrt(P2)))
    // const D_SQRT = (SCALE * sqrt(D)) / sqrt(SCALE);

    // L3 = 2 * sqrt(P1) / sqrt(P2)
    const L3_0 = <uint256>2;
    const L3_1 = L3_0 * priceMinSqrt;
    const L3_2 = L3_1 * s;
    const L3 = L3_2 / priceMaxSqrt;
    if (<uint256>2 * s > L3) {
      const nom = L1 + L2 + dSqrt;
      const den = <uint256>2 * s - L3;
      const ret = (s * nom) / den;
      return ret;
    }
    const nom = L1 + L2 - dSqrt;
    const den = L3 - <uint256>2 * s;
    const ret = (s * nom) / den;
    return ret;

    // const ret: uint64 = nom / den;
    // return (L1 + L2 + sqrt(D) / sqrt(SCALE)) / (2 * SCALE - L3) / SCALE;
  }

  @abi.readonly
  calculatePrice(
    assetAQuantity: uint256,
    assetBQuantity: uint256,
    priceMinSqrt: uint256,
    priceMaxSqrt: uint256,
    liquidity: uint256
  ): uint256 {
    // for flat price use case
    if (priceMinSqrt === priceMaxSqrt) {
      const ret = (priceMinSqrt * priceMinSqrt) / s;
      return ret;
    }
    // P=(y+L*A)/(x+L/B)
    const a = priceMinSqrt;
    const b = priceMaxSqrt;
    const P1 = (liquidity * a) / s;
    const P2 = (liquidity * s) / b;
    const Nom = assetBQuantity + P1;
    const Denom = assetAQuantity + P2;
    const ret = (Nom * s) / Denom;
    return ret;
  }

  @abi.readonly
  calculateAssetBWithdrawOnAssetADeposit(
    inAmount: uint256,
    assetABalance: uint256,
    assetBBalance: uint256,
    priceMinSqrt: uint256,
    priceMaxSqrt: uint256,
    liqudity: uint256
  ): uint256 {
    // if we are at the same min and max price
    if (priceMinSqrt === priceMaxSqrt) {
      const ret = (inAmount * priceMinSqrt * priceMinSqrt) / s / s;
      return ret;
    }

    const x = assetABalance;
    const y = assetBBalance;
    const a = priceMinSqrt;
    const b = priceMaxSqrt;
    const L = liqudity;
    // a*b*d*l
    const P1 = (((((a /* 10D */ * b) /* 10D */ / s) * inAmount) /* AD */ / s) * L) /* 10D */ / s;
    // b*d*y
    const P2 = (((b /* 10D */ * inAmount) /* AD */ / s) * y) /* BD */ / s; // << TODO CHECK B Decimals not applied?
    // b*d
    const P3 = (b /* 10D */ * inAmount) /* AD */ / s;
    // b*x
    const P4 = (b /* 10D */ * x) /* 10D */ / s;
    // (a*b*d*l + b*d*y)
    const P12 = P1 + P2;
    // (b*d+b*x+l)
    const P345 = P3 + P4 + L;
    // (a*b*d*l + b*d*y)/(b*d+b*x+l)
    const ret = (P12 * s) / P345;
    return ret;
  }

  @abi.readonly
  calculateAssetAWithdrawOnAssetBDeposit(
    inAmount: uint256,
    assetABalance: uint256,
    assetBBalance: uint256,
    priceMinSqrt: uint256,
    priceMaxSqrt: uint256,
    liqudity: uint256
  ): uint256 {
    if (priceMinSqrt === priceMaxSqrt) {
      const ret = (inAmount * s * s) / priceMinSqrt / priceMinSqrt;
      return ret;
    }
    const x = assetABalance;
    const y = assetBBalance;
    const a = priceMinSqrt;
    const b = priceMaxSqrt;
    const L = liqudity;

    // d*l
    const P1 = (inAmount * L) / s;
    // b*d*x
    const P2 = (((b * inAmount) / s) * x) / s;
    // (d*l + b*d*x)
    const nom = P1 + P2;
    // a*b*l
    const P3 = (((a * b) / s) * L) / s;
    // b*d
    const P4 = (b * inAmount) / s;
    // b*y
    const P5 = (b * y) / s;
    // (a*b*l+b*d+b*y) (P3 + P4 + P5)
    const denom = P3 + P4 + P5;
    // w = (d*l + b*d*x)/(a*b*l+b*d+b*y)
    const ret = (nom * s) / denom;
    return ret;
  }

  @abi.readonly
  calculateAssetAWithdrawOnLpDeposit(inAmount: uint256, assetABalance: uint256, liqudity: uint256): uint256 {
    // const s = SCALE as uint256;
    // const percentageOfL = (inAmount * s) / liqudity;
    // const ret = (assetABalance * percentageOfL) / s;
    const ret = (assetABalance * inAmount) / liqudity;
    return ret;
  }

  @abi.readonly
  calculateAssetBWithdrawOnLpDeposit(inAmount: uint256, assetBBalance: uint256, liqudity: uint256): uint256 {
    // const s = SCALE as uint256;
    // const percentageOfL = (inAmount * s) / liqudity;
    // const ret = (assetBBalance * percentageOfL) / s;
    const ret = (assetBBalance * inAmount) / liqudity;
    return ret;
  }

  @abi.readonly
  calculateAssetBDepositOnAssetADeposit(
    inAmountA: uint256,
    inAmountB: uint256,
    assetABalance: uint256,
    assetBBalance: uint256
  ): uint256 {
    if (assetABalance > <uint256>0) {
      return (inAmountA * assetBBalance) / assetABalance;
    }
    // if there is no asset a in the pool, the expected asset a is zero and asset b the max
    return inAmountB;
  }

  @abi.readonly
  calculateAssetADepositOnAssetBDeposit(
    inAmountA: uint256,
    inAmountB: uint256,
    assetABalance: uint256,
    assetBBalance: uint256
  ): uint256 {
    if (assetBBalance > <uint256>0) {
      return (inAmountB * assetABalance) / assetBBalance;
    }
    // if there is no asset b in the pool, the expected asset b is zero and asset a the max
    return inAmountA;
  }

  @abi.readonly
  status(appBiatecConfigProvider: AppID, assetA: AssetID, assetB: AssetID, assetLp: AssetID): AmmStatus {
    assert(
      appBiatecConfigProvider === this.appBiatecConfigProvider.value,
      'ERR_CONFIG' // 'appBiatecConfigProvider must match to the global variable app id'
    );
    assert(assetA.id === this.assetA.value);
    assert(assetB.id === this.assetB.value);
    assert(this.assetLp.value === assetLp.id, 'ERR_LP'); // 'LP asset does not match');
    const biatecFee = this.appBiatecConfigProvider.value.globalState('f') as uint256;
    const realBalanceA =
      assetA.id === 0
        ? globals.currentApplicationAddress.balance
        : globals.currentApplicationAddress.assetBalance(assetA);
    const realBalanceB = globals.currentApplicationAddress.assetBalance(assetB);
    return {
      assetA: this.assetA.value,
      assetB: this.assetB.value,
      poolToken: this.assetLp.value,
      assetABalance: this.assetABalance.value as uint64,
      assetBBalance: this.assetBBalance.value as uint64,
      realABalance: realBalanceA,
      realBBalance: realBalanceB,
      fee: this.fee.value,
      biatecFee: biatecFee as uint64,
      currentLiqudity: this.Liqudity.value as uint64,
      liqudityBiatecFromFees: this.LiqudityBiatecFromFees.value as uint64,
      liqudityUsersFromFees: this.LiqudityUsersFromFees.value as uint64,
      price: this.currentPrice.value as uint64,
      priceMaxSqrt: this.priceMaxSqrt.value as uint64,
      priceMinSqrt: this.priceMinSqrt.value as uint64,
      releasedLiqudity: this.calculateDistributedLiquidity(assetLp, <uint256>0) as uint64,
      scale: SCALE,
      verificationClass: this.verificationClass.value,
    };
  }
}
