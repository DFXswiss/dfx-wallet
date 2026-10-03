import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockLogin = jest.fn<
  Promise<string>,
  [string, (message: string) => Promise<string>, { wallet: string }]
>();
const mockLoginAsAddressOwner = jest.fn<
  Promise<string>,
  [string, (message: string) => Promise<string>, { wallet: string }]
>();
const mockGetAccessToken = jest.fn<string | null, []>();
const mockLogout = jest.fn();
const mockSign = jest.fn<Promise<{ success: true; signature: string }>, [string]>();
const mockRecoverPersonalSignAddress = jest.fn<string, [string, string]>();
const mockSecureStorageGet = jest.fn<Promise<string | null>, [string]>();
const mockSecureStorageSet = jest.fn<Promise<void>, [string, string]>();
const mockSecureStorageRemove = jest.fn<Promise<void>, [string]>();

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: () => ({
    address: '0xaccount',
    sign: (message: string) => mockSign(message),
  }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxApi: {
    clearAuthToken: jest.fn(),
    setAuthToken: jest.fn(),
  },
  dfxAuthService: {
    adoptStoredToken: jest.fn(),
    getAccessToken: () => mockGetAccessToken(),
    login: (
      address: string,
      signMessage: (message: string) => Promise<string>,
      options: { wallet: string },
    ) => mockLogin(address, signMessage, options),
    loginAsAddressOwner: (
      address: string,
      signMessage: (message: string) => Promise<string>,
      options: { wallet: string },
    ) => mockLoginAsAddressOwner(address, signMessage, options),
    logout: () => mockLogout(),
  },
}));

jest.mock('@/services/evm/signature', () => ({
  EVM_AUTH_ADDRESS_PROBE_MESSAGE: 'probe-message',
  recoverPersonalSignAddress: (message: string, signature: string) =>
    mockRecoverPersonalSignAddress(message, signature),
}));

jest.mock('@/services/storage', () => ({
  secureStorage: {
    get: (key: string) => mockSecureStorageGet(key),
    remove: (key: string) => mockSecureStorageRemove(key),
    set: (key: string, value: string) => mockSecureStorageSet(key, value),
  },
  StorageKeys: {
    DFX_AUTH_TOKEN: 'dfxAuthToken',
    DFX_LINKED_CHAINS: 'dfxLinkedChains',
  },
}));

