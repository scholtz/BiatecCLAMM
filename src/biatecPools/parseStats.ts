export type AppPoolInfo = {
  isVerified: bigint;
  assetA: bigint;
  assetB: bigint;
  verificationClass: bigint;

  latestPrice: bigint;

  period1Duration: bigint;

  period1NowVolumeA: bigint;
  period1NowVolumeB: bigint;
  period1NowFeeA: bigint;
  period1NowFeeB: bigint;
  period1NowVWAP: bigint;
  period1NowTime: bigint;

  period1PrevVolumeA: bigint;
  period1PrevVolumeB: bigint;
  period1PrevFeeA: bigint;
  period1PrevFeeB: bigint;
  period1PrevVWAP: bigint;
  period1PrevTime: bigint;

  period2Duration: bigint;

  period2NowVolumeA: bigint;
  period2NowVolumeB: bigint;
  period2NowFeeA: bigint;
  period2NowFeeB: bigint;
  period2NowVWAP: bigint;
  period2NowTime: bigint;

  period2PrevVolumeA: bigint;
  period2PrevVolumeB: bigint;
  period2PrevFeeA: bigint;
  period2PrevFeeB: bigint;
  period2PrevVWAP: bigint;
  period2PrevTime: bigint;

  period3Duration: bigint;

  period3NowVolumeA: bigint;
  period3NowVolumeB: bigint;
  period3NowFeeA: bigint;
  period3NowFeeB: bigint;
  period3NowVWAP: bigint;
  period3NowTime: bigint;

  period3PrevVolumeA: bigint;
  period3PrevVolumeB: bigint;
  period3PrevFeeA: bigint;
  period3PrevFeeB: bigint;
  period3PrevVWAP: bigint;
  period3PrevTime: bigint;

  period4Duration: bigint;

  period4NowVolumeA: bigint;
  period4NowVolumeB: bigint;
  period4NowFeeA: bigint;
  period4NowFeeB: bigint;
  period4NowVWAP: bigint;
  period4NowTime: bigint;

  period4PrevVolumeA: bigint;
  period4PrevVolumeB: bigint;
  period4PrevFeeA: bigint;
  period4PrevFeeB: bigint;
  period4PrevVWAP: bigint;
  period4PrevTime: bigint;

  period5Duration: bigint;

  period5NowVolumeA: bigint;
  period5NowVolumeB: bigint;
  period5NowFeeA: bigint;
  period5NowFeeB: bigint;
  period5NowVWAP: bigint;
  period5NowTime: bigint;

  period5PrevVolumeA: bigint;
  period5PrevVolumeB: bigint;
  period5PrevFeeA: bigint;
  period5PrevFeeB: bigint;
  period5PrevVWAP: bigint;
  period5PrevTime: bigint;

  period6Duration: bigint;

  period6NowVolumeA: bigint;
  period6NowVolumeB: bigint;
  period6NowFeeA: bigint;
  period6NowFeeB: bigint;
  period6NowVWAP: bigint;
  period6NowTime: bigint;

  period6PrevVolumeA: bigint;
  period6PrevVolumeB: bigint;
  period6PrevFeeA: bigint;
  period6PrevFeeB: bigint;
  period6PrevVWAP: bigint;
  period6PrevTime: bigint;
};

