import { renderHook } from '@testing-library/react-native';

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
  dfxAuthService: {
    changeActiveAddress: (address: string) => mockChangeActiveAddress(address),
    loginAsLnurlAddressOwner: (
      lnurl: string,
      proof: string,
      meta: { wallet: string; blockchain: string },
    ) => mockLoginAsLnurlAddressOwner(lnurl, proof, meta),
  },
}));

jest.mock('@/services/storage', () => ({
  secureStorage: { set: (key: string, value: string) => mockSecureStorageSet(key, value) },
  StorageKeys: { DFX_AUTH_TOKEN: 'dfxAuthToken' },
}));

import { useLinkedWalletReauth } from '@/features/linked-wallets/useLinkedWalletReauth';
import { StorageKeys } from '@/services/storage';

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
    mockSecureStorageSet.mockResolvedValue(undefined);
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
});
