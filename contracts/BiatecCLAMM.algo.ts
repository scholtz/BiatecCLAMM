import { Contract } from '@algorandfoundation/tealscript';

// eslint-disable-next-line no-unused-vars
const version = 'CLAMM-01-01-01';
const LP_TOKEN_DECIMALS = 6;
const SCALE_DECIMALS = 9;
const TOTAL_SUPPLY = 10_000_000_000_000_000;
const SCALE = 1_000_000_000;
const governor = 'ALGONAUTSPIUHDCX3SLFXOFDUKOE4VY36XV4JX2JHQTWJNKVBKPEBQACRY';

// eslint-disable-next-line no-unused-vars
class BiatecCLAMM extends Contract {
  // asset A id
  assetA = GlobalStateKey<AssetID>({ key: 'a' });

  // asset B id
  assetB = GlobalStateKey<AssetID>({ key: 'b' });

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

  // pool LP token id
  poolToken = GlobalStateKey<AssetID>({ key: 'p' });

  // fee settings 100000
  feeB100000 = GlobalStateKey<uint64>({ key: 'f' });

  // current price
  ratio = GlobalStateKey<uint64>({ key: 'r' });

  // scale in this contranct
  scale = GlobalStateKey<uint64>({ key: 'scale' });

  // identity provider app id
  identityProvider = GlobalStateKey<AppID>({ key: 'i' });

  // pool provider app id
  poolProvider = GlobalStateKey<AppID>({ key: 'pp' });

  // biatec account
  governor = GlobalStateKey<Address>({ key: 'g' });

  /**
   * Verification class is level of KYC verification by Biatec Identity
   *
   * 0 = Unverified, 1 = Identity documents uploaded without personal id, 2= Identity documents including government id provided, 3 = Personal verification
   */
  verificationClass = GlobalStateKey<uint8>({ key: 'c' });

  /**
   * Engagement is level of usage of the biatec services
   *
   * Accounts with low engagement have higher trading fees than accounts with high trading volume
   */
  engagementClass = GlobalStateKey<uint8>({ key: 'e' });

  /**
   * Initial setup
   */
  createApplication(): void {
    log(version);
    this.governor.value = Address.fromBytes(governor);
    this.scale.value = SCALE;
    this.feeB100000.value = <uint64>0;
  }

  @abi.readonly
  getCurrentPrice(): uint64 {
    return this.ratio.value;
  }

  @abi.readonly
  getPriceDivider(): uint64 {
    return this.scale.value;
  }

  @abi.readonly
  getLPTokenId(): uint64 {
    return this.poolToken.value.id;
  }

  /**
   * Anybody can deploy the clamm smart contract
   * @param txSeed Seed transaction so that smart contract can opt in to the assets
   * @param assetA Asset A ID must be lower then Asset B ID
   * @param assetB Asset B
   * @param feeB100000 Fee in 100000 base level. value 10000 = 10000/100000 = 0,1 = 10% fee. 1000 = 1%. 100 = 0,1%. 10 = 0,01% = 1 base point
   * @param verificationClass Asset B
   * @returns LP token ID
   */
  bootstrap(
    txSeed: PayTxn,
    assetA: AssetID,
    assetB: AssetID,
    feeB100000: uint64,
    priceMin: uint64,
    priceMax: uint64,
    currentPrice: uint64,
    verificationClass: uint8,
    identityProvider: AppID,
    poolProvider: AppID
  ): AssetID {
    verifyPayTxn(txSeed, { receiver: this.app.address, amount: { greaterThanEqualTo: 300_000 } });
    assert(this.governor.value === Address.fromBytes(governor));
    assert(assetA < assetB);
    assert(feeB100000 < 1000000); // fee must be lower then 10%
    assert(feeB100000 > 0); // fee must be higher then zero
    assert(verificationClass < 4); // verificationClass
    assert(!this.ratio.exists);
    assert(assetA.decimals <= SCALE_DECIMALS);
    assert(assetB.decimals <= SCALE_DECIMALS);
    const s = SCALE as uint256;

    assert(this.feeB100000.value <= 0, 'You can bootstrap contract only once'); // check that this contract deployment was not yet initialized

    this.identityProvider.value = identityProvider;
    this.poolProvider.value = poolProvider;

    this.priceMin.value = priceMin;
    this.priceMax.value = priceMax;
    this.priceMinSqrt.value = sqrt((priceMin as uint256) * s);
    this.priceMaxSqrt.value = sqrt((priceMax as uint256) * s);
    this.assetABalance.value = <uint256>0;
    this.assetBBalance.value = <uint256>0;
    this.ratio.value = currentPrice;

    this.assetA.value = assetA;
    this.assetB.value = assetB;
    this.poolToken.value = this.doCreatePoolToken(assetA, assetB);
    this.feeB100000.value = feeB100000;

    this.doOptIn(assetA);
    this.doOptIn(assetB);

    return this.poolToken.value;
  }

