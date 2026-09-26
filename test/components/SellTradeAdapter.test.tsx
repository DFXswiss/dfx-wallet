import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { GlassCard } from '../../src/components/GlassCard';

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
  useFocusEffect: (callback: () => void | (() => void)) => callback(),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: mockReplace }),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

let mockBalanceResults = [
  { assetId: 'BTC', success: true, balance: '1' },
  { assetId: 'USDC', success: true, balance: '1' },
];

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: () => ({
    address: 'bc1q-wallet-address',
    sign: jest.fn().mockResolvedValue({ success: true, signature: 'signed-message' }),
  }),
  useBalancesForWallet: () => ({ data: mockBalanceResults }),
}));

jest.mock('@/hooks', () => ({ useLdsWallet: () => ({ user: null, signIn: jest.fn() }) }));
jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({ enabledChains: ['bitcoin', 'ethereum'] }),
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
  WDK_SUPPORTED_CHAINS: ['bitcoin', 'ethereum'],
  getAssets: () => [
    {
      getNetwork: () => 'bitcoin',
      getId: () => 'BTC',
      getDecimals: () => 8,
    },
    {
      getNetwork: () => 'ethereum',
      getId: () => 'USDT',
      getDecimals: () => 6,
    },
    {
      getNetwork: () => 'ethereum',
      getId: () => 'USDC',
      getDecimals: () => 6,
    },
  ],
  getAssetMeta: (id: string) => ({ symbol: id }),
}));
// The Sell flow now renders Glass modules for real (`GlassCard`,
// `GlassInputField`, `GlassListGroup`, …) — they need the actual theme
// tokens (`Card`, `Radius`, `useGlassRecipe`, …) instead of a hand-picked
// color subset.
jest.mock('@/theme', () => ({
  ...jest.requireActual('@/theme'),
}));
jest.mock('@/components', () => ({
  AppHeader: ({ title, testID }: { title?: string; testID?: string }) => {
    const ReactActual = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return ReactActual.createElement(Text, { testID }, title);
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
import { SellTradeAdapter } from '../../src/features/buy-sell/SellTradeAdapter';

const mockOnShellChange = jest.fn();
const renderAdapter = () => render(<SellTradeAdapter onShellChange={mockOnShellChange} />);

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

beforeEach(() => {
  mockReplace.mockReset();
  mockGetQuote.mockReset();
  mockCreatePaymentInfo.mockReset();
  mockConfirmSell.mockReset();
  mockOnShellChange.mockReset();
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

describe('SellTradeAdapter', () => {
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
