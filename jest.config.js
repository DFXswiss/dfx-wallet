/**
 * Two project setup:
 * - unit: existing tests for services + stores. Mocks react-native to an
 *   empty module so we can run pure-logic tests without the RN runtime.
 * - components: tests for `<Component>` files. Uses the jest-expo preset
 *   so React Native primitives (Text, Pressable, View, ActivityIndicator)
 *   render through @testing-library/react-native.
 */

const sharedTransform = {
  '^.+\\.tsx?$': [
    'babel-jest',
    {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    },
  ],
};

const sharedNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@modules/(.*)$': '<rootDir>/modules/$1',
};

module.exports = {
  projects: [
    {
      displayName: 'unit',
      transform: sharedTransform,
      setupFiles: ['<rootDir>/test/setup-globals.ts'],
      testMatch: [
        '<rootDir>/test/services/**/*.test.ts',
        '<rootDir>/test/store/**/*.test.ts',
      ],
      moduleNameMapper: {
        ...sharedNameMapper,
        '^react-native-mmkv$': '<rootDir>/test/__mocks__/react-native-mmkv.ts',
        '^react-native$': '<rootDir>/test/__mocks__/empty.ts',
        '^react-native-nitro-modules$': '<rootDir>/test/__mocks__/empty.ts',
        '^react-native-ble-plx$': '<rootDir>/test/__mocks__/empty.ts',
        '^expo-secure-store$': '<rootDir>/test/__mocks__/expo-secure-store.ts',
        '^expo-crypto$': '<rootDir>/test/__mocks__/expo-crypto.ts',
        '^expo-local-authentication$': '<rootDir>/test/__mocks__/expo-local-authentication.ts',
        '^expo-haptics$': '<rootDir>/test/__mocks__/empty.ts',
        '^expo-clipboard$': '<rootDir>/test/__mocks__/empty.ts',
        '^expo-camera$': '<rootDir>/test/__mocks__/empty.ts',
        '^expo-localization$': '<rootDir>/test/__mocks__/empty.ts',
        '^react-native-qrcode-svg$': '<rootDir>/test/__mocks__/empty.ts',
        '^@tetherto/wdk-react-native-core$': '<rootDir>/test/__mocks__/wdk.ts',
        '^@tetherto/wdk-pricing-bitfinex-http$': '<rootDir>/test/__mocks__/empty.ts',
        '^@tetherto/wdk-pricing-provider$': '<rootDir>/test/__mocks__/empty.ts',
        '^bitbox-api$': '<rootDir>/test/__mocks__/empty.ts',
      },
    },
    {
      displayName: 'components',
      preset: 'jest-expo',
      transform: sharedTransform,
      testMatch: ['<rootDir>/test/components/**/*.test.tsx'],
      // Same global flag setup as the unit project: pin every
      // EXPO_PUBLIC_ENABLE_* to "true" before any feature wrapper loads,
      // so `FEATURES.X` resolves to the real implementation in the
      // components project's screen tests as well.
      setupFiles: ['<rootDir>/test/setup-globals.ts'],
      moduleNameMapper: {
        ...sharedNameMapper,
        // The WDK package ships TypeScript source on npm and Jest's transform
        // chain does not handle `export type {…}` inside node_modules without
        // help. The local mock under `test/__mocks__/wdk.ts` exposes the
        // surface our hooks touch (BaseAsset, useAccount, useRefreshBalance,
        // …) without dragging in the Bare worklet.
        '^@tetherto/wdk-react-native-core$': '<rootDir>/test/__mocks__/wdk.ts',
      },
      // jest-expo's defaults already cover react-native; add overrides for
      // wallet-specific dependencies that should not run their native bridge
      // during a pure component render test.
    },
  ],
};
