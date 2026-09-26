// Characterization tests for the steps AFTER the amount step (bank,
// confirm) and for the linkChain recovery flow. SellTradeAdapter.test.tsx
// only covers the amount step; these tests pin today's behavior across the
// buy/sell/swap module unification (see AUFTRAG).
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  formatCryptoAmount as fmtCrypto,
  formatFiat as fmtFiat,
} from '../../src/config/portfolio-presentation';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? (key[0] ?? '') : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => callback(),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

const mockSign = jest.fn().mockResolvedValue({ success: true, signature: 'signed-message' });
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: () => ({
    address: 'bc1q-wallet-address',
    sign: mockSign,
  }),
  useBalancesForWallet: () => ({
    data: [
      { assetId: 'BTC', success: true, balance: '1' },
      { assetId: 'USDC', success: true, balance: '1' },
    ],
  }),
}));

jest.mock('@/hooks', () => ({ useLdsWallet: () => ({ user: null, signIn: jest.fn() }) }));
jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({ enabledChains: ['bitcoin', 'ethereum'] }),
}));
jest.mock('@/features/linked-wallets/useLinkedWalletReauth', () => ({
  useLinkedWalletReauth: () => ({ reauthAs: jest.fn() }),
}));

// Captures the onLinkChain callback the screen wires into DfxAuthGate so the
// tests can invoke the screen's own linkChainToDfx directly, the same way
// the real DfxAuthGate does after the user taps its primary CTA.
let capturedOnLinkChain: ((chain: string) => Promise<void>) | null = null;
jest.mock('@/features/dfx-backend/DfxAuthGate', () => ({
  DfxAuthGate: ({ onLinkChain }: { onLinkChain?: (chain: string) => Promise<void> }) => {
    capturedOnLinkChain = onLinkChain ?? null;
    return null;
  },
}));

const mockMarkChainLinked = jest.fn();
jest.mock('@/hooks/useDfxAutoLink', () => ({
  markChainLinkedInAutoLinkCache: (...args: unknown[]) => mockMarkChainLinked(...args),
}));

const mockLinkAddress = jest.fn();
const mockLoginAsAddressOwner = jest.fn();
// The class is defined INLINE in the factory (not as an outer variable) to
// avoid a TDZ ReferenceError: jest.mock factories run during the hoisted
// import-resolution pass, before a same-file `class`/`const` declared later
// in source order has executed — even a "mock"-prefixed name doesn't help
// here since this is a direct value read, not a closure over the name.
jest.mock('@/features/dfx-backend/services', () => ({
  dfxAuthService: {
    linkAddress: (...args: unknown[]) => mockLinkAddress(...args),
    loginAsAddressOwner: (...args: unknown[]) => mockLoginAsAddressOwner(...args),
  },
  DfxApiError: class DfxApiError extends Error {
    statusCode: number;
    code: string;

    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.name = 'DfxApiError';
    }
  },
}));

const mockSecureStorageSet = jest.fn();
const mockSecureStorageRemove = jest.fn();
jest.mock('@/services/storage', () => ({
  secureStorage: {
    set: (...args: unknown[]) => mockSecureStorageSet(...args),
    remove: (...args: unknown[]) => mockSecureStorageRemove(...args),
  },
  StorageKeys: { DFX_AUTH_TOKEN: 'dfx-auth-token', DFX_LINKED_CHAINS: 'dfx-linked-chains' },
}));
jest.mock('@/store', () => ({
  useAuthStore: (selector: (state: { isDfxAuthenticated: boolean }) => unknown) =>
    selector({ isDfxAuthenticated: false }),
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
    retryLast: mockRetryLast,
  }),
}));

// eslint-disable-next-line import/first
import { SellTradeAdapter } from '../../src/features/buy-sell/SellTradeAdapter';
// Resolves to the mocked class above (jest intercepts this module path for
// the whole file); imported here so test bodies can construct instances.
// eslint-disable-next-line import/first
import { DfxApiError } from '@/features/dfx-backend/services';

