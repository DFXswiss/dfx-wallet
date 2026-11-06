import { setupPasskeyWallet } from '../../src/features/passkey/services/setup-wallet';
import { secureStorage, StorageKeys } from '../../src/services/storage';
import { DERIVATION_VERSION } from '../../src/features/passkey/services/key-derivation';

// Fully control the storage layer so assertions don't depend on the shared
// in-memory expo-secure-store mock (which leaks across test files).
jest.mock('../../src/services/storage', () => {
  const actual = jest.requireActual('../../src/services/storage');
  const store = new Map<string, string>();
  return {
    ...actual,
    secureStorage: {
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      remove: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      __reset: () => store.clear(),
    },
  };
});

const mockedStorage = secureStorage as unknown as {
  set: jest.Mock;
  get: jest.Mock;
  __reset: () => void;
};

const PRF_32 = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
const CREDENTIAL_ID = 'cred-abc-123';

// The mnemonic setup-wallet derives for PRF_32 (golden vector, see
// passkey-key-derivation.test.ts). setupPasskeyWallet must pass exactly this
// to initializeWallet.
const EXPECTED_MNEMONIC = 'join proof grab rough pen giant unique shiver settle enter extra enough';

describe('setupPasskeyWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.__reset();
  });

  it('initializes the WDK wallet with the mnemonic derived from the PRF output', async () => {
    const initializeWallet = jest.fn(async () => undefined);

    await setupPasskeyWallet(PRF_32, CREDENTIAL_ID, initializeWallet);

    expect(initializeWallet).toHaveBeenCalledTimes(1);
    expect(initializeWallet).toHaveBeenCalledWith(EXPECTED_MNEMONIC);
  });

  it('persists passkey metadata after wallet init', async () => {
    await setupPasskeyWallet(PRF_32, CREDENTIAL_ID, async () => undefined);

    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBe('passkey');
    expect(await mockedStorage.get(StorageKeys.PASSKEY_CREDENTIAL_ID)).toBe(CREDENTIAL_ID);
    expect(await mockedStorage.get(StorageKeys.PASSKEY_DERIVATION_VERSION)).toBe(
      String(DERIVATION_VERSION),
    );
  });

  // Documented invariant: "initializeWallet() runs first so that a failure does
  // not leave orphaned storage keys." Guard it so a future reorder can't slip in.
  it('calls initializeWallet BEFORE writing any storage key', async () => {
    const initializeWallet = jest.fn(async () => undefined);

    await setupPasskeyWallet(PRF_32, CREDENTIAL_ID, initializeWallet);

    // Use jest's global monotonic invocation counter rather than a custom
    // order array, so this assertion holds regardless of mock implementations
    // or test execution order (survives --randomize).
    const initAt = initializeWallet.mock.invocationCallOrder[0]!;
    const setOrder = mockedStorage.set.mock.invocationCallOrder;
    expect(setOrder.every((n) => n > initAt)).toBe(true);

    // And the three keys are written in the documented order.
    expect(mockedStorage.set.mock.calls.map((c) => c[0])).toEqual([
      StorageKeys.WALLET_ORIGIN,
      StorageKeys.PASSKEY_CREDENTIAL_ID,
      StorageKeys.PASSKEY_DERIVATION_VERSION,
    ]);
  });

  it('does not write orphaned storage keys when wallet init fails', async () => {
    const initializeWallet = jest.fn(async () => {
      throw new Error('WDK init failed');
    });

    await expect(setupPasskeyWallet(PRF_32, CREDENTIAL_ID, initializeWallet)).rejects.toThrow(
      'WDK init failed',
    );

    expect(mockedStorage.set).not.toHaveBeenCalled();
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBeNull();
  });

  it('propagates an invalid PRF length before touching the wallet or storage', async () => {
    const initializeWallet = jest.fn(async () => undefined);

    await expect(
      setupPasskeyWallet(new Uint8Array(16), CREDENTIAL_ID, initializeWallet),
    ).rejects.toThrow(/32-byte PRF output/);

    expect(initializeWallet).not.toHaveBeenCalled();
    expect(mockedStorage.set).not.toHaveBeenCalled();
  });
});
