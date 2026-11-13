import { act, renderHook, waitFor } from '@testing-library/react-native';

type MockLdsUser = {
  lightning: {
    addressLnurl: string;
    addressOwnershipProof: string;
  };
};

const mockLdsState: { user: MockLdsUser | null } = { user: null };
const mockLdsUser = jest.fn((): MockLdsUser | null => mockLdsState.user);
const mockSignIn = jest.fn<Promise<MockLdsUser | null>, []>();
const mockChangeActiveAddress = jest.fn<Promise<string>, [string]>();
const mockLoginAsLnurlAddressOwner = jest.fn<
  Promise<string>,
  [string, string, { wallet: string; blockchain: string }]
>();
const mockLoginAsAddressOwner = jest.fn<
  Promise<string>,
  [
    string,
    (message: string) => Promise<string>,
    { wallet: string; blockchain: string; assertActive?: () => Promise<void> },
  ]
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
    get user() {
      return mockLdsUser();
    },
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
    loginAsAddressOwner: (
      address: string,
      sign: (message: string) => Promise<string>,
      meta: { wallet: string; blockchain: string; assertActive?: () => Promise<void> },
    ) => mockLoginAsAddressOwner(address, sign, meta),
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

// eslint-disable-next-line import/first
import { useLinkedWalletReauth } from '@/features/linked-wallets/useLinkedWalletReauth';
// eslint-disable-next-line import/first
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';
// eslint-disable-next-line import/first
import { LOCAL_SESSION_ENDED_MESSAGE } from '@/features/dfx-backend/session-guard';
// eslint-disable-next-line import/first
import { StorageKeys } from '@/services/storage';
// eslint-disable-next-line import/first
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
    mockLdsUser.mockReset();
    mockLdsUser.mockImplementation(() => mockLdsState.user);
    mockSignIn.mockResolvedValue(null);
    mockChangeActiveAddress.mockRejectedValue(new Error('409'));
    mockLoginAsAddressOwner.mockReset();
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
    mockGetAccessToken.mockReturnValue(token);
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

  it('cancels Lightning reauthentication when the session ends during sign in', async () => {
    mockLdsState.user = null;
    const pendingSignIn = deferred<MockLdsUser | null>();
    mockSignIn.mockReturnValueOnce(pendingSignIn.promise);
    const { result } = renderHook(() => useLinkedWalletReauth());
    let reauthentication!: ReturnType<typeof result.current.reauthAs>;
    act(() => {
      reauthentication = result.current.reauthAs('LNURL1ABC', 'Lightning');
    });
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    act(() => useAuthStore.getState().lockSession());
    await act(async () =>
      pendingSignIn.resolve({
        lightning: { addressLnurl: 'LNURL1ABC', addressOwnershipProof: ownershipProof },
      }),
    );
    await expect(reauthentication).resolves.toEqual({ ok: false, cancelled: true });
    expect(mockLoginAsLnurlAddressOwner).not.toHaveBeenCalled();
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
    mockSecureStorageGet.mockClear();
    mockGetAccessToken.mockReturnValue('stale-change-token');
    mockSecureStorageRemove.mockClear();
    await act(async () => pendingChange.resolve('stale-change-token'));

    await expect(reauthentication).resolves.toEqual({ ok: false, cancelled: true });
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(
      StorageKeys.DFX_AUTH_TOKEN,
      'stale-change-token',
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });

  it('does not fall through to path 2 when path 1 is invalidated', async () => {
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockChangeActiveAddress.mockRejectedValueOnce(invalidated);
    const { result } = renderHook(() => useLinkedWalletReauth());

    await expect(result.current.reauthAs('LNURL1ABC', 'Lightning')).resolves.toEqual({
      ok: false,
      cancelled: true,
    });

    expect(mockLoginAsLnurlAddressOwner).not.toHaveBeenCalled();
    expect(mockSecureStorageSet).not.toHaveBeenCalled();
  });

  it('returns an unannotated invalidation from path 2', async () => {
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockLoginAsLnurlAddressOwner.mockRejectedValueOnce(invalidated);
    const { result } = renderHook(() => useLinkedWalletReauth());

    await expect(result.current.reauthAs('LNURL1ABC', 'Lightning')).resolves.toEqual({
      ok: false,
      cancelled: true,
    });

    expect(mockSecureStorageSet).not.toHaveBeenCalled();
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
    mockSecureStorageGet.mockClear();
    mockGetAccessToken.mockReturnValue('stale-lightning-token');
    mockSecureStorageRemove.mockClear();
    await act(async () => pendingLogin.resolve('stale-lightning-token'));

    await expect(reauthentication).resolves.toEqual({ ok: false, cancelled: true });
    expect(mockSecureStorageSet).not.toHaveBeenCalledWith(
      StorageKeys.DFX_AUTH_TOKEN,
      'stale-lightning-token',
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockSecureStorageGet).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });

  it.each([
    ['Bitcoin', 'bitcoin', 'bc1q-wallet'],
    ['Ethereum', 'ethereum', '0xabc'],
  ])(
    'cancels %s reauthentication when the session ends while signing',
    async (blockchain, network, address) => {
      const { useAccount } = jest.requireMock('@tetherto/wdk-react-native-core') as {
        useAccount: jest.Mock;
      };
      const previous = useAccount.getMockImplementation();
      const pendingSign = deferred<{ success: boolean; signature: string }>();
      const sign = jest.fn(() => pendingSign.promise);
      useAccount.mockImplementation(({ network: accountNetwork }: { network: string }) => ({
        address: accountNetwork === network ? address : null,
        sign,
      }));
      const signRejected = jest.fn();
      mockLoginAsAddressOwner.mockImplementation(async (_address, signMessage) => {
        try {
          return await signMessage('challenge');
        } catch (error) {
          signRejected(error);
          throw error;
        }
      });
      try {
        const { result } = renderHook(() => useLinkedWalletReauth());
        let reauthentication!: ReturnType<typeof result.current.reauthAs>;
        act(() => {
          reauthentication = result.current.reauthAs(address, blockchain);
        });
        await waitFor(() => expect(sign).toHaveBeenCalledTimes(1));
        act(() => useAuthStore.getState().lockSession());
        await act(async () => pendingSign.resolve({ success: true, signature: 'sig' }));
        await expect(reauthentication).resolves.toEqual({ ok: false, cancelled: true });
        expect(signRejected).toHaveBeenCalledTimes(1);
        expect(mockSecureStorageSet).not.toHaveBeenCalled();
      } finally {
        useAccount.mockImplementation(previous ?? (() => ({ address: null, sign: jest.fn() })));
      }
    },
  );

  it.each([
    ['Bitcoin', 'bitcoin', 'bc1q-wallet'],
    ['Ethereum', 'ethereum', '0xabc'],
  ])(
    'passes a session check to %s owner login that rejects after the session ends',
    async (blockchain, network, address) => {
      const { useAccount } = jest.requireMock('@tetherto/wdk-react-native-core') as {
        useAccount: jest.Mock;
      };
      const previousAccount = useAccount.getMockImplementation();
      const previousOwner = mockLoginAsAddressOwner.getMockImplementation();
      const previousSession = useAuthStore.getState();
      const checked = jest.fn();
      useAccount.mockImplementation(({ network: accountNetwork }: { network: string }) => ({
        address: accountNetwork === network ? address : null,
        sign: jest.fn(),
      }));
      mockLoginAsAddressOwner.mockImplementation(async (_address, _sign, options) => {
        expect(options.assertActive).toBeDefined();
        await expect(options.assertActive!()).resolves.toBeUndefined();
        useAuthStore.getState().lockSession();
        await expect(options.assertActive!()).rejects.toThrow(LOCAL_SESSION_ENDED_MESSAGE);
        checked();
        throw new Error(LOCAL_SESSION_ENDED_MESSAGE);
      });
      const { result, unmount } = renderHook(() => useLinkedWalletReauth());
      try {
        let reauthentication!: ReturnType<typeof result.current.reauthAs>;
        await act(async () => {
          reauthentication = result.current.reauthAs(address, blockchain);
          await expect(reauthentication).resolves.toEqual({ ok: false, cancelled: true });
        });
        expect(checked).toHaveBeenCalledTimes(1);
        expect(mockLoginAsAddressOwner).toHaveBeenCalledTimes(1);
        expect(mockSecureStorageSet).not.toHaveBeenCalled();
      } finally {
        unmount();
        useAuthStore.setState({
          isAuthenticated: previousSession.isAuthenticated,
          sessionEpoch: previousSession.sessionEpoch,
        });
        mockLoginAsAddressOwner.mockReset();
        if (previousOwner) mockLoginAsAddressOwner.mockImplementation(previousOwner);
        useAccount.mockImplementation(
          previousAccount ?? (() => ({ address: null, sign: jest.fn() })),
        );
      }
    },
  );

  it('does not sign when the session ends between the challenge and the signature', async () => {
    const { useAccount } = jest.requireMock('@tetherto/wdk-react-native-core') as {
      useAccount: jest.Mock;
    };
    const sign = jest.fn(async () => ({ success: true, signature: 'sig' }));
    const previous = useAccount.getMockImplementation();
    useAccount.mockImplementation(({ network }: { network: string }) => ({
      address: network === 'bitcoin' ? 'bc1q-wallet' : null,
      sign,
    }));
    mockLoginAsAddressOwner.mockImplementation(async (_address, signMessage) => {
      useAuthStore.getState().lockSession();
      return signMessage('challenge-message');
    });
    try {
      const { result } = renderHook(() => useLinkedWalletReauth());

      await expect(result.current.reauthAs('bc1q-wallet', 'Bitcoin')).resolves.toEqual({
        ok: false,
        cancelled: true,
      });
      expect(sign).not.toHaveBeenCalled();
      expect(mockLoginAsAddressOwner).toHaveBeenCalledTimes(1);
    } finally {
      useAccount.mockImplementation(previous ?? (() => ({ address: null, sign: jest.fn() })));
    }
  });

  it('cancels before path 2 when the session ends after the address change fails', async () => {
    const { useAccount } = jest.requireMock('@tetherto/wdk-react-native-core') as {
      useAccount: jest.Mock;
    };
    const sign = jest.fn(async () => ({ success: true, signature: 'sig' }));
    const previous = useAccount.getMockImplementation();
    useAccount.mockImplementation(({ network }: { network: string }) => ({
      address: network === 'bitcoin' ? 'bc1q-wallet' : null,
      sign,
    }));
    mockChangeActiveAddress.mockImplementation(async () => {
      useAuthStore.getState().lockSession();
      throw new Error('409');
    });
    try {
      const { result } = renderHook(() => useLinkedWalletReauth());

      await expect(result.current.reauthAs('bc1q-wallet', 'Bitcoin')).resolves.toEqual({
        ok: false,
        cancelled: true,
      });
      expect(mockLoginAsAddressOwner).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
    } finally {
      useAccount.mockImplementation(previous ?? (() => ({ address: null, sign: jest.fn() })));
    }
  });

  it('does not sign in to Lightning when the session ends before sign-in', async () => {
    mockLdsUser.mockImplementation(() => {
      useAuthStore.getState().lockSession();
      return null;
    });
    const { result } = renderHook(() => useLinkedWalletReauth());

    await expect(result.current.reauthAs('LNURL1ABC', 'Lightning')).resolves.toEqual({
      ok: false,
      cancelled: true,
    });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockLoginAsLnurlAddressOwner).not.toHaveBeenCalled();
  });

  it('does not sign an EVM challenge when the session ends before the signature', async () => {
    const { useAccount } = jest.requireMock('@tetherto/wdk-react-native-core') as {
      useAccount: jest.Mock;
    };
    const sign = jest.fn(async () => ({ success: true, signature: 'sig' }));
    const previous = useAccount.getMockImplementation();
    useAccount.mockImplementation(({ network }: { network: string }) => ({
      address: network === 'ethereum' ? '0xabc' : null,
      sign,
    }));
    mockLoginAsAddressOwner.mockImplementation(async (_address, signMessage) => {
      useAuthStore.getState().lockSession();
      return signMessage('challenge-message');
    });
    try {
      const { result } = renderHook(() => useLinkedWalletReauth());

      await expect(result.current.reauthAs('0xabc', 'Ethereum')).resolves.toEqual({
        ok: false,
        cancelled: true,
      });
      expect(sign).not.toHaveBeenCalled();
      expect(mockLoginAsAddressOwner).toHaveBeenCalledTimes(1);
    } finally {
      useAccount.mockImplementation(previous ?? (() => ({ address: null, sign: jest.fn() })));
    }
  });
});
