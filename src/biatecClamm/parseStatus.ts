export type AmmStatus = {
  scale: bigint;
  assetABalance: bigint;
  assetBBalance: bigint;
  realABalance: bigint;
  realBBalance: bigint;
  priceMinSqrt: bigint;
  priceMaxSqrt: bigint;
  currentLiqudity: bigint;
  releasedLiqudity: bigint;
  liqudityUsersFromFees: bigint;
  liqudityBiatecFromFees: bigint;
  assetA: bigint;
  assetB: bigint;
  poolToken: bigint;
  price: bigint;
  fee: bigint;
  biatecFee: bigint;
  verificationClass: bigint;
};

const parseStatus = (input: (bigint | number)[] | null | undefined): AmmStatus => {
  if (!input)
    return {
      scale: 0n,
      assetABalance: 0n,
      assetBBalance: 0n,
      realABalance: 0n,
      realBBalance: 0n,
      priceMinSqrt: 0n,
      priceMaxSqrt: 0n,
      currentLiqudity: 0n,
      releasedLiqudity: 0n,
      liqudityUsersFromFees: 0n,
      liqudityBiatecFromFees: 0n,
      assetA: 0n,
      assetB: 0n,
      poolToken: 0n,
      price: 0n,
      fee: 0n,
      biatecFee: 0n,
      verificationClass: 0n,
    };
  return {
    scale: BigInt(input[0]),
    assetABalance: BigInt(input[1]),
    assetBBalance: BigInt(input[2]),
    realABalance: BigInt(input[3]),
    realBBalance: BigInt(input[4]),
    priceMinSqrt: BigInt(input[5]),
    priceMaxSqrt: BigInt(input[6]),
    currentLiqudity: BigInt(input[7]),
    releasedLiqudity: BigInt(input[8]),
    liqudityUsersFromFees: BigInt(input[9]),
    liqudityBiatecFromFees: BigInt(input[10]),
    assetA: BigInt(input[11]),
    assetB: BigInt(input[12]),
    poolToken: BigInt(input[13]),
    price: BigInt(input[14]),
    fee: BigInt(input[15]),
    biatecFee: BigInt(input[16]),
    verificationClass: BigInt(input[17]),
  };
};
export default parseStatus;
