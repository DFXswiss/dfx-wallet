import { Platform } from 'react-native';
import { Passkey } from 'react-native-passkey';
import {
  isPasskeySupported,
  createPasskey,
  authenticatePasskey,
  PasskeyPrfUnsupportedError,
} from '../../src/features/passkey/services/passkey-service';

// react-native is mapped to an empty mock in the unit project; provide a
// mutable Platform so the OS/version gates in isPasskeySupported are testable.
// (jest.mock is hoisted above the imports by babel-jest, so the mocks apply.)
jest.mock('react-native', () => ({ Platform: { OS: 'ios', Version: '18' } }));
jest.mock('react-native-passkey', () => ({
  Passkey: { isSupported: jest.fn(), create: jest.fn(), get: jest.fn() },
}));

// Same object references the module under test reads — mutate per test.
const mockPlatform = Platform as unknown as { OS: string; Version: string | number };
const mockPasskey = Passkey as unknown as {
  isSupported: jest.Mock;
  create: jest.Mock;
  get: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPasskey.isSupported.mockReturnValue(true);
});

describe('isPasskeySupported', () => {
  it('returns false when the native library reports no platform authenticator', () => {
    mockPasskey.isSupported.mockReturnValue(false);
    mockPlatform.OS = 'ios';
    mockPlatform.Version = '18';
    expect(isPasskeySupported()).toBe(false);
  });

  describe('iOS (PRF needs iOS 18+)', () => {
    it.each([
      ['18', true],
      ['19', true],
      ['17', false],
      ['16', false],
    ])('iOS %s -> %s', (version, expected) => {
      mockPlatform.OS = 'ios';
      mockPlatform.Version = version;
      expect(isPasskeySupported()).toBe(expected);
    });
  });

  describe('Android (PRF needs API 34+)', () => {
    it.each([
      [34, true],
      [35, true],
      [33, false],
      [30, false],
    ])('API %i -> %s', (version, expected) => {
      mockPlatform.OS = 'android';
      mockPlatform.Version = version;
      expect(isPasskeySupported()).toBe(expected);
    });
  });

  it('returns false on an unknown platform', () => {
    mockPlatform.OS = 'web';
    mockPlatform.Version = '1';
    expect(isPasskeySupported()).toBe(false);
  });
});

describe('createPasskey / PRF extraction', () => {
  const RAW = new Uint8Array(Array.from({ length: 32 }, (_, i) => i));

  function bytesToBase64Url(bytes: Uint8Array): string {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  it('returns the PRF output and credentialId when prf.first is a Uint8Array', async () => {
    mockPasskey.create.mockResolvedValue({
      id: 'cred-1',
      clientExtensionResults: { prf: { results: { first: RAW } } },
    });

    const { prfOutput, credentialId } = await createPasskey();

    expect(Array.from(prfOutput)).toEqual(Array.from(RAW));
    expect(credentialId).toBe('cred-1');
  });

  it('decodes prf.first when it arrives as a base64url string', async () => {
    mockPasskey.create.mockResolvedValue({
      id: 'cred-2',
      clientExtensionResults: { prf: { results: { first: bytesToBase64Url(RAW) } } },
    });

    const { prfOutput } = await createPasskey();
    expect(Array.from(prfOutput)).toEqual(Array.from(RAW));
  });

  it('decodes prf.first when it arrives as an ArrayBuffer-like object with numeric keys', async () => {
    mockPasskey.create.mockResolvedValue({
      id: 'cred-3',
      clientExtensionResults: { prf: { results: { first: { ...RAW } } } },
    });

    const { prfOutput } = await createPasskey();
    expect(Array.from(prfOutput)).toEqual(Array.from(RAW));
  });

  it('throws PasskeyPrfUnsupportedError when prf results are missing', async () => {
    mockPasskey.create.mockResolvedValue({ id: 'cred-4', clientExtensionResults: {} });
    await expect(createPasskey()).rejects.toBeInstanceOf(PasskeyPrfUnsupportedError);
  });

  it('throws PasskeyPrfUnsupportedError when prf.first is absent', async () => {
    mockPasskey.create.mockResolvedValue({
      id: 'cred-5',
      clientExtensionResults: { prf: { results: {} } },
    });
    await expect(createPasskey()).rejects.toBeInstanceOf(PasskeyPrfUnsupportedError);
  });

  it('throws PasskeyPrfUnsupportedError when prf.first has an unexpected primitive type', async () => {
    // A malformed authenticator returning e.g. a number — truthy, but neither
    // Uint8Array, string nor object. Must not silently produce a bad seed.
    mockPasskey.create.mockResolvedValue({
      id: 'cred-5b',
      clientExtensionResults: { prf: { results: { first: 42 } } },
    });
    await expect(createPasskey()).rejects.toBeInstanceOf(PasskeyPrfUnsupportedError);
  });

  it('requests the PRF extension and a resident key from the authenticator', async () => {
    mockPasskey.create.mockResolvedValue({
      id: 'cred-6',
      clientExtensionResults: { prf: { results: { first: RAW } } },
    });

    await createPasskey();

    const arg = mockPasskey.create.mock.calls[0][0];
    expect(arg.rp).toEqual({ id: 'dfx.swiss', name: 'DFX Wallet' });
    expect(arg.authenticatorSelection.residentKey).toBe('required');
    expect(arg.authenticatorSelection.userVerification).toBe('required');
    expect(arg.extensions.prf.eval.first).toBeInstanceOf(Uint8Array);
  });
});

describe('authenticatePasskey', () => {
  const RAW = new Uint8Array(Array.from({ length: 32 }, (_, i) => 255 - i));

  it('returns the re-derived PRF output and credentialId', async () => {
    mockPasskey.get.mockResolvedValue({
      id: 'cred-x',
      clientExtensionResults: { prf: { results: { first: RAW } } },
    });

    const { prfOutput, credentialId } = await authenticatePasskey();

    expect(Array.from(prfOutput)).toEqual(Array.from(RAW));
    expect(credentialId).toBe('cred-x');
  });

  it('authenticates against the correct relying party with user verification required', async () => {
    mockPasskey.get.mockResolvedValue({
      id: 'cred-y',
      clientExtensionResults: { prf: { results: { first: RAW } } },
    });

    await authenticatePasskey();

    const arg = mockPasskey.get.mock.calls[0][0];
    expect(arg.rpId).toBe('dfx.swiss');
    expect(arg.userVerification).toBe('required');
    expect(arg.extensions.prf.eval.first).toBeInstanceOf(Uint8Array);
  });

  it('propagates PasskeyPrfUnsupportedError when the authenticator omits PRF', async () => {
    mockPasskey.get.mockResolvedValue({ id: 'cred-z', clientExtensionResults: {} });
    await expect(authenticatePasskey()).rejects.toBeInstanceOf(PasskeyPrfUnsupportedError);
  });
});
