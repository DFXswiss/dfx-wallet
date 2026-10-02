import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { OpenCryptoPayError } from '@/services/opencryptopay';

// react-i18next's `t()` returns the key verbatim when no i18n instance is
// initialized — matches the convention used by the other screen tests. `t`
// must be a stable reference: the screen's fetch effect depends on `[lnurl,
// t]`, and a fresh function per render would re-fire the fetch on every
// state update instead of once per lnurl.
const stableT = (key: string) => key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockParams: { lnurl?: string } = { lnurl: 'LNURL1TESTQR' };
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

const mockLnurlToEndpoint = jest.fn(
  (raw: string) => new URL(`https://ocp.example.com/lnurlp/${raw}`),
);
const mockFetchQuote = jest.fn();
const mockCancelQuote = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/opencryptopay', () => {
  const actual = jest.requireActual('@/services/opencryptopay');
  return {
    ...actual,
    lnurlToEndpoint: (raw: string) => mockLnurlToEndpoint(raw),
    fetchQuote: (...args: unknown[]) => mockFetchQuote(...args),
    cancelQuote: (...args: unknown[]) => mockCancelQuote(...args),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import OpenCryptoPayScreen from '../../app/(auth)/pay/opencryptopay';

const SAMPLE_INVOICE = {
  displayName: 'Test Merchant',
  callbackUrl: 'https://ocp.example.com/cb/123',
  quote: { id: 'q1', expiresAt: Date.now() + 5 * 60 * 1000 },
  transferAmounts: [
    {
      method: 'Ethereum',
      minFee: 100,
      assets: [
        { asset: 'ZCHF', amount: '10.5' },
        { asset: 'USDC', amount: '11.2' },
      ],
    },
    {
      method: 'Polygon',
      minFee: 50,
      assets: [{ asset: 'USDC', amount: '11.2' }],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockParams = { lnurl: 'LNURL1TESTQR' };
  mockCancelQuote.mockResolvedValue(undefined);
  mockFetchQuote.mockResolvedValue(SAMPLE_INVOICE);
});

describe('OpenCryptoPayScreen', () => {
  it('fetches the quote, renders the merchant, and defaults to the first method + asset', async () => {
    const { getByText, getByTestId } = render(<OpenCryptoPayScreen />);

    await waitFor(() => expect(getByText('Test Merchant')).toBeTruthy());

    expect(mockLnurlToEndpoint).toHaveBeenCalledWith('LNURL1TESTQR');
    expect(getByTestId('opencryptopay-method-Ethereum')).toBeTruthy();
    expect(getByTestId('opencryptopay-method-Polygon')).toBeTruthy();
    expect(getByTestId('opencryptopay-asset-ZCHF')).toBeTruthy();
    expect(getByTestId('opencryptopay-asset-USDC')).toBeTruthy();
    expect(getByTestId('opencryptopay-confirm').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('shows the invalid-QR error and a Close button when no lnurl param is present', async () => {
    mockParams = {};
    const { getByText, getByTestId, queryByText } = render(<OpenCryptoPayScreen />);

    await waitFor(() => expect(getByText('opencryptopay.errors.invalidQr')).toBeTruthy());

    expect(mockFetchQuote).not.toHaveBeenCalled();
    expect(getByTestId('opencryptopay-close')).toBeTruthy();
    expect(queryByText('Test Merchant')).toBeNull();
  });

  it('maps a typed OpenCryptoPayError to its specific message', async () => {
    mockFetchQuote.mockRejectedValueOnce(new OpenCryptoPayError('expired', 'Quote expired'));
    const { getByText, getByTestId } = render(<OpenCryptoPayScreen />);

    await waitFor(() => expect(getByText('opencryptopay.expired')).toBeTruthy());
    expect(getByTestId('opencryptopay-close')).toBeTruthy();
  });

  it('falls back to the raw message for an untyped fetch error', async () => {
    mockFetchQuote.mockRejectedValueOnce(new Error('network exploded'));
    const { getByText } = render(<OpenCryptoPayScreen />);

    await waitFor(() => expect(getByText('network exploded')).toBeTruthy());
  });

  it.each([
    ['invalid-response', 'opencryptopay.errors.invalidResponse'],
    ['commit-failed', 'opencryptopay.errors.commitFailed'],
    ['fetch-failed', 'opencryptopay.errors.fetchFailed'],
  ] as const)('maps OpenCryptoPayError code %s to %s', async (code, expectedKey) => {
    mockFetchQuote.mockRejectedValueOnce(new OpenCryptoPayError(code, 'irrelevant raw message'));
    const { getByText } = render(<OpenCryptoPayScreen />);

    await waitFor(() => expect(getByText(expectedKey)).toBeTruthy());
  });

  it('switching methods swaps the asset list to that method’s assets', async () => {
    const { getByTestId, queryByTestId } = render(<OpenCryptoPayScreen />);
    await waitFor(() => expect(getByTestId('opencryptopay-method-Polygon')).toBeTruthy());

    expect(getByTestId('opencryptopay-asset-ZCHF')).toBeTruthy();

    fireEvent.press(getByTestId('opencryptopay-method-Polygon'));

    await waitFor(() => expect(queryByTestId('opencryptopay-asset-ZCHF')).toBeNull());
    expect(getByTestId('opencryptopay-asset-USDC')).toBeTruthy();
  });

  it('picking a different asset within the same method keeps both assets listed and Confirm enabled', async () => {
    const { getByTestId } = render(<OpenCryptoPayScreen />);
    await waitFor(() => expect(getByTestId('opencryptopay-asset-USDC')).toBeTruthy());

    fireEvent.press(getByTestId('opencryptopay-asset-USDC'));

    expect(getByTestId('opencryptopay-asset-ZCHF')).toBeTruthy();
    expect(getByTestId('opencryptopay-asset-USDC')).toBeTruthy();
    expect(getByTestId('opencryptopay-confirm').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('disables Confirm and shows the expired hint once the quote has lapsed', async () => {
    mockFetchQuote.mockResolvedValueOnce({
      ...SAMPLE_INVOICE,
      quote: { id: 'q2', expiresAt: Date.now() - 1000 },
    });
    const { getByText, getByTestId } = render(<OpenCryptoPayScreen />);

    await waitFor(() => expect(getByText('opencryptopay.expired')).toBeTruthy());
    expect(getByTestId('opencryptopay-confirm').props.accessibilityState?.disabled).toBe(true);
  });

  it('Confirm sets the coming-soon hint without navigating away', async () => {
    const { getByTestId, getByText } = render(<OpenCryptoPayScreen />);
    await waitFor(() => expect(getByTestId('opencryptopay-confirm')).toBeTruthy());

    fireEvent.press(getByTestId('opencryptopay-confirm'));

    await waitFor(() => expect(getByText('opencryptopay.confirmHint')).toBeTruthy());
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Cancel calls cancelQuote with the invoice callback URL and navigates back', async () => {
    const { getByTestId } = render(<OpenCryptoPayScreen />);
    await waitFor(() => expect(getByTestId('opencryptopay-cancel')).toBeTruthy());

    fireEvent.press(getByTestId('opencryptopay-cancel'));

    await waitFor(() => expect(mockCancelQuote).toHaveBeenCalledWith(SAMPLE_INVOICE.callbackUrl));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('Cancel falls back to replacing with the dashboard when there is no back stack', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByTestId } = render(<OpenCryptoPayScreen />);
    await waitFor(() => expect(getByTestId('opencryptopay-cancel')).toBeTruthy());

    fireEvent.press(getByTestId('opencryptopay-cancel'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));
  });

  it('Close (error state) navigates back without calling cancelQuote', async () => {
    mockParams = {};
    const { getByTestId } = render(<OpenCryptoPayScreen />);
    await waitFor(() => expect(getByTestId('opencryptopay-close')).toBeTruthy());

    fireEvent.press(getByTestId('opencryptopay-close'));

    expect(mockCancelQuote).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