const mockOnShellChange = jest.fn();
const renderAdapter = () => render(<SellTradeAdapter onShellChange={mockOnShellChange} />);

/** Invokes the onBack the adapter most recently reported to the shell — the
 *  shared `TradeScreenShell` (and its rendered back button) now lives in
 *  `TradeScreen`, not in this adapter, so the test drives it the same way
 *  `TradeScreen` would: via the reported shell chrome. */
function pressShellBack() {
  const calls = mockOnShellChange.mock.calls;
  const lastShell = calls[calls.length - 1][0];
  act(() => {
    lastShell.onBack();
  });
}

const PAYMENT_INFO = {
  id: 123,
  isValid: true,
  depositAddress: 'bc1q-deposit-address',
  amount: 1,
  estimatedAmount: 25000,
  exchangeRate: 25000,
  rate: 0.00004,
  minVolume: 0.001,
  maxVolume: 10,
  currency: { name: 'CHF' },
  asset: { name: 'BTC' },
  beneficiary: { iban: 'CH9300762011623852957' },
  fees: { rate: 0.01, dfx: 9, bank: 9, network: 9, fixed: 0, total: 27 },
  feesTarget: { rate: 0.02, dfx: 2, bank: 0, network: 0, fixed: 0, total: 2 },
};

/** Narrows a captured-callback ref without a non-null assertion. */
function requireCallback<T>(value: T | null): T {
  if (value === null) throw new Error('callback was not captured by the mock');
  return value;
}

beforeEach(() => {
  capturedOnLinkChain = null;
  mockBack.mockReset();
  mockGetQuote.mockReset();
  mockCreatePaymentInfo.mockReset();
  mockConfirmSell.mockReset();
  mockRetryLast.mockReset();
  mockOnShellChange.mockReset();
  mockSign.mockClear();
  mockLinkAddress.mockReset();
  mockLoginAsAddressOwner.mockReset();
  mockSecureStorageSet.mockReset();
  mockSecureStorageRemove.mockReset();
  mockMarkChainLinked.mockReset();
  flowState.isLoading = false;
  flowState.error = null;
  flowState.authGate = null;
  flowState.paymentInfo = PAYMENT_INFO;
  flowState.quoteKey = '1|CHF|BTC|Bitcoin|bitcoin';
  flowState.errorKey = null;
  flowState.actionErrorKey = null;
});

