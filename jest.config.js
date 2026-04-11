module.exports = {
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
  setupFiles: ['<rootDir>/test/setup-globals.ts'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^react-native-mmkv$': '<rootDir>/test/__mocks__/react-native-mmkv.ts',
    '^react-native$': '<rootDir>/test/__mocks__/empty.ts',
    '^react-native-nitro-modules$': '<rootDir>/test/__mocks__/empty.ts',
    '^react-native-ble-plx$': '<rootDir>/test/__mocks__/empty.ts',
    '^expo-secure-store$': '<rootDir>/test/__mocks__/expo-secure-store.ts',
    '^expo-crypto$': '<rootDir>/test/__mocks__/expo-crypto.ts',
    '^expo-local-authentication$': '<rootDir>/test/__mocks__/empty.ts',
    '^expo-haptics$': '<rootDir>/test/__mocks__/empty.ts',
    '^expo-clipboard$': '<rootDir>/test/__mocks__/empty.ts',
    '^expo-camera$': '<rootDir>/test/__mocks__/empty.ts',
    '^expo-localization$': '<rootDir>/test/__mocks__/empty.ts',
    '^react-native-qrcode-svg$': '<rootDir>/test/__mocks__/empty.ts',
    '^@tetherto/wdk-react-native-provider$': '<rootDir>/test/__mocks__/wdk.ts',
    '^bitbox-api$': '<rootDir>/test/__mocks__/empty.ts',
  },
};
