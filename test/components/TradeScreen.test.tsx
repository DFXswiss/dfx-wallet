// TradeScreen is the container that holds `mode` state and renders one
// `TradeScreenShell` + `TradeModeTabs` + exactly one adapter (Buy/Sell/
// Swap) — see AUFTRAG "Soll (Option A)". These tests cover what only the
// assembled container can prove: tab switches are pure state (no
// navigation), the inactive adapter is unmounted, the shell stays the same
// instance across a switch, and a deep-link's target-wallet params never
// leak into a mode the screen didn't start on.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? (key[0] ?? '') : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useFocusEffect: (callback: () => void | (() => void)) => callback(),
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => true,
  }),
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
  useBalancesForWallet: () => ({ data: [] }),
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
  secureStorage: { set: jest.fn(), remove: jest.fn() },
  StorageKeys: { DFX_AUTH_TOKEN: 'dfx-auth-token', DFX_LINKED_CHAINS: 'dfx-linked-chains' },
}));
jest.mock('@/store', () => ({
  useAuthStore: (selector: (state: { isDfxAuthenticated: boolean }) => unknown) =>
    selector({ isDfxAuthenticated: false }),
}));
jest.mock('@/config/tokens', () => ({
  WDK_SUPPORTED_CHAINS: ['bitcoin', 'ethereum'],
  getAssets: () => [],
  getAssetMeta: (id: string) => ({ symbol: id }),
}));
jest.mock('@/theme', () => ({
  Typography: {
    bodySmall: {},
    bodyMedium: {},
    bodyLarge: {},
    headlineSmall: {},
    headlineMedium: {},
  },
  useColors: () => ({
    background: '#fff',
    border: '#ddd',
    borderLight: '#eee',
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
    warning: '#c60',
    error: '#c00',
    white: '#fff',
  }),
  useResolvedScheme: () => 'light',
}));
jest.mock('@/components', () => ({
  ConfirmTargetWalletModal: ({ visible }: { visible: boolean }) => {
    if (!visible) return null;
    const ReactActual = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return ReactActual.createElement(Text, { testID: 'confirm-target-wallet-modal' }, 'open');
  },
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
      { accessibilityRole: 'button', disabled: disabled || loading, onPress, testID },
      ReactActual.createElement(Text, null, title),
    );
  },
}));
// `TradeScreenShell` imports `AppHeader`/`Icon`/`DarkBackdrop` directly from
// their own files, not the `@/components` barrel above — only `Icon` needs
// a stand-in (`AppHeader`/`DarkBackdrop` are cheap enough to run for real).
jest.mock('../../src/components/Icon', () => {
  const ReactActual = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, Icon: () => ReactActual.createElement(Text, null, 'icon') };
});
jest.mock('../../src/features/buy-sell/AssetGlyph', () => ({
  AssetGlyph: () => null,
}));
jest.mock('../../src/features/buy-sell/CurrencyGlyph', () => ({
  CurrencyGlyph: () => null,
}));

// A mutable state object + a stable `createPaymentInfo` (not re-created per
// render) so a single test can arrange a valid quote / a resolved call
// regardless of how many times `BuyTradeAdapter` re-renders before the user
// presses CTA.
const mockBuyCreatePaymentInfo = jest.fn();
// Full fixture (matches BuyTradeAdapterSteps.test.tsx's PAYMENT_INFO) — once
// `step` reaches 'payment', BuyTradeAdapter's payment-step JSX reads
// `paymentInfo.currency.name`/`.asset.name`/etc. straight off this object,
// so a partial fixture (e.g. just `{ isValid, fees }`) crashes there.
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
const buyFlowState = {
  paymentInfo: null as Record<string, unknown> | null,
  quoteKey: null as string | null,
};
const mockUseBuyFlow = jest.fn(() => ({
  paymentInfo: buyFlowState.paymentInfo,
  quoteKey: buyFlowState.quoteKey,
  errorKey: null,
  actionErrorKey: null,
  isLoading: false,
  error: null,
  authGate: null,
  getQuote: jest.fn(),
  createPaymentInfo: mockBuyCreatePaymentInfo,
  confirmPayment: jest.fn(),
  dismissAuthGate: jest.fn(),
  retryLast: jest.fn(),
}));
jest.mock('../../src/features/buy-sell/useBuyFlow', () => ({
  useBuyFlow: () => mockUseBuyFlow(),
}));

const mockUseSellFlow = jest.fn(() => ({
  paymentInfo: null,
  quoteKey: null,
  errorKey: null,
  actionErrorKey: null,
  isLoading: false,
  error: null,
  authGate: null,
  getQuote: jest.fn(),
  createPaymentInfo: jest.fn(),
  confirmSell: jest.fn(),
  dismissAuthGate: jest.fn(),
  retryLast: jest.fn(),
}));
jest.mock('../../src/features/buy-sell/useSellFlow', () => ({
  useSellFlow: () => mockUseSellFlow(),
}));

// eslint-disable-next-line import/first
import TradeScreen from '../../src/features/buy-sell/TradeScreen';

beforeEach(() => {
  mockBack.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockUseBuyFlow.mockClear();
  mockUseSellFlow.mockClear();
  mockBuyCreatePaymentInfo.mockReset();
  buyFlowState.paymentInfo = null;
  buyFlowState.quoteKey = null;
});

