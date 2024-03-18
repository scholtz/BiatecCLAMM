import { Contract } from '@algorandfoundation/tealscript';

const version = 'BIATEC-CONFIG-01-01-01';
const SCALE = 1_000_000_000;
// eslint-disable-next-line no-unused-vars
class BiatecConfigProvider extends Contract {
  /**
   * Top secret account with which it is possible update contracts or identity provider
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
   * Biatec identity provider smart contract
   */
  appIdentityProvider = GlobalStateKey<AppID>({ key: 'i' });

  /**
   * Fees in 9 decimals. 1_000_000_000 = 100%
   * Fees in 9 decimals. 10_000_000 = 1%
   * Fees in 9 decimals. 100_000 = 0,01%
   *
   * Fees are respectful from the all fees taken to the LP providers. If LPs charge 1% fee, and biatec charges 10% fee, LP will receive 0.09% fee and biatec 0.01% fee
   */
  biatecFee = GlobalStateKey<uint256>({ key: 'f' });

  /**
   * Initial setup
   */
  createApplication(): void {
    log(version);
    this.addressExecutive.value = this.txn.sender;
    this.addressGov.value = this.txn.sender;
    this.addressUdpater.value = this.txn.sender;
  }

  /**
   * Setup the contract
   * @param biatecFee Biatec fees
   */
  bootstrap(biatecFee: uint256, appIdentityProvider: AppID): void {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can call bootstrap method');
    assert(biatecFee <= (SCALE as uint256) / 2, 'Biatec cannot set fees higher then 50% of lp fees');
    this.biatecFee.value = biatecFee;
    this.appIdentityProvider.value = appIdentityProvider;
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
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can change gov address');
    this.addressExecutive.value = a;
  }

  /**
   * App identity setter
   *
   * @param a Address
   */
  setBiatecIdentity(a: AppID) {
    assert(this.txn.sender === this.addressUdpater.value, 'Only updater can change gov address');
    this.appIdentityProvider.value = a;
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
}