  private doAxfer(receiver: Address, asset: AssetID, amount: uint64): void {
    sendAssetTransfer({
      assetReceiver: receiver,
      xferAsset: asset,
      assetAmount: amount,
      fee: 0,
    });
  }

  private doOptIn(asset: AssetID): void {
    if (asset.id > 0) {
      // if asset id = 0 we do not have to opt in to native token
      this.doAxfer(this.app.address, asset, 0);
    }
  }

  private doCreatePoolToken(assetA: AssetID, assetB: AssetID): AssetID {
    // const verificationClass = this.verificationClass.value.toString(); // TODO
    // const feeB100000 = this.feeB100000.value.toString();
    // const name = 'B-' + verificationClass + '-' + feeB100000 + '-' + assetA.unitName + '-' + assetB.unitName; // TODO
    const name = 'B-' + assetA.unitName + '-' + assetB.unitName; // TODO

    return sendAssetCreation({
      configAssetName: name,
      configAssetUnitName: 'BLP',
      configAssetTotal: TOTAL_SUPPLY,
      configAssetDecimals: LP_TOKEN_DECIMALS,
      configAssetManager: this.app.address,
      configAssetReserve: this.app.address,
    });
  }

  /**
   * This method adds Asset A and Asset B to the Automated Market Maker Concentrated Liqudidity Pool and send to the liqudidty provider the liqudity token
   * @param txAssetADeposit Transfer of asset A to the LP pool
   * @param txAssetBDeposit Transfer of asset B to the LP pool
   * @param assetLP Liquidity pool asset
   * @param assetA Asset A
   * @param assetB Asset B
   * @returns LP Token quantity distributed
   */
  addLiquidity(
    //    aXfer: AssetTransferTxn | PayTxn,
    //    bXfer: AssetTransferTxn | PayTxn,
    txAssetADeposit: Txn,
    txAssetBDeposit: Txn,
    assetLP: AssetID,
    assetA: AssetID,
    assetB: AssetID
  ): uint64 {
    /// well formed mint
    assert(assetA === this.assetA.value);
    assert(assetB === this.assetB.value);
    assert(assetLP === this.poolToken.value);
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetA.decimals)) as uint256;
    // if assetA.decimals == 6 then assetADelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;
    // if assetA.decimals == 6 then assetADelicmalScale2Scale = 1000
    const assetLPDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - LP_TOKEN_DECIMALS)) as uint256;
    /*
    if ((aXfer as PayTxn) != null) {
      const pay = aXfer as PayTxn;
      // assert(this.assetA.value == 0);
      verifyPayTxn(pay, { receiver: this.app.address, amount: { greaterThanEqualTo: 0 } });
    } */
    // if ((aXfer as AssetTransferTxn) != null) {
    if (true) {
      const xfer = txAssetADeposit as AssetTransferTxn;
      verifyAssetTransferTxn(xfer, {
        assetReceiver: this.app.address,
        xferAsset: assetA,
        assetAmount: { greaterThanEqualTo: 0 },
      });
    }
    // }
    /*
    if ((bXfer as PayTxn) != null) {
      const pay = bXfer as PayTxn;
      // assert(this.assetA.value == 0);
      verifyPayTxn(pay, { receiver: this.app.address, amount: { greaterThanEqualTo: 0 } });
    }
    */
    //    if ((bXfer as AssetTransferTxn) != null) {
    if (true) {
      const xfer = txAssetBDeposit as AssetTransferTxn;
      verifyAssetTransferTxn(xfer, {
        assetReceiver: this.app.address,
        xferAsset: assetB,
        assetAmount: { greaterThanEqualTo: 0 },
      });
    }
    // }

    if (
      this.app.address.assetBalance(assetA) === txAssetADeposit.assetAmount &&
      this.app.address.assetBalance(assetB) === txAssetBDeposit.assetAmount
    ) {
      // make sure we are on the curve
      // TODO

      // calculate LP position
      this.assetABalance.value = (txAssetADeposit.assetAmount as uint256) * assetADelicmalScale2Scale;
      this.assetBBalance.value = (txAssetBDeposit.assetAmount as uint256) * assetBDelicmalScale2Scale;

      const x = this.assetABalance.value;
      const y = this.assetBBalance.value;
      const priceMin = this.priceMin.value as uint256;
      const priceMax = this.priceMax.value as uint256;
      const priceMinSqrt = this.priceMinSqrt.value;
      const priceMaxSqrt = this.priceMaxSqrt.value;
      assert(priceMinSqrt > <uint256>0);
      const toMint = this.calculateLiquidity(x, y, priceMin, priceMax, priceMinSqrt, priceMaxSqrt);
      assert(false);
      this.Liqudity.value = toMint;
      const lpTokensToSend = (toMint / assetLPDelicmalScale2Scale) as uint64;
      // send LP tokens to user
      this.doAxfer(this.txn.sender, this.poolToken.value, lpTokensToSend);
      return lpTokensToSend;
    }
    return 0;
  }

  /**
   * This method retrieves from the liquidity provider LP token and returns Asset A and Asset B from the Automated Market Maker Concentrated Liqudidity Pool
   * @param txLPXfer Transfer of the LP token
   * @param assetLP LP pool asset
   * @param assetA Asset A
   * @param assetB Asset B
   */
  removeLiquidity(txLPXfer: AssetTransferTxn, assetLP: AssetID, assetA: AssetID, assetB: AssetID): void {
    /// well formed mint
    assert(assetA === this.assetA.value);
    assert(assetB === this.assetB.value);
    assert(assetLP === this.poolToken.value);

    verifyAssetTransferTxn(txLPXfer, {
      assetReceiver: this.app.address,
      xferAsset: assetLP,
      assetAmount: { greaterThanEqualTo: 0 },
    });

    throw Error();
  }

  /**
   * Swap Asset A to Asset B or Asset B to Asst A
   * @param txSwap Transfer of the token to be deposited to the pool. To the owner the other asset will be sent.
   * @param assetA Asset A
   * @param assetB Asset B
   * @param minimumToReceive If number greater then zero, the check is performed for the output of the other asset
   */
  swap(txSwap: AssetTransferTxn, assetA: AssetID, assetB: AssetID, minimumToReceive: uint64): uint64 {
    /// well formed swap
    assert(assetA === this.assetA.value);
    assert(assetB === this.assetB.value);

    verifyAssetTransferTxn(txSwap, {
      assetAmount: { greaterThan: 0 },
      assetReceiver: this.app.address,
      sender: this.txn.sender,
      xferAsset: { includedIn: [assetA, assetB] },
    });
    // if assetA.decimals == 8 then assetADelicmalScale2Scale = 10
    const assetADelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetA.decimals)) as uint256;
    // if assetA.decimals == 6 then assetADelicmalScale2Scale = 1000
    const assetBDelicmalScale2Scale = (10 ** (SCALE_DECIMALS - assetB.decimals)) as uint256;
    let toSwap: uint256 = 0;
    if (txSwap.xferAsset === assetA) {
      const assetInAssetDecimals = txSwap.assetAmount as uint256;
      toSwap = this.calculateAssetBWithdrawOnAssetADeposit(
        assetInAssetDecimals * assetADelicmalScale2Scale,
        this.assetABalance.value,
        this.assetBBalance.value,
        this.priceMinSqrt.value,
        this.priceMaxSqrt.value,
        this.Liqudity.value
      );
      toSwap = toSwap / assetBDelicmalScale2Scale;
      const toSwapBDecimals = toSwap as uint64;
      if (minimumToReceive > 0) {
        // if minimumToReceive == 0, do not restrict the price
        assert(minimumToReceive >= toSwapBDecimals);
      }

      this.doAxfer(this.txn.sender, assetB, toSwapBDecimals);

      this.assetABalance.value =
        (this.app.address.assetBalance(this.assetA.value) as uint256) * assetADelicmalScale2Scale;
      this.assetBBalance.value =
        (this.app.address.assetBalance(this.assetB.value) as uint256) * assetBDelicmalScale2Scale;
    }

    const newPrice = this.calculatePrice(
      this.assetABalance.value, // assetAQuantity: uint256,
      this.assetBBalance.value, // assetBQuantity: uint256,
      this.priceMinSqrt.value, // priceMinSqrt: uint256,
      this.priceMaxSqrt.value, // priceMaxSqrt: uint256,
      this.Liqudity.value // liquidity: uint256
    );
    this.ratio.value = newPrice as uint64;

    // verify that L has not been changed
    const newL = this.calculateLiquidity(
      this.assetABalance.value,
      this.assetBBalance.value,
      this.priceMin.value as uint256, // priceMin: uint256,
      this.priceMax.value as uint256, // priceMax: uint256,
      this.priceMinSqrt.value, // priceMinSqrt: uint256,
      this.priceMaxSqrt.value // priceMaxSqrt: uint256,
    );
    if (newL !== this.Liqudity.value) {
      log('New liquidity does not match');
      assert(newL === this.Liqudity.value, 'New liquidity does not match');
    }
    return toSwap as uint64;
  }

  /**
   * Calculates the liquidity  from the x - Asset A position and y - Asset B position
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
  calculateLiquidity(
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

    const s = SCALE as uint256;
    // D1 = x^2 * P1
    const D1 = (((x * x) / s) * priceMin) / s;
    // D2 = y^2/P2
    const D2 = (y * y) / priceMax;
    // D3 = 2*x*y*sqrt(P1)/sqrt(P2)
    const D3 = (((<uint256>2 * x * y) / s) * priceMinSqrt) / s / priceMaxSqrt;
    // sqrt(10000/1000) = sqrt(10000)/sqrt(1000)
    // D4 = 4*x*y
    const D4 = (<uint256>4 * x * y) / s;
    // D5 = -4*x*y*sqrt(P1)/sqrt(P2)
    const D5 = (((<uint256>4 * x * y) / s) * priceMinSqrt) / s / priceMaxSqrt;
    const D = D1 + D2 + D3 + D4 - D5;
    // L = ( x * sqrt(P1) + y /sqrt(P2) +- sqrt(D)) / (2  - 2 * P1 / sqrt(P2)))
    // L = ( L1           + L2          +- sqrt(D) ) / (2 - L3)
    // L1 = x * sqrt(P1)
    const L1 = (x * priceMinSqrt) / s;
    // L2 = 0 * 1000000000n / 1250000000n
    // L2 = y /sqrt(P2)
    const L2 = (y * s) / priceMaxSqrt;
    // L3 = 2 * sqrt(P1) / sqrt(P2)
    const L3 = (<uint256>2 * priceMinSqrt * s) / priceMaxSqrt;
    // L = ( x * P1 + y /sqrt(P2) +- sqrt(D)) / (2  - 2 * P1 / sqrt(P2)))
    // const D_SQRT = (SCALE * sqrt(D)) / sqrt(SCALE);
    const D_SQRT = sqrt(s * D);

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
    // P=(y+L*A)/(x+L/B)
    const s = SCALE as uint256;
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

    const s = SCALE as uint256;
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
    const s = SCALE as uint256;
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
}
