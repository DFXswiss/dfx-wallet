import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

// Send screen consumes `useSendFlow` directly; mock the public re-export so
// the test never touches `useAccount` / WDK and the hook returns a stable
// idle state on every render.
jest.mock('@/hooks', () => ({
  useSendFlow: () => ({
    send: jest.fn(),
    estimate: jest.fn(async () => ({ success: true, fee: '0' })),
    isLoading: false,
    txHash: null,
    error: null,
    reset: jest.fn(),
  }),
}));

// QrScanner pulls in expo-camera at module load — stub it out.
jest.mock('@/components/QrScanner', () => ({
  QrScanner: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import SendScreen from '../../app/(auth)/send/index';

describe('SendScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders the asset picker with the static SEND_ASSETS list', () => {
    const { getAllByText, getByText, getByTestId } = render(<SendScreen />);
    expect(getByTestId('send-screen')).toBeTruthy();
    expect(getByText('BTC')).toBeTruthy();
    expect(getByText('Bitcoin')).toBeTruthy();
    expect(getAllByText('CHF').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('USD').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Euro')).toBeTruthy();
  });

  it('shows the "sell to bank" affordance only when FEATURES.BUY_SELL is on', () => {
    // Same setup as ReceiveScreen: setup-globals.ts forces every
    // EXPO_PUBLIC_ENABLE_* to "true" under Jest, so this affordance must
    // render. The flag-off branch is verified at the bundle level.
    const { getByTestId } = render(<SendScreen />);
    expect(getByTestId('send-destination-bank')).toBeTruthy();
  });

  it('navigates to the sell screen when the bank-send affordance is pressed', () => {
    const { getByTestId } = render(<SendScreen />);
    fireEvent.press(getByTestId('send-destination-bank'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sell');
  });

  it('switches to the input step after picking BTC', () => {
    const { getByText, queryByText } = render(<SendScreen />);
    // The asset-step subtitle is `send.sendToCrypto` (key returned as-is by
    // our i18n mock).
    expect(getByText('send.sendToCrypto')).toBeTruthy();

    fireEvent.press(getByText('BTC'));

    // After picking the asset we leave the asset step — the subtitle is gone,
    // the continue CTA from the input step appears in its place.
    expect(queryByText('send.sendToCrypto')).toBeNull();
    expect(getByText('common.continue')).toBeTruthy();
  });
});
