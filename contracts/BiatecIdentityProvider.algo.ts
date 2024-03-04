import { Contract } from '@algorandfoundation/tealscript';

// eslint-disable-next-line no-unused-vars
const TOTAL_SUPPLY = 10_000_000_000_000_000;
const governor = 'ALGONAUTSPIUHDCX3SLFXOFDUKOE4VY36XV4JX2JHQTWJNKVBKPEBQACRY';

type IdentityInfo = {
  verificationClass: uint8;
  engagementClass: uint8;
  isCompany: boolean;
  personUUID: string[36];
  legalEntityUUID: string[36];
};

// eslint-disable-next-line no-unused-vars
class BiatecIdentityProvider extends Contract {
  /**
   * Each account on the
   */
  identities = BoxMap<Address, IdentityInfo>({ prefix: 'i' });

  governor = GlobalStateKey<Address>({ key: 'g' });

  verificationClassSetter = GlobalStateKey<Address>({ key: 'v' });

  engagementClassSetter = GlobalStateKey<Address>({ key: 'e' });

  /**
   * Initial setup
   */
  createApplication(): void {
    this.governor.value = Address.fromBytes(governor);
  }
}
