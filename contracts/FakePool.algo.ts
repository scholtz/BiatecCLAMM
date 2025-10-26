import { Contract } from '@algorandfoundation/tealscript';

export class FakePool extends Contract {
  /**
   * When we know the app id of this pool, we can register it properly at the pool provider
   */
  bootstrapStep2(assetA: AssetID, assetB: AssetID, verificationClass: uint64, appBiatecPoolProvider: AppID): void {
    sendMethodCall<[AppID, AssetID, AssetID, uint64], void>({
      name: 'registerPool',
      methodArgs: [globals.currentApplicationID, assetA, assetB, verificationClass],
      fee: 0,
      applicationID: appBiatecPoolProvider,
    });
  }
}
