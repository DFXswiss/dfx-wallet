import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from '@/services/balances';

let mockBalanceMap: BalanceMap = new Map();
let mockBalancesLoading = false;
let mockBalancesError: Error | null = null;
jest.mock('@/services/balances', () => {
  const actual = jest.requireActual('@/services/balances');
  return {
    ...actual,
    useBalances: (): BalanceSourceResult => ({
      data: mockBalanceMap,
      isLoading: mockBalancesLoading,
      error: mockBalancesError,
    }),
  };
});

function balanceEntry(assetId: string, rawBalance: string, source: 'wdk' | 'evm'): BalanceEntry {
  return { assetId, rawBalance, status: 'ok', source };
}

jest.mock('react-i18next', () => {
  const t = (key: string | string[], params?: Record<string, unknown>) => {
    const resolved = Array.isArray(key) ? key[0]! : key;
    return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
  };
  return { useTranslation: () => ({ t }) };
});

const mockBack = jest.fn();
let mockLatestFocusCallback: (() => void | (() => void)) | null = null;
let mockLatestFocusCleanup: (() => void) | undefined;

function refocusScreen(): void {
  if (typeof mockLatestFocusCleanup === 'function') mockLatestFocusCleanup();
  if (!mockLatestFocusCallback) {
    throw new Error('screen focus effect is not registered');
  }
  const cleanup = mockLatestFocusCallback();
  mockLatestFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
}

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactActual = jest.requireActual<typeof import('react')>('react');
    ReactActual.useEffect(() => {
      mockLatestFocusCallback = callback;
      const cleanup = callback();
      mockLatestFocusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
      return () => {
        if (typeof cleanup === 'function') cleanup();
        if (mockLatestFocusCallback === callback) {
          mockLatestFocusCallback = null;
          mockLatestFocusCleanup = undefined;
        }
      };
    }, [callback]);
  },
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
    onClose,
    onCancel,
    onLinkChain,
  }: {
    gate: { chain?: 'bitcoin' } | null;
    onClose?: () => void;
    onCancel?: () => void;
    onLinkChain?: (chain: 'bitcoin') => Promise<void>;
  }) => {
    const chain = gate?.chain;
    if (!gate) return null;
    const ReactActual = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    if (chain && onLinkChain) {
      return ReactActual.createElement(
        Pressable,
        { onPress: () => onLinkChain(chain), testID: 'mock-link-chain' },
        ReactActual.createElement(Text, null, 'link-chain'),
      );
    }
    return ReactActual.createElement(
      ReactActual.Fragment,
      null,
      ReactActual.createElement(
        Pressable,
        { onPress: onClose, testID: 'dfx-auth-gate-primary' },
        ReactActual.createElement(Text, null, 'gate-primary'),
      ),
      ReactActual.createElement(
        Pressable,
        { onPress: onCancel ?? onClose, testID: 'dfx-auth-gate-cancel' },
        ReactActual.createElement(Text, null, 'gate-cancel'),
      ),
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
let mockConfirmModalProps: { onCancel: () => void } | null = null;
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
  ConfirmTargetWalletModal: (props: { onCancel: () => void }) => {
    mockConfirmModalProps = props;
    return null;
  },
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
const mockCancelAuthGate = jest.fn();
const mockRetryLast = jest.fn();

const flowState = {
  isLoading: false,
  error: null as string | null,
  authGate: null as { kind: string; chain?: 'bitcoin'; message: string } | null,
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
    cancelAuthGate: mockCancelAuthGate,
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

function armInFlightPaymentThatFailsWith401(): {
  pending: Promise<null>;
  settle401: () => void;
} {
  let replayDropped = false;
  const loginGate = { kind: 'login' as const, message: 'sign in' };
  let settle401: () => void = () => {};
  const pending = new Promise<null>((resolve) => {
    settle401 = () => {
      if (!replayDropped) flowState.authGate = loginGate;
      resolve(null);
    };
  });
  mockCancelAuthGate.mockImplementation(() => {
    replayDropped = true;
    flowState.authGate = null;
  });
  mockCreatePaymentInfo.mockImplementation(() => pending);
  mockRetryLast.mockImplementation(async () => {
    if (replayDropped) return null;
    await mockCreatePaymentInfo();
    return { kind: 'paymentInfo' as const, info: PAYMENT_INFO };
  });
  return { pending, settle401 };
}

beforeEach(() => {
  mockIsDfxAuthenticated = false;
  mockBalanceMap = new Map([
    ['bitcoin-native', balanceEntry('bitcoin-native', '100000000', 'wdk')],
  ]);
  mockEnabledChains = ['bitcoin'];
  mockBalancesLoading = false;
  mockBalancesError = null;
  mockBack.mockReset();
  mockGetQuote.mockReset();
  mockCreatePaymentInfo.mockReset();
  mockDismissAuthGate.mockReset();
  mockCancelAuthGate.mockReset();
  mockConfirmModalProps = null;
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

  it('does not replay payment info when authenticated focus has no pending confirmation', async () => {
    mockIsDfxAuthenticated = true;
    mockRetryLast.mockResolvedValueOnce({ kind: 'paymentInfo', info: PAYMENT_INFO });

    const { queryByText } = render(<SellScreenImpl />);

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(queryByText('sell.confirmSale')).toBeNull();
  });

  it('does not advance for a quote retry or a payment retry without a pending confirmation', async () => {
    flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'link Bitcoin' };
    mockRetryLast
      .mockResolvedValueOnce({ kind: 'quote', info: PAYMENT_INFO })
      .mockResolvedValueOnce({ kind: 'paymentInfo', info: PAYMENT_INFO });

    const { getByTestId, queryByText } = render(<SellScreenImpl />);

    await act(async () => {
      fireEvent.press(getByTestId('mock-link-chain'));
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(queryByText('sell.confirmSale')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('mock-link-chain'));
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(2));
    expect(queryByText('sell.confirmSale')).toBeNull();
  });

  it('handles a null payment replay quietly', async () => {
    flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'link Bitcoin' };
    mockRetryLast.mockResolvedValueOnce(null);

    const { getByTestId, queryByText } = render(<SellScreenImpl />);

    await act(async () => {
      fireEvent.press(getByTestId('mock-link-chain'));
    });

    expect(mockRetryLast).toHaveBeenCalledTimes(1);
    expect(queryByText('sell.confirmSale')).toBeNull();
    expect(queryByText('sell.quoteError.noCode')).toBeNull();
  });

  it('creates payment info once after login proceeds and focus returns', async () => {
    const loginGate = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockImplementation(async () => ({ kind: 'paymentInfo', info: PAYMENT_INFO }));

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(view.getByTestId('dfx-auth-gate-primary')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    expect(mockDismissAuthGate).toHaveBeenCalledWith(loginGate);
    expect(mockCancelAuthGate).not.toHaveBeenCalledWith(loginGate);

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.getByText('sell.confirmSale')).toBeTruthy();
  });

  it('abandons the gated sell when focus returns without a session', async () => {
    const loginGate = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(view.getByTestId('dfx-auth-gate-primary')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    expect(mockDismissAuthGate).toHaveBeenCalledWith(loginGate);

    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });
    expect(view.queryByTestId('dfx-auth-gate-primary')).toBeNull();

    const callsBefore = mockCancelAuthGate.mock.calls.length;
    await act(async () => {
      refocusScreen();
    });
    expect(mockCancelAuthGate.mock.calls.length).toBe(callsBefore + 1);
    expect(mockCancelAuthGate.mock.calls[callsBefore]).toEqual([]);

    mockRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: PAYMENT_INFO });
    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(view.queryByText('sell.confirmSale')).toBeNull();
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    mockCreatePaymentInfo.mockImplementation(async () => PAYMENT_INFO);
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(2);
    expect(view.getByText('sell.confirmSale')).toBeTruthy();
  });

  it('does not create payment info after the login gate is cancelled', async () => {
    const loginGate = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockCancelAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: PAYMENT_INFO });

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-cancel'));
    });
    expect(mockCancelAuthGate).toHaveBeenCalledWith(loginGate);
    expect(mockDismissAuthGate).not.toHaveBeenCalled();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });

  it('creates one payment info when continue is pressed twice', async () => {
    mockCreatePaymentInfo.mockResolvedValue(PAYMENT_INFO);
    const view = render(<SellScreenImpl />);

    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );

    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
      fireEvent.press(view.getByText('common.continue'));
    });

    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('shows the hook error when payment info returns null without a gate', async () => {
    mockCreatePaymentInfo.mockImplementation(() => {
      flowState.error = 'network down';
      return null;
    });
    const view = render(<SellScreenImpl />);

    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });

    await waitFor(() => expect(view.getByText('network down')).toBeTruthy());
    expect(view.queryByText('sell.quoteError.noCode')).toBeNull();
    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });

  it('shows a generic error when payment info returns null without a gate', async () => {
    mockCreatePaymentInfo.mockResolvedValue(null);
    const view = render(<SellScreenImpl />);

    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });

    await waitFor(() => expect(view.getByText('sell.quoteError.noCode')).toBeTruthy());
    expect(view.queryByText('sell.confirmSale')).toBeNull();
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

  it('shows a loading placeholder instead of no balance while balances load', () => {
    mockBalanceMap = new Map();
    mockBalancesLoading = true;

    const { getByText, queryByTestId } = render(<SellScreenImpl />);
    fireEvent.press(getByText('BTC'));

    expect(getByText('sell.balanceLoading')).toBeTruthy();
    expect(queryByTestId('sell-no-balance')).toBeNull();
  });

  it('shows an unavailable placeholder instead of no balance on a balance-source error', () => {
    mockBalanceMap = new Map();
    mockBalancesError = new Error('rpc-down');

    const { getByText, queryByTestId } = render(<SellScreenImpl />);
    fireEvent.press(getByText('BTC'));

    expect(getByText('sell.balanceUnavailable')).toBeTruthy();
    expect(queryByTestId('sell-no-balance')).toBeNull();
  });

  it('treats a stale balance entry as incomplete instead of as no balance', () => {
    mockBalanceMap = new Map([
      [
        'bitcoin-native',
        { ...balanceEntry('bitcoin-native', '0', 'wdk'), status: 'stale' },
      ],
    ]);

    const { getByText, queryByTestId } = render(<SellScreenImpl />);
    fireEvent.press(getByText('BTC'));

    expect(getByText('sell.balanceUnavailable')).toBeTruthy();
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

  it('does not advance when cancel lands during an in-flight payment replay', async () => {
    let resolveRetry: (value: { kind: 'paymentInfo'; info: typeof PAYMENT_INFO }) => void = () => {};
    const retryPromise = new Promise<{ kind: 'paymentInfo'; info: typeof PAYMENT_INFO }>(
      (resolve) => {
        resolveRetry = resolve;
      },
    );
    const loginGate = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(view.getByTestId('dfx-auth-gate-cancel')).toBeTruthy();

    mockRetryLast.mockReturnValue(retryPromise);
    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });
    expect(mockRetryLast).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-cancel'));
    });
    await act(async () => {
      resolveRetry({ kind: 'paymentInfo', info: PAYMENT_INFO });
      await retryPromise;
    });

    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });

  it('stays on the amount step when bank back wins over in-flight payment info', async () => {
    let resolvePayment: (value: typeof PAYMENT_INFO) => void = () => {};
    const pending = new Promise<typeof PAYMENT_INFO>((resolve) => {
      resolvePayment = resolve;
    });
    mockCreatePaymentInfo.mockReturnValue(pending);

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );

    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByTestId('sell-back'));
    expect(view.queryByText('sell.bankAccount')).toBeNull();

    await act(async () => {
      resolvePayment(PAYMENT_INFO);
      await pending;
    });

    expect(view.queryByText('sell.confirmSale')).toBeNull();
    expect(view.queryByText('sell.bankAccount')).toBeNull();
  });

  it('does not replay when an auth gate appears while already signed in', async () => {
    mockIsDfxAuthenticated = true;
    mockRetryLast.mockResolvedValue(null);
    const view = render(<SellScreenImpl />);

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));

    flowState.authGate = { kind: 'login', message: 'sign in' };
    view.rerender(<SellScreenImpl />);

    expect(mockRetryLast).toHaveBeenCalledTimes(1);
  });

  it('replays a quote gate once focus returns after login', async () => {
    const loginGate = { kind: 'login' as const, message: 'sign in' };
    flowState.authGate = loginGate;
    mockDismissAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockResolvedValue({ kind: 'quote', info: PAYMENT_INFO });

    const view = render(<SellScreenImpl />);
    expect(mockRetryLast).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    expect(mockDismissAuthGate).toHaveBeenCalledWith(loginGate);

    view.rerender(<SellScreenImpl />);
    expect(mockRetryLast).not.toHaveBeenCalled();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
  });

  it('applies only the payment info from the submit that is still current', async () => {
    let resolveFirst: (value: null) => void = () => {};
    let resolveSecond: (value: typeof PAYMENT_INFO) => void = () => {};
    const first = new Promise<null>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<typeof PAYMENT_INFO>((resolve) => {
      resolveSecond = resolve;
    });
    mockCreatePaymentInfo.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByTestId('sell-back'));
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirst(null);
      await first;
    });
    expect(view.queryByText('sell.quoteError.noCode')).toBeNull();

    await act(async () => {
      resolveSecond(PAYMENT_INFO);
      await second;
    });

    await waitFor(() => expect(view.getByText('sell.confirmSale')).toBeTruthy());
    expect(view.queryByText('sell.quoteError.noCode')).toBeNull();
  });

  it('does not create payment info while a replay is in flight', async () => {
    let resolveRetry: (value: { kind: 'paymentInfo'; info: typeof PAYMENT_INFO }) => void =
      () => {};
    const retryPromise = new Promise<{ kind: 'paymentInfo'; info: typeof PAYMENT_INFO }>(
      (resolve) => {
        resolveRetry = resolve;
      },
    );
    const loginGate = { kind: 'login' as const, message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    view.rerender(<SellScreenImpl />);

    mockRetryLast.mockReturnValue(retryPromise);
    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });
    expect(mockRetryLast).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRetry({ kind: 'paymentInfo', info: PAYMENT_INFO });
      await retryPromise;
    });
  });

  it('confirm cancel during payment info drops the replay', async () => {
    const { pending, settle401 } = armInFlightPaymentThatFailsWith401();
    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    const onCancel = mockConfirmModalProps?.onCancel;
    if (!onCancel) throw new Error('confirm modal onCancel is not registered');
    await act(async () => {
      onCancel();
    });
    expect(mockCancelAuthGate).toHaveBeenCalledTimes(1);
    expect(mockCancelAuthGate.mock.calls[0]).toEqual([]);

    await act(async () => {
      settle401();
      await pending;
    });
    view.rerender(<SellScreenImpl />);
    expect(view.queryByTestId('dfx-auth-gate-primary')).toBeNull();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });
    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });

  it('bank back during payment info drops the replay', async () => {
    const { pending, settle401 } = armInFlightPaymentThatFailsWith401();
    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByTestId('sell-back'));
    expect(mockCancelAuthGate).toHaveBeenCalledTimes(1);
    expect(mockCancelAuthGate.mock.calls[0]).toEqual([]);

    await act(async () => {
      settle401();
      await pending;
    });
    view.rerender(<SellScreenImpl />);
    expect(view.queryByTestId('dfx-auth-gate-primary')).toBeNull();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(<SellScreenImpl />);
    });
    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });
});
