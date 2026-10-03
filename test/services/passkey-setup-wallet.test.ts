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
  remove: jest.Mock;
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

  // Red mutation: write pending before reading the origin, move it after initialization, or commit
  // the origin early.
  it('reads the origin, writes pending, initializes, persists metadata and commits', async () => {
    const initializeWallet = jest.fn(async () => undefined);

    await setupPasskeyWallet(PRF_32, CREDENTIAL_ID, initializeWallet);

    const getAt = mockedStorage.get.mock.invocationCallOrder[0]!;
    const initAt = initializeWallet.mock.invocationCallOrder[0]!;
    const setOrder = mockedStorage.set.mock.invocationCallOrder;
    expect(getAt).toBeLessThan(setOrder[0]!);
    expect(setOrder[0]).toBeLessThan(initAt);
    expect(initAt).toBeLessThan(setOrder[1]!);
    expect(mockedStorage.set.mock.calls).toEqual([
      [StorageKeys.WALLET_ORIGIN, 'passkey-pending'],
      [StorageKeys.PASSKEY_CREDENTIAL_ID, CREDENTIAL_ID],
      [StorageKeys.PASSKEY_DERIVATION_VERSION, String(DERIVATION_VERSION)],
      [StorageKeys.WALLET_ORIGIN, 'passkey'],
    ]);
  });

  // Red mutation: drop the pending write; the stored origin becomes null after this failure.
  it('leaves the pending marker when the first post-init metadata write fails', async () => {
    const persist = mockedStorage.set.getMockImplementation() as (
      key: string,
      value: string,
    ) => Promise<void>;
    mockedStorage.set
      .mockImplementationOnce((key: string, value: string) => persist(key, value))
      .mockImplementationOnce(async () => {
        throw new Error('keychain unavailable');
      });

    await expect(
      setupPasskeyWallet(PRF_32, CREDENTIAL_ID, async () => undefined),
    ).rejects.toThrow('keychain unavailable');

    expect(mockedStorage.set.mock.calls.map((call) => call[0])).toEqual([
      StorageKeys.WALLET_ORIGIN,
      StorageKeys.PASSKEY_CREDENTIAL_ID,
    ]);
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBe('passkey-pending');
    expect(await mockedStorage.get(StorageKeys.PASSKEY_CREDENTIAL_ID)).toBeNull();
  });

  // Red mutation: remove the cleanup call; the pending marker remains stored.
  it('removes the pending marker when no previous origin existed', async () => {
    const initError = new Error('WDK init failed');
    const initializeWallet = jest.fn(async () => {
      throw initError;
    });

    await expect(
      setupPasskeyWallet(PRF_32, CREDENTIAL_ID, initializeWallet, async () => false),
    ).rejects.toBe(initError);

    expect(mockedStorage.set).toHaveBeenCalledWith(StorageKeys.WALLET_ORIGIN, 'passkey-pending');
    expect(mockedStorage.remove).toHaveBeenCalledWith(StorageKeys.WALLET_ORIGIN);
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBeNull();
  });

  // Red mutation: remove instead of restoring when the previous origin is non-null.
  it('restores the previous origin and propagates the original wallet init failure', async () => {
    await mockedStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey');
    mockedStorage.set.mockClear();
    const initError = new Error('WDK init failed');
    const initializeWallet = jest.fn(async () => {
      throw initError;
    });

    await expect(
      setupPasskeyWallet(PRF_32, CREDENTIAL_ID, initializeWallet, async () => false),
    ).rejects.toBe(initError);

    expect(mockedStorage.set.mock.calls).toEqual([
      [StorageKeys.WALLET_ORIGIN, 'passkey-pending'],
      [StorageKeys.WALLET_ORIGIN, 'passkey'],
    ]);
    expect(mockedStorage.remove).not.toHaveBeenCalled();
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBe('passkey');
  });

  // Red mutation: let marker-removal failure replace the initialization error.
  it('preserves the wallet init failure when pending-marker removal also fails', async () => {
    const initError = new Error('WDK init failed');
    mockedStorage.remove.mockImplementationOnce(async () => {
      throw new Error('keychain cleanup failed');
    });

    await expect(
      setupPasskeyWallet(
        PRF_32,
        CREDENTIAL_ID,
        async () => {
          throw initError;
        },
        async () => false,
      ),
    ).rejects.toBe(initError);

    expect(mockedStorage.remove).toHaveBeenCalledWith(StorageKeys.WALLET_ORIGIN);
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBe('passkey-pending');
  });

  // Red mutation: let previous-origin restoration failure replace the initialization error.
  it('preserves the init failure when restoring the previous origin fails', async () => {
    await mockedStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey');
    mockedStorage.set.mockClear();
    const persist = mockedStorage.set.getMockImplementation() as (
      key: string,
      value: string,
    ) => Promise<void>;
    const initError = new Error('WDK init failed');
    mockedStorage.set
      .mockImplementationOnce((key: string, value: string) => persist(key, value))
      .mockImplementationOnce(async () => {
        throw new Error('keychain restoration failed');
      });

    await expect(
      setupPasskeyWallet(
        PRF_32,
        CREDENTIAL_ID,
        async () => {
          throw initError;
        },
        async () => false,
      ),
    ).rejects.toBe(initError);

    expect(mockedStorage.set.mock.calls).toEqual([
      [StorageKeys.WALLET_ORIGIN, 'passkey-pending'],
      [StorageKeys.WALLET_ORIGIN, 'passkey'],
    ]);
    expect(mockedStorage.remove).not.toHaveBeenCalled();
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBe('passkey-pending');
  });

  // Red mutation: always restore the previous origin after initialization fails.
  it('keeps the pending marker when a wallet exists after initialization failure', async () => {
    await mockedStorage.set(StorageKeys.WALLET_ORIGIN, 'seed');
    mockedStorage.set.mockClear();
    const initError = new Error('WDK init failed');
    const walletExists = jest.fn(async () => true);

    await expect(
      setupPasskeyWallet(
        PRF_32,
        CREDENTIAL_ID,
        async () => {
          throw initError;
        },
        walletExists,
      ),
    ).rejects.toBe(initError);

    expect(walletExists).toHaveBeenCalledTimes(1);
    expect(mockedStorage.set.mock.calls).toEqual([
      [StorageKeys.WALLET_ORIGIN, 'passkey-pending'],
    ]);
    expect(mockedStorage.remove).not.toHaveBeenCalled();
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBe('passkey-pending');
  });

  // Red mutation: restore or remove the origin when the existence check rejects.
  it('keeps the pending marker and init error when wallet existence is unverifiable', async () => {
    const initError = new Error('WDK init failed');
    const walletExists = jest.fn(async () => {
      throw new Error('storage unavailable');
    });

    await expect(
      setupPasskeyWallet(
        PRF_32,
        CREDENTIAL_ID,
        async () => {
          throw initError;
        },
        walletExists,
      ),
    ).rejects.toBe(initError);

    expect(walletExists).toHaveBeenCalledTimes(1);
    expect(mockedStorage.set.mock.calls).toEqual([
      [StorageKeys.WALLET_ORIGIN, 'passkey-pending'],
    ]);
    expect(mockedStorage.remove).not.toHaveBeenCalled();
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBe('passkey-pending');
  });

  // Red mutation: make the optional existence-check fallback restore the origin.
  it('keeps the pending marker when no wallet existence check is supplied', async () => {
    const initError = new Error('WDK init failed');

    await expect(
      setupPasskeyWallet(PRF_32, CREDENTIAL_ID, async () => {
        throw initError;
      }),
    ).rejects.toBe(initError);

    expect(mockedStorage.remove).not.toHaveBeenCalled();
    expect(await mockedStorage.get(StorageKeys.WALLET_ORIGIN)).toBe('passkey-pending');
  });

  // Red mutation: catch the origin-read failure and continue setup.
  it('aborts before writing or initializing when the previous-origin read fails', async () => {
    const readError = new Error('keychain read failed');
    const initializeWallet = jest.fn(async () => undefined);
    mockedStorage.get.mockImplementationOnce(async () => {
      throw readError;
    });

    await expect(setupPasskeyWallet(PRF_32, CREDENTIAL_ID, initializeWallet)).rejects.toBe(
      readError,
    );

    expect(initializeWallet).not.toHaveBeenCalled();
    expect(mockedStorage.set).not.toHaveBeenCalled();
    expect(mockedStorage.remove).not.toHaveBeenCalled();
  });

  it('propagates an invalid PRF length before touching the wallet or storage', async () => {
    const initializeWallet = jest.fn(async () => undefined);

    await expect(
      setupPasskeyWallet(new Uint8Array(16), CREDENTIAL_ID, initializeWallet),
    ).rejects.toThrow(/32-byte PRF output/);

    expect(initializeWallet).not.toHaveBeenCalled();
    expect(mockedStorage.get).not.toHaveBeenCalled();
    expect(mockedStorage.set).not.toHaveBeenCalled();
    expect(mockedStorage.remove).not.toHaveBeenCalled();
  });
});
