import { describe, test, expect } from '@jest/globals';
import parseExcludedSwapAssetIds from '../../src/common/parseExcludedSwapAssetIds';

describe('parseExcludedSwapAssetIds', () => {
  test('always excludes the native asset, even with no env value', () => {
    expect(parseExcludedSwapAssetIds(undefined)).toEqual(new Set([0n]));
    expect(parseExcludedSwapAssetIds('')).toEqual(new Set([0n]));
  });

  test('parses a comma-separated list and keeps the native asset excluded too', () => {
    expect(parseExcludedSwapAssetIds('12345,67890')).toEqual(new Set([0n, 12345n, 67890n]));
  });

  test('tolerates whitespace around ids', () => {
    expect(parseExcludedSwapAssetIds(' 12345 , 67890 ')).toEqual(new Set([0n, 12345n, 67890n]));
  });

  test('deduplicates if the native asset is listed explicitly', () => {
    expect(parseExcludedSwapAssetIds('0,12345')).toEqual(new Set([0n, 12345n]));
  });

  test('ignores stray trailing commas / empty entries', () => {
    expect(parseExcludedSwapAssetIds('12345,,67890,')).toEqual(new Set([0n, 12345n, 67890n]));
  });
});
