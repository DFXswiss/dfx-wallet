import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

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
import BuyScreenImpl from '../../src/features/buy-sell/BuyScreenImpl';

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
  flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';
  flowState.errorKey = null;
  flowState.actionErrorKey = null;
});

describe('BuyScreenImpl', () => {
  it('shows a current payment-info error while keeping the valid quote and clears it on input change', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce(null);
    const { getByTestId, queryByText, rerender } = render(<BuyScreenImpl />);

    fireEvent.changeText(getByTestId('buy-pay-amount'), '100');
    await act(async () => {
      fireEvent.press(getByTestId('buy-cta'));
    });

    flowState.error = 'payment info failed';
    flowState.actionErrorKey = '100|CHF|BTC|Bitcoin|bitcoin';
    rerender(<BuyScreenImpl />);
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));
    expect(queryByText('payment info failed')).toBeTruthy();
    expect(getByTestId('buy-receive-amount').props.value).not.toBe('');
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('buy-pay-amount'), '101');
    expect(queryByText('payment info failed')).toBeNull();
  });

  it('keeps the payment instructions visible when transfer confirmation fails', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce(PAYMENT_INFO);
    mockConfirmPayment.mockResolvedValueOnce(false);

    const { getByTestId, getByText, queryByText } = render(<BuyScreenImpl />);

    fireEvent.changeText(getByTestId('buy-pay-amount'), '100');
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

  it('keeps the fee panel directly below the amount panels before a quote exists', () => {
    flowState.paymentInfo = null;
    flowState.quoteKey = null;

    const { getByTestId } = render(<BuyScreenImpl />);

    const feePanel = getByTestId('buy-fees-panel');
    expect(feePanel).toBeTruthy();
    expect(within(feePanel).getAllByText('—')).toHaveLength(2);
  });

  it('keeps backend quote errors visible in the expanded fee panel', () => {
    flowState.paymentInfo = { isValid: false, error: 'AmountTooLow' };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId, getByText } = render(<BuyScreenImpl />);
    fireEvent.changeText(getByTestId('buy-pay-amount'), '1');
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));

    expect(getByText(/buy\.quoteError\.AmountTooLow/)).toBeTruthy();
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('allows an account gate to continue without a valid quote', () => {
    flowState.paymentInfo = { isValid: false, error: 'KycRequired' };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId } = render(<BuyScreenImpl />);
    fireEvent.changeText(getByTestId('buy-pay-amount'), '1');

    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(false);
  });

  it('shows a current generic quote error and hides it after the amount changes', () => {
    flowState.paymentInfo = null;
    flowState.error = 'network failed';
    flowState.errorKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId, getByText, queryByText } = render(<BuyScreenImpl />);
    fireEvent.changeText(getByTestId('buy-pay-amount'), '1');
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));

    expect(getByText('network failed')).toBeTruthy();
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('buy-pay-amount'), '2');
    expect(queryByText('network failed')).toBeNull();
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('does not reopen an old auth gate after the quote inputs change', () => {
    flowState.paymentInfo = null;
    flowState.authGate = { kind: 'login', message: 'sign in' };
    flowState.errorKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId } = render(<BuyScreenImpl />);
    fireEvent.changeText(getByTestId('buy-pay-amount'), '2');

    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('keeps the continue hint visible for an invalid quote without an error', () => {
    flowState.paymentInfo = { isValid: false };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId, getByText } = render(<BuyScreenImpl />);
    fireEvent.changeText(getByTestId('buy-pay-amount'), '1');
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));

    expect(getByText('buy.continueHint')).toBeTruthy();
  });

  it('does not render a previous quote while a replacement quote is loading', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.isLoading = true;
    flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId } = render(<BuyScreenImpl />);

    expect(getByTestId('buy-receive-amount').props.value).toBe('');
    expect(within(getByTestId('buy-fees-panel')).getAllByText('—')).toHaveLength(2);
  });

  it('invalidates the previous quote immediately when the amount changes', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId } = render(<BuyScreenImpl />);
    fireEvent.changeText(getByTestId('buy-pay-amount'), '101');

    expect(getByTestId('buy-receive-amount').props.value).toBe('');
    expect(within(getByTestId('buy-fees-panel')).getAllByText('—')).toHaveLength(2);
    expect(getByTestId('buy-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('does not show a previous quote error after the amount changes', () => {
    flowState.paymentInfo = { isValid: false, error: 'AmountTooLow' };
    flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';

    const { getByTestId, queryByText } = render(<BuyScreenImpl />);
    fireEvent.changeText(getByTestId('buy-pay-amount'), '101');
    fireEvent.press(within(getByTestId('buy-fees-panel')).getByRole('button'));

    expect(queryByText(/buy\.quoteError\.AmountTooLow/)).toBeNull();
    expect(queryByText('buy.continueHint')).toBeNull();
  });
});
