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

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: () => ({
    address: 'bc1q-wallet-address',
    sign: jest.fn().mockResolvedValue({ success: true, signature: 'signed-message' }),
  }),
  useBalancesForWallet: () => ({
    data: [{ assetId: 'btc', success: true, balance: '1' }],
  }),
}));

jest.mock('@/config/tokens', () => ({
  getAssets: () => [{ getNetwork: () => 'bitcoin', getId: () => 'btc', getDecimals: () => 8 }],
  getAssetMeta: () => ({ symbol: 'BTC' }),
  WDK_SUPPORTED_CHAINS: ['bitcoin'],
}));

jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({ enabledChains: ['bitcoin'] }),
}));

jest.mock('@/hooks', () => ({
  useLdsWallet: () => ({
    user: null,
    signIn: jest.fn(),
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

jest.mock('@/features/dfx-backend/useDfxAutoLinkImpl', () => ({
  markChainLinkedInAutoLinkCache: jest.fn(),
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
  AppHeader: ({ title }: { title?: string }) => {
    const ReactActual = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return ReactActual.createElement(Text, null, title);
  },
  ConfirmTargetWalletModal: () => null,
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
const mockConfirmPayment = jest.fn();
const mockDismissAuthGate = jest.fn();
const mockRetryLast = jest.fn();
const mockSellGetQuote = jest.fn();
const mockSellCreatePaymentInfo = jest.fn();
const mockSellConfirmPayment = jest.fn();
const mockSellDismissAuthGate = jest.fn();
const mockSellRetryLast = jest.fn();

const flowState = {
  isLoading: false,
  error: null as string | null,
  authGate: null,
  paymentInfo: null as Record<string, unknown> | null,
};

jest.mock('../../src/features/buy-sell/useBuyFlow', () => ({
  useBuyFlow: () => ({
    paymentInfo: flowState.paymentInfo,
    isLoading: flowState.isLoading,
    error: flowState.error,
    authGate: flowState.authGate,
    getQuote: mockGetQuote,
    createPaymentInfo: mockCreatePaymentInfo,
    confirmPayment: mockConfirmPayment,
    dismissAuthGate: mockDismissAuthGate,
    retryLast: mockRetryLast,
  }),
}));

jest.mock('../../src/features/buy-sell/useSellFlow', () => ({
  useSellFlow: () => ({
    paymentInfo: mockSellFlowState.paymentInfo,
    isLoading: mockSellFlowState.isLoading,
    error: mockSellFlowState.error,
    authGate: mockSellFlowState.authGate,
    getQuote: mockSellGetQuote,
    createPaymentInfo: mockSellCreatePaymentInfo,
    confirmSell: mockSellConfirmPayment,
    dismissAuthGate: mockSellDismissAuthGate,
    retryLast: mockSellRetryLast,
  }),
}));

// eslint-disable-next-line import/first
import BuyScreenImpl from '../../src/features/buy-sell/BuyScreenImpl';
import SellScreenImpl from '../../src/features/buy-sell/SellScreenImpl';

const PAYMENT_INFO = {
  id: 321,
  isValid: true,
  iban: 'CH9300762011623852957',
  bic: 'DSSWCHZZXXX',
  name: 'DFX AG',
  remittanceInfo: 'DFX-321',
  amount: 100,
  estimatedAmount: 0.001,
  exchangeRate: 100000,
  minVolume: 10,
  maxVolume: 10000,
  currency: { name: 'CHF' },
  asset: { name: 'BTC' },
  rate: 101000,
  fees: {
    rate: 0.01,
    dfx: 1,
    network: 0,
    fixed: 0,
    bank: 0,
    platform: 0,
    min: 0,
    total: 1,
  },
};

const SELL_PAYMENT_INFO = {
  ...PAYMENT_INFO,
  amount: 0.001,
  estimatedAmount: 100,
  exchangeRate: 100000,
  asset: { name: 'BTC' },
  currency: { name: 'CHF' },
  beneficiary: { iban: 'CH9300762011623852957' },
};

const mockSellFlowState = {
  isLoading: false,
  error: null as string | null,
  authGate: null,
  paymentInfo: SELL_PAYMENT_INFO as Record<string, unknown> | null,
};

beforeEach(() => {
  mockBack.mockReset();
  mockGetQuote.mockReset();
  mockCreatePaymentInfo.mockReset();
  mockConfirmPayment.mockReset();
  mockDismissAuthGate.mockReset();
  mockRetryLast.mockReset();
  flowState.isLoading = false;
  flowState.error = null;
  flowState.authGate = null;
  flowState.paymentInfo = PAYMENT_INFO;
  mockSellFlowState.isLoading = false;
  mockSellFlowState.error = null;
  mockSellFlowState.authGate = null;
  mockSellFlowState.paymentInfo = SELL_PAYMENT_INFO;
  mockSellGetQuote.mockReset();
  mockSellCreatePaymentInfo.mockReset();
  mockSellConfirmPayment.mockReset();
  mockSellDismissAuthGate.mockReset();
  mockSellRetryLast.mockReset();
});

describe('BuyScreenImpl', () => {
  it('keeps the payment instructions visible when transfer confirmation fails', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce(PAYMENT_INFO);
    mockConfirmPayment.mockResolvedValueOnce(false);

    const { getByPlaceholderText, getByText, queryByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(getByText('buy.title BTC'));
    });

    await waitFor(() => expect(getByText('buy.paymentInfo')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('buy.confirmTransfer'));
    });

    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalledWith(321));
    expect(queryByText('buy.confirmDescription')).toBeNull();
    expect(getByText('buy.paymentInfo')).toBeTruthy();
  });

  it('surfaces a rejected quote while the quote card is collapsed', () => {
    flowState.paymentInfo = { ...PAYMENT_INFO, isValid: false, error: 'KycRequired' };

    const { getByPlaceholderText, getByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');

    expect(getByText(/buy\.quoteError\.KycRequired/)).toBeTruthy();
  });

  it('renders the static payment method as information, not an action', () => {
    const { getByPlaceholderText, getByText, getByTestId } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');

    expect(getByTestId('buy-payment-method-row').props.accessibilityRole).toBeUndefined();
  });
});

describe('SellScreenImpl', () => {
  it('shows the sell amount panel and collapsed quote summary for a held asset', () => {
    const { getByPlaceholderText, getByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.001');

    expect(getByText(/sell\.rateInclFees/)).toBeTruthy();
  });

  it('surfaces a rejected sell quote while the quote card is collapsed', () => {
    mockSellFlowState.paymentInfo = { ...SELL_PAYMENT_INFO, isValid: false, error: 'KycRequired' };

    const { getByPlaceholderText, getByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.001');

    expect(getByText(/sell\.quoteError\.KycRequired/)).toBeTruthy();
  });
});
