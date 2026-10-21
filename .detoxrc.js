/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
      // The app (WDK worklet thread + balance/pricing timers) keeps the Node
      // event loop alive, so jest can hang after the suite passes instead of
      // exiting — intermittently on CI, which then burns the whole job to the
      // timeout. Force-exit once the run (and teardown) is done.
      forceExit: true,
    },
    jest: {
      setupTimeout: 120_000,
    },
  },

  behavior: {
    cleanup: {
      // forceExit above only kills the jest child. The detox CLI parent then
      // closes its ws server, but the app still running in the simulator holds
      // its connection open, so the close callback never fires ("Detox server
      // has been closed abruptly") and the leaked handle keeps the CLI alive
      // until the CI job timeout. Shutting the device down drops the
      // connection so the CLI can actually exit after a passing run.
      shutdownDevice: true,
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
