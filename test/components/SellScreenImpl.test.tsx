import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0]! : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useFocusEffect: (callback: () => void | (() => void)) => callback(),
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@tetherto/wdk-react-native-core', () => {
  const actual = jest.requireActual('@tetherto/wdk-react-native-core');
  return {
    ...actual,
    useAccount: () => ({
      address: 'bc1q-wallet-address',
      sign: jest.fn().mockResolvedValue({ success: true, signature: 'signed-message' }),
    }),
    useBalancesForWallet: () => ({
      data: [{ assetId: 'bitcoin-native', success: true, balance: '100000000' }],
    }),
  };
});

jest.mock('@/hooks', () => ({
  useLdsWallet: () => ({
    user: null,
    signIn: jest.fn(),
  }),
}));

jest.mock('@/hooks/useDfxAutoLink', () => ({
  markChainLinkedInAutoLinkCache: jest.fn(),
}));

jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({
    enabledChains: ['bitcoin'],
  }),
}));

jest.mock('@/features/linked-wallets/useLinkedWalletReauth', () => ({
  useLinkedWalletReauth: () => ({
    reauthAs: jest.fn(),
  }),
}));

jest.mock('@/features/dfx-backend/DfxAuthGate', () => ({
  DfxAuthGate: () => null,
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxAuthService: {
    linkAddress: jest.fn(),
    linkLnurlAddress: jest.fn(),
    loginAsAddressOwner: jest.fn(),
    loginAsLnurlAddressOwner: jest.fn(),
  },
  DfxApiError: class DfxApiError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

jest.mock('@/services/storage', () => ({
  secureStorage: {
    set: jest.fn(),
    remove: jest.fn(),
  },
  StorageKeys: {
    DFX_AUTH_TOKEN: 'dfx-auth-token',
    DFX_LINKED_CHAINS: 'dfx-linked-chains',
  },
}));

jest.mock('@/store', () => ({
  useAuthStore: (selector: (state: { isDfxAuthenticated: boolean }) => unknown) =>
    selector({ isDfxAuthenticated: false }),
}));

jest.mock('@/components', () => ({
  AppHeader: ({
    title,
    onBack,
  }: {
    title?: string;
    onBack?: () => void;
    testID?: string;
  }) => {
    const ReactActual = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    return ReactActual.createElement(
      Pressable,
      { onPress: onBack, testID: 'sell-back' },
      ReactActual.createElement(Text, null, title),
    );
  },
  ConfirmTargetWalletModal: () => null,
  DarkBackdrop: () => null,
  Icon: ({ name }: { name: string }) => {
    const ReactActual = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return ReactActual.createElement(Text, null, name);
  },
  PrimaryButton: ({
    title,
    onPress,
    disabled,
    loading,
  }: {
    title: string;
    onPress: () => void | Promise<void>;
    disabled?: boolean;
    loading?: boolean;
  }) => {
    const ReactActual = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    return ReactActual.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        disabled: disabled || loading,
        onPress,
      },
      ReactActual.createElement(Text, null, loading ? 'common.loading' : title),
    );
  },
}));

const mockGetQuote = jest.fn();
const mockCreatePaymentInfo = jest.fn();
const mockDismissAuthGate = jest.fn();
const mockRetryLast = jest.fn();

const flowState = {
  isLoading: false,
  error: null as string | null,
  authGate: null,
  paymentInfo: null as Record<string, unknown> | null,
};

jest.mock('@/features/buy-sell/useSellFlow', () => ({
  useSellFlow: () => ({
    paymentInfo: flowState.paymentInfo,
    isLoading: flowState.isLoading,
    error: flowState.error,
    authGate: flowState.authGate,
    getQuote: mockGetQuote,
    createPaymentInfo: mockCreatePaymentInfo,
    dismissAuthGate: mockDismissAuthGate,
    retryLast: mockRetryLast,
  }),
}));

// eslint-disable-next-line import/first
import SellScreenImpl from '@/features/buy-sell/SellScreenImpl';

const FEES = {
  rate: 0.01,
  fixed: 0,
  network: 0,
  min: 0,
  dfx: 0.00001,
  platform: 0,
  bank: 0,
  total: 0.00001,
};

const PAYMENT_INFO = {
  id: 654,
  isValid: true,
  depositAddress: 'bc1q-deposit-address',
  amount: 0.001,
  estimatedAmount: 90,
  exchangeRate: 0.00001,
  minVolume: 0.0001,
  maxVolume: 1,
  currency: { name: 'CHF' },
  asset: { name: 'BTC' },
  beneficiary: { iban: 'CH9300762011623852957' },
  fees: FEES,
  feesTarget: FEES,
};

beforeEach(() => {
  mockBack.mockReset();
  mockGetQuote.mockReset();
  mockCreatePaymentInfo.mockReset();
  mockDismissAuthGate.mockReset();
  mockRetryLast.mockReset();
  flowState.isLoading = false;
  flowState.error = null;
  flowState.authGate = null;
  flowState.paymentInfo = PAYMENT_INFO;
});

describe('SellScreenImpl', () => {
  it('shows a final invalid payment info error without advancing to confirmation', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce({ isValid: false, error: 'KycRequired' });

    const { getByPlaceholderText, getByText, queryByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(getByText('common.continue'));
    });

    expect(getByText('sell.quoteError.KycRequired:{"code":"KycRequired"}')).toBeTruthy();
    expect(queryByText('sell.confirmSale')).toBeNull();
  });

  it('clears a final payment info error when the amount changes', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce({ isValid: false, error: 'KycRequired' });

    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <SellScreenImpl />,
    );

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(getByText('common.continue'));
    });

    const errorMessage = 'sell.quoteError.KycRequired:{"code":"KycRequired"}';
    expect(getByText(errorMessage)).toBeTruthy();

    fireEvent.press(getByTestId('sell-back'));
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('0.00'), '0.002');
    });
    fireEvent.press(getByText('sell.cta:{"asset":"BTC"}'));

    await waitFor(() => expect(queryByText(errorMessage)).toBeNull());
  });

  it('advances to confirmation for valid payment info', async () => {
    mockCreatePaymentInfo.mockImplementationOnce(async () => {
      flowState.paymentInfo = PAYMENT_INFO;
      return PAYMENT_INFO;
    });

    const { getByPlaceholderText, getByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(getByText('common.continue'));
    });

    await waitFor(() => expect(getByText('sell.confirmSale')).toBeTruthy());
  });
});