import { useDfxAuth } from '@/features/dfx-backend/useDfxAuthImpl';
import { LOCAL_SESSION_ENDED_MESSAGE } from '@/features/dfx-backend/session-guard';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';
import { StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('useDfxAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSign.mockResolvedValue({ success: true, signature: 'probe-signature' });
    mockRecoverPersonalSignAddress.mockReturnValue('0xsigner');
    mockGetAccessToken.mockReturnValue(null);
    mockSecureStorageGet.mockResolvedValue(null);
    mockSecureStorageSet.mockResolvedValue(undefined);
    mockSecureStorageRemove.mockResolvedValue(undefined);
    useAuthStore.setState({
      isAuthenticated: true,
      isOnboarded: true,
      isDfxAuthenticated: false,
    });
  });

  it('does not overwrite a stored token when auto-lock ends the session during login', async () => {
    let resolveLogin: (token: string) => void = () => undefined;
    mockGetAccessToken.mockReturnValue('stale-token');
    mockSecureStorageGet.mockResolvedValue('previous-token');
    mockLogin.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    const { result } = renderHook(() => useDfxAuth());

    let authentication!: Promise<string>;
    act(() => {
      authentication = result.current.authenticate();
    });
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));

    act(() => {
      useAuthStore.getState().setAuthenticated(false);
    });
    const rejection = expect(authentication).rejects.toThrow(
      'Local wallet session ended during DFX authentication',
    );
    await act(async () => resolveLogin('stale-token'));

    await rejection;
    expect(mockSecureStorageSet).not.toHaveBeenCalled();
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });

  it('rejects an invalidated login without persisting or authenticating the DFX session', async () => {
    const pendingLogin = deferred<string>();
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockLogin.mockImplementationOnce(() => pendingLogin.promise);
    const { result } = renderHook(() => useDfxAuth());

    let authentication!: Promise<string>;
    act(() => {
      authentication = result.current.authenticate();
    });
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));

    await act(async () => {
      await useAuthStore.getState().reset();
    });
    const rejection = expect(authentication).rejects.toBe(invalidated);
    await act(async () => {
      pendingLogin.reject(invalidated);
      await rejection;
    });

    expect(mockSecureStorageSet).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });

  it('rejects authenticate after a reset creates a new active local session', async () => {
    const pendingLogin = deferred<string>();
    mockGetAccessToken.mockReturnValue('newer-token');
    mockLogin.mockImplementationOnce(() => pendingLogin.promise);
    const { result } = renderHook(() => useDfxAuth());

    let authentication!: Promise<string>;
    act(() => {
      authentication = result.current.authenticate();
    });
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));

    await act(async () => {
      await useAuthStore.getState().reset();
      useAuthStore.setState({ isAuthenticated: true, isOnboarded: true });
    });
    const rejection = expect(authentication).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);
    await act(async () => {
      pendingLogin.resolve('stale-token');
      await rejection;
    });

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isOnboarded: true,
    });
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(
      StorageKeys.DFX_AUTH_TOKEN,
      'stale-token',
    );
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('discards an auth token when the local session ends during persistence', async () => {
    const pendingTokenWrite = deferred<void>();
    mockGetAccessToken.mockReturnValue('fresh-token');
    mockLogin.mockResolvedValue('fresh-token');
    mockSecureStorageGet.mockResolvedValue('fresh-token');
    mockSecureStorageSet.mockImplementation((key) => {
      if (key === StorageKeys.DFX_AUTH_TOKEN) return pendingTokenWrite.promise;
      return Promise.resolve();
    });
    const { result } = renderHook(() => useDfxAuth());

    let authentication!: Promise<string>;
    act(() => {
      authentication = result.current.authenticate();
    });
    await waitFor(() =>
      expect(mockSecureStorageSet).toHaveBeenCalledWith(
        StorageKeys.DFX_AUTH_TOKEN,
        'fresh-token',
      ),
    );

    act(() => {
      useAuthStore.getState().setAuthenticated(false);
    });
    const rejection = expect(authentication).rejects.toThrow(
      'Local wallet session ended during DFX authentication',
    );
    await act(async () => {
      pendingTokenWrite.resolve();
      await rejection;
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageGet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(mockSecureStorageRemove).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });

  it('discards an owner token when the local session ends during persistence', async () => {
    const pendingTokenWrite = deferred<void>();
    mockGetAccessToken.mockReturnValue('owner-token');
    mockLoginAsAddressOwner.mockResolvedValue('owner-token');
    mockSecureStorageGet.mockResolvedValue('owner-token');
    mockSecureStorageSet.mockImplementation((key) => {
      if (key === StorageKeys.DFX_AUTH_TOKEN) return pendingTokenWrite.promise;
      return Promise.resolve();
    });
    const { result } = renderHook(() => useDfxAuth());

    let authentication!: Promise<string>;
    act(() => {
      authentication = result.current.reauthenticateAsOwner();
    });
    await waitFor(() =>
      expect(mockSecureStorageSet).toHaveBeenCalledWith(
        StorageKeys.DFX_AUTH_TOKEN,
        'owner-token',
      ),
    );

    act(() => {
      useAuthStore.getState().setAuthenticated(false);
    });
    const rejection = expect(authentication).rejects.toThrow(
      'Local wallet session ended during DFX authentication',
    );
    await act(async () => {
      pendingTokenWrite.resolve();
      await rejection;
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageGet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(mockSecureStorageRemove).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });

  it('rejects owner reauthentication after a reset creates a new active local session', async () => {
    const pendingLogin = deferred<string>();
    mockGetAccessToken.mockReturnValue('stale-owner-token');
    mockLoginAsAddressOwner.mockImplementationOnce(() => pendingLogin.promise);
    const { result } = renderHook(() => useDfxAuth());

    let authentication!: Promise<string>;
    act(() => {
      authentication = result.current.reauthenticateAsOwner();
    });
    await waitFor(() => expect(mockLoginAsAddressOwner).toHaveBeenCalledTimes(1));

    await act(async () => {
      await useAuthStore.getState().reset();
      useAuthStore.setState({ isAuthenticated: true, isOnboarded: true });
    });
    const rejection = expect(authentication).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);
    await act(async () => {
      pendingLogin.resolve('stale-owner-token');
      await rejection;
    });

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isOnboarded: true,
    });
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(
      StorageKeys.DFX_AUTH_TOKEN,
      'stale-owner-token',
    );
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('discards an owner token when the session ends during linked-chain cleanup', async () => {
    const pendingLinkedChainsRemoval = deferred<void>();
    mockGetAccessToken.mockReturnValue('owner-token');
    mockLoginAsAddressOwner.mockResolvedValue('owner-token');
    mockSecureStorageGet.mockResolvedValue('owner-token');
    mockSecureStorageRemove.mockImplementation((key) => {
      if (key === StorageKeys.DFX_LINKED_CHAINS) return pendingLinkedChainsRemoval.promise;
      return Promise.resolve();
    });
    const { result } = renderHook(() => useDfxAuth());

    let authentication!: Promise<string>;
    act(() => {
      authentication = result.current.reauthenticateAsOwner();
    });
    await waitFor(() =>
      expect(mockSecureStorageRemove).toHaveBeenCalledWith(StorageKeys.DFX_LINKED_CHAINS),
    );

    act(() => {
      useAuthStore.getState().setAuthenticated(false);
    });
    const rejection = expect(authentication).rejects.toThrow(
      'Local wallet session ended during DFX authentication',
    );
    await act(async () => {
      pendingLinkedChainsRemoval.resolve();
      await rejection;
    });

    expect(mockSecureStorageSet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN, 'owner-token');
    expect(mockSecureStorageGet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledTimes(2);
    expect(mockSecureStorageRemove).toHaveBeenNthCalledWith(1, StorageKeys.DFX_LINKED_CHAINS);
    expect(mockSecureStorageRemove).toHaveBeenNthCalledWith(2, StorageKeys.DFX_AUTH_TOKEN);
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });
});
