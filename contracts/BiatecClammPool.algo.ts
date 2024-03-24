import { Contract } from '@algorandfoundation/tealscript';

// eslint-disable-next-line no-unused-vars
const version = 'BIATEC-CLAMM-01-01-01';
const LP_TOKEN_DECIMALS = 6;
const TOTAL_SUPPLY = 10_000_000_000_000_000;
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
  /**
   * Verification class of the user. Uses bits system - 7 = 1 + 2 + 4 = Email and mobile verified
   *
   * 0 - No information about user
   * 1 - Box created for address
   * 2 - Email verified
   * 4 - Mobile Phone verified
   * 8 - Address verified
   * 16 - Address verified
   * 32 - X account verified
   * 64 - Discord account verified
   * 128 - Telegram account verified
   * 256 - First government document with gov id stored in secure storage
   * 512 - Second government document with gov id stored in secure storage
   * 1024 - Corporation government documents stored in secure storage
   * 2048 - First government document verified by online verification process
   * 4096 - Second government document verified by online verification process
   * 8192 - Corporation government documents verified by online verification process
   * 16384 - First government document verified by in person verification process
   * 32768 - Second government document verified by in person verification process
   * 65536 - Corporation government documents verified by in person verification process
   *
   */
  verificationStatus: uint64;
  /**
   * Verification class of the user.
   *
   * 0 - No information about user
   * 1 - KYC filled in
   * 2 - KYC checked by online process
   * 3 - In person verification
   * 4 - Professional investor verified
   *
   */
  verificationClass: uint64;
  /**
   * Each user who interacts with Biatec services will receive engagement points
   */
  biatecEngagementPoints: uint64;
  /**
   * All accounts are sorted by points and rank expresses their percentil in the total biatec population
   *
   * Rank 0 means no interaction
   * Rank 10000 means highest interaction
   * Rank 5000 means median interaction level
   *
   */
  biatecEngagementRank: uint64;
  /**
   * Each user who interacts with AVM services - Algorand network,Voi network,Aramid network,... will receive engagement points
   */
  avmEngagementPoints: uint64;
  /**
   * All accounts are sorted by points and rank expresses their percentil in the total avm population
   *
   * Rank 0 means no interaction
   * Rank 10000 means highest interaction
   * Rank 5000 means median interaction level
   */
  avmEngagementRank: uint64;
  /**
   * Each user who is trading through biatec services will receive point according to fees in dollar nomination paid to biatec
   */
  tradingEngagementPoints: uint64;
  /**
   * All accounts are sorted by trading points and rank expresses their percentil in the total traders population
   *
   * Rank 0 means no interaction
   * Rank 10000 means highest interaction
   * Rank 5000 means median interaction level
   *
   */
  tradingEngagementRank: uint64;
  /**
   * Depending on verification class, biatecEngagementRank, avmEngagementRank and trading history
   */
  feeMultiplier: uint256;
  /**
   * Scale multiplier for decimal numbers. 1_000_000_000 means that number 10 is expressed as 10_000_000_000
   */
  base: uint256;
  /**
   * In case of account is suspicious of theft, malicious activity, not renewing the kyc or investor form, or other legal actions enforces us to lock the account, the account cannot perform any trade or liqudity removal
   */
  isLocked: boolean;
  /**
   * unix time in seconds when kyc form expires. If no kyc provided, equals to zero.
   */
  kycExpiration: uint64;
  /**
   * unix time in seconds when investor form expires. If no form provided, equals to zero.
   */
  investorForExpiration: uint64;
  /**
   * information weather the account belongs to professional investor or to MiFID regulated instutution like bank or securities trader
   */
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
  // asset A id
  assetA = GlobalStateKey<uint64>({ key: 'a' });

  // asset B id
  assetB = GlobalStateKey<uint64>({ key: 'b' });

  // pool LP token id
  assetLP = GlobalStateKey<uint64>({ key: 'lp' });

  // asset A balance - disponible for swapping. The difference between contract balance and asset A balance is the fees collected
  assetABalance = GlobalStateKey<uint256>({ key: 'ab' });

  // asset B balance - disponible for swapping. The difference between contract balance and asset B balance is the fees collected
  assetBBalance = GlobalStateKey<uint256>({ key: 'bb' });

  // min price
  priceMin = GlobalStateKey<uint64>({ key: 'pMin' });

  // max price
  priceMax = GlobalStateKey<uint64>({ key: 'pMax' });

  // min price in square root
  priceMinSqrt = GlobalStateKey<uint256>({ key: 'pMinS' });

  // max price in square root
  priceMaxSqrt = GlobalStateKey<uint256>({ key: 'pMaxS' });

  // Current liquidity at the pool
  Liqudity = GlobalStateKey<uint256>({ key: 'L' });

  // Liquidity held by users earned by swap fees
  LiqudityUsersFromFees = GlobalStateKey<uint256>({ key: 'Lu' });

  // Liquidity held by biatec earned by swap fees
  LiqudityBiatecFromFees = GlobalStateKey<uint256>({ key: 'Lb' });

  /**
   * LP Fees in 9 decimals. 1_000_000_000 = 100%
   * LP Fees in 9 decimals. 10_000_000 = 1%
   * LP Fees in 9 decimals. 100_000 = 0,01%
   *
   * The Biatec fee is defined in the Biatec AMM Provider.
   */
  fee = GlobalStateKey<uint64>({ key: 'f' });

  // current price
  currentPrice = GlobalStateKey<uint64>({ key: 'price' });

  // scale in this contranct
  scale = GlobalStateKey<uint64>({ key: 'scale' });

  // biatec amm provider
  appBiatecConfigProvider = GlobalStateKey<AppID>({ key: 'B' });

  /**
   * Verification class is level of KYC verification by Biatec Identity
   *
   * 0 = Unverified, 1 = Identity documents uploaded without personal id, 2= Identity documents including government id provided, 3 = Personal verification
   */
  verificationClass = GlobalStateKey<uint64>({ key: 'c' });

  /**
   * Initial setup
   */
  createApplication(): void {
    log(version);
    this.scale.value = SCALE;
    this.fee.value = <uint64>0;
    this.Liqudity.value = <uint256>0;
    this.LiqudityBiatecFromFees.value = <uint256>0;
    this.LiqudityUsersFromFees.value = <uint256>0;
    this.priceMax.value = 0;
  }

  /**
   * addressUdpater from global biatec configuration is allowed to update application
   */
  updateApplication(appBiatecConfigProvider: AppID): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('u');
    assert(this.txn.sender === addressExecutiveFee, 'Only addressUdpater setup in the config can update application');
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
    return this.assetLP.value;
  }

  /**
   * Anybody can deploy the clamm smart contract
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
    assert(this.priceMax.value === 0, 'It is not possible to call bootrap twice');
    assert(this.txn.sender === this.app.creator, 'Only creator of the app can set it up');
    assert(priceMax > 0, 'You must set price');
    assert(assetA < assetB);
    assert(fee <= SCALE / 10); // fee must be lower then 10%
    assert(verificationClass <= 4); // verificationClass
    assert(!this.currentPrice.exists);
    if (assetA.id > 0) {
      assert(assetA.decimals <= SCALE_DECIMALS); // asset A can be algo
    }
    assert(assetB.decimals <= SCALE_DECIMALS);

    assert(this.fee.value <= 0, 'You can bootstrap contract only once'); // check that this contract deployment was not yet initialized

    const poolProviderFromConfig = appBiatecConfigProvider.globalState('p');
    assert(
      appBiatecPoolProvider === poolProviderFromConfig,
      'appBiatecPoolProvider must match to the config in appBiatecConfigProvider'
    );

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
    this.assetLP.value = this.doCreatePoolToken(assetA, assetB).id;
    this.fee.value = fee;
    this.doOptIn(assetA);
    this.doOptIn(assetB);

    sendMethodCall<[AppID, AssetID, AssetID, uint8], void>({
      name: 'registerPool',
      methodArgs: [globals.currentApplicationID, assetA, assetB, verificationClass],
      fee: 0,
      applicationID: appBiatecPoolProvider,
    });

    return this.assetLP.value;
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
   * Performs opt in to the asset. If native token is provided (0) it does not perform any action
   * @param asset Asset to opt in to
   */
  private doOptIn(asset: AssetID): void {
    if (asset.id > 0) {
      // if asset id = 0 we do not have to opt in to native token
      this.doAxfer(this.app.address, asset, 0);
    }
  }

  /**
   * Creates LP token
   * @param assetA Asset A
   * @param assetB Asset B
   * @returns id of the token
   */
  private doCreatePoolToken(assetA: AssetID, assetB: AssetID): AssetID {
    // const verificationClass = this.verificationClass.value.toString(); // TODO
    // const feeB100000 = this.feeB100000.value.toString();
    // const name = 'B-' + verificationClass + '-' + feeB100000 + '-' + assetA.unitName + '-' + assetB.unitName; // TODO
    let nameAssetA = 'ALGO';
    if (assetA.id > 0) {
      nameAssetA = assetA.unitName;
    }

    const name =
      'B-' + itob(this.verificationClass.value) + '-' + nameAssetA + '-' + assetB.unitName + '-' + itob(this.fee.value); // TODO

    return sendAssetCreation({
      configAssetName: name,
      configAssetUnitName: 'BLP', // Biatec LP token
      configAssetTotal: TOTAL_SUPPLY,
      configAssetDecimals: LP_TOKEN_DECIMALS,
      configAssetManager: this.app.address,
      configAssetReserve: this.app.address,
    });
  }

  private checkAssetsAB(assetA: AssetID, assetB: AssetID) {
    assert(assetA.id === this.assetA.value, 'assetA does not match');
    assert(assetB.id === this.assetB.value, 'assetB does not match');
  }

  private checkAssets(assetA: AssetID, assetB: AssetID, assetLP: AssetID) {
    this.checkAssetsAB(assetA, assetB);
    assert(assetLP.id === this.assetLP.value, 'assetLP does not match');
  }

  /**
   * This method adds Asset A and Asset B to the Automated Market Maker Concentrated Liqudidity Pool and send to the liqudidty provider the liqudity token
   * @param appBiatecConfigProvider Configuration reference
   * @param appBiatecIdentityProvider Identity service reference
   * @param txAssetADeposit Transfer of asset A to the LP pool
   * @param txAssetBDeposit Transfer of asset B to the LP pool
   * @param assetLP Liquidity pool asset
   * @param assetA Asset A
   * @param assetB Asset B
   * @returns LP Token quantity distributed
   */
  addLiquidity(
    appBiatecConfigProvider: AppID,
    appBiatecIdentityProvider: AppID,
    txAssetADeposit: Txn,
    txAssetBDeposit: Txn,
    assetA: AssetID,
    assetB: AssetID,
    assetLP: AssetID
  ): uint64 {
    increaseOpcodeBudget();
    increaseOpcodeBudget();
    /// well formed mint
    this.checkAssets(assetA, assetB, assetLP);

    this.verifyIdentity(appBiatecConfigProvider, appBiatecIdentityProvider);

    let assetADecimals = 6;
    if (assetA.id > 0) assetADecimals = assetA.decimals;
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetADecimals)) as uint256;
    // if assetB.decimals == 6 then assetBDelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;
    // if assetLP.decimals == 6 then assetLPDelicmalScale2Scale = 1000
    const assetLPDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;

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
      return this.processAddLiqudity(aDepositInBaseScale, bDepositInBaseScale, assetLPDelicmalScale2Scale, assetLP);
    }

    // else

    if (this.assetABalance.value === <uint256>0 && this.assetBBalance.value === <uint256>0) {
      // calculate LP position
      // this.assetABalance.value = aDepositInBaseScale;
      // this.assetBBalance.value = bDepositInBaseScale;

      const ret = this.processAddLiqudity(
        aDepositInBaseScale,
        bDepositInBaseScale,
        assetLPDelicmalScale2Scale,
        assetLP
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
      // dominant is asset B. User sent more asset B then asset A, so we should return excess asset B to the user back.

      // AB=1,BB=1, P = 1, deposit A = 0.5, deposit B = 1
      // expected a = (inAmountB * assetABalance) / assetBBalance = 1 * 1 / 1 = 1
      // expected b = (inAmountA * assetBBalance) / assetABalance = 0.5 * 1 / 1 = 0.5

      if (expectedBDepositB64 > txAssetBDeposit.assetAmount) {
        assert(false, 'Dominant is asset B'); // there should not be case to return bot asset a and asset b
      }
      if (txAssetBDeposit.assetAmount - expectedBDepositB64 > 0) {
        // return excess asset B to the user
        this.doAxfer(this.txn.sender, assetB, txAssetBDeposit.assetAmount - expectedBDepositB64);
      }
      const realAssetADeposit = aDepositInBaseScale;
      const realAssetBDeposit = (expectedBDepositB64 as uint256) * assetBDelicmalScale2Scale;
      return this.processAddLiqudity(realAssetADeposit, realAssetBDeposit, assetLPDelicmalScale2Scale, assetLP);
    }

    if (expectedBDepositB64 > txAssetBDeposit.assetAmount) {
      // dominant is asset A. User sent more asset A then asset B, so we should return excess asset A to the user back.

      // AB=1,BB=1, P = 1, deposit A = 1, deposit B = 0.5
      // expected a = (inAmountB * assetABalance) / assetBBalance = 0.5 * 1 / 1 = 0.5
      // expected b = (inAmountA * assetBBalance) / assetABalance = 1 * 1 / 1 = 1

      if (expectedADepositB64 > txAssetADeposit.assetAmount) {
        assert(false, 'Dominant is asset A'); // there should not be case to return bot asset a and asset b
      }
      if (txAssetADeposit.assetAmount - expectedADepositB64 > 0) {
        // return excess asset A to the user
        this.doAxfer(this.txn.sender, assetB, txAssetADeposit.assetAmount - expectedADepositB64);
      }
      const realAssetADeposit = (expectedADepositB64 as uint256) * assetADelicmalScale2Scale;
      const realAssetBDeposit = bDepositInBaseScale;
      return this.processAddLiqudity(realAssetADeposit, realAssetBDeposit, assetLPDelicmalScale2Scale, assetLP);
    }
    if (expectedADepositB64 === txAssetADeposit.assetAmount && expectedBDepositB64 === txAssetBDeposit.assetAmount) {
      const realAssetADeposit = aDepositInBaseScale;
      const realAssetBDeposit = bDepositInBaseScale;
      return this.processAddLiqudity(realAssetADeposit, realAssetBDeposit, assetLPDelicmalScale2Scale, assetLP);
    }

    if (expectedADepositB64 === txAssetADeposit.assetAmount && expectedBDepositB64 === txAssetBDeposit.assetAmount) {
      const realAssetADeposit = aDepositInBaseScale;
      const realAssetBDeposit = bDepositInBaseScale;
      return this.processAddLiqudity(realAssetADeposit, realAssetBDeposit, assetLPDelicmalScale2Scale, assetLP);
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
   * @param assetLPDelicmalScale2Scale LP decimal scale
   * @param assetLP LP Asset
   * @returns LP Token quantity distributed
   */
  private processAddLiqudity(
    realAssetADeposit: uint256,
    realAssetBDeposit: uint256,
    assetLPDelicmalScale2Scale: uint256,
    assetLP: AssetID
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
    const lpTokensToSend = ((newLiqudity - this.Liqudity.value) / assetLPDelicmalScale2Scale) as uint64;

    this.Liqudity.value = newLiqudity;
    // send LP tokens to user
    this.doAxfer(this.txn.sender, assetLP, lpTokensToSend);
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
   * @param txLPXfer Transfer of the LP token
   * @param assetLP LP pool asset
   * @param assetA Asset A
   * @param assetB Asset B
   * @returns LP position reduced
   */
  removeLiquidity(
    appBiatecConfigProvider: AppID,
    appBiatecIdentityProvider: AppID,
    txLPXfer: AssetTransferTxn,
    assetA: AssetID,
    assetB: AssetID,
    assetLP: AssetID
  ): uint256 {
    /// well formed mint
    this.checkAssets(assetA, assetB, assetLP);
    verifyAssetTransferTxn(txLPXfer, {
      assetReceiver: this.app.address,
      xferAsset: assetLP,
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
    // if assetLP.decimals == 6 then assetLPDelicmalScale2Scale = 1000
    const assetLPDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;

    const lpDelta = txLPXfer.assetAmount as uint256;
    const lpDeltaBase = lpDelta * assetLPDelicmalScale2Scale;
    let lpDeltaWithFees = lpDeltaBase;
    const lpWithOthers = this.calculateDistributedLiquidity(assetLP, lpDelta);
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
    return lpDeltaWithFees / assetLPDelicmalScale2Scale;
  }

  /**
   * This method allows biatec admin to reduce the lp position created by lp fees allocation.
   *
   * Only addressExecutiveFee is allowed to execute this method.
   *
   * @param appBiatecConfigProvider Biatec config app. Only addressExecutiveFee is allowed to execute this method.
   * @param assetA Asset A
   * @param assetB Asset B
   * @param amount Amount to withdraw. If zero, removes all available lps from fees.
   *
   * @returns LP position reduced
   */
  removeLiquidityAdmin(
    appBiatecConfigProvider: AppID,
    assetA: AssetID,
    assetB: AssetID,
    assetLP: AssetID,
    amount: uint256
  ): uint256 {
    /// well formed mint
    this.checkAssets(assetA, assetB, assetLP);

    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value);
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef');
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
    // if assetLP.decimals == 6 then assetLPDelicmalScale2Scale = 1000
    const assetLPDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;

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

    // verify that L with new x and y is correctly calculated
    // this part can be removed if all tests goes through to lower cost by 1 tx
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
    return lpDeltaWithFees / assetLPDelicmalScale2Scale;
  }

  /**
   * Checks if config matches with the app configuration, identity matches with the config, and user is not banned.
   *
   * Fetches the user info from the identity app and returns the engagement, verification class,...
   *
   * @param appBiatecConfigProvider Biatec config provider
   * @param appBiatecIdentityProvider Biatec identity provider
   * @returns User info object
   */
  private verifyIdentity(appBiatecConfigProvider: AppID, appBiatecIdentityProvider: AppID): UserInfoV1 {
    assert(
      appBiatecConfigProvider === this.appBiatecConfigProvider.value,
      'ERR-INVALID-CONFIG' // 'Configuration app does not match'
    );
    const identityFromConfig = appBiatecConfigProvider.globalState('i');
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
    return user;
  }

  /**
   * Swap Asset A to Asset B or Asset B to Asst A
   * @param txSwap Transfer of the token to be deposited to the pool. To the owner the other asset will be sent.
   * @param assetA Asset A
   * @param assetB Asset B
   * @param minimumToReceive If number greater then zero, the check is performed for the output of the other asset
   */
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

    const poolProviderFromConfig = appBiatecConfigProvider.globalState('p');
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

    if (newL !== this.Liqudity.value) {
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
    if (assetA.id === 0) {
      assert(
        ((this.assetABalance.value / assetADelicmalScale2Scale) as uint64) <= this.app.address.balance,
        'ERR-BALANCE-CHECK-1' // current algo balance must be above the assetABalance value'
      );
    } else {
      assert(
        ((this.assetABalance.value / assetADelicmalScale2Scale) as uint64) <= this.app.address.assetBalance(assetA),
        'ERR-BALANCE-CHECK-2' // 'current a balance must be above the assetABalance value'
      );
    }

    assert(
      ((this.assetBBalance.value / assetBDelicmalScale2Scale) as uint64) <= this.app.address.assetBalance(assetB),
      'ERR-BALANCE-CHECK-3' // 'current B balance must be above the assetBBalance value'
    );
    assert(
      ret > 1,
      'ERR-ZERO-DEPOSIT' // 'The result would lead to deposit but zero withdrawal'
    ); // protection of the client
    return ret as uint256;
  }

  /**
   * If someone deposits excess assets to the LP pool, addressExecutiveFee can either distribute them to the lp tokens or withdraw it, depending on the use case.
   * If someone sent there assets in fault, the withrawing can be use to return them back. If the pool received assets for example for having its algo stake online and recieved rewards it is prefered to distribute them to the current LP holders.
   *
   * This method is used to distribute amount a and amount b of asset a and asset b to holders as the fee income.
   *
   * Only addressExecutiveFee is allowed to execute this method.
   *
   * @param appBiatecConfigProvider Biatec config app. Only addressExecutiveFee is allowed to execute this method.
   * @param assetA Asset A
   * @param assetB Asset B
   * @param amountA Amount of asset A to be deposited to the liquidity. In base decimals (9)
   * @param amountB Amount of asset B to be deposited to the liquidity. In base decimals (9)
   */
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

    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef');
    assert(
      this.txn.sender === addressExecutiveFee,
      'Only fee executor setup in the config can take the collected fees'
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
        'It is not possible to set higher assetABalance in algos then is in the app balance'
      );
    } else {
      assert(
        (this.app.address.assetBalance(assetA) as uint256) * assetADelicmalScale2Scale >= this.assetABalance.value,
        'It is not possible to set higher assetABalance then is in the app balance'
      );
    }
    assert(
      (this.app.address.assetBalance(assetB) as uint256) * assetBDelicmalScale2Scale >= this.assetBBalance.value,
      'It is not possible to set higher assetBBalance then is in the app balance'
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

  /**
   * If someone deposits excess assets to the LP pool, addressExecutiveFee can either distribute them to the lp tokens or withdraw it, depending on the use case.
   * If someone sent there assets in fault, the withrawing can be use to return them back. If the pool received assets for example for having its algo stake online and recieved rewards it is prefered to distribute them to the current LP holders.
   *
   * This method is used to distribute amount a and amount b of asset a and asset b to addressExecutiveFee account.
   *
   * Only addressExecutiveFee is allowed to execute this method.
   *
   * @param appBiatecConfigProvider Biatec config app. Only addressExecutiveFee is allowed to execute this method.
   * @param assetA Asset A
   * @param assetB Asset B
   * @param amountA Amount of asset A to be deposited to the liquidity. In asset a decimals
   * @param amountB Amount of asset B to be deposited to the liquidity. In asset b decimals
   */
  withdrawExcessAssets(
    appBiatecConfigProvider: AppID,
    assetA: AssetID,
    assetB: AssetID,
    amountA: uint64,
    amountB: uint64
  ): uint64 {
    this.checkAssetsAB(assetA, assetB);

    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef');
    assert(
      this.txn.sender === addressExecutiveFee,
      'Only fee executor setup in the config can take the collected fees'
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
        'It is not possible to set higher assetABalance in algos then is in the app balance'
      );
    } else {
      assert(
        (this.app.address.assetBalance(assetA) as uint256) * assetADelicmalScale2Scale >= this.assetABalance.value,
        'It is not possible to set higher assetABalance then is in the app balance'
      );
    }
    assert(
      (this.app.address.assetBalance(assetB) as uint256) * assetBDelicmalScale2Scale >= this.assetBBalance.value,
      'It is not possible to set higher assetBBalance then is in the app balance'
    );

    return amountA + amountB;
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
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef');
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
   * addressExecutiveFee can perfom key unregistration for this LP pool
   *
   * Only addressExecutiveFee is allowed to execute this method.
   */
  sendOfflineKeyRegistration(appBiatecConfigProvider: AppID): void {
    assert(appBiatecConfigProvider === this.appBiatecConfigProvider.value, 'Configuration app does not match');
    const addressExecutiveFee = appBiatecConfigProvider.globalState('ef');
    assert(
      this.txn.sender === addressExecutiveFee,
      'Only fee executor setup in the config can take the collected fees'
    );
    sendOfflineKeyRegistration({ fee: 0 });
  }

  /**
   * Calculates the number of LP tokens issued to users
   */
  @abi.readonly
  calculateDistributedLiquidity(assetLP: AssetID, currentDeposit: uint256): uint256 {
    const current = (this.app.address.assetBalance(assetLP) as uint256) - currentDeposit;
    const minted = TOTAL_SUPPLY as uint256;
    const distributedLPTokens = minted - current;
    // if assetLP.decimals == 6 then assetLPDelicmalScale2Scale = 1000
    const assetLPDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;
    const ret = distributedLPTokens * assetLPDelicmalScale2Scale;
    return ret;
  }

  @abi.readonly
  calculateLiquidityFlatPrice(x: uint256, y: uint256, price: uint256): uint256 {
    // if priceMinSqrt == priceMaxSqrt
    // EURUSD = 1.1  .. 1000 EUR 1100 USD

    // (x + L/sqrt(P2))*(y+L*sqrt(P1))=L*L
    // (x + L/sqrt(P))*(y+L*sqrt(P))=L*L
    // (x + L/S)*(y+L*S) = L*L
    // x*y + l/s*l*s + x*l*s+y*l/s=l*l
    // x*y  + x*l*s+y*l/s=0
    //  l(x*s+y/s)=-xy
    // l = -xy/(x*s+y/s)

    // 1000*1100/(1000*(1,1)^(1/2)+1100/(1,1)^(1/2))=524,40442408507577349572675683997

    // (1000 - 524,4/(1,1)^(1/2))*(1100-524,4*(1,1)^(1/2))=524,4*524,4 = 275004,64003914505751536355485248
    return (x * price) / s + y;
  }

  /**
   * Calculates the liquidity  from the x - Asset A position and y - Asset B position
   * This method calculates discriminant - first part of the calculation.
   * It is divided so that the readonly method does not need to charge fees
   *
   * @param x Asset A position balanced on the curve
   * @param y Asset B position balanced on the curve
   * @param priceMin Minimum price variable in base scale decimals (pa)
   * @param priceMax Maximum price variable in base scale decimals (pb)
   * @param priceMinSqrt sqrt(priceMin) in base scale decimals Variable pas
   * @param priceMaxSqrt sqrt(priceMax) in base scale decimals Variable pbs
   * @returns Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.
   */
  @abi.readonly
  calculateLiquidityD(
    x: uint256,
    y: uint256,
    priceMin: uint256,
    priceMax: uint256,
    priceMinSqrt: uint256,
    priceMaxSqrt: uint256
  ): uint256 {
    // (x + L/sqrt(P2))*(y+L*sqrt(P1))=L*L
    // y + L*sqrt(P1) = L*L / (x + L/sqrt(P2))
    // x*y + L*sqrt(P1)*L/sqrt(P2) + x * L*sqrt(P1) + y * L/sqrt(P2) =L*L
    // x*y = L*L - L*sqrt(P1)*L/sqrt(P2) -  x * L*sqrt(P1) -y * L/sqrt(P2)
    // x*y = L^2 ( 1 - sqrt(P1) / sqrt(P2) ) - L * (x * sqrt(P1) + y /sqrt(P2)  )
    // 0 = L^2 ( 1 - sqrt(P1) / sqrt(P2) ) + L * (- 1 * x * sqrt(P1) - y /sqrt(P2)) + (-1 * x*y)

    // D = (- 1 * x * sqrt(P1) - y /sqrt(P2)) * (- 1 * x * sqrt(P1) - y /sqrt(P2)) - 4 * ( 1 - sqrt(P1) / sqrt(P2) ) * (-1 * x*y)
    // D = (- 1 * x * sqrt(P1) - y /sqrt(P2)) * (- 1 * x * sqrt(P1) - y /sqrt(P2)) + 4 * ( 1 - sqrt(P1) / sqrt(P2) ) * ( x*y)
    // D = ( ( x * sqrt(P1)) ( x * sqrt(P1)) + (y /sqrt(P2))*(y /sqrt(P2)) + 2 * x * sqrt(P1) * y /sqrt(P2)) +  4 * x*y - 4*x*y * sqrt(P1) / sqrt(P2)
    // D = x^2 * P1 + y^2/P2 + 2*x*y*sqrt(P1)/sqrt(P2) + 4*x*y-4*x*y*sqrt(P1)/sqrt(P2)
    //
    // x = 20000, y = 0, P1 = 1, P2 = 125/80
    // D = 20000^2 * P1^2 + 0^2/P2 + 2*20000*0*P1/sqrt(P2) + 4*20000*0-4*20000*0*P1/sqrt(P2)
    // D = 20000^2 * 1^2
    // D = 400000000

    // L = (-b +-sqrt(D))/2a
    // L = -1 * (- 1 * x * P1 - y /sqrt(P2)) +- sqrt(D)) / (2 * (1 - P1 / sqrt(P2)) )
    // L = ( x * P1 + y /sqrt(P2) +- sqrt(D)) / (2  - 2 * P1 / sqrt(P2)))
    // L = ( 20000 * 1 + 0/sqrt(P2) +- sqrt(400000000) ) / (2 - 2 * 1 / sqrt(125/80) )
    // L = (20000 + 20000)  / ( 2 - 2 * 1 / sqrt(125/80))
    // L = 40000 / ( 2 - 2 / 1,25) = 40000 / 0.4 = 100000

    // D = x^2 * P1 + y^2/P2 + 2*x*y*sqrt(P1)/sqrt(P2) + 4*x*y - 4*x*y*sqrt(P1)/sqrt(P2)
    // D = D1       + D2     + D3                      + D4    - D5

    // increaseOpcodeBudget();
    // D1 = x^2 * P1
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

  /**
   * Calculates the liquidity  from the x - Asset A position and y - Asset B position
   *
   * @param x Asset A position balanced on the curve
   * @param y Asset B position balanced on the curve
   * @param priceMinSqrt sqrt(priceMin) in base scale decimals Variable pas
   * @param priceMaxSqrt sqrt(priceMax) in base scale decimals Variable pbs
   * @returns Liquidity is constant in swapping each direction. On deposit the diff between the liquidity is number of LP tokens received by user.
   */
  @abi.readonly
  calculateLiquidityWithD(
    x: uint256,
    y: uint256,
    priceMinSqrt: uint256,
    priceMaxSqrt: uint256,
    D_SQRT: uint256
  ): uint256 {
    // (x + L/sqrt(P2))*(y+L*sqrt(P1))=L*L
    // y + L*sqrt(P1) = L*L / (x + L/sqrt(P2))
    // x*y + L*sqrt(P1)*L/sqrt(P2) + x * L*sqrt(P1) + y * L/sqrt(P2) =L*L
    // x*y = L*L - L*sqrt(P1)*L/sqrt(P2) -  x * L*sqrt(P1) -y * L/sqrt(P2)
    // x*y = L^2 ( 1 - sqrt(P1) / sqrt(P2) ) - L * (x * sqrt(P1) + y /sqrt(P2)  )
    // 0 = L^2 ( 1 - sqrt(P1) / sqrt(P2) ) + L * (- 1 * x * sqrt(P1) - y /sqrt(P2)) + (-1 * x*y)

    // D = (- 1 * x * sqrt(P1) - y /sqrt(P2)) * (- 1 * x * sqrt(P1) - y /sqrt(P2)) - 4 * ( 1 - sqrt(P1) / sqrt(P2) ) * (-1 * x*y)
    // D = (- 1 * x * sqrt(P1) - y /sqrt(P2)) * (- 1 * x * sqrt(P1) - y /sqrt(P2)) + 4 * ( 1 - sqrt(P1) / sqrt(P2) ) * ( x*y)
    // D = ( ( x * sqrt(P1)) ( x * sqrt(P1)) + (y /sqrt(P2))*(y /sqrt(P2)) + 2 * x * sqrt(P1) * y /sqrt(P2)) +  4 * x*y - 4*x*y * sqrt(P1) / sqrt(P2)
    // D = x^2 * P1 + y^2/P2 + 2*x*y*sqrt(P1)/sqrt(P2) + 4*x*y-4*x*y*sqrt(P1)/sqrt(P2)
    //
    // x = 20000, y = 0, P1 = 1, P2 = 125/80
    // D = 20000^2 * P1^2 + 0^2/P2 + 2*20000*0*P1/sqrt(P2) + 4*20000*0-4*20000*0*P1/sqrt(P2)
    // D = 20000^2 * 1^2
    // D = 400000000

    // L = (-b +-sqrt(D))/2a
    // L = -1 * (- 1 * x * P1 - y /sqrt(P2)) +- sqrt(D)) / (2 * (1 - P1 / sqrt(P2)) )
    // L = ( x * P1 + y /sqrt(P2) +- sqrt(D)) / (2  - 2 * P1 / sqrt(P2)))
    // L = ( 20000 * 1 + 0/sqrt(P2) +- sqrt(400000000) ) / (2 - 2 * 1 / sqrt(125/80) )
    // L = (20000 + 20000)  / ( 2 - 2 * 1 / sqrt(125/80))
    // L = 40000 / ( 2 - 2 / 1,25) = 40000 / 0.4 = 100000

    // D = x^2 * P1 + y^2/P2 + 2*x*y*sqrt(P1)/sqrt(P2) + 4*x*y - 4*x*y*sqrt(P1)/sqrt(P2)
    // D = D1       + D2     + D3                      + D4    - D5

    // L = ( x * sqrt(P1) + y /sqrt(P2) +- sqrt(D)) / (2  - 2 * P1 / sqrt(P2)))
    // L = ( L1           + L2          +- sqrt(D) ) / (2 - L3)
    // L1 = x * sqrt(P1)
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
      const nom = L1 + L2 + D_SQRT;
      const den = <uint256>2 * s - L3;
      const ret = (s * nom) / den;
      return ret;
    }
    const nom = L1 + L2 - D_SQRT;
    const den = L3 - <uint256>2 * s;
    const ret = (s * nom) / den;
    return ret;

    // const ret: uint64 = nom / den;
    // return (L1 + L2 + sqrt(D) / sqrt(SCALE)) / (2 * SCALE - L3) / SCALE;
  }

  /**
   * Get the current price when asset a has x
   * @param assetAQuantity x
   * @param assetBQuantity y
   * @param priceMinSqrt sqrt(priceMin)
   * @param priceMaxSqrt sqrt(priceMax)
   * @param liquidity Current pool liquidity - L variable
   * @returns the price with specified quantity with the price range set in the contract
   */
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

  /**
   * Calculates how much asset B will be taken from the smart contract on asset A deposit
   * @param inAmount Asset A amount in Base decimal representation.. If asset has 6 decimals, 1 is represented as 1000000000
   * @param assetABalance Asset A balance. Variable ab, in base scale
   * @param assetBBalance Asset B balance. Variable bb, in base scale
   * @param priceMinSqrt sqrt(Min price). Variable pMinS, in base scale
   * @param priceMaxSqrt sqrt(Max price). Variable pMaxS, in base scale
   * @param liqudity sqrt(Max price). Variable L, in base scale
   * @returns Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)
   */
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
    // (x + L / sqrt(P2))*(y+L*sqrt(P1))= L*L
    // (x1 + L / sqrt(P2))*(y1 + L * sqrt(P1))= L*L
    // (x2 + L / sqrt(P2))*(y2 + L * sqrt(P1))= L*L
    // (x1 + deposit) = x2
    // (y1 - withdraw ) = y2
    // (x1 + L / sqrt(P2))*(y1 + L * sqrt(P1)) = (x2 + L / sqrt(P2))*(y2 + L * sqrt(P1))
    // (x1 + L / sqrt(P2))*(y1 + L * sqrt(P1)) = (x1 + deposit + L / sqrt(P2))*(y1 - withdraw + L * sqrt(P1))
    // (x1 + L / sqrt(P2))*(y1 + L * sqrt(P1)) = (x1 + deposit + L / sqrt(P2))*(y1 - withdraw + L * sqrt(P1))
    // SP2 = B
    // SP1 = A
    // (X + L / B)*(Y + L * A) = (X + D + L / B)*(Y - W + L * A)
    // https://www.mathpapa.com/equation-solver/
    // w = (a*b*d*l + b*d*y)/(b*d+b*x+l)
    // const assetADelicmalScale: uint64 = 10 ** assetADecimals;
    // const assetBDelicmalScale: uint64 = 10 ** assetBDecimals;

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

  /**
   * Calculates how much asset A will be taken from the smart contract on asset B deposit
   * @param inAmount Asset B amount in Base decimal representation.. If asset has 6 decimals, 1 is represented as 1000000000
   * @param assetABalance Asset A balance. Variable ab, in base scale
   * @param assetBBalance Asset B balance. Variable bb, in base scale
   * @param priceMinSqrt sqrt(Min price). Variable pMinS, in base scale
   * @param priceMaxSqrt sqrt(Max price). Variable pMaxS, in base scale
   * @param liqudity sqrt(Max price). Variable L, in base scale
   *
   * @returns Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)
   */
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
    // return (inAmount * priceMinSqrt * priceMinSqrt) / s / s;
    // (x + L / sqrt(P2))*(y+L*sqrt(P1))= L*L
    // (x1 + L / sqrt(P2))*(y1 + L * sqrt(P1))= L*L
    // (x2 + L / sqrt(P2))*(y2 + L * sqrt(P1))= L*L
    // (x1 - withdraw) = x2
    // (y1 + deposit ) = y2
    // (x1 + L / sqrt(P2))*(y1 + L * sqrt(P1))= (x1 - withdraw + L / sqrt(P2))*(y1 + deposit + L * sqrt(P1))
    // SP2 = B
    // SP1 = A
    // (X + L / B)*(Y + L * A) = (X - W + L / B)*(Y + D + L * A)

    // https://www.mathpapa.com/equation-solver/
    // w = (d*l + b*d*x)/(a*b*l+b*d+b*y)
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

  /**
   * Calculates how much asset A will be taken from the smart contract on LP asset deposit
   * @param inAmount LP Asset amount in Base decimal representation..
   * @param assetABalance Asset A balance. Variable ab, in base scale
   * @param liqudity Current liqudity. Variable L, in base scale
   *
   * @returns Amount of asset A to be given to the caller before fees. The result is in Base decimals (9)
   */
  @abi.readonly
  calculateAssetAWithdrawOnLpDeposit(inAmount: uint256, assetABalance: uint256, liqudity: uint256): uint256 {
    // const s = SCALE as uint256;
    // const percentageOfL = (inAmount * s) / liqudity;
    // const ret = (assetABalance * percentageOfL) / s;
    const ret = (assetABalance * inAmount) / liqudity;
    return ret;
  }

  /**
   * Calculates how much asset B will be taken from the smart contract on LP asset deposit
   * @param inAmount LP Asset amount in Base decimal representation..
   * @param assetBBalance Asset B balance. Variable ab, in base scale
   * @param liqudity Current liqudity. Variable L, in base scale
   *
   * @returns Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)
   */
  @abi.readonly
  calculateAssetBWithdrawOnLpDeposit(inAmount: uint256, assetBBalance: uint256, liqudity: uint256): uint256 {
    // const s = SCALE as uint256;
    // const percentageOfL = (inAmount * s) / liqudity;
    // const ret = (assetBBalance * percentageOfL) / s;
    const ret = (assetBBalance * inAmount) / liqudity;
    return ret;
  }

  /**
   * Calculates how much asset B should be deposited when user deposit asset a and b.
   *
   * On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user
   *
   * @param inAmountA Asset A amount in Base decimal representation
   * @param inAmountB Asset B amount in Base decimal representation
   * @param assetABalance Asset A balance. Variable ab, in base scale
   * @param assetBBalance Asset B balance. Variable bb, in base scale
   *
   * @returns Amount of asset B to be given to the caller before fees. The result is in Base decimals (9)
   */
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

  /**
   * Calculates how much asset A should be deposited when user deposit asset a and b
   *
   * On deposit min(calculateAssetBDepositOnAssetADeposit, calculateAssetADepositOnAssetBDeposit) should be considered for the real deposit and rest should be swapped or returned back to user
   *
   * @param inAmountA Asset A amount in Base decimal representation
   * @param inAmountB Asset B amount in Base decimal representation
   * @param assetABalance Asset A balance. Variable ab, in base scale
   * @param assetBBalance Asset B balance. Variable bb, in base scale
   *
   * @returns Amount of asset A to be deposited. The result is in Base decimals (9)
   */
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
  status(appBiatecConfigProvider: AppID, assetA: AssetID, assetB: AssetID, assetLP: AssetID): AmmStatus {
    assert(
      appBiatecConfigProvider === this.appBiatecConfigProvider.value,
      'appBiatecConfigProvider must match to the global variable app id'
    );
    assert(assetA.id === this.assetA.value);
    assert(assetB.id === this.assetB.value);
    assert(this.assetLP.value === assetLP.id, 'LP asset does not match');
    const biatecFee = this.appBiatecConfigProvider.value.globalState('f') as uint256;
    const realBalanceA =
      assetA.id === 0
        ? globals.currentApplicationAddress.balance
        : globals.currentApplicationAddress.assetBalance(assetA);
    const realBalanceB = globals.currentApplicationAddress.assetBalance(assetB);
    return {
      assetA: this.assetA.value,
      assetB: this.assetB.value,
      poolToken: this.assetLP.value,
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
      releasedLiqudity: this.calculateDistributedLiquidity(assetLP, <uint256>0) as uint64,
      scale: SCALE,
      verificationClass: this.verificationClass.value,
    };
  }
}