const parseStats = (input: (bigint | number)[] | null | undefined): AppPoolInfo => {
  if (!input)
    return {
      assetA: 0n,
      assetB: 0n,
      isVerified: 0n,
      latestPrice: 0n,
      verificationClass: 0n,

      period1Duration: 0n,
      period2Duration: 0n,
      period3Duration: 0n,
      period4Duration: 0n,
      period5Duration: 0n,
      period6Duration: 0n,

      period1NowFeeA: 0n,
      period1NowFeeB: 0n,
      period1NowTime: 0n,
      period1NowVolumeA: 0n,
      period1NowVolumeB: 0n,
      period1NowVWAP: 0n,
      period1PrevFeeA: 0n,
      period1PrevFeeB: 0n,
      period1PrevTime: 0n,
      period1PrevVolumeA: 0n,
      period1PrevVolumeB: 0n,
      period1PrevVWAP: 0n,

      period2NowFeeA: 0n,
      period2NowFeeB: 0n,
      period2NowTime: 0n,
      period2NowVolumeA: 0n,
      period2NowVolumeB: 0n,
      period2NowVWAP: 0n,
      period2PrevFeeA: 0n,
      period2PrevFeeB: 0n,
      period2PrevTime: 0n,
      period2PrevVolumeA: 0n,
      period2PrevVolumeB: 0n,
      period2PrevVWAP: 0n,

      period3NowFeeA: 0n,
      period3NowFeeB: 0n,
      period3NowTime: 0n,
      period3NowVolumeA: 0n,
      period3NowVolumeB: 0n,
      period3NowVWAP: 0n,
      period3PrevFeeA: 0n,
      period3PrevFeeB: 0n,
      period3PrevTime: 0n,
      period3PrevVolumeA: 0n,
      period3PrevVolumeB: 0n,
      period3PrevVWAP: 0n,

      period4NowFeeA: 0n,
      period4NowFeeB: 0n,
      period4NowTime: 0n,
      period4NowVolumeA: 0n,
      period4NowVolumeB: 0n,
      period4NowVWAP: 0n,
      period4PrevFeeA: 0n,
      period4PrevFeeB: 0n,
      period4PrevTime: 0n,
      period4PrevVolumeA: 0n,
      period4PrevVolumeB: 0n,
      period4PrevVWAP: 0n,

      period5NowFeeA: 0n,
      period5NowFeeB: 0n,
      period5NowTime: 0n,
      period5NowVolumeA: 0n,
      period5NowVolumeB: 0n,
      period5NowVWAP: 0n,
      period5PrevFeeA: 0n,
      period5PrevFeeB: 0n,
      period5PrevTime: 0n,
      period5PrevVolumeA: 0n,
      period5PrevVolumeB: 0n,
      period5PrevVWAP: 0n,
      period6NowFeeA: 0n,
      period6NowFeeB: 0n,
      period6NowTime: 0n,
      period6NowVolumeA: 0n,
      period6NowVolumeB: 0n,
      period6NowVWAP: 0n,
      period6PrevFeeA: 0n,
      period6PrevFeeB: 0n,
      period6PrevTime: 0n,
      period6PrevVolumeA: 0n,
      period6PrevVolumeB: 0n,
      period6PrevVWAP: 0n,
    };
  return {
    isVerified: BigInt(input[0]),
    assetA: BigInt(input[1]),
    assetB: BigInt(input[2]),
    verificationClass: BigInt(input[3]),
    latestPrice: BigInt(input[4]),

    period1Duration: BigInt(input[5]),
    period1NowVolumeA: BigInt(input[6]),
    period1NowVolumeB: BigInt(input[7]),
    period1NowFeeA: BigInt(input[8]),
    period1NowFeeB: BigInt(input[9]),
    period1NowVWAP: BigInt(input[10]),
    period1NowTime: BigInt(input[11]),

    period1PrevVolumeA: BigInt(input[12]),
    period1PrevVolumeB: BigInt(input[13]),
    period1PrevFeeA: BigInt(input[14]),
    period1PrevFeeB: BigInt(input[15]),
    period1PrevVWAP: BigInt(input[16]),
    period1PrevTime: BigInt(input[17]),

    period2Duration: BigInt(input[18]),
    period2NowVolumeA: BigInt(input[19]),
    period2NowVolumeB: BigInt(input[20]),
    period2NowFeeA: BigInt(input[21]),
    period2NowFeeB: BigInt(input[22]),
    period2NowVWAP: BigInt(input[23]),
    period2NowTime: BigInt(input[24]),

    period2PrevVolumeA: BigInt(input[25]),
    period2PrevVolumeB: BigInt(input[26]),
    period2PrevFeeA: BigInt(input[27]),
    period2PrevFeeB: BigInt(input[28]),
    period2PrevVWAP: BigInt(input[29]),
    period2PrevTime: BigInt(input[30]),

    period3Duration: BigInt(input[31]),
    period3NowVolumeA: BigInt(input[32]),
    period3NowVolumeB: BigInt(input[33]),
    period3NowFeeA: BigInt(input[34]),
    period3NowFeeB: BigInt(input[35]),
    period3NowVWAP: BigInt(input[36]),
    period3NowTime: BigInt(input[37]),

    period3PrevVolumeA: BigInt(input[38]),
    period3PrevVolumeB: BigInt(input[39]),
    period3PrevFeeA: BigInt(input[40]),
    period3PrevFeeB: BigInt(input[41]),
    period3PrevVWAP: BigInt(input[42]),
    period3PrevTime: BigInt(input[43]),

    period4Duration: BigInt(input[44]),
    period4NowVolumeA: BigInt(input[45]),
    period4NowVolumeB: BigInt(input[46]),
    period4NowFeeA: BigInt(input[47]),
    period4NowFeeB: BigInt(input[48]),
    period4NowVWAP: BigInt(input[49]),
    period4NowTime: BigInt(input[50]),

    period4PrevVolumeA: BigInt(input[51]),
    period4PrevVolumeB: BigInt(input[52]),
    period4PrevFeeA: BigInt(input[53]),
    period4PrevFeeB: BigInt(input[54]),
    period4PrevVWAP: BigInt(input[55]),
    period4PrevTime: BigInt(input[56]),

    period5Duration: BigInt(input[57]),
    period5NowVolumeA: BigInt(input[58]),
    period5NowVolumeB: BigInt(input[59]),
    period5NowFeeA: BigInt(input[60]),
    period5NowFeeB: BigInt(input[61]),
    period5NowVWAP: BigInt(input[62]),
    period5NowTime: BigInt(input[63]),

    period5PrevVolumeA: BigInt(input[64]),
    period5PrevVolumeB: BigInt(input[65]),
    period5PrevFeeA: BigInt(input[66]),
    period5PrevFeeB: BigInt(input[67]),
    period5PrevVWAP: BigInt(input[68]),
    period5PrevTime: BigInt(input[69]),

    period6Duration: BigInt(input[70]),
    period6NowVolumeA: BigInt(input[71]),
    period6NowVolumeB: BigInt(input[72]),
    period6NowFeeA: BigInt(input[73]),
    period6NowFeeB: BigInt(input[74]),
    period6NowVWAP: BigInt(input[75]),
    period6NowTime: BigInt(input[76]),

    period6PrevVolumeA: BigInt(input[77]),
    period6PrevVolumeB: BigInt(input[78]),
    period6PrevFeeA: BigInt(input[79]),
    period6PrevFeeB: BigInt(input[80]),
    period6PrevVWAP: BigInt(input[81]),
    period6PrevTime: BigInt(input[82]),
  };
};
export default parseStats;
