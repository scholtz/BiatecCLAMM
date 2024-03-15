import { Contract } from '@algorandfoundation/tealscript';

// eslint-disable-next-line no-unused-vars
const version = 'BIATEC-IDENT-01-01-01';

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
    log(version);
  }
}
