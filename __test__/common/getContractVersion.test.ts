import { describe, test, expect, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import getContractVersion from '../../src/common/getContractVersion';

describe('getContractVersion', () => {
  const tmpFiles: string[] = [];
  const writeFixture = (content: string): string => {
    const file = path.join(os.tmpdir(), `getContractVersion-${Date.now()}-${Math.random().toString(36).slice(2)}.teal`);
    fs.writeFileSync(file, content);
    tmpFiles.push(file);
    return file;
  };

  afterEach(() => {
    while (tmpFiles.length) fs.rmSync(tmpFiles.pop()!, { force: true });
  });

  test('extracts the version literal from a compiled approval program', () => {
    const file = writeFixture('bytecblock 0x "BIATEC-CLAMM-01-06-07" 0x00\n\tbytec 1 // "BIATEC-CLAMM-01-06-07"\n');
    expect(getContractVersion(file)).toBe('BIATEC-CLAMM-01-06-07');
  });

  test('extracts the version literal for other contracts in the repo', () => {
    const file = writeFixture('bytecblock "BIATEC-PP-01-05-04"\n');
    expect(getContractVersion(file)).toBe('BIATEC-PP-01-05-04');
  });

  test('throws a clear error when the artifact has no BIATEC-* version literal', () => {
    const file = writeFixture('bytecblock 0x00 0x01\n');
    expect(() => getContractVersion(file)).toThrow(/Could not find a BIATEC-\* version string/);
  });

  test('matches the version currently embedded in the built BiatecClammPool artifact', () => {
    const approvalTealPath = path.join(__dirname, '../../contracts/artifacts/BiatecClammPool.approval.teal');
    if (!fs.existsSync(approvalTealPath)) {
      // artifact only exists after `npm run build` / `npm run compile-contract`
      return;
    }
    expect(getContractVersion(approvalTealPath)).toMatch(/^BIATEC-CLAMM-\d{2}-\d{2}-\d{2}$/);
  });
});
