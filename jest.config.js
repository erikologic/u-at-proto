/** @type {import("jest").Config} **/
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: "node",
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/e2e/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/browser/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
    '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@skyware|@atcute|nanoevents|yocto-queue)/)'
  ],
  forceExit: true
};