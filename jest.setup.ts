declare interface BigInt {
  toJSON(): string;
}

BigInt.prototype.toJSON = function toJSONBigInt() {
  return this.toString();
};
