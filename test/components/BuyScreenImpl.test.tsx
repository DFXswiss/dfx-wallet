import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type {
  BuyPaymentInfoDto,
  SellPaymentInfoDto,
} from '@/features/dfx-backend/services/dto/payment';
import BuyScreenImpl from '../../src/features/buy-sell/BuyScreenImpl';
import SellScreenImpl from '../../src/features/buy-sell/SellScreenImpl';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0]! : key;
      const translations: Record<string, string> = {
        'buy.paymentMethodBank': 'Bank transfer',
        'buy.paymentMethodHint': '0–1 business day',
        'buy.paymentMethodSepa': 'SEPA bank transfer',
      };
      const rendered = translations[resolved] ?? resolved;
      return params ? `${rendered}:${JSON.stringify(params)}` : rendered;
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

const PAYMENT_INFO: BuyPaymentInfoDto = {
  id: 321,
  uid: 'buy-quote-321',
  routeId: 1,
  timestamp: '2026-10-01T10:00:00.000Z',
  isValid: true,
  iban: 'CH9300762011623852957',
  bic: 'DSSWCHZZXXX',
  name: 'DFX AG',
  street: 'Bahnhofstrasse',
  number: '1',
  zip: '8001',
  city: 'Zurich',
  country: 'CH',
  sepaInstant: false,
  remittanceInfo: 'DFX-321',
  amount: 500,
  estimatedAmount: 0.00702448,
  exchangeRate: 70073.53,
  minVolume: 10,
  maxVolume: 10000,
  currency: { id: 1, name: 'CHF' },
  asset: { id: 1, name: 'BTC', uniqueName: 'Bitcoin', blockchain: 'Bitcoin' },
  rate: 71179.66,
  exactPrice: false,
  priceSteps: [],
  fees: {
    rate: 0.01554,
    fixed: 0,
    network: 0.77,
    min: 0,
    dfx: 5,
    platform: 0,
    bank: 2,
    bankFixed: 0,
    bankVariable: 0,
    networkStart: 0,
    total: 7.77,
  },
  feesTarget: {
    rate: 0.01554,
    fixed: 0,
    network: 0.00001099,
    min: 0,
    dfx: 0.00007135,
    platform: 0,
    bank: 0.00002854,
    bankFixed: 0,
    bankVariable: 0,
    networkStart: 0,
    total: 0.00011088,
  },
  expiryDate: '2026-10-01T10:05:00.000Z',
};

const SELL_PAYMENT_INFO: SellPaymentInfoDto = {
  id: 321,
  uid: 'sell-quote-321',
  routeId: 1,
  timestamp: '2026-10-01T10:00:00.000Z',
  depositAddress: 'bc1q-dfx-deposit-address',
  amount: 0.01,
  asset: { id: 1, name: 'BTC', uniqueName: 'Bitcoin', blockchain: 'Bitcoin' },
  estimatedAmount: 689.46,
  currency: { id: 1, name: 'CHF' },
  beneficiary: { iban: 'CH9300762011623852957' },
  exchangeRate: 0.000014271,
  rate: 0.000014504,
  exactPrice: false,
  priceSteps: [],
  fees: {
    rate: 0.016065,
    fixed: 0,
    network: 0.00002915,
    min: 0,
    dfx: 0.000103,
    platform: 0,
    bank: 0.0000285,
    bankFixed: 0,
    bankVariable: 0,
    networkStart: 0,
    total: 0.00016065,
  },
  feesTarget: {
    rate: 0.016065,
    fixed: 0,
    network: 2.04,
    min: 0,
    dfx: 7.22,
    platform: 0,
    bank: 2,
    bankFixed: 0,
    bankVariable: 0,
    networkStart: 0,
    total: 11.26,
  },
  minVolume: 0.0001,
  maxVolume: 10,
  isValid: true,
  expiryDate: '2026-10-01T10:05:00.000Z',
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
      fireEvent.press(getByText('buy.cta:{"asset":"BTC"}'));
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

    expect(getByText(/buy\.quoteError\.KycRequired/).props.children).toContain(
      'buy.quoteError.KycRequired',
    );
  });

  it('uses the fee-inclusive rate in the buy quote headline', () => {
    const { getByPlaceholderText, getByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '500');

    const headline = getByText(/buy\.rateInclFees/).props.children;
    expect(headline).toMatch(/"amount":"71['’]179\.66"/);
    expect(headline).not.toMatch(/"amount":"70['’]073\.53"/);
  });

  it('falls back to the buy summary for an invalid final rate', () => {
    flowState.paymentInfo = { ...PAYMENT_INFO, rate: 0 };
    const { getByPlaceholderText, getByText, queryByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '500');

    expect(getByText('buy.summary')).toBeTruthy();
    expect(queryByText(/buy\.rateInclFees/)).toBeNull();
  });

  it('shows a bank transfer for CHF without claiming it is free', () => {
    const { getByPlaceholderText, getByText, getByTestId, queryByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');

    expect(getByTestId('buy-payment-method-row').props.accessibilityRole).toBeUndefined();
    expect(getByText('Bank transfer')).toBeTruthy();
    expect(getByText('0–1 business day')).toBeTruthy();
    expect(queryByText(/Free/)).toBeNull();
  });

  it('shows SEPA as the EUR payment method', () => {
    const { getAllByText, getByPlaceholderText, getByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.press(getAllByText('EUR')[1]!);
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');

    expect(getByText('SEPA bank transfer')).toBeTruthy();
    expect(getByText('0–1 business day')).toBeTruthy();
  });
});

