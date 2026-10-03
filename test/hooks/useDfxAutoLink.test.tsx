import { renderHook, waitFor } from '@testing-library/react-native';
import { useDfxAutoLink } from '@/features/dfx-backend/useDfxAutoLinkImpl';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';

const mockJwtCoversBlockchain = jest.fn();
const mockLinkAddress = jest.fn();
const mockLinkLnurlAddress = jest.fn();
const mockGetAccessToken = jest.fn();
const mockLogout = jest.fn();
const mockRecoverPersonalSignAddress = jest.fn();
const mockSign = jest.fn();
const mockStorageGet = jest.fn();
const mockStorageRemove = jest.fn();
const mockStorageSet = jest.fn();
const mockUseAccount = jest.fn();
const mockUseLdsWallet = jest.fn();

const mockAuthState = {
  isAuthenticated: true,
  isDfxAuthenticated: true,
  isOnboarded: true,
  sessionEpoch: 1,
};

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: (options: { accountIndex: number; network: string }) => mockUseAccount(options),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxAuthService: {
    getAccessToken: () => mockGetAccessToken(),
    linkAddress: (
      address: string,
      sign: (message: string) => Promise<string>,
      metadata: { blockchain: string; wallet: string },
    ) => mockLinkAddress(address, sign, metadata),
    linkLnurlAddress: (
      address: string,
      proof: string,
      metadata: { blockchain: string; wallet: string },
    ) => mockLinkLnurlAddress(address, proof, metadata),
    logout: () => mockLogout(),
  },
  jwtCoversBlockchain: (token: string | null, blockchain: string) =>
    mockJwtCoversBlockchain(token, blockchain),
}));

jest.mock('@/services/evm/signature', () => ({
  EVM_AUTH_ADDRESS_PROBE_MESSAGE: 'probe-message',
  recoverPersonalSignAddress: (message: string, signature: string) =>
    mockRecoverPersonalSignAddress(message, signature),
}));

jest.mock('@/services/storage', () => ({
  secureStorage: {
    get: (key: string) => mockStorageGet(key),
    remove: (key: string) => mockStorageRemove(key),
    set: (key: string, value: string) => mockStorageSet(key, value),
  },
  StorageKeys: {
    DFX_AUTH_TOKEN: 'dfx-auth-token',
    DFX_LINKED_CHAINS: 'dfx-linked-chains',
  },
}));

jest.mock('@/store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
    { getState: () => mockAuthState },
  ),
}));

jest.mock('@/features/dfx-backend/useLdsWalletImpl', () => ({
  useLdsWallet: () => mockUseLdsWallet(),
}));

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useDfxAutoLink', () => {
  beforeEach(() => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isDfxAuthenticated = true;
    mockAuthState.isOnboarded = true;
    mockAuthState.sessionEpoch = 1;
    mockJwtCoversBlockchain.mockReset();
    mockJwtCoversBlockchain.mockReturnValue(false);
    mockLinkAddress.mockReset();
    mockLinkAddress.mockImplementation(() => Promise.resolve('fresh-token'));
    mockLinkLnurlAddress.mockReset();
    mockGetAccessToken.mockReset();
    mockGetAccessToken.mockReturnValue(null);
    mockLogout.mockReset();
    mockRecoverPersonalSignAddress.mockReset();
    mockRecoverPersonalSignAddress.mockReturnValue('0x-owner-address');
    mockSign.mockReset();
    mockSign.mockResolvedValue({ signature: 'signed-message', success: true });
    mockStorageGet.mockReset();
    mockStorageGet.mockImplementation((key: string) =>
      Promise.resolve(key === 'dfx-auth-token' ? 'current-token' : null),
    );
    mockStorageRemove.mockReset();
    mockStorageSet.mockReset();
    mockUseAccount.mockReset();
    mockUseAccount.mockImplementation(({ network }: { network: string }) => ({
      address: network === 'bitcoin' ? 'bc1q-wallet-address' : '0x-account-address',
      sign: mockSign,
    }));
    mockUseLdsWallet.mockReset();
    mockUseLdsWallet.mockReturnValue({ user: null });
  });

  it(
    'stops auto-linking and discards the token when the local session ends in flight',
    async () => {
      const request = createDeferred<string>();
      mockLinkAddress.mockImplementationOnce(() => request.promise);

      renderHook(() => useDfxAutoLink());
      await waitFor(() => expect(mockLinkAddress).toHaveBeenCalledTimes(1));

      mockAuthState.isAuthenticated = false;
      mockAuthState.sessionEpoch += 1;
      mockGetAccessToken.mockReturnValue('stale-auto-link-token');
      request.resolve('stale-auto-link-token');

      await waitFor(() => expect(mockLogout).toHaveBeenCalled());
      expect(mockStorageRemove).not.toHaveBeenCalled();
      expect(mockStorageSet).not.toHaveBeenCalledWith('dfx-auth-token', 'stale-auto-link-token');
      expect(mockLinkAddress).toHaveBeenCalledTimes(1);
    },
  );

  it('stops auto-linking when the auth flow is invalidated', async () => {
    mockLinkAddress.mockRejectedValueOnce(new DfxAuthFlowInvalidatedError());

    renderHook(() => useDfxAutoLink());

    await waitFor(() => expect(mockLinkAddress).toHaveBeenCalledTimes(1));
    expect(mockLinkLnurlAddress).not.toHaveBeenCalled();
    expect(mockStorageSet).not.toHaveBeenCalled();
  });
});