describe('SellTradeAdapter — bank/confirm steps', () => {
  it('submits the IBAN and shows deposit + quote rows; back returns bank then amount', async () => {
    const { getByTestId, getByText, getByPlaceholderText, queryByTestId } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');
    fireEvent.press(getByTestId('sell-cta'));

    fireEvent.changeText(
      getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH93 0076 2011 6238 5295 7',
    );

    mockCreatePaymentInfo.mockResolvedValueOnce(PAYMENT_INFO);
    await act(async () => {
      fireEvent.press(getByText('common.continue'));
    });

    expect(mockCreatePaymentInfo).toHaveBeenCalledWith({
      amount: 1,
      asset: 'BTC',
      blockchain: 'Bitcoin',
      currency: 'CHF',
      iban: 'CH9300762011623852957',
      chain: 'bitcoin',
    });

    await waitFor(() => expect(getByText('sell.confirmSale')).toBeTruthy());
    expect(getByText(PAYMENT_INFO.depositAddress)).toBeTruthy();
    const sellText = `${fmtCrypto(PAYMENT_INFO.amount)} ${PAYMENT_INFO.asset.name}`;
    const rate = fmtFiat(PAYMENT_INFO.exchangeRate);
    const rateText = `1 ${PAYMENT_INFO.asset.name} = ${rate} ${PAYMENT_INFO.currency.name}`;
    const receiveText = `${fmtFiat(PAYMENT_INFO.estimatedAmount)} ${PAYMENT_INFO.currency.name}`;
    expect(getByText(sellText)).toBeTruthy();
    expect(getByText(rateText)).toBeTruthy();
    expect(getByText(receiveText)).toBeTruthy();
    expect(getByText(PAYMENT_INFO.beneficiary.iban)).toBeTruthy();

    pressShellBack();
    expect(getByPlaceholderText('CH00 0000 0000 0000 0000 0')).toBeTruthy();
    expect(queryByTestId('sell-cta')).toBeNull();

    pressShellBack();
    expect(getByTestId('sell-cta')).toBeTruthy();
  });

  it('shows the error and stays on the bank step when createPaymentInfo fails', async () => {
    const { getByTestId, getByText, queryByText, getByPlaceholderText, rerender } = renderAdapter();

    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-pill'));
    });
    act(() => {
      fireEvent.press(getByTestId('sell-pay-asset-option-BTC-bitcoin'));
    });
    fireEvent.changeText(getByTestId('sell-pay-amount'), '1');
    fireEvent.press(getByTestId('sell-cta'));
    fireEvent.changeText(
      getByPlaceholderText('CH00 0000 0000 0000 0000 0'),
      'CH93 0076 2011 6238 5295 7',
    );

    mockCreatePaymentInfo.mockResolvedValueOnce(null);
    await act(async () => {
      fireEvent.press(getByText('common.continue'));
    });

    flowState.error = 'sell failed';
    rerender(<SellTradeAdapter onShellChange={mockOnShellChange} />);

    expect(getByText('sell failed')).toBeTruthy();
    expect(getByPlaceholderText('CH00 0000 0000 0000 0000 0')).toBeTruthy();
    expect(queryByText('sell.confirmSale')).toBeNull();
  });
});

describe('SellTradeAdapter — linkChainToDfx (linkChain gate recovery)', () => {
  it('links the chain, caches it, and replays the last call on success', async () => {
    mockLinkAddress.mockResolvedValueOnce('new-token');
    renderAdapter();
    const onLinkChain = requireCallback(capturedOnLinkChain);

    await act(async () => {
      await onLinkChain('bitcoin');
    });

    expect(mockLinkAddress).toHaveBeenCalledWith('bc1q-wallet-address', expect.any(Function), {
      wallet: 'DFX Wallet',
      blockchain: 'Bitcoin',
    });
    expect(mockSecureStorageSet).toHaveBeenCalledWith('dfx-auth-token', 'new-token');
    expect(mockMarkChainLinked).toHaveBeenCalledWith('bitcoin');
    expect(mockRetryLast).toHaveBeenCalledTimes(1);
    expect(mockLoginAsAddressOwner).not.toHaveBeenCalled();
    expect(mockSecureStorageRemove).not.toHaveBeenCalled();
  });

  it('on a 409 conflict, re-authenticates as the owner and wipes the chain cache', async () => {
    mockLinkAddress.mockRejectedValueOnce(
      new DfxApiError(409, 'CONFLICT', 'address owned by another user'),
    );
    mockLoginAsAddressOwner.mockResolvedValueOnce('owner-token');
    renderAdapter();
    const onLinkChain = requireCallback(capturedOnLinkChain);

    await act(async () => {
      await onLinkChain('bitcoin');
    });

    expect(mockLoginAsAddressOwner).toHaveBeenCalledWith(
      'bc1q-wallet-address',
      expect.any(Function),
      { wallet: 'DFX Wallet', blockchain: 'Bitcoin' },
    );
    expect(mockSecureStorageSet).toHaveBeenCalledWith('dfx-auth-token', 'owner-token');
    expect(mockSecureStorageRemove).toHaveBeenCalledWith('dfx-linked-chains');
    expect(mockRetryLast).toHaveBeenCalledTimes(1);
    expect(mockMarkChainLinked).not.toHaveBeenCalled();
  });
});
