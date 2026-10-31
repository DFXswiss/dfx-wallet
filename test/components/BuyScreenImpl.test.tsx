import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import type { ChainId } from '@/config/chains';
import { ConfirmTargetWalletModal } from '@/components';
import { LOCAL_SESSION_ENDED_MESSAGE } from '@/features/dfx-backend/session-guard';
import type { DfxAuthGateState } from '@/features/dfx-backend/services';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';
import type {
  BuyPaymentInfoDto,
  SellPaymentInfoDto,
} from '@/features/dfx-backend/services/dto/payment';
import { darkColors, ThemeProvider, useThemeStore } from '@/theme';
import BuyScreenImpl from '../../src/features/buy-sell/BuyScreenImpl';
import SellScreenImpl from '../../src/features/buy-sell/SellScreenImpl';

jest.mock('@/services/balances', () => {
  const actual = jest.requireActual('@/services/balances');
  const balances = new Map([
    ['btc', { assetId: 'btc', rawBalance: '1', status: 'ok', source: 'wdk' }],
  ]);
  return {
    ...actual,
    useBalances: () => ({ data: balances, isLoading: false, error: null }),
  };
});

jest.mock('react-i18next', () => {
  const translations: Record<string, string> = {
    'buy.paymentMethodBank': 'Bank transfer',
    'buy.paymentMethodHint': '0–1 business day',
    'buy.paymentMethodSepa': 'SEPA bank transfer',
  };
  const t = (key: string | string[], params?: Record<string, unknown>) => {
    const resolved = Array.isArray(key) ? key[0]! : key;
    const rendered = translations[resolved] ?? resolved;
    return params ? `${rendered}:${JSON.stringify(params)}` : rendered;
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
  useLocalSearchParams: () => mockSearchParams,
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
  assetIncludedInEvmBalanceQuery: () => false,
  assetIncludedInWdkBalanceQuery: () => true,
  getAssets: () => [{ getNetwork: () => 'bitcoin', getId: () => 'btc', getDecimals: () => 8 }],
  getAssetMeta: () => ({ symbol: 'BTC' }),
  WDK_SUPPORTED_CHAINS: ['bitcoin'],
}));

jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({ enabledChains: ['bitcoin'] }),
}));

const mockLdsState: {
  user: { lightning: { addressLnurl: string; addressOwnershipProof: string } } | null;
} = { user: null };
const mockLdsSignIn = jest.fn();
const LDS_LIGHTNING_USER = {
  lightning: {
    addressLnurl: 'LNURL1ABC',
    addressOwnershipProof: 'test-ownership-proof',
  },
};

jest.mock('@/hooks', () => ({
  useLdsWallet: () => ({
    user: mockLdsState.user,
    signIn: mockLdsSignIn,
  }),
}));

const mockReauthAs = jest.fn();
jest.mock('@/features/linked-wallets/useLinkedWalletReauth', () => ({
  useLinkedWalletReauth: () => ({
    reauthAs: (...args: unknown[]) => mockReauthAs(...args),
  }),
}));

let mockUseRealDfxAuthGate = false;
jest.mock('@/features/dfx-backend/DfxAuthGate', () => {
  const actual = jest.requireActual<typeof import('@/features/dfx-backend/DfxAuthGate')>(
    '@/features/dfx-backend/DfxAuthGate',
  );
  const ReactActual = jest.requireActual('react');

  function MockDfxAuthGate(props: {
    gate: (DfxAuthGateState & { chain?: ChainId }) | null;
    onClose: () => void;
    onLinkChain?: (chain: ChainId) => Promise<void>;
  }) {
    if (mockUseRealDfxAuthGate) {
      return ReactActual.createElement(actual.DfxAuthGate, props);
    }
    const { gate, onLinkChain } = props;
    const chain = gate?.chain;
    if (!chain || !onLinkChain) return null;
    const { Pressable, Text } = jest.requireActual('react-native');
    return ReactActual.createElement(
      Pressable,
      { onPress: () => onLinkChain(chain), testID: 'mock-link-chain' },
      ReactActual.createElement(Text, null, 'link-chain'),
    );
  }

  return { DfxAuthGate: MockDfxAuthGate };
});

jest.mock('@/features/dfx-backend/useDfxAutoLinkImpl', () => ({
  markChainLinkedInAutoLinkCache: jest.fn(),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxAuthService: {
    getAccessToken: jest.fn(),
    linkAddress: jest.fn(),
    linkLnurlAddress: jest.fn(),
    loginAsAddressOwner: jest.fn(),
    loginAsLnurlAddressOwner: jest.fn(),
    logout: jest.fn(),
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
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
  StorageKeys: {
    DFX_AUTH_TOKEN: 'dfx-auth-token',
    DFX_LINKED_CHAINS: 'dfx-linked-chains',
  },
}));

let mockIsDfxAuthenticated = false;
let mockSearchParams: Record<string, string> = {};
const mockAuthState = {
  isAuthenticated: true,
  isDfxAuthenticated: false,
  isOnboarded: true,
  sessionEpoch: 1,
  setDfxAuthenticated: jest.fn(),
};

jest.mock('@/store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof mockAuthState) => unknown) =>
      selector({
        ...mockAuthState,
        isDfxAuthenticated: mockIsDfxAuthenticated || mockAuthState.isDfxAuthenticated,
      }),
    { getState: () => mockAuthState },
  ),
}));

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');

  function MockAppHeader({ title }: { title?: string }) {
    return ReactActual.createElement(Text, null, title);
  }

  function MockConfirmTargetWalletModal({
    visible,
    loading,
    error,
    onConfirm,
    onCancel,
  }: {
    visible: boolean;
    loading?: boolean;
    error?: string | null;
    onConfirm: () => void;
    onCancel: () => void;
  }) {
    if (!visible) return null;
    return ReactActual.createElement(
      Pressable,
      { testID: 'confirm-target-modal' },
      error ? ReactActual.createElement(Text, null, error) : null,
      ReactActual.createElement(
        Pressable,
        { testID: 'confirm-target-confirm', onPress: onConfirm, disabled: loading },
        ReactActual.createElement(Text, null, loading ? 'common.loading' : 'common.confirm'),
      ),
      ReactActual.createElement(
        Pressable,
        { testID: 'confirm-target-cancel', onPress: onCancel, disabled: loading },
        ReactActual.createElement(Text, null, 'common.cancel'),
      ),
    );
  }

  function MockDarkBackdrop() {
    return null;
  }

  function MockIcon({ name, color }: { name: string; color?: string }) {
    return ReactActual.createElement(Text, { style: { color }, testID: `mock-icon-${name}` }, name);
  }

  function MockPrimaryButton({
    title,
    onPress,
    disabled,
    loading,
    icon,
  }: {
    title: string;
    onPress: () => void | Promise<void>;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
  }) {
    return ReactActual.createElement(
      Pressable,
      {
        accessibilityLabel: title,
        accessibilityRole: 'button',
        disabled: disabled || loading,
        onPress,
      },
      ReactActual.createElement(Text, null, loading ? 'common.loading' : title),
      icon,
    );
  }

  return {
    AppHeader: MockAppHeader,
    ConfirmTargetWalletModal: MockConfirmTargetWalletModal,
    DarkBackdrop: MockDarkBackdrop,
    Icon: MockIcon,
    PrimaryButton: MockPrimaryButton,
  };
});

