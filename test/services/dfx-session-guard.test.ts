const mockAuthState = {
  isAuthenticated: true,
  isOnboarded: true,
  sessionEpoch: 0,
};
const mockGetAccessToken = jest.fn<string | null, []>();
const mockLogout = jest.fn();
const mockSecureStorageGet = jest.fn<Promise<string | null>, [string]>();
const mockSecureStorageRemove = jest.fn<Promise<void>, [string]>();
const mockSecureStorageSet = jest.fn<Promise<void>, [string, string]>();

jest.mock('@/features/dfx-backend/services', () => ({
  dfxAuthService: {
    getAccessToken: () => mockGetAccessToken(),
    logout: () => mockLogout(),
  },
}));

jest.mock('@/services/storage', () => ({
  secureStorage: {
    get: (key: string) => mockSecureStorageGet(key),
    remove: (key: string) => mockSecureStorageRemove(key),
    set: (key: string, value: string) => mockSecureStorageSet(key, value),
  },
  StorageKeys: {
    DFX_AUTH_TOKEN: 'dfxAuthToken',
  },
}));

jest.mock('@/store', () => ({
  useAuthStore: {
    getState: () => mockAuthState,
  },
}));

import {
  createDfxSessionGuard,
  isLocalSessionEndedError,
  LOCAL_SESSION_ENDED_MESSAGE,
} from '@/features/dfx-backend/session-guard';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';
import { StorageKeys } from '@/services/storage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('isLocalSessionEndedError', () => {
  it('matches local-session and invalidated-auth errors only', () => {
    expect(isLocalSessionEndedError(new Error(LOCAL_SESSION_ENDED_MESSAGE))).toBe(true);
    expect(isLocalSessionEndedError(new DfxAuthFlowInvalidatedError())).toBe(true);
    expect(isLocalSessionEndedError(new Error('different failure'))).toBe(false);
    expect(isLocalSessionEndedError('not an error')).toBe(false);
  });
});

