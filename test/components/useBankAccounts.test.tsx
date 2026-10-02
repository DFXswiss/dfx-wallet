import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGetBankAccounts = jest.fn();
jest.mock('@/features/dfx-backend/services', () => ({
  dfxPaymentService: {
    getBankAccounts: (...args: unknown[]) => mockGetBankAccounts(...args),
  },
}));

let mockFocusCallback: (() => void | (() => void)) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockFocusCallback = callback;
  },
}));

const mockAuthState = { isDfxAuthenticated: true };
jest.mock('@/store', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

// eslint-disable-next-line import/first
import { useBankAccounts } from '../../src/features/transfer/useBankAccounts';

describe('useBankAccounts', () => {
  beforeEach(() => {
    mockGetBankAccounts.mockReset();
    mockAuthState.isDfxAuthenticated = true;
    mockFocusCallback = null;
  });

  it('reloads active bank accounts whenever the screen receives focus', async () => {
    mockGetBankAccounts
      .mockResolvedValueOnce([
        { id: 1, iban: 'CH9300762011623852957', label: 'First', active: true, default: false },
        { id: 2, iban: 'DE89370400440532013000', active: false, default: false },
      ])
      .mockResolvedValueOnce([
        { id: 3, iban: 'GB82WEST12345698765432', label: 'New', active: true, default: true },
      ]);
    const { result } = renderHook(() => useBankAccounts());

    await act(async () => {
      mockFocusCallback?.();
    });
    await waitFor(() =>
      expect(result.current).toEqual([{ id: 1, iban: 'CH9300762011623852957', label: 'First' }]),
    );

    await act(async () => {
      mockFocusCallback?.();
    });
    await waitFor(() =>
      expect(result.current).toEqual([{ id: 3, iban: 'GB82WEST12345698765432', label: 'New' }]),
    );
    expect(mockGetBankAccounts).toHaveBeenCalledTimes(2);
  });
});