const mockGetQuote = jest.fn();
const mockCreatePaymentInfo = jest.fn();
const mockConfirmPayment = jest.fn();
const mockDismissAuthGate = jest.fn();
const mockCancelAuthGate = jest.fn();
const mockRetryLast = jest.fn();
const mockSellGetQuote = jest.fn();
const mockSellCreatePaymentInfo = jest.fn();
const mockSellConfirmPayment = jest.fn();
const mockSellDismissAuthGate = jest.fn();
const mockSellCancelAuthGate = jest.fn();
const mockSellRetryLast = jest.fn();

const mockDfxAuthService = (
  jest.requireMock('@/features/dfx-backend/services') as {
    dfxAuthService: {
      getAccessToken: jest.Mock;
      linkAddress: jest.Mock;
      linkLnurlAddress: jest.Mock;
      loginAsAddressOwner: jest.Mock;
      loginAsLnurlAddressOwner: jest.Mock;
      logout: jest.Mock;
    };
  }
).dfxAuthService;
const mockSecureStorage = (
  jest.requireMock('@/services/storage') as {
    secureStorage: { get: jest.Mock; remove: jest.Mock; set: jest.Mock };
  }
).secureStorage;
const mockMarkChainLinked = (
  jest.requireMock('@/features/dfx-backend/useDfxAutoLinkImpl') as {
    markChainLinkedInAutoLinkCache: jest.Mock;
  }
).markChainLinkedInAutoLinkCache;

function persistTokenThatEndsSessionAfterWrite(token: string, linkMock: jest.Mock): void {
  let currentToken: string | null = null;
  let persisted = false;
  mockSecureStorage.set.mockImplementation(async (key: string, value: string) => {
    if (key === 'dfx-auth-token' && value === token) persisted = true;
  });
  mockDfxAuthService.getAccessToken.mockImplementation(() => {
    if (persisted) {
      persisted = false;
      queueMicrotask(() => {
        mockAuthState.isAuthenticated = false;
        mockAuthState.sessionEpoch += 1;
      });
    }
    return currentToken;
  });
  linkMock.mockImplementation(async () => {
    currentToken = token;
    return token;
  });
}

function linkAddressThatEndsSessionAfterPersist(token: string): void {
  persistTokenThatEndsSessionAfterWrite(token, mockDfxAuthService.linkAddress);
}

function linkLnurlAddressThatEndsSessionAfterPersist(token: string): void {
  persistTokenThatEndsSessionAfterWrite(token, mockDfxAuthService.linkLnurlAddress);
}

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const flowState = {
  isLoading: false,
  error: null as string | null,
  authGate: null as DfxAuthGateState | null,
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
    cancelAuthGate: mockCancelAuthGate,
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
    cancelAuthGate: mockSellCancelAuthGate,
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
  authGate: null as DfxAuthGateState | null,
  paymentInfo: SELL_PAYMENT_INFO as Record<string, unknown> | null,
};

beforeEach(() => {
  mockIsDfxAuthenticated = false;
  mockSearchParams = {};
  mockReauthAs.mockReset();
  mockReauthAs.mockResolvedValue({ ok: true });
  mockUseRealDfxAuthGate = false;
  useThemeStore.setState({ mode: 'light' });
  mockAuthState.isAuthenticated = true;
  mockAuthState.isDfxAuthenticated = false;
  mockAuthState.isOnboarded = true;
  mockAuthState.sessionEpoch = 1;
  mockAuthState.setDfxAuthenticated.mockClear();
  mockMarkChainLinked.mockClear();
  mockBack.mockReset();
  mockDfxAuthService.linkAddress.mockReset();
  mockDfxAuthService.linkAddress.mockImplementation(async () => {
    const token = 'linked-token';
    mockDfxAuthService.getAccessToken.mockReturnValue(token);
    return token;
  });
  mockDfxAuthService.linkLnurlAddress.mockReset();
  mockLdsState.user = null;
  mockLdsSignIn.mockReset();
  mockLdsSignIn.mockResolvedValue(null);
  mockDfxAuthService.getAccessToken.mockReset();
  mockDfxAuthService.getAccessToken.mockReturnValue(null);
  mockDfxAuthService.loginAsAddressOwner.mockReset();
  mockDfxAuthService.loginAsLnurlAddressOwner.mockReset();
  mockDfxAuthService.logout.mockReset();
  mockSecureStorage.get.mockReset();
  mockSecureStorage.get.mockResolvedValue(null);
  mockSecureStorage.remove.mockReset();
  mockSecureStorage.set.mockReset();
  mockGetQuote.mockReset();
  mockCreatePaymentInfo.mockReset();
  mockConfirmPayment.mockReset();
  mockDismissAuthGate.mockReset();
  mockCancelAuthGate.mockReset();
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
  mockSellCancelAuthGate.mockReset();
  mockSellRetryLast.mockReset();
  mockAlert.mockClear();
});

