import { act, renderHook, waitFor } from '@testing-library/react-native';

type MockLdsUser = {
  lightning: {
    addressLnurl: string;
    addressOwnershipProof: string;
  };
};

const mockLdsState: { user: MockLdsUser | null } = { user: null };
const mockSignIn = jest.fn<Promise<MockLdsUser | null>, []>();
const mockChangeActiveAddress = jest.fn<Promise<string>, [string]>();
const mockLoginAsLnurlAddressOwner = jest.fn<
  Promise<string>,
  [string, string, { wallet: string; blockchain: string }]
>();
const mockAdoptStoredToken = jest.fn();
const mockClearAuthToken = jest.fn();
const mockGetAccessToken = jest.fn<string | null, []>();
const mockLogout = jest.fn();
const mockSecureStorageGet = jest.fn<Promise<string | null>, [string]>();
const mockSecureStorageRemove = jest.fn<Promise<void>, [string]>();
const mockSecureStorageSet = jest.fn<Promise<void>, [string, string]>();

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: jest.fn(() => ({ address: null, sign: jest.fn() })),
}));

jest.mock('@/hooks', () => ({
  useLdsWallet: () => ({
    user: mockLdsState.user,
    signIn: mockSignIn,
  }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxApi: {
    clearAuthToken: () => mockClearAuthToken(),
  },
  dfxAuthService: {
    adoptStoredToken: (token: string | null) => mockAdoptStoredToken(token),
    changeActiveAddress: (address: string) => mockChangeActiveAddress(address),
    getAccessToken: () => mockGetAccessToken(),
    loginAsLnurlAddressOwner: (
      lnurl: string,
      proof: string,
      meta: { wallet: string; blockchain: string },
    ) => mockLoginAsLnurlAddressOwner(lnurl, proof, meta),
    logout: () => mockLogout(),
  },
}));

jest.mock('@/services/storage', () => ({
  secureStorage: {
    get: (key: string) => mockSecureStorageGet(key),
    remove: (key: string) => mockSecureStorageRemove(key),
    set: (key: string, value: string) => mockSecureStorageSet(key, value),
  },
  StorageKeys: { DFX_AUTH_TOKEN: 'dfxAuthToken' },
}));

import { useLinkedWalletReauth } from '@/features/linked-wallets/useLinkedWalletReauth';
import { LOCAL_SESSION_ENDED_MESSAGE } from '@/features/dfx-backend/session-guard';
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

describe('useLinkedWalletReauth', () => {
  const ownershipProof = 'test-ownership-proof';
  const token = 'test-dfx-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockLdsState.user = {
      lightning: {
        addressLnurl: 'LNURL1ABC',
        addressOwnershipProof: ownershipProof,
      },
    };
    mockSignIn.mockResolvedValue(null);
    mockChangeActiveAddress.mockRejectedValue(new Error('409'));
    mockLoginAsLnurlAddressOwner.mockResolvedValue(token);
    mockGetAccessToken.mockReturnValue(null);
    mockSecureStorageGet.mockResolvedValue(null);
    mockSecureStorageRemove.mockResolvedValue(undefined);
    mockSecureStorageSet.mockResolvedValue(undefined);
    useAuthStore.setState({
      isAuthenticated: true,
      isOnboarded: true,
      isDfxAuthenticated: false,
    });
  });

  it('logs in with the LDS Lightning identity when the requested LNURL matches (case-insensitive, trimmed)', async () => {
    const { result } = renderHook(() => useLinkedWalletReauth());

    await expect(result.current.reauthAs('  lnurl1abc ', 'Lightning')).resolves.toEqual({
      ok: true,
      token,
    });
    expect(mockLoginAsLnurlAddressOwner).toHaveBeenCalledTimes(1);
    expect(mockLoginAsLnurlAddressOwner).toHaveBeenCalledWith('LNURL1ABC', ownershipProof, {
      wallet: 'DFX Bitcoin',
      blockchain: 'Lightning',
    });
    expect(mockSecureStorageSet).toHaveBeenCalledWith(StorageKeys.DFX_AUTH_TOKEN, token);
  });

  it('rejects the Lightning fallback with addressMismatch when the requested LNURL is not the local LDS identity', async () => {
    const { result } = renderHook(() => useLinkedWalletReauth());

    await expect(result.current.reauthAs('lnurl1different', 'Lightning')).resolves.toEqual({
      ok: false,
      error: expect.stringContaining('addressMismatch'),
    });
    expect(mockLoginAsLnurlAddressOwner).not.toHaveBeenCalled();
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(
      StorageKeys.DFX_AUTH_TOKEN,
      expect.anything(),
    );
  });

  it('does not persist a path-1 token after reset creates a new active session', async () => {
    const pendingChange = deferred<string>();
    mockChangeActiveAddress.mockImplementationOnce(() => pendingChange.promise);
    const { result } = renderHook(() => useLinkedWalletReauth());

    let reauthentication!: ReturnType<typeof result.current.reauthAs>;
    act(() => {
      reauthentication = result.current.reauthAs('linked-address', 'Ethereum');
    });
    await waitFor(() => expect(mockChangeActiveAddress).toHaveBeenCalledWith('linked-address'));

    await act(async () => {
      await useAuthStore.getState().reset();
      useAuthStore.setState({ isAuthenticated: true, isOnboarded: true });
    });
    mockGetAccessToken.mockReturnValue('stale-change-token');
    mockSecureStorageRemove.mockClear();
    await act(async () => pendingChange.resolve('stale-change-token'));

    await expect(reauthentication).resolves.toEqual({
      ok: false,
      error: LOCAL_SESSION_ENDED_MESSAGE,
    });
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(
      StorageKeys.DFX_AUTH_TOKEN,
      'stale-change-token',
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });

  it('does not persist a Lightning owner token after reset creates a new active session', async () => {
    const pendingLogin = deferred<string>();
    mockLoginAsLnurlAddressOwner.mockImplementationOnce(() => pendingLogin.promise);
    const { result } = renderHook(() => useLinkedWalletReauth());

    let reauthentication!: ReturnType<typeof result.current.reauthAs>;
    act(() => {
      reauthentication = result.current.reauthAs('LNURL1ABC', 'Lightning');
    });
    await waitFor(() => expect(mockLoginAsLnurlAddressOwner).toHaveBeenCalledTimes(1));

    await act(async () => {
      await useAuthStore.getState().reset();
      useAuthStore.setState({ isAuthenticated: true, isOnboarded: true });
    });
    mockGetAccessToken.mockReturnValue('stale-lightning-token');
    mockSecureStorageRemove.mockClear();
    await act(async () => pendingLogin.resolve('stale-lightning-token'));

    await expect(reauthentication).resolves.toEqual({
      ok: false,
      error: expect.stringContaining(LOCAL_SESSION_ENDED_MESSAGE),
    });
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(
      StorageKeys.DFX_AUTH_TOKEN,
      'stale-lightning-token',
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });
});
