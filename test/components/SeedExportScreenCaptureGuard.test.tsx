/**
 * Isolated load of SeedExportScreenImpl with a throwing
 * `expo-screen-capture` mock so the module-level try/catch
 * (unlinked native module) is exercised. Lives in its own file
 * because the main suite mocks the module successfully.
 */
jest.mock('expo-screen-capture', () => {
  throw new Error('Cannot find native module ExpoScreenCapture');
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return {
    ...actual,
    secureStorage: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), remove: jest.fn() },
  };
});

jest.mock('@/features/passkey/services', () => ({
  authenticatePasskey: jest.fn(),
  deriveMnemonicFromPrf: jest.fn(),
  PasskeyPrfUnsupportedError: class extends Error {},
}));

// eslint-disable-next-line import/first
import SeedExportScreenImpl from '../../src/features/settings/SeedExportScreenImpl';

describe('SeedExportScreenImpl native-module guard', () => {
  it('still exports the screen when expo-screen-capture is unlinked', () => {
    expect(typeof SeedExportScreenImpl).toBe('function');
  });
});
