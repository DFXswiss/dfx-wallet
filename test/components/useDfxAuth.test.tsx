import { act, renderHook } from '@testing-library/react-native';

import { useDfxAuth } from '@/features/dfx-backend/useDfxAuthImpl';

const mockLogin = jest.fn();
const mockRefresh = jest.fn();
const mockGetAccessToken = jest.fn(() => null as string | null);
const mockSecureSet = jest.fn();
const mockSetDfxAuthenticated = jest.fn();
const mockSign = jest.fn();
const mockAuthState = {
  isAuthenticated: true,
  isOnboarded: true,
  sessionEpoch: 1,
};

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: () => ({ address: '0xaccount', sign: mockSign }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxAuthService: {
    login: (...args: unknown[]) => mockLogin(...args),
    refresh: (...args: unknown[]) => mockRefresh(...args),
    getAccessToken: () => mockGetAccessToken(),
  },
}));

jest.mock('@/services/evm/signature', () => ({
  EVM_AUTH_ADDRESS_PROBE_MESSAGE: 'address probe',
  recoverPersonalSignAddress: () => '0xowner',
}));

jest.mock('@/services/storage', () => ({
  secureStorage: { set: (...args: unknown[]) => mockSecureSet(...args) },
  StorageKeys: { DFX_AUTH_TOKEN: 'dfxAuthToken' },
}));

jest.mock('@/store', () => ({
  useAuthStore: Object.assign(() => ({ setDfxAuthenticated: mockSetDfxAuthenticated }), {
    getState: () => mockAuthState,
  }),
}));

describe('useDfxAuth', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockRefresh.mockReset();
    mockGetAccessToken.mockReset();
    mockGetAccessToken.mockReturnValue(null);
    mockSecureSet.mockReset();
    mockSetDfxAuthenticated.mockReset();
    mockSign.mockReset();
    mockSign.mockResolvedValue({ success: true, signature: 'SIGNATURE' });
    mockAuthState.isAuthenticated = true;
    mockAuthState.isOnboarded = true;
    mockAuthState.sessionEpoch = 1;
  });

  it('forwards the API auth generation through the silent refresh path', async () => {
    mockRefresh.mockImplementation(async () => {
      mockGetAccessToken.mockReturnValue('REFRESHED_TOKEN');
      return 'REFRESHED_TOKEN';
    });
    const { result } = renderHook(() => useDfxAuth());

    let token: string | null = null;
    await act(async () => {
      token = await result.current.authenticateSilent(7);
    });

    expect(token).toBe('REFRESHED_TOKEN');
    expect(mockRefresh).toHaveBeenCalledWith('0xowner', expect.any(Function), 7);
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockSecureSet).toHaveBeenCalledWith('dfxAuthToken', 'REFRESHED_TOKEN');
    expect(mockSetDfxAuthenticated).toHaveBeenCalledWith(true);
  });
});