describe('TradeScreen', () => {
  it('switches Buy → Sell → Swap without navigating, keeping the same shell instance', () => {
    const { getByTestId, queryByTestId } = render(<TradeScreen initialMode="buy" />);

    expect(getByTestId('buy-screen')).toBeTruthy();
    expect(getByTestId('buy-cta')).toBeTruthy();
    const shellBackground = getByTestId('buy-screen-background');

    fireEvent.press(getByTestId('trade-tab-sell'));
    expect(getByTestId('sell-screen')).toBeTruthy();
    expect(getByTestId('sell-cta')).toBeTruthy();
    expect(queryByTestId('buy-cta')).toBeNull();
    // Same shell element (single call site in TradeScreen) — the background
    // wrapper is the same node, only its testID value changed with the mode.
    expect(getByTestId('sell-screen-background')).toBe(shellBackground);

    fireEvent.press(getByTestId('trade-tab-swap'));
    expect(getByTestId('swap-header')).toBeTruthy();
    expect(getByTestId('swap-cta')).toBeTruthy();
    expect(queryByTestId('sell-cta')).toBeNull();
    expect(getByTestId('swap-header-background')).toBe(shellBackground);

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('unmounts the inactive adapter — useSellFlow is never called while Buy is active', () => {
    render(<TradeScreen initialMode="buy" />);

    expect(mockUseBuyFlow).toHaveBeenCalled();
    expect(mockUseSellFlow).not.toHaveBeenCalled();
  });

  it('mounts the newly active adapter and stops calling the previous one on a tab switch', () => {
    const { getByTestId } = render(<TradeScreen initialMode="buy" />);
    mockUseBuyFlow.mockClear();

    fireEvent.press(getByTestId('trade-tab-sell'));

    expect(mockUseSellFlow).toHaveBeenCalled();
    // Buy unmounted — no further renders call its flow hook again after the
    // switch (the one call recorded before `mockClear()` is discarded).
    expect(mockUseBuyFlow).not.toHaveBeenCalled();
  });

  it('does not leak a deep-linked target wallet into a mode switched to from Sell', () => {
    const { getByTestId, queryByTestId } = render(
      <TradeScreen
        initialMode="sell"
        targetAddress="0x1234567890123456789012345678901234567890"
        targetBlockchain="Ethereum"
      />,
    );
    expect(getByTestId('sell-target-wallet-banner')).toBeTruthy();

    fireEvent.press(getByTestId('trade-tab-buy'));

    expect(queryByTestId('buy-target-wallet-banner')).toBeNull();
    fireEvent.changeText(getByTestId('buy-pay-amount'), '100');
    fireEvent.press(getByTestId('buy-cta'));
    expect(queryByTestId('confirm-target-wallet-modal')).toBeNull();
  });

  // Mirror of the test above: the leaked-params guard is a per-adapter
  // check (`initialMode === '<mode>' ? initialModeProps : {}`), one branch
  // per adapter — this one only exercises the Sell branch. Without it, a
  // mutation that drops the Sell branch's own `initialMode === 'sell'`
  // check (e.g. always spreading `initialModeProps` onto `SellTradeAdapter`)
  // stays green, because every other params-leak test here starts on Sell
  // or Buy, never *switches into* Sell from a different `initialMode`.
  it('does not leak a deep-linked target wallet into a mode switched to from Buy', () => {
    const { getByTestId, queryByTestId } = render(
      <TradeScreen
        initialMode="buy"
        targetAddress="0x1234567890123456789012345678901234567890"
        targetBlockchain="Ethereum"
      />,
    );
    expect(getByTestId('buy-target-wallet-banner')).toBeTruthy();

    fireEvent.press(getByTestId('trade-tab-sell'));

    expect(queryByTestId('sell-target-wallet-banner')).toBeNull();
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');
    fireEvent.press(getByTestId('sell-cta'));
    expect(queryByTestId('confirm-target-wallet-modal')).toBeNull();
  });

  it('shows the target-wallet banner when the screen opens directly in that mode', () => {
    const { getByTestId } = render(
      <TradeScreen
        initialMode="buy"
        targetAddress="0x1234567890123456789012345678901234567890"
        targetBlockchain="Ethereum"
      />,
    );

    expect(getByTestId('buy-target-wallet-banner')).toBeTruthy();
  });

  it('hides the tab bar once Buy leaves the amount step (no mid-payment unmount)', async () => {
    // Matches the quote key `makeTradeQuoteKey` derives from the default
    // selection (BTC/Bitcoin/bitcoin) plus the amount typed below, so the
    // CTA is enabled (`hasQuote`) and the press actually calls through. A
    // full fixture is required, not just `{ isValid, fees }` — once `step`
    // advances to 'payment', the adapter renders `paymentInfo.currency.name`
    // etc. straight off this same object.
    buyFlowState.paymentInfo = PAYMENT_INFO;
    buyFlowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';
    mockBuyCreatePaymentInfo.mockResolvedValueOnce({ id: 1 });
    const { getByTestId, queryByTestId } = render(<TradeScreen initialMode="buy" />);

    expect(getByTestId('trade-mode-tabs')).toBeTruthy();

    fireEvent.changeText(getByTestId('buy-pay-amount'), '100');
    await act(async () => {
      fireEvent.press(getByTestId('buy-cta'));
    });

    expect(mockBuyCreatePaymentInfo).toHaveBeenCalled();
    expect(queryByTestId('trade-mode-tabs')).toBeNull();
  });

  it('does not loop: mounting settles after a small, bounded number of renders', () => {
    render(<TradeScreen initialMode="buy" />);

    // One render for the mount, at most one more for the shell-report
    // effect's first (equal-to-default) call. An update loop would blow this
    // well past a handful of calls — or make `render()` itself throw
    // ("Maximum update depth exceeded") before this assertion ever runs.
    expect(mockUseBuyFlow.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
