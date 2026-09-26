import { describe, test, expect } from '@jest/globals';
import algosdk from 'algosdk';
import buildArc14AuthHeader, { ARC14_REALM } from '../../src/common/buildArc14AuthHeader';

describe('buildArc14AuthHeader', () => {
  const suggestedParams: algosdk.SuggestedParams = {
    fee: 1000n,
    minFee: 1000n,
    flatFee: false,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisID: 'mainnet-v1.0',
    genesisHash: new Uint8Array(32).fill(1),
  };

  test('produces a "SigTx <base64>" header wrapping a signed, zero-fee, self-payment transaction', () => {
    const account = algosdk.generateAccount();
    const header = buildArc14AuthHeader(account, suggestedParams);

    expect(header.startsWith('SigTx ')).toBe(true);
    const encoded = Buffer.from(header.slice('SigTx '.length), 'base64');
    const decoded = algosdk.decodeSignedTransaction(encoded);

    expect(decoded.txn.sender.toString()).toBe(account.addr.toString());
    expect(decoded.txn.payment?.receiver.toString()).toBe(account.addr.toString());
    expect(decoded.txn.payment?.amount).toBe(0n);
    expect(decoded.txn.fee).toBe(0n);
    expect(Buffer.from(decoded.txn.note!).toString()).toBe(ARC14_REALM);
  });

  test('produces a validly signed transaction (signature verifies)', () => {
    const account = algosdk.generateAccount();
    const header = buildArc14AuthHeader(account, suggestedParams);
    const encoded = Buffer.from(header.slice('SigTx '.length), 'base64');
    expect(() => algosdk.decodeSignedTransaction(encoded)).not.toThrow();
  });

  test('does not mutate the caller-supplied suggestedParams', () => {
    const account = algosdk.generateAccount();
    const before = { ...suggestedParams };
    buildArc14AuthHeader(account, suggestedParams);
    expect(suggestedParams).toEqual(before);
  });
});