describe('SellScreenImpl', () => {
  it('shows the inverse fee-inclusive rate and target-currency fee badge', () => {
    const { getByPlaceholderText, getByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.01');

    const headline = getByText(/sell\.rateInclFees/).props.children;
    expect(headline).toMatch(/"amount":"68['’]946\.50"/);
    expect(headline).not.toContain('"amount":"0.00"');
    expect(getByText('11.26')).toBeTruthy();
  });

  it('falls back to the sell summary for an invalid final rate', () => {
    mockSellFlowState.paymentInfo = { ...SELL_PAYMENT_INFO, rate: 0 };
    const { getByPlaceholderText, getByText, queryByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.01');

    expect(getByText('sell.summary')).toBeTruthy();
    expect(queryByText(/sell\.rateInclFees/)).toBeNull();
  });

  it('shows target-currency fees and the inverse market rate in the expanded quote', () => {
    const { getByPlaceholderText, getByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.01');
    fireEvent.press(getByText(/sell\.rateInclFees/));

    expect(getByText('2.00 CHF')).toBeTruthy();
    expect(getByText('11.26 CHF')).toBeTruthy();
    expect(getByText(/^1 BTC = 70['’]072\.17 CHF$/)).toBeTruthy();
  });

  it('names the IBAN continue step and omits fees without feesTarget', () => {
    mockSellFlowState.paymentInfo = { ...SELL_PAYMENT_INFO, feesTarget: undefined };
    const { getByPlaceholderText, getByText, queryByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.01');

    const hint = getByText(/sell\.continueHint/).props.children;
    expect(hint).toContain('"next":"common.continue"');
    expect(queryByText('11.26')).toBeNull();
  });

  it('shows target-currency fees and the inverse market rate on confirmation', async () => {
    mockSellCreatePaymentInfo.mockResolvedValueOnce(SELL_PAYMENT_INFO);
    const { getByPlaceholderText, getByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.01');
    fireEvent.press(getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(getByText('common.continue'));
    });

    await waitFor(() => expect(getByText('sell.confirmSale')).toBeTruthy());
    expect(getByText('2.00 CHF')).toBeTruthy();
    expect(getByText('11.26 CHF')).toBeTruthy();
    expect(getByText(/^1 BTC = 70['’]072\.17 CHF$/)).toBeTruthy();
  });

  it('surfaces a rejected sell quote while the quote card is collapsed', () => {
    mockSellFlowState.paymentInfo = { ...SELL_PAYMENT_INFO, isValid: false, error: 'KycRequired' };

    const { getByPlaceholderText, getByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '0.01');

    expect(getByText(/sell\.quoteError\.KycRequired/).props.children).toContain(
      'sell.quoteError.KycRequired',
    );
  });
});
