// Characterization tests for the steps AFTER the amount step (payment,
// confirm) and for the linkChain recovery flow. BuyTradeAdapter.test.tsx only
// covers the amount step; these tests pin today's behavior across the
// buy/sell/swap module unification (see AUFTRAG).
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { GlassListGroup } from '../../src/components/GlassListGroup';
import {
  formatFiat as fmtFiat,
  formatCryptoAmount as fmtCrypto,
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

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

const mockSign = jest.fn().mockResolvedValue({ success: true, signature: 'signed-message' });
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: () => ({
    address: 'bc1q-wallet-address',
    sign: mockSign,
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
jest.mock('@/features/dfx-backend/useDfxAutoLinkImpl', () => ({
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
    linkLnurlAddress: jest.fn(),
    loginAsAddressOwner: (...args: unknown[]) => mockLoginAsAddressOwner(...args),
    loginAsLnurlAddressOwner: jest.fn(),
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
// Resolves to the mocked class above (jest intercepts this module path for
// the whole file); imported here so test bodies can construct instances.
// eslint-disable-next-line import/first
import { DfxApiError } from '@/features/dfx-backend/services';

const mockOnShellChange = jest.fn();
const renderAdapter = (props: Partial<React.ComponentProps<typeof BuyTradeAdapter>> = {}) =>
  render(<BuyTradeAdapter onShellChange={mockOnShellChange} {...props} />);

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
  amount: 100,
  estimatedAmount: 0.001,
  exchangeRate: 100000,
  minVolume: 10,
  maxVolume: 10000,
  currency: { id: 1, name: 'CHF' },
  asset: { id: 1, name: 'BTC', uniqueName: 'Bitcoin', blockchain: 'Bitcoin' },
  rate: 101000,
  exactPrice: false,
  priceSteps: [],
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
  feesTarget: {
    rate: 0.01,
    dfx: 0.00001,
    network: 0,
    fixed: 0,
    bank: 0,
    platform: 0,
    min: 0,
    total: 0.00001,
  },
  expiryDate: '2026-10-01T10:05:00.000Z',
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
  mockConfirmPayment.mockReset();
  mockDismissAuthGate.mockReset();
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
  flowState.quoteKey = '100|CHF|BTC|Bitcoin|bitcoin';
  flowState.errorKey = null;
  flowState.actionErrorKey = null;
});

describe('BuyTradeAdapter — payment/confirm steps', () => {
  it('shows payment step fields and quote rows; back returns to amount', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce(PAYMENT_INFO);
    const { getByTestId, getByText, UNSAFE_getAllByType } = renderAdapter();

    fireEvent.changeText(getByTestId('buy-amount-input'), '100');
    await act(async () => {
      fireEvent.press(getByTestId('buy-cta'));
    });

    expect(mockCreatePaymentInfo).toHaveBeenCalledWith({
      amount: 100,
      currency: 'CHF',
      asset: 'BTC',
      blockchain: 'Bitcoin',
      chain: 'bitcoin',
    });

    await waitFor(() => expect(getByText('buy.paymentInfo')).toBeTruthy());
    expect(getByText(PAYMENT_INFO.iban)).toBeTruthy();
    expect(getByText(PAYMENT_INFO.bic)).toBeTruthy();
    expect(getByText(PAYMENT_INFO.name)).toBeTruthy();
    expect(getByText(PAYMENT_INFO.remittanceInfo)).toBeTruthy();
    const amountText = `${fmtFiat(PAYMENT_INFO.amount)} ${PAYMENT_INFO.currency.name}`;
    const rate = fmtCrypto(1 / PAYMENT_INFO.exchangeRate);
    const rateText = `1 ${PAYMENT_INFO.currency.name} = ${rate} ${PAYMENT_INFO.asset.name}`;
    const receiveText = `${fmtCrypto(PAYMENT_INFO.estimatedAmount)} ${PAYMENT_INFO.asset.name}`;
    expect(getByText(amountText)).toBeTruthy();
    expect(getByText(rateText)).toBeTruthy();
    expect(getByText(receiveText)).toBeTruthy();
    // Bank-details row + quote summary both sit in a `GlassListGroup`.
    expect(UNSAFE_getAllByType(GlassListGroup).length).toBeGreaterThanOrEqual(2);

    // Back on the payment step is reported via the shell's onBack, not a
    // rendered header button — the shared shell lives in `TradeScreen` now.
    const calls = mockOnShellChange.mock.calls;
    const lastShell = calls[calls.length - 1][0];
    act(() => {
      lastShell.onBack();
    });
    expect(getByTestId('buy-cta')).toBeTruthy();
    expect(getByTestId('buy-amount-input')).toBeTruthy();
  });

  it('confirms the transfer, shows the success step, and Done navigates back', async () => {
    mockCreatePaymentInfo.mockResolvedValueOnce(PAYMENT_INFO);
    mockConfirmPayment.mockResolvedValueOnce(true);
    const { getByTestId, getByText, queryByText } = renderAdapter();

    fireEvent.changeText(getByTestId('buy-amount-input'), '100');
    await act(async () => {
      fireEvent.press(getByTestId('buy-cta'));
    });
    await waitFor(() => expect(getByText('buy.paymentInfo')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('buy.confirmTransfer'));
    });

    expect(mockConfirmPayment).toHaveBeenCalledWith(PAYMENT_INFO.id);
    await waitFor(() => expect(getByText('buy.confirm')).toBeTruthy());
    expect(getByText('buy.confirmDescription')).toBeTruthy();
    expect(queryByText('buy.paymentInfo')).toBeNull();

    fireEvent.press(getByText('common.done'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('BuyTradeAdapter — linkChainToDfx (linkChain gate recovery)', () => {
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

describe('BuyTradeAdapter — linked-wallet target params', () => {
  it('shows the banner and opens the confirm modal from the CTA when params are present', () => {
    const { getByTestId, queryByTestId } = renderAdapter({
      targetAddress: '0x1234567890123456789012345678901234567890',
      targetBlockchain: 'Ethereum',
    });

    expect(getByTestId('buy-target-wallet-banner')).toBeTruthy();
    expect(queryByTestId('confirm-target-wallet-modal')).toBeNull();

    fireEvent.changeText(getByTestId('buy-amount-input'), '100');
    fireEvent.press(getByTestId('buy-cta'));

    expect(getByTestId('confirm-target-wallet-modal')).toBeTruthy();
  });

  it('shows no target-wallet banner without linked-wallet params', () => {
    const { queryByTestId } = renderAdapter();
    expect(queryByTestId('buy-target-wallet-banner')).toBeNull();
  });
});
