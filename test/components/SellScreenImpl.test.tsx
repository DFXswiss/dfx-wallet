import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from '@/services/balances';

let mockBalanceMap: BalanceMap = new Map();
jest.mock('@/services/balances', () => {
  const actual = jest.requireActual('@/services/balances');
  return {
    ...actual,
    useBalances: (): BalanceSourceResult => ({
      data: mockBalanceMap,
      isLoading: false,
      error: null,
    }),
  };
});

function balanceEntry(assetId: string, rawBalance: string, source: 'wdk' | 'evm'): BalanceEntry {
  return { assetId, rawBalance, status: 'ok', source };
}

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

let mockEnabledChains = ['bitcoin'];
jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({
    enabledChains: mockEnabledChains,
  }),
}));

jest.mock('@/features/linked-wallets/useLinkedWalletReauth', () => ({
  useLinkedWalletReauth: () => ({
    reauthAs: jest.fn(),
  }),
}));

jest.mock('@/features/dfx-backend/DfxAuthGate', () => ({
  DfxAuthGate: ({
    gate,
    onLinkChain,
  }: {
    gate: { chain?: 'bitcoin' } | null;
    onLinkChain?: (chain: 'bitcoin') => Promise<void>;
  }) => {
    const chain = gate?.chain;
    if (!chain || !onLinkChain) return null;
    const ReactActual = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    return ReactActual.createElement(
      Pressable,
      { onPress: () => onLinkChain(chain), testID: 'mock-link-chain' },
      ReactActual.createElement(Text, null, 'link-chain'),
    );
  },
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

let mockIsDfxAuthenticated = false;
jest.mock('@/store', () => ({
  useAuthStore: (selector: (state: { isDfxAuthenticated: boolean }) => unknown) =>
    selector({ isDfxAuthenticated: mockIsDfxAuthenticated }),
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
        accessibilityLabel: title,
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
  authGate: null as { kind: 'linkChain'; chain: 'bitcoin'; message: string } | null,
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
  mockIsDfxAuthenticated = false;
  mockBalanceMap = new Map([
    ['bitcoin-native', balanceEntry('bitcoin-native', '100000000', 'wdk')],
  ]);
  mockEnabledChains = ['bitcoin'];
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
  it.each([
    ['1,5', 1.5],
    ['0,001', 0.001],
  ])('normalizes %s for both the quote and payment info request', async (input, expected) => {
    flowState.paymentInfo = { ...PAYMENT_INFO, maxVolume: 10 };
    mockCreatePaymentInfo.mockResolvedValueOnce(PAYMENT_INFO);
    const { getByPlaceholderText, getByText } = render(<SellScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), input);
    await waitFor(() =>
      expect(mockGetQuote).toHaveBeenCalledWith(expect.objectContaining({ amount: expected })),
    );
    fireEvent.press(getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(getByText('common.continue'));
    });

    expect(mockCreatePaymentInfo).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expected }),
    );
  });

  it('keeps a mixed-separator amount gated', () => {
    const { getByLabelText, getByPlaceholderText, getByText } = render(<SellScreenImpl />);
    const ctaLabel = 'sell.cta:{"asset":"BTC"}';

    fireEvent.press(getByText('BTC'));
    const amountInput = getByPlaceholderText('0.00');
    fireEvent.changeText(amountInput, '1,000.50');

    expect(getByLabelText(ctaLabel).props.accessibilityState?.disabled).toBe(true);
    expect(mockGetQuote).not.toHaveBeenCalled();

    fireEvent.changeText(amountInput, '0,5');
    expect(getByLabelText(ctaLabel).props.accessibilityState?.disabled).not.toBe(true);
  });

  it('handles a payment-info retry when authenticated focus resumes', async () => {
    mockIsDfxAuthenticated = true;
    mockRetryLast.mockResolvedValueOnce({ kind: 'paymentInfo', info: PAYMENT_INFO });

    const { getByText } = render(<SellScreenImpl />);

    await waitFor(() => expect(getByText('sell.confirmSale')).toBeTruthy());
    expect(mockRetryLast).toHaveBeenCalled();
  });

  it('advances after a linked-chain retry only for payment info, not for a quote', async () => {
    flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'link Bitcoin' };
    mockRetryLast
      .mockResolvedValueOnce({ kind: 'quote', info: PAYMENT_INFO })
      .mockResolvedValueOnce({ kind: 'paymentInfo', info: PAYMENT_INFO });

    const { getByTestId, getByText, queryByText } = render(<SellScreenImpl />);

    await act(async () => {
      fireEvent.press(getByTestId('mock-link-chain'));
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(queryByText('sell.confirmSale')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('mock-link-chain'));
    });

    await waitFor(() => expect(getByText('sell.confirmSale')).toBeTruthy());
    expect(mockRetryLast).toHaveBeenCalledTimes(2);
  });

  it('uses the shared EVM balance map to expose a sellable token', () => {
    const assetId = 'ethereum-0xdac17f958d2ee523a2206206994597c13d831ec7';
    mockEnabledChains = ['ethereum'];
    mockBalanceMap = new Map([[assetId, balanceEntry(assetId, '2500000', 'evm')]]);

    const { getByText, queryByTestId } = render(<SellScreenImpl />);
    fireEvent.press(getByText('USD'));

    expect(getByText('Ethereum')).toBeTruthy();
    expect(getByText('USDT')).toBeTruthy();
    expect(queryByTestId('sell-no-balance')).toBeNull();
  });

  it.each([
    {
      error: 'KycRequired',
      expectedMessage: 'sell.quoteError.KycRequired:{"code":"KycRequired"}',
    },
    { error: undefined, expectedMessage: 'sell.quoteError.noCode' },
  ])(
    'shows a final invalid payment info error for backend code $error without advancing',
    async ({ error, expectedMessage }) => {
      mockCreatePaymentInfo.mockResolvedValueOnce({ isValid: false, error });

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

      expect(getByText(expectedMessage)).toBeTruthy();
      expect(queryByText('sell.confirmSale')).toBeNull();
    },
  );

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
