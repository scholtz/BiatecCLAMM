/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 60000,
  setupFiles: ['./jest.setup.ts'],
  // Worker threads pass results to the parent via structured clone, which supports BigInt.
  // The default child-process workers use JSON, so any failing assertion involving bigint values
  // was replaced by "TypeError: Do not know how to serialize a BigInt", hiding the real failure.
  workerThreads: true,
};
