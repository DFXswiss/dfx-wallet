import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
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
const mockReplace = jest.fn();
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
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: mockReplace,
    canGoBack: () => true,
  }),
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

let mockBalanceResults: { assetId: string; success: boolean; balance: string }[] = [
  { assetId: 'BTC', success: true, balance: '1' },
];

jest.mock('@tetherto/wdk-react-native-core', () => {
  const actual = jest.requireActual('@tetherto/wdk-react-native-core');
  return {
    ...actual,
    useAccount: () => ({
      address: 'bc1q-wallet-address',
      sign: jest.fn().mockResolvedValue({ success: true, signature: 'signed-message' }),
    }),
    useBalancesForWallet: () => ({ data: mockBalanceResults }),
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
jest.mock('@/config/tokens', () => ({
  WDK_SUPPORTED_CHAINS: ['bitcoin', 'ethereum'],
  getAssets: () => [
    { getNetwork: () => 'bitcoin', getId: () => 'BTC', getDecimals: () => 8 },
    { getNetwork: () => 'ethereum', getId: () => 'USDT', getDecimals: () => 6 },
    { getNetwork: () => 'ethereum', getId: () => 'USDC', getDecimals: () => 6 },
  ],
  getAssetMeta: (id: string) => ({ symbol: id }),
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

jest.mock('@/features/dfx-backend/services', () => {
  const getAccessToken = jest.fn(() => null as string | null);
  return {
    dfxAuthService: {
      getAccessToken,
      linkAddress: jest.fn(async () => {
        const token = 'linked-token';
        getAccessToken.mockReturnValue(token);
        return token;
      }),
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
  };
});

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
const mockAuthState = {
  isAuthenticated: true,
  isDfxAuthenticated: false,
  isOnboarded: true,
  sessionEpoch: 1,
};
jest.mock('@/store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { isDfxAuthenticated: boolean }) => unknown) =>
      selector({
        ...mockAuthState,
        isDfxAuthenticated: mockIsDfxAuthenticated,
      }),
    { getState: () => mockAuthState },
  ),
}));

jest.mock('@/components', () => ({
  AppHeader: ({ title, onBack }: { title?: string; onBack?: () => void; testID?: string }) => {
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
  Icon: ({ name, color }: { name: string; color?: string }) => {
    const ReactActual = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return ReactActual.createElement(Text, { style: { color }, testID: `mock-icon-${name}` }, name);
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
        accessibilityLabel: title,
        accessibilityRole: 'button',
        disabled: disabled || loading,
        onPress,
        testID,
      },
      ReactActual.createElement(Text, null, loading ? 'common.loading' : title),
    );
  },
}));

jest.mock('../../src/features/buy-sell/AssetGlyph', () => ({
  AssetGlyph: ({ symbol }: { symbol: string }) => {
    const ReactActual = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return ReactActual.createElement(Text, null, symbol);
  },
}));
jest.mock('../../src/features/buy-sell/CurrencyGlyph', () => ({ CurrencyGlyph: () => null }));

const mockGetQuote = jest.fn();
const mockCreatePaymentInfo = jest.fn();
const mockDismissAuthGate = jest.fn();
const mockCancelAuthGate = jest.fn();
const mockRetryLast = jest.fn();
const mockConfirmSell = jest.fn();

const flowState = {
  isLoading: false,
  error: null as string | null,
  authGate: null as { kind: string; chain?: 'bitcoin'; message: string } | null,
  paymentInfo: null as Record<string, unknown> | null,
  quoteKey: null as string | null,
  errorKey: null as string | null,
  actionErrorKey: null as string | null,
};

jest.mock('../../src/features/buy-sell/useSellFlow', () => ({
  useSellFlow: () => ({
    paymentInfo: flowState.paymentInfo,
    quoteKey: flowState.quoteKey,
    errorKey: flowState.errorKey,
    actionErrorKey: flowState.actionErrorKey,
    isLoading: flowState.isLoading,
    error: flowState.error,
    authGate: flowState.authGate,
    getQuote: mockGetQuote,
    createPaymentInfo: mockCreatePaymentInfo,
    dismissAuthGate: mockDismissAuthGate,
    cancelAuthGate: mockCancelAuthGate,
    retryLast: mockRetryLast,
    confirmSell: mockConfirmSell,
  }),
}));

// eslint-disable-next-line import/first
import { GlassCard } from '../../src/components/GlassCard';
// eslint-disable-next-line import/first
import { SellTradeAdapter } from '../../src/features/buy-sell/SellTradeAdapter';

const mockOnShellChange = jest.fn();
const sellElement = () => <SellTradeAdapter onShellChange={mockOnShellChange} />;
const renderAdapter = () => render(sellElement());

function pressReportedBack(): void {
  const calls = mockOnShellChange.mock.calls;
  const last = calls[calls.length - 1]?.[0] as { onBack?: () => void } | undefined;
  if (!last?.onBack) throw new Error('shell not reported');
  last.onBack();
}

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

const FLOW_PAYMENT_INFO = {
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
    return { kind: 'paymentInfo' as const, info: FLOW_PAYMENT_INFO };
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
  flowState.paymentInfo = FLOW_PAYMENT_INFO;
  flowState.quoteKey = null;
  flowState.errorKey = null;
  flowState.actionErrorKey = null;
  mockBalanceResults = [{ assetId: 'BTC', success: true, balance: '1' }];
  mockOnShellChange.mockReset();
});

describe('SellTradeAdapter payment replay', () => {
  it.each([
    ['1,5', 1.5],
    ['0,001', 0.001],
  ])(
    'normalizes %s for both the quote and payment info request',
    async (input, expected) => {
      flowState.paymentInfo = { ...FLOW_PAYMENT_INFO, maxVolume: 10 };
      mockCreatePaymentInfo.mockResolvedValueOnce(FLOW_PAYMENT_INFO);
      const { getByTestId, getByText, getByPlaceholderText } = renderAdapter();

      fireEvent.press(getByTestId('sell-pay-asset-pill'));
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
      flowState.quoteKey = `${expected}|CHF|BTC|Bitcoin|bitcoin`;
      fireEvent.changeText(getByTestId('sell-amount-input'), input);
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
      // First case pays the module cold start; slower than the 5 s default on CI runners.
    },
    15000,
  );

  it('keeps a mixed-separator amount gated', () => {
    const { getByTestId, getByLabelText } = renderAdapter();
    const ctaLabel = 'sell.cta:{"asset":"BTC"}';

    fireEvent.press(getByTestId('sell-pay-asset-pill'));
    fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    const amountInput = getByTestId('sell-amount-input');
    fireEvent.changeText(amountInput, '1,000.50');

    expect(getByLabelText(ctaLabel).props.accessibilityState?.disabled).toBe(true);
    expect(mockGetQuote).not.toHaveBeenCalled();

    flowState.quoteKey = '0.5|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(amountInput, '0,5');
    expect(getByLabelText(ctaLabel).props.accessibilityState?.disabled).not.toBe(true);
  });

  it('does not advance from replayed payment info when authenticated focus has no pending confirmation', async () => {
    mockIsDfxAuthenticated = true;
    mockRetryLast.mockResolvedValueOnce({ kind: 'paymentInfo', info: FLOW_PAYMENT_INFO });

    const { queryByText } = renderAdapter();

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(queryByText('sell.confirmSale')).toBeNull();
  });

  it('does not advance for a quote retry or a payment retry without a pending confirmation', async () => {
    flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'link Bitcoin' };
    flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    mockRetryLast
      .mockResolvedValueOnce({ kind: 'quote', info: FLOW_PAYMENT_INFO })
      .mockResolvedValueOnce({ kind: 'paymentInfo', info: FLOW_PAYMENT_INFO });

    const { getByTestId, queryByText } = renderAdapter();

    fireEvent.press(getByTestId('sell-pay-asset-pill'));
    fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(getByTestId('sell-amount-input'), '0.001');
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
    flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    mockRetryLast.mockResolvedValueOnce(null);

    const { getByTestId, queryByText } = renderAdapter();

    fireEvent.press(getByTestId('sell-pay-asset-pill'));
    fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(getByTestId('sell-amount-input'), '0.001');
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
      flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockImplementation(async () => ({
      kind: 'paymentInfo',
      info: FLOW_PAYMENT_INFO,
    }));

    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
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
      view.rerender(sellElement());
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.getByText('sell.confirmSale')).toBeTruthy();
  });

  it('abandons the gated sell when focus returns without a session', async () => {
    const loginGate = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });

    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
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
      view.rerender(sellElement());
    });
    expect(view.queryByTestId('dfx-auth-gate-primary')).toBeNull();

    const callsBefore = mockCancelAuthGate.mock.calls.length;
    await act(async () => {
      refocusScreen();
    });
    expect(mockCancelAuthGate.mock.calls.length).toBe(callsBefore + 1);
    expect(mockCancelAuthGate.mock.calls[callsBefore]).toEqual([]);

    mockRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: FLOW_PAYMENT_INFO });
    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(sellElement());
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(view.queryByText('sell.confirmSale')).toBeNull();
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    mockCreatePaymentInfo.mockImplementation(async () => FLOW_PAYMENT_INFO);
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
      flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
      return null;
    });
    mockCancelAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: FLOW_PAYMENT_INFO });

    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
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
      view.rerender(sellElement());
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });

  it('creates one payment info when continue is pressed twice', async () => {
    mockCreatePaymentInfo.mockResolvedValue(FLOW_PAYMENT_INFO);
    const view = renderAdapter();

    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
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
    const view = renderAdapter();

    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
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
    const view = renderAdapter();

    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
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

      const { getByTestId, getByText, getByPlaceholderText, queryByText } = renderAdapter();

      fireEvent.press(getByTestId('sell-pay-asset-pill'));
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
      flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
      fireEvent.changeText(getByTestId('sell-amount-input'), '0.001');
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

    const { getByTestId, getByText, getByPlaceholderText, queryByText } = renderAdapter();

    fireEvent.press(getByTestId('sell-pay-asset-pill'));
    fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(getByTestId('sell-amount-input'), '0.001');
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

    act(() => {
      pressReportedBack();
    });
    await act(async () => {
      fireEvent.changeText(getByTestId('sell-amount-input'), '0.002');
    });
    fireEvent.press(getByText('sell.cta:{"asset":"BTC"}'));

    await waitFor(() => expect(queryByText(errorMessage)).toBeNull());
  });

  it('advances to confirmation for valid payment info', async () => {
    mockCreatePaymentInfo.mockImplementationOnce(async () => {
      flowState.paymentInfo = FLOW_PAYMENT_INFO;
      return FLOW_PAYMENT_INFO;
    });

    const { getByTestId, getByText, getByPlaceholderText } = renderAdapter();

    fireEvent.press(getByTestId('sell-pay-asset-pill'));
    fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(getByTestId('sell-amount-input'), '0.001');
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
    let resolveRetry: (value: {
      kind: 'paymentInfo';
      info: typeof FLOW_PAYMENT_INFO;
    }) => void = () => {};
    const retryPromise = new Promise<{ kind: 'paymentInfo'; info: typeof FLOW_PAYMENT_INFO }>(
      (resolve) => {
        resolveRetry = resolve;
      },
    );
    const loginGate = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
      return null;
    });

    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
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
      view.rerender(sellElement());
    });
    expect(mockRetryLast).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-cancel'));
    });
    await act(async () => {
      resolveRetry({ kind: 'paymentInfo', info: FLOW_PAYMENT_INFO });
      await retryPromise;
    });

    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });

  it('stays on the amount step when bank back wins over in-flight payment info', async () => {
    let resolvePayment: (value: typeof FLOW_PAYMENT_INFO) => void = () => {};
    const pending = new Promise<typeof FLOW_PAYMENT_INFO>((resolve) => {
      resolvePayment = resolve;
    });
    mockCreatePaymentInfo.mockReturnValue(pending);

    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );

    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    act(() => {
      pressReportedBack();
    });
    expect(view.queryByText('sell.bankAccount')).toBeNull();

    await act(async () => {
      resolvePayment(FLOW_PAYMENT_INFO);
      await pending;
    });

    expect(view.queryByText('sell.confirmSale')).toBeNull();
    expect(view.queryByText('sell.bankAccount')).toBeNull();
  });

  it('does not replay when an auth gate appears while already signed in', async () => {
    mockIsDfxAuthenticated = true;
    mockRetryLast.mockResolvedValue(null);
    const view = renderAdapter();

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));

    flowState.authGate = { kind: 'login', message: 'sign in' };
    flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    view.rerender(sellElement());

    expect(mockRetryLast).toHaveBeenCalledTimes(1);
  });

  it('calls retryLast once for a quote gate after login', async () => {
    const loginGate = { kind: 'login' as const, message: 'sign in' };
    flowState.authGate = loginGate;
    flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    mockDismissAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockResolvedValue({ kind: 'quote', info: FLOW_PAYMENT_INFO });

    const view = renderAdapter();
    expect(mockRetryLast).not.toHaveBeenCalled();

    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    expect(mockDismissAuthGate).toHaveBeenCalledWith(loginGate);

    view.rerender(sellElement());
    expect(mockRetryLast).not.toHaveBeenCalled();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(sellElement());
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
  });

  it('applies only the payment info from the submit that is still current', async () => {
    let resolveFirst: (value: null) => void = () => {};
    let resolveSecond: (value: typeof FLOW_PAYMENT_INFO) => void = () => {};
    const first = new Promise<null>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<typeof FLOW_PAYMENT_INFO>((resolve) => {
      resolveSecond = resolve;
    });
    mockCreatePaymentInfo.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    act(() => {
      pressReportedBack();
    });
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
      resolveSecond(FLOW_PAYMENT_INFO);
      await second;
    });

    await waitFor(() => expect(view.getByText('sell.confirmSale')).toBeTruthy());
    expect(view.queryByText('sell.quoteError.noCode')).toBeNull();
  });

  it('does not create payment info while a replay is in flight', async () => {
    let resolveRetry: (value: {
      kind: 'paymentInfo';
      info: typeof FLOW_PAYMENT_INFO;
    }) => void = () => {};
    const retryPromise = new Promise<{ kind: 'paymentInfo'; info: typeof FLOW_PAYMENT_INFO }>(
      (resolve) => {
        resolveRetry = resolve;
      },
    );
    const loginGate = { kind: 'login' as const, message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      flowState.actionErrorKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: { kind: string }) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });

    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
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
    view.rerender(sellElement());

    mockRetryLast.mockReturnValue(retryPromise);
    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(sellElement());
    });
    expect(mockRetryLast).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRetry({ kind: 'paymentInfo', info: FLOW_PAYMENT_INFO });
      await retryPromise;
    });
  });

  it('confirm cancel during payment info drops the replay', async () => {
    const { pending, settle401 } = armInFlightPaymentThatFailsWith401();
    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    // The cancel button is disabled while loading; this drives the handler as defence in depth.
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
    view.rerender(sellElement());
    expect(view.queryByTestId('dfx-auth-gate-primary')).toBeNull();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(sellElement());
    });
    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });

  it('bank back during payment info drops the replay', async () => {
    const { pending, settle401 } = armInFlightPaymentThatFailsWith401();
    const view = renderAdapter();
    fireEvent.press(view.getByTestId('sell-pay-asset-pill'));
    fireEvent.press(view.getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    flowState.quoteKey = '0.001|CHF|BTC|Bitcoin|bitcoin';
    fireEvent.changeText(view.getByTestId('sell-amount-input'), '0.001');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    act(() => {
      pressReportedBack();
    });
    expect(mockCancelAuthGate).toHaveBeenCalledTimes(1);
    expect(mockCancelAuthGate.mock.calls[0]).toEqual([]);

    await act(async () => {
      settle401();
      await pending;
    });
    view.rerender(sellElement());
    expect(view.queryByTestId('dfx-auth-gate-primary')).toBeNull();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(sellElement());
    });
    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });
});

