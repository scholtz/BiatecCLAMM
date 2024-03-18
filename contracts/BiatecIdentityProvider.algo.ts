import { Contract } from '@algorandfoundation/tealscript';

// eslint-disable-next-line no-unused-vars
const version = 'BIATEC-IDENT-01-01-01';
const SCALE = 1_000_000_000;

type IdentityInfo = {
  verificationStatus: uint64;
  verificationClass: uint64;
  isCompany: boolean;
  personUUID: string[36];
  legalEntityUUID: string[36];
  biatecEngagementPoints: uint64;
  biatecEngagementRank: uint64;
  avmEngagementPoints: uint64;
  avmEngagementRank: uint64;
  tradingEngagementPoints: uint64;
  tradingEngagementRank: uint64;
  isLocked: boolean;
  kycExpiration: uint64;
  investorForExpiration: uint64;
  isProfessionalInvestor: boolean;
};
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

// eslint-disable-next-line no-unused-vars
class BiatecIdentityProvider extends Contract {
  /**
   * Each account on the
   */
  identities = BoxMap<Address, IdentityInfo>({ prefix: 'i' });

  governor = GlobalStateKey<Address>({ key: 'g' });

  verificationSetter = GlobalStateKey<Address>({ key: 'v' });

  engagementSetter = GlobalStateKey<Address>({ key: 'e' });

  /**
   * Initial setup
   */
  createApplication(): void {
    log(version);
  }

  selfRegistration(user: Address, info: IdentityInfo) {
    assert(!this.identities(user).exists, 'Self registration cannot be executed if address is already registered');

    // verificationStatus: uint64;
    assert(info.verificationStatus === 1, 'Verification status must be empty');
    // verificationClass: uint64;
    assert(info.verificationClass === 0, 'verificationClass must equal to 0');
    // isCompany: boolean;
    // personUUID: string[36];
    assert(
      info.personUUID === '00000000-0000-0000-0000-000000000000',
      'personUUID must equal to 00000000-0000-0000-0000-000000000000'
    );
    // legalEntityUUID: string[36];
    assert(
      info.legalEntityUUID === '00000000-0000-0000-0000-000000000000',
      'legalEntityUUID must equal to 00000000-0000-0000-0000-000000000000'
    );
    // biatecEngagementPoints: uint64;
    assert(info.biatecEngagementPoints === 0, 'biatecEngagementPoints must equal to 0');
    // biatecEngagementRank: uint64;
    assert(info.biatecEngagementRank === 0, 'biatecEngagementRank must equal to 0');
    // avmEngagementPoints: uint64;
    assert(info.avmEngagementPoints === 0, 'avmEngagementPoints must equal to 0');
    // avmEngagementRank: uint64;
    assert(info.avmEngagementRank === 0, 'avmEngagementRank must equal to 0');
    // tradingEngagementPoints: uint64;
    assert(info.tradingEngagementPoints === 0, 'tradingEngagementPoints must equal to 0');
    // tradingEngagementRank: uint64;
    assert(info.tradingEngagementRank === 0, 'tradingEngagementRank must equal to 0');
    // isLocked: boolean;
    assert(info.isLocked === false, 'isLocked must equal to false');
    // kycExpiration: uint64;
    assert(info.kycExpiration === 0, 'kycExpiration must equal to 0');
    // investorForExpiration: uint64;
    assert(info.investorForExpiration === 0, 'investorForExpiration must equal to 0');
    // isProfessionalInvestor: boolean;
    assert(info.isProfessionalInvestor === false, 'isProfessionalInvestor must equal to false');

    this.identities(user).value = info;
  }

  setInfo(user: Address, info: IdentityInfo) {
    assert(this.txn.sender === this.engagementSetter.value);
    this.identities(user).value = info;
  }

  /**
   * Returns user information - fee multiplier, verification class, engagement class ..
   *
   * @param user Get info for specific user address
   * @param v Version of the data structure to return
   */
  @abi.readonly
  getUser(user: Address, v: uint8): UserInfoV1 {
    assert(v === 1, "Currently supported version of the data structure is '1'");
    if (!this.identities(user).exists) {
      const retNoIdentity: UserInfoV1 = {
        version: v,
        base: SCALE as uint256,
        feeMultiplier: (2 * SCALE) as uint256,
        isLocked: false,
        verificationClass: 0,
        verificationStatus: 0,
        biatecEngagementPoints: 0,
        biatecEngagementRank: 0,
        avmEngagementPoints: 0,
        avmEngagementRank: 0,
        tradingEngagementPoints: 0,
        tradingEngagementRank: 0,
        kycExpiration: 0,
        investorForExpiration: 0,
        isProfessionalInvestor: false,
      };
      return retNoIdentity;
    }
    const identity = this.identities(user).value;

    const ret: UserInfoV1 = {
      version: v,
      base: SCALE as uint256,
      feeMultiplier: (1 * SCALE) as uint256,
      isLocked: identity.isLocked,
      verificationClass: identity.verificationClass,
      verificationStatus: identity.verificationStatus,
      biatecEngagementPoints: identity.biatecEngagementPoints,
      biatecEngagementRank: identity.biatecEngagementRank,
      avmEngagementPoints: identity.avmEngagementPoints,
      avmEngagementRank: identity.avmEngagementRank,
      tradingEngagementPoints: identity.tradingEngagementPoints,
      tradingEngagementRank: identity.tradingEngagementRank,
      kycExpiration: identity.kycExpiration,
      investorForExpiration: identity.investorForExpiration,
      isProfessionalInvestor: identity.isProfessionalInvestor,
    };
    return ret;
  }
}