describe('BuyScreenImpl', () => {
  it('uses on-primary for the active currency and CTA icon in dark mode', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(getByText('BTC'));

    const activeCurrencyColor = StyleSheet.flatten(
      within(getByTestId('buy-currency-CHF')).getByText('CHF').props.style,
    ).color;
    const inactiveCurrencyColor = StyleSheet.flatten(
      within(getByTestId('buy-currency-EUR')).getByText('EUR').props.style,
    ).color;
    const iconColor = StyleSheet.flatten(getByTestId('mock-icon-arrow-right').props.style).color;
    expect(activeCurrencyColor).toBe(darkColors.onPrimary);
    expect(activeCurrencyColor).not.toBe(darkColors.white);
    expect(inactiveCurrencyColor).not.toBe(activeCurrencyColor);
    expect(inactiveCurrencyColor).not.toBe(darkColors.onPrimary);
    expect(iconColor).toBe(darkColors.onPrimary);
    expect(iconColor).not.toBe(darkColors.white);
  });

  it('normalizes a comma amount for both the quote and payment info request', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce(PAYMENT_INFO);
    const { getByPlaceholderText, getByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '100,50');

    await waitFor(() =>
      expect(mockGetQuote).toHaveBeenCalledWith(expect.objectContaining({ amount: 100.5 })),
    );
    await act(async () => {
      fireEvent.press(getByText('buy.cta:{"asset":"BTC"}'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledWith(expect.objectContaining({ amount: 100.5 }));
  });

  it.each(['1,000.50', '1.2.3', '1,,5'])('keeps malformed amount %s gated', (invalid) => {
    const { getByLabelText, getByPlaceholderText, getByText, queryByText } = render(
      <BuyScreenImpl />,
    );
    const ctaLabel = 'buy.cta:{"asset":"BTC"}';

    fireEvent.press(getByText('BTC'));
    const amountInput = getByPlaceholderText('0.00');
    fireEvent.changeText(amountInput, invalid);

    expect(getByLabelText(ctaLabel).props.accessibilityState?.disabled).toBe(true);
    expect(queryByText(/buy\.rateInclFees/)).toBeNull();
    expect(mockGetQuote).not.toHaveBeenCalled();

    fireEvent.changeText(amountInput, '100,50');
    expect(getByLabelText(ctaLabel).props.accessibilityState?.disabled).not.toBe(true);
  });

  it('does not advance from replayed payment info when authenticated focus has no pending confirmation', async () => {
    mockIsDfxAuthenticated = true;
    mockRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: PAYMENT_INFO });

    const { queryByText } = render(<BuyScreenImpl />);

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(queryByText('buy.paymentInfo')).toBeNull();
  });

  it('does not advance for a quote retry or a payment retry without a pending confirmation', async () => {
    flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'link Bitcoin' };
    mockRetryLast
      .mockResolvedValueOnce({ kind: 'quote', info: PAYMENT_INFO })
      .mockResolvedValueOnce({ kind: 'paymentInfo', info: PAYMENT_INFO });

    const { getByTestId, queryByText } = render(<BuyScreenImpl />);

    await act(async () => {
      fireEvent.press(getByTestId('mock-link-chain'));
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(queryByText('buy.paymentInfo')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('mock-link-chain'));
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(2));
    expect(queryByText('buy.paymentInfo')).toBeNull();
  });

  it('handles a null payment replay quietly', async () => {
    flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'link Bitcoin' };
    mockRetryLast.mockResolvedValueOnce(null);

    const { getByTestId, queryByText } = render(<BuyScreenImpl />);

    await act(async () => {
      fireEvent.press(getByTestId('mock-link-chain'));
    });

    expect(mockRetryLast).toHaveBeenCalledTimes(1);
    expect(queryByText('buy.paymentInfo')).toBeNull();
    expect(queryByText('buy.quoteError.noCode')).toBeNull();
  });

  it('keeps a newer auth gate visible after the linked-chain retry', async () => {
    mockUseRealDfxAuthGate = true;
    const linkGate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin',
      message: 'link Bitcoin',
    };
    const kycGate: DfxAuthGateState = { kind: 'kyc', message: 'finish KYC' };
    flowState.authGate = linkGate;
    mockDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockImplementationOnce(async () => {
      flowState.authGate = kycGate;
      return null;
    });

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );

    fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    await waitFor(() => expect(mockDismissAuthGate).toHaveBeenCalledWith(linkGate));

    view.rerender(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    expect(view.getByText('dfxAuthGate.kyc.title:{"chain":""}')).toBeTruthy();
  });

  it('does not report an unexpected payment retry error as a link failure', async () => {
    mockUseRealDfxAuthGate = true;
    const linkGate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin',
      message: 'link Bitcoin',
    };
    flowState.authGate = linkGate;
    mockDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockRejectedValueOnce(new Error('buy retry exploded'));

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );

    fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    await waitFor(() => expect(mockDismissAuthGate).toHaveBeenCalledWith(linkGate));
    view.rerender(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    expect(view.queryByTestId('dfx-auth-gate')).toBeNull();
    expect(view.queryByText('buy retry exploded')).toBeNull();
  });

  it('shows the continue hint for an invalid quote without an error code, then advances on valid payment info', async () => {
    flowState.paymentInfo = { isValid: false };
    mockCreatePaymentInfo.mockImplementationOnce(async () => {
      flowState.paymentInfo = PAYMENT_INFO;
      return PAYMENT_INFO;
    });

    const { getByPlaceholderText, getByText, queryByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');

    expect(getByText('buy.continueHint:{"action":"buy.cta:{\\"asset\\":\\"BTC\\"}"}')).toBeTruthy();
    expect(queryByText(/^buy\.quoteError\.generic/)).toBeNull();

    await act(async () => {
      fireEvent.press(getByText('buy.cta:{"asset":"BTC"}'));
    });

    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(getByText('buy.paymentInfo')).toBeTruthy());
  });

  it.each([
    {
      error: 'KycRequired',
      expectedMessage: 'buy.quoteError.KycRequired:{"code":"KycRequired"}',
    },
    { error: undefined, expectedMessage: 'buy.quoteError.noCode' },
  ])(
    'blocks payment instructions for final invalid payment info with error $error',
    async ({ error, expectedMessage }) => {
      mockCreatePaymentInfo.mockResolvedValueOnce({ isValid: false, error });

      const { getByPlaceholderText, getByText, queryByText } = render(<BuyScreenImpl />);

      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('0.00'), '100');
      await act(async () => {
        fireEvent.press(getByText('buy.cta:{"asset":"BTC"}'));
      });

      expect(queryByText('buy.paymentInfo')).toBeNull();
      expect(getByText(expectedMessage)).toBeTruthy();
    },
  );

  it('clears a final payment info error when the amount changes', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce({ isValid: false, error: 'KycRequired' });

    const { getByPlaceholderText, getByText, queryByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(getByText('buy.cta:{"asset":"BTC"}'));
    });

    const errorMessage = 'buy.quoteError.KycRequired:{"code":"KycRequired"}';
    expect(getByText(errorMessage)).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('0.00'), '200');

    await waitFor(() => expect(queryByText(errorMessage)).toBeNull());
  });

  it('clears a final payment info error when the currency changes', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce({ isValid: false, error: 'KycRequired' });

    const { getAllByText, getByPlaceholderText, getByText, queryByText } = render(
      <BuyScreenImpl />,
    );

    fireEvent.press(getByText('BTC'));
    fireEvent.changeText(getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(getByText('buy.cta:{"asset":"BTC"}'));
    });

    const errorMessage = 'buy.quoteError.KycRequired:{"code":"KycRequired"}';
    expect(getByText(errorMessage)).toBeTruthy();

    const [, eurCurrencyLabel] = getAllByText('EUR');
    fireEvent.press(eurCurrencyLabel!);

    await waitFor(() => expect(queryByText(errorMessage)).toBeNull());
  });

  it('keeps the payment instructions visible when transfer confirmation fails', async () => {
    mockCreatePaymentInfo.mockImplementationOnce(async () => {
      flowState.paymentInfo = PAYMENT_INFO;
      return PAYMENT_INFO;
    });
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

  it('creates one payment info when confirm is pressed twice', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    mockCreatePaymentInfo.mockResolvedValue(PAYMENT_INFO);
    const view = render(<BuyScreenImpl />);

    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });

    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(mockReauthAs).toHaveBeenCalledTimes(1);
  });

  it('closes the confirm modal when payment info opens an auth gate', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    mockCreatePaymentInfo.mockImplementation(() => {
      flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'link Bitcoin' };
      return null;
    });
    mockRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: PAYMENT_INFO });
    const view = render(<BuyScreenImpl />);

    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    expect(view.getByTestId('confirm-target-modal')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });

    await waitFor(() => expect(view.queryByTestId('confirm-target-modal')).toBeNull());
    expect(view.getByTestId('mock-link-chain')).toBeTruthy();
    expect(view.queryByText('buy.quoteError.noCode')).toBeNull();

    await act(async () => {
      fireEvent.press(view.getByTestId('mock-link-chain'));
    });
    await waitFor(() => expect(view.getByText('buy.paymentInfo')).toBeTruthy());
  });

  it('shows the hook error in the confirm modal when payment info returns null', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    mockCreatePaymentInfo.mockImplementation(() => {
      flowState.error = 'network down';
      return null;
    });
    const view = render(<BuyScreenImpl />);

    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });

    await waitFor(() =>
      expect(
        within(view.getByTestId('confirm-target-modal')).getByText('network down'),
      ).toBeTruthy(),
    );
    expect(view.queryByText('buy.paymentInfo')).toBeNull();
    expect(view.queryByText('buy.quoteError.noCode')).toBeNull();
  });

  it('shows a generic error in the confirm modal when payment info returns null', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    mockCreatePaymentInfo.mockResolvedValue(null);
    const view = render(<BuyScreenImpl />);

    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });

    await waitFor(() =>
      expect(
        within(view.getByTestId('confirm-target-modal')).getByText('buy.quoteError.noCode'),
      ).toBeTruthy(),
    );
    expect(view.queryByText('buy.paymentInfo')).toBeNull();
  });

  it('creates payment info once after login proceeds and focus returns', async () => {
    mockUseRealDfxAuthGate = true;
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockImplementation(async () => ({ kind: 'paymentInfo', info: PAYMENT_INFO }));

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });
    expect(view.getByTestId('dfx-auth-gate')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    expect(mockDismissAuthGate).toHaveBeenCalledWith(loginGate);
    expect(mockCancelAuthGate).not.toHaveBeenCalledWith(loginGate);

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.getByText('buy.paymentInfo')).toBeTruthy();
  });

  it('does not create payment info after the login gate is cancelled', async () => {
    mockUseRealDfxAuthGate = true;
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockCancelAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: PAYMENT_INFO });

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-cancel'));
    });
    expect(mockCancelAuthGate).toHaveBeenCalledWith(loginGate);
    expect(mockDismissAuthGate).not.toHaveBeenCalled();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('buy.paymentInfo')).toBeNull();
  });

  it('abandons the gated buy when focus returns without a session', async () => {
    mockUseRealDfxAuthGate = true;
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });
    expect(view.getByTestId('dfx-auth-gate')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    expect(mockDismissAuthGate).toHaveBeenCalledWith(loginGate);

    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });
    expect(view.queryByTestId('dfx-auth-gate')).toBeNull();

    const callsBefore = mockCancelAuthGate.mock.calls.length;
    await act(async () => {
      refocusScreen();
    });
    expect(mockCancelAuthGate.mock.calls.length).toBe(callsBefore + 1);
    expect(mockCancelAuthGate.mock.calls[callsBefore]).toEqual([]);

    mockRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: PAYMENT_INFO });
    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(view.queryByText('buy.paymentInfo')).toBeNull();
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    mockCreatePaymentInfo.mockImplementation(async () => PAYMENT_INFO);
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(2);
    expect(view.getByText('buy.paymentInfo')).toBeTruthy();
  });

  it('does not apply a cancelled payment replay after a later submit starts', async () => {
    mockUseRealDfxAuthGate = true;
    let resolveRetry: (value: { kind: 'paymentInfo'; info: BuyPaymentInfoDto }) => void = () => {};
    const retryPromise = new Promise<{ kind: 'paymentInfo'; info: BuyPaymentInfoDto }>(
      (resolve) => {
        resolveRetry = resolve;
      },
    );
    let resolveSecond: (value: BuyPaymentInfoDto | null) => void = () => {};
    const secondPayment = new Promise<BuyPaymentInfoDto | null>((resolve) => {
      resolveSecond = resolve;
    });
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockCancelAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });
    expect(view.getByTestId('dfx-auth-gate-cancel')).toBeTruthy();

    mockRetryLast.mockReturnValue(retryPromise);
    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });
    expect(mockRetryLast).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-cancel'));
    });
    expect(mockCancelAuthGate).toHaveBeenCalledWith(loginGate);
    view.rerender(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    expect(view.queryByTestId('dfx-auth-gate')).toBeNull();

    mockCreatePaymentInfo.mockReturnValue(secondPayment);
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRetry({ kind: 'paymentInfo', info: PAYMENT_INFO });
      await retryPromise;
    });

    expect(view.queryByText('buy.paymentInfo')).toBeNull();
    expect(view.queryByTestId('dfx-auth-gate')).toBeNull();

    await act(async () => {
      resolveSecond(null);
      await secondPayment;
    });
    expect(view.queryByText('buy.paymentInfo')).toBeNull();
  });

  it('shows a sign-in replay error on the amount step', async () => {
    mockUseRealDfxAuthGate = true;
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockResolvedValue({
      kind: 'paymentInfo',
      info: { isValid: false, error: 'KycRequired' },
    });

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    expect(view.getByTestId('confirm-target-modal')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });

    await waitFor(() => expect(view.queryByTestId('confirm-target-modal')).toBeNull());
    expect(view.getByTestId('dfx-auth-gate')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });

    const message = 'buy.quoteError.KycRequired:{"code":"KycRequired"}';
    await waitFor(() => expect(view.getByText(message)).toBeTruthy());
    expect(view.queryByTestId('confirm-target-modal')).toBeNull();
    expect(view.queryByText('buy.paymentInfo')).toBeNull();
  });

  it('does not replay when an auth gate appears while already signed in', async () => {
    mockIsDfxAuthenticated = true;
    mockRetryLast.mockResolvedValue(null);
    const view = render(<BuyScreenImpl />);

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));

    flowState.authGate = { kind: 'login', message: 'sign in' };
    view.rerender(<BuyScreenImpl />);

    expect(mockRetryLast).toHaveBeenCalledTimes(1);
  });

  it('calls retryLast once for a quote gate after login', async () => {
    mockUseRealDfxAuthGate = true;
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    flowState.authGate = loginGate;
    mockDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockResolvedValue({ kind: 'quote', info: PAYMENT_INFO });

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    expect(mockRetryLast).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    expect(mockDismissAuthGate).toHaveBeenCalledWith(loginGate);

    view.rerender(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    expect(mockRetryLast).not.toHaveBeenCalled();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });

    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
  });

  it('applies only the payment info from the submit that is still current', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    let resolveFirst: (value: null) => void = () => {};
    let resolveSecond: (value: BuyPaymentInfoDto) => void = () => {};
    const first = new Promise<null>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<BuyPaymentInfoDto>((resolve) => {
      resolveSecond = resolve;
    });
    mockCreatePaymentInfo.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const view = render(<BuyScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    // The cancel button is disabled while loading; this drives the handler as defence in depth.
    await act(async () => {
      view.UNSAFE_getByType(ConfirmTargetWalletModal).props.onCancel();
    });
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirst(null);
      await first;
    });
    expect(view.queryByText('buy.quoteError.noCode')).toBeNull();

    await act(async () => {
      resolveSecond(PAYMENT_INFO);
      await second;
    });

    await waitFor(() => expect(view.getByText('buy.paymentInfo')).toBeTruthy());
    expect(view.queryByText('buy.quoteError.noCode')).toBeNull();
  });

  it('does not create payment info while a replay is in flight', async () => {
    mockUseRealDfxAuthGate = true;
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    let resolveRetry: (value: { kind: 'paymentInfo'; info: BuyPaymentInfoDto }) => void = () => {};
    const retryPromise = new Promise<{ kind: 'paymentInfo'; info: BuyPaymentInfoDto }>(
      (resolve) => {
        resolveRetry = resolve;
      },
    );
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = loginGate;
      return null;
    });
    mockDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || flowState.authGate === gate) flowState.authGate = null;
    });
    mockRetryLast.mockReturnValue(retryPromise);

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.queryByTestId('confirm-target-modal')).toBeNull());

    // The layout effect keeps the confirm modal closed while the gate is up.
    // Proceeding hides the gate and leaves the submit lock held.
    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    view.rerender(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    expect(view.queryByTestId('dfx-auth-gate')).toBeNull();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });
    expect(mockRetryLast).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRetry({ kind: 'paymentInfo', info: PAYMENT_INFO });
      await retryPromise;
    });
  });

  it('drops the payment replay when confirm cancel lands during payment info', async () => {
    mockUseRealDfxAuthGate = true;
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    let replayDropped = false;
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
      return { kind: 'paymentInfo', info: PAYMENT_INFO };
    });

    const view = render(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);

    // The cancel button is disabled while loading; this drives the handler.
    await act(async () => {
      view.UNSAFE_getByType(ConfirmTargetWalletModal).props.onCancel();
    });
    expect(mockCancelAuthGate).toHaveBeenCalledTimes(1);
    expect(mockCancelAuthGate.mock.calls[0]).toEqual([]);

    await act(async () => {
      settle401();
      await pending;
    });
    view.rerender(
      <ThemeProvider>
        <BuyScreenImpl />
      </ThemeProvider>,
    );
    expect(view.queryByTestId('dfx-auth-gate')).toBeNull();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <BuyScreenImpl />
        </ThemeProvider>,
      );
    });
    await waitFor(() => expect(mockRetryLast).toHaveBeenCalledTimes(1));
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('buy.paymentInfo')).toBeNull();
  });

  it('releases submit when a login gate closes confirm during reauth', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    let resolveReauth: (value: { ok: true }) => void = () => {};
    const reauthPromise = new Promise<{ ok: true }>((resolve) => {
      resolveReauth = resolve;
    });
    mockReauthAs.mockReturnValue(reauthPromise);
    mockCreatePaymentInfo.mockResolvedValue(PAYMENT_INFO);

    const view = render(<BuyScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    expect(view.getByTestId('confirm-target-modal')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    expect(mockReauthAs).toHaveBeenCalledTimes(1);
    expect(mockCreatePaymentInfo).not.toHaveBeenCalled();

    flowState.authGate = { kind: 'login', message: 'sign in' };
    view.rerender(<BuyScreenImpl />);
    await waitFor(() => expect(view.queryByTestId('confirm-target-modal')).toBeNull());

    await act(async () => {
      resolveReauth({ ok: true });
      await reauthPromise;
    });
    expect(mockCreatePaymentInfo).not.toHaveBeenCalled();

    flowState.authGate = null;
    view.rerender(<BuyScreenImpl />);
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    expect(view.getByTestId('confirm-target-modal')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('discards a linked token and clears link loading when the local session ends', async () => {
    mockUseRealDfxAuthGate = true;
    const request = createDeferred<string>();
    mockDfxAuthService.linkAddress.mockImplementationOnce(() => request.promise);
    flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'Link Bitcoin' };
    const { getByTestId, queryByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByTestId('dfx-auth-gate-primary'));
    await waitFor(() => expect(mockDfxAuthService.linkAddress).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(getByTestId('dfx-auth-gate-primary').props.accessibilityState?.disabled).toBe(true),
    );

    mockAuthState.isAuthenticated = false;
    mockAuthState.sessionEpoch += 1;
    mockDfxAuthService.getAccessToken.mockReturnValue('stale-buy-token');
    request.resolve('stale-buy-token');

    await waitFor(() => expect(mockDfxAuthService.logout).toHaveBeenCalled());
    await waitFor(() =>
      expect(getByTestId('dfx-auth-gate-primary').props.accessibilityState?.disabled).toBe(false),
    );
    expect(mockSecureStorage.remove).not.toHaveBeenCalled();
    expect(mockSecureStorage.set).not.toHaveBeenCalledWith('dfx-auth-token', 'stale-buy-token');
    expect(mockRetryLast).not.toHaveBeenCalled();
    expect(queryByText(LOCAL_SESSION_ENDED_MESSAGE)).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('silently closes the link gate when DFX authentication is invalidated', async () => {
    mockUseRealDfxAuthGate = true;
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockDfxAuthService.linkAddress.mockRejectedValueOnce(invalidated);
    flowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'Link Bitcoin' };
    const { getByTestId, queryByText } = render(<BuyScreenImpl />);

    fireEvent.press(getByTestId('dfx-auth-gate-primary'));

    await waitFor(() => expect(mockDfxAuthService.linkAddress).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockDismissAuthGate).toHaveBeenCalledTimes(1));
    expect(mockCancelAuthGate).toHaveBeenCalledWith(flowState.authGate);
    expect(getByTestId('dfx-auth-gate-primary').props.accessibilityState?.disabled).toBe(false);
    expect(queryByText(invalidated.message)).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('releases the buy submit lock when the link gate is invalidated', async () => {
    mockUseRealDfxAuthGate = true;
    const gate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin',
      message: 'Link Bitcoin',
    };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = gate;
      return null;
    });
    mockDfxAuthService.linkAddress.mockRejectedValue(new DfxAuthFlowInvalidatedError());

    const view = render(<BuyScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });

    await waitFor(() => expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId('dfx-auth-gate-primary')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    await waitFor(() => expect(mockCancelAuthGate).toHaveBeenCalledWith(gate));

    mockCreatePaymentInfo.mockClear();
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });
    await waitFor(() => expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1));
  });

  it('does not replay a buy when the session ends after the linked token is stored', async () => {
    mockUseRealDfxAuthGate = true;
    const gate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin',
      message: 'Link Bitcoin',
    };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = gate;
      return null;
    });
    linkAddressThatEndsSessionAfterPersist('linked-buy-token');

    const view = render(<BuyScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });

    await waitFor(() => expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId('dfx-auth-gate-primary')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });

    await waitFor(() => expect(mockCancelAuthGate).toHaveBeenCalledWith(gate));
    expect(mockSecureStorage.set).toHaveBeenCalledWith('dfx-auth-token', 'linked-buy-token');
    expect(mockMarkChainLinked).not.toHaveBeenCalled();
    expect(mockRetryLast).not.toHaveBeenCalled();
    expect(mockDfxAuthService.logout).toHaveBeenCalled();

    mockCreatePaymentInfo.mockClear();
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });
    await waitFor(() => expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1));
  });

  it('does not replay a buy when the session ends after the linked Lightning token is stored', async () => {
    mockUseRealDfxAuthGate = true;
    mockLdsState.user = LDS_LIGHTNING_USER;
    const gate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin-lightning',
      message: 'Link Lightning',
    };
    mockCreatePaymentInfo.mockImplementation(async () => {
      flowState.authGate = gate;
      return null;
    });
    linkLnurlAddressThatEndsSessionAfterPersist('linked-lnurl-buy-token');

    const view = render(<BuyScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });

    await waitFor(() => expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId('dfx-auth-gate-primary')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });

    await waitFor(() => expect(mockCancelAuthGate).toHaveBeenCalledWith(gate));
    expect(mockDfxAuthService.linkLnurlAddress).toHaveBeenCalledTimes(1);
    expect(mockDfxAuthService.linkAddress).not.toHaveBeenCalled();
    expect(mockSecureStorage.set).toHaveBeenCalledWith('dfx-auth-token', 'linked-lnurl-buy-token');
    expect(mockMarkChainLinked).not.toHaveBeenCalled();
    expect(mockRetryLast).not.toHaveBeenCalled();
    expect(mockDfxAuthService.logout).toHaveBeenCalled();

    mockCreatePaymentInfo.mockClear();
    await act(async () => {
      fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    });
    await waitFor(() => expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1));
  });

  it('closes buy confirmation without an error when reauth is cancelled', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    mockReauthAs
      .mockResolvedValueOnce({ ok: false, cancelled: true })
      .mockResolvedValueOnce({ ok: true, token: 't' });
    mockCreatePaymentInfo.mockResolvedValue(PAYMENT_INFO);

    const view = render(<BuyScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    expect(view.getByTestId('confirm-target-modal')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    await waitFor(() => expect(view.queryByTestId('confirm-target-modal')).toBeNull());
    expect(view.queryByText(/linkedWallet\.reauthError/)).toBeNull();

    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));
    expect(view.getByTestId('confirm-target-modal')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    await waitFor(() => expect(mockCreatePaymentInfo).toHaveBeenCalledTimes(1));
  });

  it('closes buy confirmation without an error when reauth throws a session error', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockReauthAs.mockRejectedValueOnce(invalidated);

    const view = render(<BuyScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '100');
    fireEvent.press(view.getByText('buy.cta:{"asset":"BTC"}'));

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    await waitFor(() => expect(view.queryByTestId('confirm-target-modal')).toBeNull());
    expect(view.queryByText(invalidated.message)).toBeNull();
  });
});

