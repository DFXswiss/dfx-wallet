import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

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
  useFocusEffect: (callback: () => void | (() => void)) => callback(),
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
    testID,
  }: {
    title: string;
    onPress: () => void | Promise<void>;
    disabled?: boolean;
    loading?: boolean;
    testID?: string;
  }) => {
    const ReactActual = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    return ReactActual.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        disabled: disabled || loading,
        onPress,
        testID,
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

const flowState = {
  isLoading: false,
  error: null as string | null,
  authGate: null as { kind: string; message: string } | null,
  paymentInfo: null as Record<string, unknown> | null,
  quoteKey: null as string | null,
  errorKey: null as string | null,
  actionErrorKey: null as string | null,
};

jest.mock('../../src/features/buy-sell/useBuyFlow', () => ({
  useBuyFlow: () => ({
    paymentInfo: flowState.paymentInfo,
    quoteKey: flowState.quoteKey,
    errorKey: flowState.errorKey,
    actionErrorKey: flowState.actionErrorKey,
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

// eslint-disable-next-line import/first
import { BuyTradeAdapter } from '../../src/features/buy-sell/BuyTradeAdapter';

const mockOnShellChange = jest.fn();
const renderAdapter = () => render(<BuyTradeAdapter onShellChange={mockOnShellChange} />);

const PAYMENT_INFO = {
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

beforeEach(() => {
  mockBack.mockReset();
  mockGetQuote.mockReset();
  mockCreatePaymentInfo.mockReset();
  mockConfirmPayment.mockReset();
  mockDismissAuthGate.mockReset();
  mockRetryLast.mockReset();
  mockOnShellChange.mockReset();
  flowState.isLoading = false;
  flowState.error = null;
  flowState.authGate = null;
  flowState.paymentInfo = PAYMENT_INFO;
  flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';
  flowState.errorKey = null;
  flowState.actionErrorKey = null;
});

describe('BuyTradeAdapter', () => {
  it('shows a current payment-info error while keeping the valid quote and clears it on input change', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce(null);
    const { getByTestId, queryByText, rerender } = renderAdapter();

    fireEvent.changeText(getByTestId('buy-amount-input'), '100');
    await act(async () => {
      fireEvent.press(getByTestId('buy-cta'));
    });

    flowState.error = 'payment info failed';
    flowState.actionErrorKey = '100|CHF|BTC|Bitcoin|bitcoin';
    rerender(<BuyTradeAdapter onShellChange={mockOnShellChange} />);
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));
    expect(queryByText('payment info failed')).toBeTruthy();
    expect(getByTestId('buy-receive-amount').props.value).not.toBe('');
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('buy-amount-input'), '101');
    expect(queryByText('payment info failed')).toBeNull();
  });

  it('keeps the payment instructions visible when transfer confirmation fails', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce(PAYMENT_INFO);
    mockConfirmPayment.mockResolvedValueOnce(false);

    const { getByTestId, getByText, queryByText } = renderAdapter();

    fireEvent.changeText(getByTestId('buy-amount-input'), '100');
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

  it('keeps the fee panel directly below the amount panels before a quote exists', () => {
    flowState.paymentInfo = null;
    flowState.quoteKey = null;

    const { getByTestId } = renderAdapter();

    const feePanel = getByTestId('buy-fees-panel');
    expect(feePanel).toBeTruthy();
    expect(within(feePanel).getByText('buy.summary')).toBeTruthy();
    expect(within(feePanel).getAllByText('—')).toHaveLength(1);
  });

  it('keeps backend quote errors visible while the fee panel is collapsed', () => {
    flowState.paymentInfo = { isValid: false, error: 'AmountTooLow' };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId, getByText } = renderAdapter();
    fireEvent.changeText(getByTestId('buy-amount-input'), '1');

    expect(getByText(/buy\.quoteError\.AmountTooLow/)).toBeTruthy();
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('allows an account gate to continue without a valid quote', () => {
    flowState.paymentInfo = { isValid: false, error: 'KycRequired' };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId } = renderAdapter();
    fireEvent.changeText(getByTestId('buy-amount-input'), '1');

    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(false);
  });

  it('shows a current generic quote error and hides it after the amount changes', () => {
    flowState.paymentInfo = null;
    flowState.error = 'network failed';
    flowState.errorKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId, getByText, queryByText } = renderAdapter();
    fireEvent.changeText(getByTestId('buy-amount-input'), '1');
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));

    expect(getByText('network failed')).toBeTruthy();
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('buy-amount-input'), '2');
    expect(queryByText('network failed')).toBeNull();
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('does not reopen an old auth gate after the quote inputs change', () => {
    flowState.paymentInfo = null;
    flowState.authGate = { kind: 'login', message: 'sign in' };
    flowState.errorKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId } = renderAdapter();
    fireEvent.changeText(getByTestId('buy-amount-input'), '2');

    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('keeps the continue hint visible for an invalid quote without an error', () => {
    flowState.paymentInfo = { isValid: false };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId, getByText } = renderAdapter();
    fireEvent.changeText(getByTestId('buy-amount-input'), '1');
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));

    expect(getByText(/buy\.continueHint/).props.children).toContain(
      '"action":"buy.cta:{\\"asset\\":\\"BTC\\"}"',
    );
  });

  it('does not render a previous quote while a replacement quote is loading', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.isLoading = true;
    flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId } = renderAdapter();

    expect(getByTestId('buy-receive-amount').props.value).toBe('');
    expect(within(getByTestId('buy-fees-panel')).getByText('buy.fetchingQuote')).toBeTruthy();
    expect(within(getByTestId('buy-fees-panel')).getAllByText('—')).toHaveLength(1);
  });

  it('invalidates the previous quote immediately when the amount changes', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId } = renderAdapter();
    fireEvent.changeText(getByTestId('buy-amount-input'), '101');

    expect(getByTestId('buy-receive-amount').props.value).toBe('');
    expect(within(getByTestId('buy-fees-panel')).getByText('buy.summary')).toBeTruthy();
    expect(within(getByTestId('buy-fees-panel')).getAllByText('—')).toHaveLength(1);
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('does not show a previous quote error after the amount changes', () => {
    flowState.paymentInfo = { isValid: false, error: 'AmountTooLow' };
    flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId, queryByText } = renderAdapter();
    fireEvent.changeText(getByTestId('buy-amount-input'), '101');
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));

    expect(queryByText(/buy\.quoteError\.AmountTooLow/)).toBeNull();
    expect(queryByText(/buy\.continueHint/)).toBeNull();
  });

  it('uses the fee-inclusive rate in the buy headline and exposes the E2E input id', () => {
    const { getByTestId, getByText } = renderAdapter();

    fireEvent.changeText(getByTestId('buy-amount-input'), '100');

    expect(getByTestId('buy-amount-input')).toBeTruthy();
    const headline = getByText(/buy\.rateInclFees/).props.children;
    expect(headline).toMatch(/"amount":"71['’]179\.66"/);
    expect(headline).not.toMatch(/"amount":"70['’]073\.53"/);
  });

  it('falls back to the buy summary when the final rate is not positive', () => {
    flowState.paymentInfo = { ...PAYMENT_INFO, rate: 0 };
    const { getByTestId, getByText, queryByText } = renderAdapter();

    fireEvent.changeText(getByTestId('buy-amount-input'), '100');

    expect(getByText('buy.summary')).toBeTruthy();
    expect(queryByText(/buy\.rateInclFees/)).toBeNull();
  });

  it('renders the interpolated CTA and the CHF bank-transfer payment method', () => {
    const { getByTestId, getByText } = renderAdapter();

    expect(getByText('buy.cta:{"asset":"BTC"}')).toBeTruthy();
    const paymentMethod = getByTestId('buy-payment-method-row');
    expect(
      within(paymentMethod)
        .getAllByText(/Bank transfer|0–1 business day/)
        .map((node) => node.props.children),
    ).toEqual(['Bank transfer', '0–1 business day']);
  });

  it('renders SEPA for EUR while keeping the neutral payment-method hint', () => {
    const { getByTestId } = renderAdapter();

    fireEvent.press(getByTestId('buy-pay-currency-pill'));
    fireEvent.press(getByTestId('pay-currency-option-EUR'));

    const paymentMethod = getByTestId('buy-payment-method-row');
    expect(
      within(paymentMethod)
        .getAllByText(/SEPA bank transfer|0–1 business day/)
        .map((node) => node.props.children),
    ).toEqual(['SEPA bank transfer', '0–1 business day']);
  });

  it('reports the amount-step shell chrome on mount', () => {
    renderAdapter();

    expect(mockOnShellChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'buy.title',
        headerTestID: 'buy-screen',
        activeStep: 0,
        steps: ['amount', 'payment', 'confirm'],
      }),
    );
  });
});