const PAYMENT_INFO = {
  id: 123,
  uid: 'sell-quote-123',
  routeId: 1,
  timestamp: '2026-10-01T10:00:00.000Z',
  isValid: true,
  depositAddress: 'bc1q-dfx-deposit-address',
  amount: 0.01,
  estimatedAmount: 689.46,
  exchangeRate: 0.000014271,
  rate: 0.000014504,
  minVolume: 0.001,
  maxVolume: 10,
  currency: { id: 1, name: 'CHF' },
  asset: { id: 1, name: 'BTC', uniqueName: 'Bitcoin', blockchain: 'Bitcoin' },
  beneficiary: { iban: 'CH9300762011623852957' },
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
  expiryDate: '2026-10-01T10:05:00.000Z',
};

describe('SellTradeAdapter', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockGetQuote.mockReset();
    mockCreatePaymentInfo.mockReset();
    mockConfirmSell.mockReset();
    mockOnShellChange.mockReset();
    mockEnabledChains = ['bitcoin', 'ethereum'];
    mockBalanceResults = [
      { assetId: 'BTC', success: true, balance: '1' },
      { assetId: 'USDC', success: true, balance: '1' },
    ];
    flowState.isLoading = false;
    flowState.error = null;
    flowState.authGate = null;
    flowState.paymentInfo = null;
    flowState.quoteKey = null;
    flowState.errorKey = null;
    flowState.actionErrorKey = null;
  });

  it('renders empty amount, fees, disabled CTA, and security shell without a selection', () => {
    const { getByTestId, UNSAFE_getAllByType } = renderAdapter();

    expect(getByTestId('sell-amount-panels-empty')).toBeTruthy();
    expect(getByTestId('sell-fees-panel')).toBeTruthy();
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('sell-security-row')).toBeTruthy();
    // Amount panels + fees panel both render on `GlassCard` now.
    expect(UNSAFE_getAllByType(GlassCard).length).toBeGreaterThan(0);
  });

  it('labels the flip action as navigation to Buy', () => {
    const { getByTestId } = renderAdapter();

    expect(getByTestId('sell-flip-to-buy').props.accessibilityLabel).toBe('sell.flipToBuy');
  });

  it('renders feesTarget rows after selecting an asset and entering an amount', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');
    const panel = getByTestId('sell-fees-panel');
    const headline = within(panel).getByText(/sell\.rateInclFees/).props.children;
    expect(headline).toMatch(/"amount":"68['’]946\.50"/);
    expect(headline).not.toContain('"amount":"0.00"');
    fireEvent.press(within(panel).getByRole('button'));
    expect(within(panel).getByText('−7.22 CHF')).toBeTruthy();
    expect(within(panel).getByText('−2.04 CHF')).toBeTruthy();
    expect(within(panel).getByText('−2.00 CHF')).toBeTruthy();
    expect(within(panel).getByText('−11.26 CHF')).toBeTruthy();
    expect(within(panel).getByText(/^1 BTC = 70['’]072\.17 CHF$/)).toBeTruthy();
    expect(within(panel).queryByText('common.free')).toBeNull();
    expect(within(panel).queryByText('common.included')).toBeNull();
  });

  it('shows a concrete errors entry while the fee panel is collapsed', () => {
    flowState.paymentInfo = { isValid: false, errors: ['AmountTooLow'] };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId, getByText } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');
    const panel = getByTestId('sell-fees-panel');

    expect(getByText(/sell\.quoteError\.AmountTooLow/)).toBeTruthy();
    expect(within(panel).queryByText('sell.continueHint')).toBeNull();
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('allows an account gate to continue without a valid quote', () => {
    flowState.paymentInfo = { isValid: false, error: 'KycRequired' };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');

    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(false);
  });

  it('shows a current generic quote error and hides it after the amount changes', () => {
    flowState.paymentInfo = null;
    flowState.error = 'network failed';
    flowState.errorKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId, getByText, queryByText } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');
    fireEvent.press(within(getByTestId('sell-fees-panel')).getByRole('button'));

    expect(getByText('network failed')).toBeTruthy();
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('sell-amount-input'), '2');
    expect(queryByText('network failed')).toBeNull();
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('does not reopen an old auth gate after the quote inputs change', () => {
    flowState.authGate = { kind: 'login', message: 'sign in' };
    flowState.errorKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '2');

    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('hides stale receive and fee values and disables CTA while loading', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.isLoading = true;
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');

    expect(getByTestId('sell-receive-amount').props.value).toBe('');
    expect(within(getByTestId('sell-fees-panel')).getByText('sell.fetchingQuote')).toBeTruthy();
    expect(within(getByTestId('sell-fees-panel')).getAllByText('—')).toHaveLength(1);
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('invalidates the previous quote immediately when payout currency changes', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');
    expect(getByTestId('sell-receive-amount').props.value).not.toBe('');

    fireEvent.press(getByTestId('sell-receive-currency-pill'));

    expect(getByTestId('sell-receive-amount').props.value).toBe('');
    expect(within(getByTestId('sell-fees-panel')).getByText('sell.summary')).toBeTruthy();
    expect(within(getByTestId('sell-fees-panel')).getAllByText('—')).toHaveLength(1);
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('keeps USDC-only holdings selectable and uses the selected token in the quote key', () => {
    flowState.paymentInfo = {
      ...PAYMENT_INFO,
      asset: { name: 'USDC' },
      estimatedAmount: 25000,
    };
    flowState.quoteKey = '1|CHF|USDC|Ethereum|ethereum';
    const { getByTestId, getAllByText } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    expect(getByTestId('sell-pay-asset-option-USD-ethereum-USDT')).toBeTruthy();
    expect(getByTestId('sell-pay-asset-option-USD-ethereum-USDC')).toBeTruthy();
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-USD-ethereum-USDC'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');

    expect(getAllByText('USDC', { exact: true }).length).toBeGreaterThan(0);
    expect(getByTestId('sell-receive-amount').props.value).toBe("25'000.00");
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(false);
  });

  it('exposes the Sell E2E ids and renders the no-balance anchor without sellable funds', () => {
    mockBalanceResults = [];
    const { getByTestId } = renderAdapter();

    expect(getByTestId('sell-amount-input')).toBeTruthy();
    const noBalance = getByTestId('sell-no-balance');
    expect([noBalance.props.testID, noBalance.props.children]).toEqual([
      'sell-no-balance',
      'sell.noBalance',
    ]);
  });

  it('falls back to the Sell summary for an invalid final rate', () => {
    flowState.paymentInfo = { ...PAYMENT_INFO, rate: 0 };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId, getByText, queryByText } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');

    expect(getByText('sell.summary')).toBeTruthy();
    expect(queryByText(/sell\.rateInclFees/)).toBeNull();
  });

  it('interpolates the Sell CTA and both continue-hint actions', () => {
    flowState.paymentInfo = { ...PAYMENT_INFO, feesTarget: undefined };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getByTestId, getByText } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-amount-input'), '1');

    expect(getByText('sell.cta:{"asset":"BTC"}')).toBeTruthy();
    const hint = getByText(/sell\.continueHint/).props.children;
    expect(hint).toContain('"action":"sell.cta:{\\"asset\\":\\"BTC\\"}"');
    expect(hint).toContain('"next":"common.continue"');
  });

  it('reports the amount-step shell chrome on mount', () => {
    renderAdapter();

    expect(mockOnShellChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'sell.title',
        headerTestID: 'sell-screen',
        activeStep: 0,
        steps: ['amount', 'bank', 'confirm'],
      }),
    );
  });
});
