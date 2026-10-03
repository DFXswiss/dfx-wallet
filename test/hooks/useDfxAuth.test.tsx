import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockLogin = jest.fn<
  Promise<string>,
  [string, (message: string) => Promise<string>, { wallet: string }]
>();
const mockLoginAsAddressOwner = jest.fn<
  Promise<string>,
  [string, (message: string) => Promise<string>, { wallet: string }]
>();
const mockLogout = jest.fn();
const mockSign = jest.fn<Promise<{ success: true; signature: string }>, [string]>();
const mockRecoverPersonalSignAddress = jest.fn<string, [string, string]>();
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
    remove: (key: string) => mockSecureStorageRemove(key),
    set: (key: string, value: string) => mockSecureStorageSet(key, value),
  },
  StorageKeys: {
    DFX_AUTH_TOKEN: 'dfxAuthToken',
    DFX_LINKED_CHAINS: 'dfxLinkedChains',
  },
}));

import { useDfxAuth } from '@/features/dfx-backend/useDfxAuthImpl';
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
    mockSecureStorageSet.mockResolvedValue(undefined);
    mockSecureStorageRemove.mockResolvedValue(undefined);
    useAuthStore.setState({
      isAuthenticated: true,
      isOnboarded: true,
      isDfxAuthenticated: false,
    });
  });

  it('does not persist a completed DFX login after the local session is reset', async () => {
    let resolveLogin: (token: string) => void = () => undefined;
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
      useAuthStore.setState({ isAuthenticated: false });
    });
    const rejection = expect(authentication).rejects.toThrow(
      'Local wallet session ended during DFX authentication',
    );
    await act(async () => resolveLogin('stale-token'));

    await rejection;
    expect(mockSecureStorageSet).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });

  it('discards an auth token when the local session ends during persistence', async () => {
    const pendingTokenWrite = deferred<void>();
    mockLogin.mockResolvedValue('fresh-token');
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
      useAuthStore.setState({ isAuthenticated: false });
    });
    const rejection = expect(authentication).rejects.toThrow(
      'Local wallet session ended during DFX authentication',
    );
    await act(async () => {
      pendingTokenWrite.resolve();
      await rejection;
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });

  it('discards an owner token when the local session ends during persistence', async () => {
    const pendingTokenWrite = deferred<void>();
    mockLoginAsAddressOwner.mockResolvedValue('owner-token');
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
      useAuthStore.setState({ isAuthenticated: false });
    });
    const rejection = expect(authentication).rejects.toThrow(
      'Local wallet session ended during DFX authentication',
    );
    await act(async () => {
      pendingTokenWrite.resolve();
      await rejection;
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN);
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });

  it('discards an owner token when the session ends during linked-chain cleanup', async () => {
    const pendingLinkedChainsRemoval = deferred<void>();
    mockLoginAsAddressOwner.mockResolvedValue('owner-token');
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
      useAuthStore.setState({ isAuthenticated: false });
    });
    const rejection = expect(authentication).rejects.toThrow(
      'Local wallet session ended during DFX authentication',
    );
    await act(async () => {
      pendingLinkedChainsRemoval.resolve();
      await rejection;
    });

    expect(mockSecureStorageSet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN, 'owner-token');
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageRemove).toHaveBeenCalledTimes(2);
    expect(mockSecureStorageRemove).toHaveBeenNthCalledWith(1, StorageKeys.DFX_LINKED_CHAINS);
    expect(mockSecureStorageRemove).toHaveBeenNthCalledWith(2, StorageKeys.DFX_AUTH_TOKEN);
    expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
  });
});
