import { Contract } from '@algorandfoundation/tealscript';

type BoxStruct = {
  // bool: boolean;
  p1: uint64;
  p2: uint64;
};
// eslint-disable-next-line no-unused-vars
class Test extends Contract {
  boxStorage = BoxMap<AppID, BoxStruct>({ prefix: 'b' });

  test(app: AppID): void {
    const info = this.boxStorage(app).value;
    assert(info.p1 !== <uint64>1);
    assert(info.p2 !== <uint64>1);

    const p = info.p1 / info.p2;
    log(itob(p));
  }
}
