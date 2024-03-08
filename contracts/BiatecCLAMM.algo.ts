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
  assetABalance = GlobalStateKey<uint64>({ key: 'ab' });

  // asset B balance - disponible for swapping. The difference between contract balance and asset B balance is the fees collected
  assetBBalance = GlobalStateKey<uint64>({ key: 'bb' });

  // min price
  priceMaxA = GlobalStateKey<uint64>({ key: 'pa' });

  // max price
  priceMaxB = GlobalStateKey<uint64>({ key: 'pb' });

  // min price in square root
  priceMaxASqrt = GlobalStateKey<uint64>({ key: 'pas' });

  // max price in square root
  priceMaxBSqrt = GlobalStateKey<uint64>({ key: 'pbs' });

  // pool LP token id
  poolToken = GlobalStateKey<AssetID>({ key: 'p' });

  // fee settings 100000
  feeB100000 = GlobalStateKey<uint32>({ key: 'f' });

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
  }

  @abi.readonly
  getCurrentPrice(): uint64 {
    return this.ratio.value;
  }

  @abi.readonly
  getHypotheticPrice(assetAQuantity: uint64, assetBQuantity: uint64): uint64 {
    return this.getPrice(assetAQuantity, assetBQuantity);
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
    feeB100000: uint32,
    priceMaxA: uint64,
    priceMaxB: uint64,
    currentPrice: uint64,
    verificationClass: uint8,
    identityProvider: AppID,
    poolProvider: AppID
  ): AssetID {
    verifyPayTxn(txSeed, { receiver: this.app.address, amount: { greaterThanEqualTo: 300_000 } });
    assert(this.governor.value === Address.fromBytes(governor));
    assert(assetA < assetB);
    assert(feeB100000 < 1000000); // fee must be lower then 10%
    assert(verificationClass < 4); // verificationClass
    assert(!this.ratio.exists);
    assert(assetA.decimals <= SCALE_DECIMALS);
    assert(assetB.decimals <= SCALE_DECIMALS);

    this.identityProvider.value = identityProvider;
    this.poolProvider.value = poolProvider;

    this.priceMaxA.value = priceMaxA;
    this.priceMaxB.value = priceMaxB;
    this.priceMaxASqrt.value = sqrt(priceMaxA * SCALE);
    this.priceMaxBSqrt.value = sqrt(priceMaxB * SCALE);
    this.assetABalance.value = 0;
    this.assetBBalance.value = 0;
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
   * @param poolAsset LP pool asset
   * @param assetA Asset A
   * @param assetB Asset B
   * @returns LP Token quantity distributed
   */
  addLiquidity(
    //    aXfer: AssetTransferTxn | PayTxn,
    //    bXfer: AssetTransferTxn | PayTxn,
    txAssetADeposit: Txn,
    txAssetBDeposit: Txn,
    poolAsset: AssetID,
    assetA: AssetID,
    assetB: AssetID
  ): uint64 {
    /// well formed mint
    assert(assetA === this.assetA.value);
    assert(assetB === this.assetB.value);
    assert(poolAsset === this.poolToken.value);
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
      this.assetABalance.value = txAssetADeposit.assetAmount;
      this.assetBBalance.value = txAssetBDeposit.assetAmount;
      const toMint = this.calculateL(this.assetABalance.value, this.assetBBalance.value);

      // send LP tokens to user
      // this.doAxfer(this.txn.sender, this.poolToken.value, toMint); TODO FIX
      return toMint;
    }
    return 0;
  }

  private calculateL(x: uint64, y: uint64): uint64 {
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

    // D1 = x^2 * P1
    const D1: uint64 = (((x * x) / SCALE) * this.priceMaxA.value) / SCALE;
    // D2 = y^2/P2
    const D2: uint64 = (y * y) / this.priceMaxB.value;
    // D3 = 2*x*y*sqrt(P1)/sqrt(P2)
    const D3: uint64 = (((2 * x * y) / SCALE) * this.priceMaxASqrt.value) / SCALE / this.priceMaxBSqrt.value;
    // sqrt(10000/1000) = sqrt(10000)/sqrt(1000)
    // D4 = 4*x*y
    const D4: uint64 = (4 * x * y) / SCALE;
    // D5 = -4*x*y*sqrt(P1)/sqrt(P2)
    const D5: uint64 = (((4 * x * y) / SCALE) * this.priceMaxASqrt.value) / SCALE / this.priceMaxBSqrt.value;
    const D = D1 + D2 + D3 + D4 - D5;
    // L = ( x * sqrt(P1) + y /sqrt(P2) +- sqrt(D)) / (2  - 2 * P1 / sqrt(P2)))
    // L = ( L1           + L2          +- sqrt(D) ) / (2 - L3)

    // L1 = x * sqrt(P1)
    const L1: uint64 = (x * this.priceMaxASqrt.value) / SCALE;
    // L2 = y /sqrt(P2)
    const L2: uint64 = (y * SCALE) / this.priceMaxBSqrt.value;
    // L3 = 2 * sqrt(P1) / sqrt(P2)
    const L3: uint64 = (2 * this.priceMaxASqrt.value * SCALE) / this.priceMaxBSqrt.value;
    // L = ( x * P1 + y /sqrt(P2) +- sqrt(D)) / (2  - 2 * P1 / sqrt(P2)))
    // const D_SQRT = (SCALE * sqrt(D)) / sqrt(SCALE);
    const D_SQRT = sqrt(SCALE * D);

    if (2 * SCALE > L3) {
      const nom: uint64 = L1 + L2 + D_SQRT;
      const den: uint64 = 2 * SCALE - L3;
      const ret: uint64 = (SCALE * nom) / den;
      return ret;
    }
    const nom: uint64 = L1 + L2 - D_SQRT;
    const den: uint64 = L3 - 2 * SCALE;
    const ret: uint64 = (SCALE * nom) / den;
    return ret;

    // const ret: uint64 = nom / den;
    // return (L1 + L2 + sqrt(D) / sqrt(SCALE)) / (2 * SCALE - L3) / SCALE;
  }

  /**
   * Get the current price when asset a has x
   * @param assetAQuantity x
   * @param assetBQuantity y
   * @returns the price with specified quantity with the price range set in the contract
   */
  private getPrice(assetAQuantity: uint64, assetBQuantity: uint64): uint64 {
    return assetAQuantity;
  }

  /**
   * This method retrieves from the liquidity provider LP token and returns Asset A and Asset B from the Automated Market Maker Concentrated Liqudidity Pool
   * @param txLPXfer Transfer of the LP token
   * @param poolAsset LP pool asset
   * @param assetA Asset A
   * @param assetB Asset B
   */
  removeLiquidity(txLPXfer: AssetTransferTxn, poolAsset: AssetID, assetA: AssetID, assetB: AssetID): void {
    /// well formed mint
    assert(assetA === this.assetA.value);
    assert(assetB === this.assetB.value);
    assert(poolAsset === this.poolToken.value);

    verifyAssetTransferTxn(txLPXfer, {
      assetReceiver: this.app.address,
      xferAsset: poolAsset,
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
  swap(txSwap: AssetTransferTxn, assetA: AssetID, assetB: AssetID, minimumToReceive: uint64): void {
    /// well formed swap
    assert(assetA === this.assetA.value);
    assert(assetB === this.assetB.value);

    verifyAssetTransferTxn(txSwap, {
      assetAmount: { greaterThan: 0 },
      assetReceiver: this.app.address,
      sender: this.txn.sender,
      xferAsset: { includedIn: [assetA, assetB] },
    });

    if (txSwap.xferAsset === assetA) {
      const toSwap = this.calculateAssetBWithdrawOnAssetADeposit(txSwap.assetAmount, assetA.decimals, assetB.decimals);
      assert(minimumToReceive >= toSwap);
      this.doAxfer(this.txn.sender, assetB, toSwap);
    }

    // assert(toSwap > 0);

    // this.doAxfer(this.txn.sender, outId, toSwap);

    // this.ratio.value = this.computeRatio();
  }

  @abi.readonly
  calculateAssetBWithdrawOnAssetADeposit(inAmount: uint64, assetADecimals: uint64, assetBDecimals: uint64): uint64 {
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
    const assetADelicmalScale: uint64 = 10 ** assetADecimals;
    const assetBDelicmalScale: uint64 = 10 ** assetBDecimals;

    const x: uint64 = this.assetABalance.value;
    const y: uint64 = this.assetBBalance.value;
    const a: uint64 = this.priceMaxASqrt.value;
    const b: uint64 = this.priceMaxBSqrt.value;
    const L: uint64 = this.calculateL(x, y);
    // a*b*d*l
    const P1: uint64 =
      (((((a /* 10D */ * b) /* 10D */ / SCALE) * inAmount) /* AD */ / SCALE) * L) /* 10D */ / assetADelicmalScale;
    // b*d*y
    const P2: uint64 = (((b /* 10D */ * inAmount) /* AD */ / assetADelicmalScale) * y) /* BD */ / SCALE; // << CHECK B Decimals not applied?
    // b*d
    const P3: uint64 = (b /* 10D */ * inAmount) /* AD */ / assetADelicmalScale;
    // b*x
    const P4: uint64 = (b /* 10D */ * x) /* 10D */ / SCALE;
    // (a*b*d*l + b*d*y)
    const P12: uint64 = P1 + P2;
    // (b*d+b*x+l)
    const P345: uint64 = P3 + P4 + L;
    // (a*b*d*l + b*d*y)/(b*d+b*x+l)
    const ret: uint64 = (P12 * assetBDelicmalScale) / P345;
    return ret;
  }
}