describe('createDfxSessionGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.isAuthenticated = true;
    mockAuthState.isOnboarded = true;
    mockAuthState.sessionEpoch = 0;
    mockGetAccessToken.mockReturnValue(null);
    mockSecureStorageGet.mockResolvedValue(null);
    mockSecureStorageRemove.mockResolvedValue(undefined);
    mockSecureStorageSet.mockResolvedValue(undefined);
  });

  it('persists a token while the captured local session remains active', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('fresh-token');

    await expect(guard.persistToken('fresh-token')).resolves.toBeUndefined();

    expect(mockSecureStorageSet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN, 'fresh-token');
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });

  it('serializes competing writes and preserves the newer stored token', async () => {
    const firstWrite = deferred<void>();
    const firstWriteStarted = deferred<void>();
    const secondWriteFinished = deferred<void>();
    const cleanupRead = deferred<string | null>();
    const writeOrder: string[] = [];
    let activeToken = 'A';
    let storedToken: string | null = null;
    mockGetAccessToken.mockImplementation(() => activeToken);
    mockSecureStorageGet.mockImplementation(() => cleanupRead.promise);
    mockSecureStorageRemove.mockImplementation(async () => {
      storedToken = null;
    });
    mockSecureStorageSet.mockImplementation(async (_key, value) => {
      switch (value) {
        case 'A':
          firstWriteStarted.resolve(undefined);
          await firstWrite.promise;
          break;
        case 'B':
          secondWriteFinished.resolve(undefined);
          break;
      }
      writeOrder.push(value);
      storedToken = value;
    });

    const guardA = createDfxSessionGuard();
    const persistenceA = guardA.persistToken('A');
    const rejectionA = expect(persistenceA).rejects.toBeInstanceOf(
      DfxAuthFlowInvalidatedError,
    );
    await firstWriteStarted.promise;

    activeToken = 'B';
    const guardB = createDfxSessionGuard();
    const persistenceB = guardB.persistToken('B');
    await Promise.resolve();
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN, 'B');
    firstWrite.resolve(undefined);
    await secondWriteFinished.promise;
    cleanupRead.resolve(storedToken);

    await expect(persistenceB).resolves.toBeUndefined();
    await rejectionA;
    expect(writeOrder).toEqual(['A', 'B']);
    expect(storedToken).toBe('B');
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });

  it('skips a queued write when its flow loses the in-memory token', async () => {
    const blockerWrite = deferred<void>();
    const blockerWriteStarted = deferred<void>();
    let activeToken = 'blocker-token';
    mockGetAccessToken.mockImplementation(() => activeToken);
    mockSecureStorageSet.mockImplementation((_key, value) => {
      switch (value) {
        case 'blocker-token':
          blockerWriteStarted.resolve(undefined);
          return blockerWrite.promise;
        default:
          return Promise.resolve();
      }
    });

    const blockerGuard = createDfxSessionGuard();
    const blockerPersistence = blockerGuard.persistToken('blocker-token');
    const blockerRejection = expect(blockerPersistence).rejects.toThrow('write failed');
    await blockerWriteStarted.promise;

    activeToken = 'queued-token';
    const queuedGuard = createDfxSessionGuard();
    const queuedPersistence = queuedGuard.persistToken('queued-token');
    const queuedRejection = expect(queuedPersistence).rejects.toBeInstanceOf(
      DfxAuthFlowInvalidatedError,
    );
    activeToken = 'replacement-token';
    blockerWrite.reject(new Error('write failed'));

    await blockerRejection;
    await queuedRejection;
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(
      StorageKeys.DFX_AUTH_TOKEN,
      'queued-token',
    );
  });

  it('continues the write queue after a storage rejection', async () => {
    let activeToken = 'failed-token';
    mockGetAccessToken.mockImplementation(() => activeToken);
    mockSecureStorageSet.mockImplementationOnce(async () => {
      throw new Error('keychain unavailable');
    });

    const failedGuard = createDfxSessionGuard();
    await expect(failedGuard.persistToken('failed-token')).rejects.toThrow(
      'keychain unavailable',
    );

    activeToken = 'next-token';
    const nextGuard = createDfxSessionGuard();
    await expect(nextGuard.persistToken('next-token')).resolves.toBeUndefined();

    expect(mockSecureStorageSet).toHaveBeenNthCalledWith(
      2,
      StorageKeys.DFX_AUTH_TOKEN,
      'next-token',
    );
  });

  it('rejects before writing without cleaning another session token', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('newer-token');
    mockAuthState.sessionEpoch += 1;

    await expect(guard.persistToken('stale-token')).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);

    expect(mockSecureStorageSet).not.toHaveBeenCalled();
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('never logs out an existing token when a mismatch is detected before login', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('existing-token');
    mockAuthState.sessionEpoch += 1;

    await expect(guard.assertActive()).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);

    expect(mockGetAccessToken).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });

  it('logs out its own in-memory token before writing without touching storage', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('own-token');
    mockAuthState.sessionEpoch += 1;

    await expect(guard.assertActive('own-token')).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });

  it('removes its own stored token when the session ends during persistence', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('stale-token');
    mockSecureStorageGet.mockResolvedValue('stale-token');
    mockSecureStorageSet.mockImplementation(async () => {
      mockAuthState.sessionEpoch += 1;
      mockAuthState.isAuthenticated = false;
    });

    await expect(guard.persistToken('stale-token')).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageGet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(mockSecureStorageRemove).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
  });

  it('preserves a newer stored and in-memory token after its session ends', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('stale-token');
    mockSecureStorageGet.mockResolvedValue('newer-token');
    mockSecureStorageSet.mockImplementation(async () => {
      mockGetAccessToken.mockReturnValue('newer-token');
      mockAuthState.sessionEpoch += 1;
      mockAuthState.isAuthenticated = false;
    });

    await expect(guard.persistToken('stale-token')).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);

    expect(mockSecureStorageGet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('rejects a token after a true-false-true session flip despite active final flags', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('stale-token');
    mockSecureStorageGet.mockResolvedValue('stale-token');
    mockSecureStorageSet.mockImplementation(async () => {
      mockAuthState.isAuthenticated = false;
      mockAuthState.sessionEpoch += 1;
      mockAuthState.isAuthenticated = true;
    });

    await expect(guard.persistToken('stale-token')).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);

    expect(mockAuthState.isAuthenticated).toBe(true);
    expect(mockAuthState.isOnboarded).toBe(true);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
  });

  it('preserves the local-session error when reading the stored token fails', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('stale-token');
    mockSecureStorageGet.mockRejectedValue(new Error('keychain unavailable'));
    mockSecureStorageSet.mockImplementation(async () => {
      mockAuthState.sessionEpoch += 1;
    });

    await expect(guard.persistToken('stale-token')).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);

    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('preserves the local-session error when removing its stored token fails', async () => {
    const guard = createDfxSessionGuard();
    mockGetAccessToken.mockReturnValue('stale-token');
    mockSecureStorageGet.mockResolvedValue('stale-token');
    mockSecureStorageRemove.mockRejectedValue(new Error('keychain unavailable'));
    mockSecureStorageSet.mockImplementation(async () => {
      mockAuthState.sessionEpoch += 1;
    });

    await expect(guard.persistToken('stale-token')).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);

    expect(mockSecureStorageRemove).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
