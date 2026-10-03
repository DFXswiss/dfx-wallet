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
  LOCAL_SESSION_ENDED_MESSAGE,
} from '@/features/dfx-backend/session-guard';
import { StorageKeys } from '@/services/storage';

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

    await expect(guard.persistToken('fresh-token')).resolves.toBeUndefined();

    expect(mockSecureStorageSet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN, 'fresh-token');
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
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
    mockGetAccessToken.mockReturnValue('newer-token');
    mockSecureStorageGet.mockResolvedValue('newer-token');
    mockSecureStorageSet.mockImplementation(async () => {
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
