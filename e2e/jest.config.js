/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.ts'],
  testTimeout: 120_000,
  maxWorkers: 1,
  globalSetup: require.resolve('detox/runners/jest/globalSetup'),
  globalTeardown: require.resolve('detox/runners/jest/globalTeardown'),
  reporters: [require.resolve('detox/runners/jest/reporter')],
  testEnvironment: require.resolve('detox/runners/jest/testEnvironment'),
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
  verbose: false,
};
