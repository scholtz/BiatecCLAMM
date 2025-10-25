/**
 * Recursively converts string representations of numbers to BigInt in test data objects.
 * This is necessary because JSON doesn't natively support BigInt values.
 * 
 * @param obj - The object to convert
 * @returns A new object with string values converted to BigInt where appropriate
 */
export function convertToBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertToBigInt(item)) as T;
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && /^\d+$/.test(value)) {
        // Convert string numbers to BigInt
        result[key] = BigInt(value);
      } else if (typeof value === 'object') {
        result[key] = convertToBigInt(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}
