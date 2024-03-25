import { Contract } from '@algorandfoundation/tealscript';

const version = 'BIATEC-CONFIG-01-01-01';
const SCALE = 1_000_000_000;
// eslint-disable-next-line no-unused-vars
class BiatecConfigProvider extends Contract {
  /**
   * Top secret multisig account with which it is possible update user contracts or biatec contracts.
   */
  addressUdpater = GlobalStateKey<Address>({ key: 'u' });

  /**
   * Execution address with which it is possible to opt in for governance
   */
  addressGov = GlobalStateKey<Address>({ key: 'g' });

  /**
   * Execution address with which it is possible to change global biatec fees
   */
  addressExecutive = GlobalStateKey<Address>({ key: 'e' });

  /**
   * Execution address with which it is possible to change global biatec fees
   */
  addressExecutiveFee = GlobalStateKey<Address>({ key: 'ef' });

  /**
   * Biatec identity provider smart contract
   */
  appBiatecIdentityProvider = GlobalStateKey<AppID>({ key: 'i' });

  /**
   * Biatec pool provider smart contract
   */
  appBiatecPoolProvider = GlobalStateKey<AppID>({ key: 'p' });

  /**
   * Kill switch. In the extreme case all services (deposit, trading, withdrawal, identity modifications and more) can be suspended.
   * Only addressUdpater multisig can modify this setting.
   */
  suspended = GlobalStateKey<uint64>({ key: 's' });

  /**
   * Fees in 9 decimals. 1_000_000_000 = 100%
   * Fees in 9 decimals. 10_000_000 = 1%
   * Fees in 9 decimals. 100_000 = 0,01%
   *
   * Fees are respectful from the all fees taken to the LP providers. If LPs charge 1% fee, and biatec charges 10% fee, LP will receive 0.09% fee and biatec 0.01% fee
   */
  biatecFee = GlobalStateKey<uint256>({ key: 'f' });

  /**
   * Version of the smart contract
   */
  version = GlobalStateKey<bytes>({ key: 'scver' });

  /**
   * Initial setup
   */
  createApplication(): void {
    this.version.value = version;
    this.addressExecutive.value = this.txn.sender;
    this.addressGov.value = this.txn.sender;
    this.addressUdpater.value = this.txn.sender;
    this.addressExecutiveFee.value = this.txn.sender;
    this.suspended.value = 0;
  }

  /**
   * addressUdpater from global biatec configuration is allowed to update application
   */
  updateApplication(newVersion: bytes): void {
    assert(
      this.txn.sender === this.addressUdpater.value,
      'Only addressUdpater setup in the config can update application'
    );
    this.version.value = newVersion;
  }

  /**
   * Setup the contract
   * @param biatecFee Biatec fees
   */
  bootstrap(biatecFee: uint256, appBiatecIdentityProvider: AppID, appBiatecPoolProvider: AppID): void {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can call bootstrap method');
    assert(biatecFee <= (SCALE as uint256) / 2, 'Biatec cannot set fees higher then 50% of lp fees');
    this.biatecFee.value = biatecFee;
    this.appBiatecIdentityProvider.value = appBiatecIdentityProvider;
    this.appBiatecPoolProvider.value = appBiatecPoolProvider;
  }

  /**
   * Top secret account with which it is possible update contracts or identity provider
   *
   * @param a Address
   */
  setAddressUdpater(a: Address) {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can change updater address');
    this.addressUdpater.value = a;
  }

  /**
   * Kill switch. In the extreme case all services (deposit, trading, withdrawal, identity modifications and more) can be suspended.
   *
   * @param a Address
   */
  setPaused(a: uint64) {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can pause and unpause the biatec services');
    this.suspended.value = a;
  }

  /**
   * Execution address with which it is possible to opt in for governance
   *
   * @param a Address
   */
  setAddressGov(a: Address) {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can change gov address');
    this.addressGov.value = a;
  }

  /**
   * Execution address with which it is possible to change global biatec fees
   *
   * @param a Address
   */
  setAddressExecutive(a: Address) {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can change addressExecutive');
    this.addressExecutive.value = a;
  }

  /**
   * Execution fee address is address which can take fees from pools.
   *
   * @param a Address
   */
  setAddressExecutiveFee(a: Address) {
    assert(this.txn.sender === this.addressExecutive.value, 'Only addressExecutive can change fee executor address');
    this.addressExecutiveFee.value = a;
  }

  /**
   * App identity setter
   *
   * @param a Address
   */
  setBiatecIdentity(a: AppID) {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can change appIdentityProvider');
    this.appBiatecIdentityProvider.value = a;
  }

  /**
   * App identity setter
   *
   * @param a Address
   */
  setBiatecPool(a: AppID) {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can change appPoolProvider');
    this.appBiatecPoolProvider.value = a;
  }

  /** 
   * Fees in 9 decimals. 1_000_000_000 = 100%
   * Fees in 9 decimals. 10_000_000 = 1%
   * Fees in 9 decimals. 100_000 = 0,01%
   *
   * Fees are respectful from the all fees taken to the LP providers. If LPs charge 1% fee, and biatec charges 10% fee, LP will receive 0.09% fee and biatec 0.01% fee

   * @param biatecFee Fee
   */
  setBiatecFee(biatecFee: uint256) {
    assert(this.txn.sender === this.addressExecutive.value, 'Only executive address can change fees');
    assert(biatecFee <= (SCALE as uint256) / 2, 'Biatec cannot set fees higher then 50% of lp fees');
    this.biatecFee.value = biatecFee;
  }

  /**
   * addressExecutiveFee can perfom key registration for this LP pool
   *
   * Only addressExecutiveFee is allowed to execute this method.
   */
  sendOnlineKeyRegistration(
    votePK: bytes,
    selectionPK: bytes,
    stateProofPK: bytes,
    voteFirst: uint64,
    voteLast: uint64,
    voteKeyDilution: uint64
  ): void {
    assert(
      this.txn.sender === this.addressExecutiveFee.value,
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
   * @param asset Asset to withdraw. If native token, then zero
   * @param amount Amount of the asset to be withdrawn
   */
  withdrawExcessAssets(asset: AssetID, amount: uint64): uint64 {
    assert(
      this.txn.sender === this.addressExecutiveFee.value,
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
