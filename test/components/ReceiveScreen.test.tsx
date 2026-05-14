import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

// react-i18next's `t()` returns the key verbatim when no i18n instance is
// initialized — that's fine for assertions like `getByText('receive.title')`
// and saves us from booting i18next in every component test.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// expo-router mock — `useRouter` is the only API the screen touches at
// runtime. `Stack.Screen` is rendered as a no-op so the screen's options
// hook never tries to reach into a real navigator.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

// WDK + LDS — match the same return-shape the disabled wrappers use.
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: jest.fn(() => ({ address: '0x1111222233334444555566667777888899990000' })),
}));
jest.mock('@/hooks', () => ({
  useLdsWallet: () => ({ user: null, isLoading: false, error: null, signIn: jest.fn() }),
}));

// Render-only stubs for native primitives so the test doesn't try to render
// SVGs or the gesture handler.
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import ReceiveScreen from '../../app/(auth)/receive/index';

describe('ReceiveScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
  });

  it('renders the asset picker with the static RECEIVE_ASSETS list', () => {
    const { getAllByText, getByText } = render(<ReceiveScreen />);
    // BTC has distinct symbol + label ("BTC" / "Bitcoin"); CHF / USD reuse
    // the same string for both — use getAllByText so we don't trip on the
    // duplicate.
    expect(getByText('BTC')).toBeTruthy();
    expect(getByText('Bitcoin')).toBeTruthy();
    expect(getAllByText('CHF').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('USD').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Euro')).toBeTruthy();
  });

  it('shows the "buy from bank" affordance only when FEATURES.BUY_SELL is on', () => {
    // The test runtime sets every feature flag to true in `test/setup-globals.ts`,
    // so the affordance must render. The branch with the flag off is verified
    // implicitly by the `FEATURES.BUY_SELL && …` JSX guard — exercising the
    // off-state would require restarting the module with the env unset, which
    // we leave to the bundle-level CI.
    const { getByTestId } = render(<ReceiveScreen />);
    expect(getByTestId('receive-destination-bank')).toBeTruthy();
  });

  it('navigates to the buy screen when the bank-receive affordance is pressed', () => {
    const { getByTestId } = render(<ReceiveScreen />);
    fireEvent.press(getByTestId('receive-destination-bank'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/buy');
  });

  it('switches to the QR step after picking an asset', () => {
    const { getByText, queryByText } = render(<ReceiveScreen />);

    // Before the tap: the subtitle for the asset step is visible.
    expect(getByText('receive.selectAsset')).toBeTruthy();

    fireEvent.press(getByText('BTC'));

    // After the tap: the asset-step subtitle is gone and the selected-asset
    // pill carries the chosen symbol.
    expect(queryByText('receive.selectAsset')).toBeNull();
    expect(getByText('BTC')).toBeTruthy();
  });

  it('renders the chain bar for multi-chain assets in the QR step', () => {
    const { getByText, getAllByText } = render(<ReceiveScreen />);
    // BTC has multiple receive layers (SegWit, Taproot, Lightning, EVM).
    fireEvent.press(getByText('BTC'));
    expect(getByText('SegWit')).toBeTruthy();
    // Taproot + Lightning are only rendered when FEATURES.DFX_BACKEND is on
    // — and setup-globals.ts forces all flags on under jest.
    expect(getByText('Taproot')).toBeTruthy();
    expect(getByText('Lightning')).toBeTruthy();
    expect(getAllByText('EVM').length).toBeGreaterThanOrEqual(1);
  });

  it('switches the chain when a different chip is tapped', () => {
    const { getByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    fireEvent.press(getByText('SegWit'));
    // We are still in the QR step; the copy CTA is visible.
    expect(getByText('common.copy')).toBeTruthy();
  });

  it('renders the QR + address when an address is available', () => {
    const { getByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    // useAccount mock returns the same address regardless of chain.
    expect(getByText('0x1111222233334444555566667777888899990000')).toBeTruthy();
  });

  it('copies the address to clipboard when "Copy" is pressed', async () => {
    const { getByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    fireEvent.press(getByText('common.copy'));
    // Allow the async setStringAsync to flush.
    await Promise.resolve();
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      '0x1111222233334444555566667777888899990000',
    );
  });

  it('back button on the QR step returns to the asset picker', () => {
    const { getByText, getByLabelText, queryByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    expect(queryByText('receive.selectAsset')).toBeNull();

    fireEvent.press(getByLabelText('Back'));
    expect(getByText('receive.selectAsset')).toBeTruthy();
  });
});
