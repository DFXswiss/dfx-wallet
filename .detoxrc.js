/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120_000,
    },
  },

  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/DFXWallet.app',
      build:
        'xcodebuild -workspace ios/DFXWallet.xcworkspace -scheme DFXWallet ' +
        '-configuration Debug -sdk iphonesimulator ' +
        '-derivedDataPath ios/build -quiet',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/DFXWallet.app',
      build:
        'xcodebuild -workspace ios/DFXWallet.xcworkspace -scheme DFXWallet ' +
        '-configuration Release -sdk iphonesimulator ' +
        '-derivedDataPath ios/build -quiet',
    },
  },

  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 17 Pro',
      },
    },
  },

  configurations: {
    'ios.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
};