describe('SellScreenImpl', () => {
  it('uses on-primary for the active currency and CTA icon in dark mode', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <SellScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(getByText('BTC'));

    const activeCurrencyColor = StyleSheet.flatten(
      within(getByTestId('sell-currency-CHF')).getByText('CHF').props.style,
    ).color;
    const inactiveCurrencyColor = StyleSheet.flatten(
      within(getByTestId('sell-currency-EUR')).getByText('EUR').props.style,
    ).color;
    const iconColor = StyleSheet.flatten(getByTestId('mock-icon-arrow-right').props.style).color;
    expect(activeCurrencyColor).toBe(darkColors.onPrimary);
    expect(activeCurrencyColor).not.toBe(darkColors.white);
    expect(inactiveCurrencyColor).not.toBe(activeCurrencyColor);
    expect(inactiveCurrencyColor).not.toBe(darkColors.onPrimary);
    expect(iconColor).toBe(darkColors.onPrimary);
    expect(iconColor).not.toBe(darkColors.white);
  });

  it('keeps a newer auth gate visible after the linked-chain retry', async () => {
    mockUseRealDfxAuthGate = true;
    const linkGate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin',
      message: 'link Bitcoin',
    };
    const registrationGate: DfxAuthGateState = {
      kind: 'registration',
      message: 'register first',
    };
    mockSellFlowState.authGate = linkGate;
    mockSellDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || mockSellFlowState.authGate === gate) {
        mockSellFlowState.authGate = null;
      }
    });
    mockSellRetryLast.mockImplementationOnce(async () => {
      mockSellFlowState.authGate = registrationGate;
      return null;
    });

    const view = render(
      <ThemeProvider>
        <SellScreenImpl />
      </ThemeProvider>,
    );

    fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    await waitFor(() => expect(mockSellDismissAuthGate).toHaveBeenCalledWith(linkGate));

    view.rerender(
      <ThemeProvider>
        <SellScreenImpl />
      </ThemeProvider>,
    );
    expect(view.getByText('dfxAuthGate.registration.title:{"chain":""}')).toBeTruthy();
  });

  it('does not report an unexpected payment retry error as a link failure', async () => {
    mockUseRealDfxAuthGate = true;
    const linkGate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin',
      message: 'link Bitcoin',
    };
    mockSellFlowState.authGate = linkGate;
    mockSellDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || mockSellFlowState.authGate === gate) {
        mockSellFlowState.authGate = null;
      }
    });
    mockSellRetryLast.mockRejectedValueOnce(new Error('sell retry exploded'));

    const view = render(
      <ThemeProvider>
        <SellScreenImpl />
      </ThemeProvider>,
    );

    fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    await waitFor(() => expect(mockSellDismissAuthGate).toHaveBeenCalledWith(linkGate));
    view.rerender(
      <ThemeProvider>
        <SellScreenImpl />
      </ThemeProvider>,
    );
    expect(view.queryByTestId('dfx-auth-gate')).toBeNull();
    expect(view.queryByText('sell retry exploded')).toBeNull();
  });

  it('creates payment info once after login proceeds and focus returns', async () => {
    mockUseRealDfxAuthGate = true;
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    mockSellCreatePaymentInfo.mockImplementation(async () => {
      mockSellFlowState.authGate = loginGate;
      return null;
    });
    mockSellDismissAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || mockSellFlowState.authGate === gate) {
        mockSellFlowState.authGate = null;
      }
    });
    mockSellRetryLast.mockImplementation(async () => ({
      kind: 'paymentInfo',
      info: SELL_PAYMENT_INFO,
    }));

    const view = render(
      <ThemeProvider>
        <SellScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.01');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    expect(view.getByTestId('dfx-auth-gate')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });
    expect(mockSellDismissAuthGate).toHaveBeenCalledWith(loginGate);
    expect(mockSellCancelAuthGate).not.toHaveBeenCalledWith(loginGate);

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <SellScreenImpl />
        </ThemeProvider>,
      );
    });

    await waitFor(() => expect(mockSellRetryLast).toHaveBeenCalledTimes(1));
    expect(mockSellCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.getByText('sell.confirmSale')).toBeTruthy();
  });

  it('does not create payment info after the login gate is cancelled', async () => {
    mockUseRealDfxAuthGate = true;
    const loginGate: DfxAuthGateState = { kind: 'login', message: 'sign in' };
    mockSellCreatePaymentInfo.mockImplementation(async () => {
      mockSellFlowState.authGate = loginGate;
      return null;
    });
    mockSellCancelAuthGate.mockImplementation((gate?: DfxAuthGateState) => {
      if (gate === undefined || mockSellFlowState.authGate === gate) {
        mockSellFlowState.authGate = null;
      }
    });
    mockSellRetryLast.mockResolvedValue({ kind: 'paymentInfo', info: SELL_PAYMENT_INFO });

    const view = render(
      <ThemeProvider>
        <SellScreenImpl />
      </ThemeProvider>,
    );
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.01');
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
    expect(mockSellCancelAuthGate).toHaveBeenCalledWith(loginGate);
    expect(mockSellDismissAuthGate).not.toHaveBeenCalled();

    mockIsDfxAuthenticated = true;
    await act(async () => {
      view.rerender(
        <ThemeProvider>
          <SellScreenImpl />
        </ThemeProvider>,
      );
    });

    await waitFor(() => expect(mockSellRetryLast).toHaveBeenCalledTimes(1));
    expect(mockSellCreatePaymentInfo).toHaveBeenCalledTimes(1);
    expect(view.queryByText('sell.confirmSale')).toBeNull();
  });

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

  it('discards a linked token and clears link loading when the local session ends', async () => {
    mockUseRealDfxAuthGate = true;
    const request = createDeferred<string>();
    mockDfxAuthService.linkAddress.mockImplementationOnce(() => request.promise);
    mockSellFlowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'Link Bitcoin' };
    const { getByTestId, queryByText } = render(<SellScreenImpl />);

    fireEvent.press(getByTestId('dfx-auth-gate-primary'));
    await waitFor(() => expect(mockDfxAuthService.linkAddress).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(getByTestId('dfx-auth-gate-primary').props.accessibilityState?.disabled).toBe(true),
    );

    mockAuthState.isAuthenticated = false;
    mockAuthState.sessionEpoch += 1;
    mockDfxAuthService.getAccessToken.mockReturnValue('stale-sell-token');
    request.resolve('stale-sell-token');

    await waitFor(() => expect(mockDfxAuthService.logout).toHaveBeenCalled());
    await waitFor(() =>
      expect(getByTestId('dfx-auth-gate-primary').props.accessibilityState?.disabled).toBe(false),
    );
    expect(mockSecureStorage.remove).not.toHaveBeenCalled();
    expect(mockSecureStorage.set).not.toHaveBeenCalledWith('dfx-auth-token', 'stale-sell-token');
    expect(mockSellRetryLast).not.toHaveBeenCalled();
    expect(queryByText(LOCAL_SESSION_ENDED_MESSAGE)).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('silently closes the link gate when DFX authentication is invalidated', async () => {
    mockUseRealDfxAuthGate = true;
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockDfxAuthService.linkAddress.mockRejectedValueOnce(invalidated);
    mockSellFlowState.authGate = { kind: 'linkChain', chain: 'bitcoin', message: 'Link Bitcoin' };
    const { getByTestId, queryByText } = render(<SellScreenImpl />);

    fireEvent.press(getByTestId('dfx-auth-gate-primary'));

    await waitFor(() => expect(mockDfxAuthService.linkAddress).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSellDismissAuthGate).toHaveBeenCalledTimes(1));
    expect(mockSellCancelAuthGate).toHaveBeenCalledWith(mockSellFlowState.authGate);
    expect(getByTestId('dfx-auth-gate-primary').props.accessibilityState?.disabled).toBe(false);
    expect(queryByText(invalidated.message)).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('does not replay a sell when the session ends after the linked token is stored', async () => {
    mockUseRealDfxAuthGate = true;
    const gate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin',
      message: 'Link Bitcoin',
    };
    mockSellCreatePaymentInfo.mockImplementation(async () => {
      mockSellFlowState.authGate = gate;
      return null;
    });
    linkAddressThatEndsSessionAfterPersist('linked-sell-token');

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.01');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });

    await waitFor(() => expect(mockSellCreatePaymentInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId('dfx-auth-gate-primary')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });

    await waitFor(() => expect(mockSellCancelAuthGate).toHaveBeenCalledWith(gate));
    expect(mockSecureStorage.set).toHaveBeenCalledWith('dfx-auth-token', 'linked-sell-token');
    expect(mockMarkChainLinked).not.toHaveBeenCalled();
    expect(mockSellRetryLast).not.toHaveBeenCalled();
    expect(mockDfxAuthService.logout).toHaveBeenCalled();

    mockSellCreatePaymentInfo.mockClear();
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    await waitFor(() => expect(mockSellCreatePaymentInfo).toHaveBeenCalledTimes(1));
  });

  it('does not replay a sell when the session ends after the linked Lightning token is stored', async () => {
    mockUseRealDfxAuthGate = true;
    mockLdsState.user = LDS_LIGHTNING_USER;
    const gate: DfxAuthGateState = {
      kind: 'linkChain',
      chain: 'bitcoin-lightning',
      message: 'Link Lightning',
    };
    mockSellCreatePaymentInfo.mockImplementation(async () => {
      mockSellFlowState.authGate = gate;
      return null;
    });
    linkLnurlAddressThatEndsSessionAfterPersist('linked-lnurl-sell-token');

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.01');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    fireEvent.changeText(
      view.getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH9300762011623852957',
    );
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });

    await waitFor(() => expect(mockSellCreatePaymentInfo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByTestId('dfx-auth-gate-primary')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));
    });

    await waitFor(() => expect(mockSellCancelAuthGate).toHaveBeenCalledWith(gate));
    expect(mockDfxAuthService.linkLnurlAddress).toHaveBeenCalledTimes(1);
    expect(mockDfxAuthService.linkAddress).not.toHaveBeenCalled();
    expect(mockSecureStorage.set).toHaveBeenCalledWith('dfx-auth-token', 'linked-lnurl-sell-token');
    expect(mockMarkChainLinked).not.toHaveBeenCalled();
    expect(mockSellRetryLast).not.toHaveBeenCalled();
    expect(mockDfxAuthService.logout).toHaveBeenCalled();

    mockSellCreatePaymentInfo.mockClear();
    await act(async () => {
      fireEvent.press(view.getByText('common.continue'));
    });
    await waitFor(() => expect(mockSellCreatePaymentInfo).toHaveBeenCalledTimes(1));
  });

  it('closes sell confirmation without an error when reauth is cancelled', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    mockReauthAs.mockResolvedValueOnce({ ok: false, cancelled: true });

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.01');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));
    expect(view.getByTestId('confirm-target-modal')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    await waitFor(() => expect(view.queryByTestId('confirm-target-modal')).toBeNull());
    expect(view.queryByText(/linkedWallet\.reauthError/)).toBeNull();
  });

  it('closes sell confirmation without an error when reauth throws a session error', async () => {
    mockSearchParams = {
      targetAddress: 'bc1qtargetwalletxxxx',
      targetBlockchain: 'Bitcoin',
    };
    mockReauthAs.mockRejectedValueOnce(new Error(LOCAL_SESSION_ENDED_MESSAGE));

    const view = render(<SellScreenImpl />);
    fireEvent.press(view.getByText('BTC'));
    fireEvent.changeText(view.getByPlaceholderText('0.00'), '0.01');
    fireEvent.press(view.getByText('sell.cta:{"asset":"BTC"}'));

    await act(async () => {
      fireEvent.press(view.getByTestId('confirm-target-confirm'));
    });
    await waitFor(() => expect(view.queryByTestId('confirm-target-modal')).toBeNull());
    expect(view.queryByText(LOCAL_SESSION_ENDED_MESSAGE)).toBeNull();
  });
});
