import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0]! : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useFocusEffect: (callback: () => void | (() => void)) => callback(),
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: mockReplace }),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: () => ({
    address: 'bc1q-wallet-address',
    sign: jest.fn().mockResolvedValue({ success: true, signature: 'signed-message' }),
  }),
  useBalancesForWallet: () => ({
    data: [{ assetId: 'BTC', success: true, balance: '1' }],
  }),
}));

jest.mock('@/hooks', () => ({ useLdsWallet: () => ({ user: null, signIn: jest.fn() }) }));
jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({ enabledChains: ['bitcoin'] }),
}));
jest.mock('@/features/linked-wallets/useLinkedWalletReauth', () => ({
  useLinkedWalletReauth: () => ({ reauthAs: jest.fn() }),
}));
jest.mock('@/features/dfx-backend/DfxAuthGate', () => ({ DfxAuthGate: () => null }));
jest.mock('@/hooks/useDfxAutoLink', () => ({ markChainLinkedInAutoLinkCache: jest.fn() }));
jest.mock('@/features/dfx-backend/services', () => ({
  dfxAuthService: { linkAddress: jest.fn(), loginAsAddressOwner: jest.fn() },
  DfxApiError: class DfxApiError extends Error {
    statusCode = 409;
  },
}));
jest.mock('@/services/storage', () => ({
  secureStorage: { set: jest.fn(), remove: jest.fn() },
  StorageKeys: { DFX_AUTH_TOKEN: 'dfx-auth-token', DFX_LINKED_CHAINS: 'dfx-linked-chains' },
}));
jest.mock('@/store', () => ({
  useAuthStore: (selector: (state: { isDfxAuthenticated: boolean }) => unknown) =>
    selector({ isDfxAuthenticated: false }),
}));
jest.mock('@/config/tokens', () => ({
  WDK_SUPPORTED_CHAINS: ['bitcoin'],
  getAssets: () => [
    {
      getNetwork: () => 'bitcoin',
      getId: () => 'BTC',
      getDecimals: () => 8,
    },
  ],
  getAssetMeta: (id: string) => ({ symbol: id }),
}));
jest.mock('@/theme', () => ({
  Typography: { bodySmall: { fontSize: 12 } },
  useColors: () => ({
    background: '#fff',
    border: '#ddd',
    card: '#f8f8f8',
    cardOverlay: '#fff',
    divider: '#ddd',
    primary: '#06f',
    primaryLight: '#def',
    surface: '#fff',
    surfaceLight: '#f2f2f2',
    success: '#16a34a',
    text: '#111',
    textSecondary: '#555',
    textTertiary: '#888',
    white: '#fff',
  }),
  useResolvedScheme: () => 'light',
}));
jest.mock('@/components', () => ({
  AppHeader: ({ title, testID }: { title?: string; testID?: string }) => {
    const ReactActual = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return ReactActual.createElement(Text, { testID }, title);
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
    testID,
  }: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
  }) => {
    const ReactActual = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    return ReactActual.createElement(
      Pressable,
      { accessibilityRole: 'button', disabled, onPress, testID },
      ReactActual.createElement(Text, null, title),
    );
  },
}));
jest.mock('../../src/features/buy-sell/TradeModeTabs', () => () => null);
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
const mockConfirmSell = jest.fn();
const flowState = {
  isLoading: false,
  error: null as string | null,
  authGate: null as { kind: string; message: string } | null,
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
    confirmSell: mockConfirmSell,
    dismissAuthGate: jest.fn(),
    retryLast: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import SellScreenImpl from '../../src/features/buy-sell/SellScreenImpl';

const PAYMENT_INFO = {
  id: 123,
  isValid: true,
  amount: 1,
  estimatedAmount: 25000,
  exchangeRate: 25000,
  rate: 0.00004,
  minVolume: 0.001,
  maxVolume: 10,
  currency: { name: 'CHF' },
  asset: { name: 'BTC' },
  fees: { rate: 0.01, dfx: 9, bank: 9, network: 9, fixed: 0, total: 27 },
  feesTarget: { rate: 0.02, dfx: 2, bank: 0, network: 0, fixed: 0, total: 2 },
};

beforeEach(() => {
  mockReplace.mockReset();
  mockGetQuote.mockReset();
  mockCreatePaymentInfo.mockReset();
  mockConfirmSell.mockReset();
  flowState.isLoading = false;
  flowState.error = null;
  flowState.authGate = null;
  flowState.paymentInfo = null;
  flowState.quoteKey = null;
  flowState.errorKey = null;
  flowState.actionErrorKey = null;
});

describe('SellScreenImpl', () => {
  it('renders empty amount, fees, disabled CTA, and security shell without a selection', () => {
    const { getByTestId } = render(<SellScreenImpl />);

    expect(getByTestId('sell-amount-panels-empty')).toBeTruthy();
    expect(getByTestId('sell-fees-panel')).toBeTruthy();
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('sell-security-row')).toBeTruthy();
  });

  it('renders feesTarget rows after selecting an asset and entering an amount', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getAllByText, getByTestId } = render(<SellScreenImpl />);

    act(() => {
      fireEvent.press(getAllByText('BTC')[0]!);
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');
    const panel = getByTestId('sell-fees-panel');
    fireEvent.press(within(panel).getByRole('button'));
    expect(within(panel).getByText('common.free')).toBeTruthy();
    expect(within(panel).getByText('common.included')).toBeTruthy();
    expect(within(panel).getAllByText('−2.00 CHF')).toHaveLength(2);
  });

  it('prefers a concrete errors entry over the continue hint', () => {
    flowState.paymentInfo = { isValid: false, errors: ['AmountTooLow'] };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getAllByText, getByTestId, getByText } = render(<SellScreenImpl />);

    act(() => {
      fireEvent.press(getAllByText('BTC')[0]!);
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');
    const panel = getByTestId('sell-fees-panel');
    fireEvent.press(within(panel).getByRole('button'));

    expect(getByText(/sell\.quoteError\.AmountTooLow/)).toBeTruthy();
    expect(within(panel).queryByText('sell.continueHint')).toBeNull();
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('allows an account gate to continue without a valid quote', () => {
    flowState.paymentInfo = { isValid: false, error: 'KycRequired' };
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getAllByText, getByTestId } = render(<SellScreenImpl />);

    act(() => {
      fireEvent.press(getAllByText('BTC')[0]!);
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');

    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(false);
  });

  it('shows a current generic quote error and hides it after the amount changes', () => {
    flowState.paymentInfo = null;
    flowState.error = 'network failed';
    flowState.errorKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getAllByText, getByTestId, getByText, queryByText } = render(<SellScreenImpl />);

    act(() => {
      fireEvent.press(getAllByText('BTC')[0]!);
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');
    fireEvent.press(within(getByTestId('sell-fees-panel')).getByRole('button'));

    expect(getByText('network failed')).toBeTruthy();
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(getByTestId('sell-pay-amount'), '2');
    expect(queryByText('network failed')).toBeNull();
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('does not reopen an old auth gate after the quote inputs change', () => {
    flowState.authGate = { kind: 'login', message: 'sign in' };
    flowState.errorKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getAllByText, getByTestId } = render(<SellScreenImpl />);

    act(() => {
      fireEvent.press(getAllByText('BTC')[0]!);
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '2');

    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('hides stale receive and fee values and disables CTA while loading', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.isLoading = true;
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getAllByText, getByTestId } = render(<SellScreenImpl />);

    act(() => {
      fireEvent.press(getAllByText('BTC')[0]!);
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');

    expect(getByTestId('sell-receive-amount').props.value).toBe('');
    expect(within(getByTestId('sell-fees-panel')).getAllByText('—')).toHaveLength(2);
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('invalidates the previous quote immediately when payout currency changes', () => {
    flowState.paymentInfo = PAYMENT_INFO;
    flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
    const { getAllByText, getByTestId } = render(<SellScreenImpl />);

    act(() => {
      fireEvent.press(getAllByText('BTC')[0]!);
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');
    expect(getByTestId('sell-receive-amount').props.value).not.toBe('');

    fireEvent.press(getByTestId('sell-receive-currency-pill'));

    expect(getByTestId('sell-receive-amount').props.value).toBe('');
    expect(within(getByTestId('sell-fees-panel')).getAllByText('—')).toHaveLength(2);
    expect(getByTestId('sell-cta').props.accessibilityState.disabled).toBe(true);
  });
});
