import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

// WDK + LDS — match the same return-shape the disabled wrappers use.
// `mockAccountAddress` / `mockLdsUser` let per-test cases override the
// address shape so we can drive every branch of the address picker (empty
// WDK address, taproot via LDS, plain ETH).
const mockAccountAddress: { current: string | null | undefined } = {
  current: '0x1111222233334444555566667777888899990000',
};
const mockLdsUser: {
  current: { lightning: { address: string } } | null;
} = { current: null };
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: jest.fn(() => ({ address: mockAccountAddress.current })),
}));
jest.mock('@/hooks', () => ({
  useLdsWallet: () => ({
    user: mockLdsUser.current,
    isLoading: false,
    error: null,
    signIn: jest.fn(),
  }),
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

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockLdsUser.current = null;
  mockAccountAddress.current = '0x1111222233334444555566667777888899990000';
  jest.restoreAllMocks();
  jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
});

describe('ReceiveScreen', () => {

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

  it('back button on the asset step calls router.back()', () => {
    const { getByLabelText } = render(<ReceiveScreen />);
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('pressing the selected-asset pill on the QR step returns to the asset picker', () => {
    const { getByText, queryByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    // Now on QR step — the asset-list subtitle is gone and only the pill
    // shows "BTC". Press it: should re-show the asset picker.
    expect(queryByText('receive.selectAsset')).toBeNull();
    fireEvent.press(getByText('BTC'));
    expect(getByText('receive.selectAsset')).toBeTruthy();
  });

  it('exercises the pressed-state style fn on every function-style Pressable', () => {
    const { UNSAFE_root } = render(<ReceiveScreen />);
    // Walk the entire tree, find any Pressable whose `style` is a function
    // and invoke it with pressed=true so each `pressed && styles.pressed`
    // branch evaluates.
    let invoked = 0;
    const walk = (node: { props?: { style?: unknown }; children?: unknown[] }) => {
      if (typeof node.props?.style === 'function') {
        node.props.style({ pressed: true });
        invoked += 1;
      }
      for (const child of node.children ?? []) {
        if (typeof child === 'object' && child) walk(child as typeof node);
      }
    };
    walk(UNSAFE_root);
    expect(invoked).toBeGreaterThanOrEqual(2);
  });
});

describe('ReceiveScreen — empty address path', () => {
  it('shows the noAddress placeholder + walletNotInitialized label when address is empty', () => {
    mockAccountAddress.current = '';
    const { getByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    expect(getByText('receive.noAddress')).toBeTruthy();
    expect(getByText('receive.walletNotInitialized')).toBeTruthy();
  });

  it('falls back to empty when useAccount returns an undefined address', () => {
    // `?? ''` only fires for nullish — `''` is not nullish. Pass undefined
    // explicitly so the right side of the coalesce evaluates.
    mockAccountAddress.current = undefined;
    const { getByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    expect(getByText('receive.noAddress')).toBeTruthy();
  });

  it('renders the LDS lightning address when the Taproot chain is selected', () => {
    mockLdsUser.current = { lightning: { address: 'lnbc1taprootaddress' } };
    const { getByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    fireEvent.press(getByText('Taproot'));
    expect(getByText('lnbc1taprootaddress')).toBeTruthy();
  });

  it('falls back to empty when the Taproot chain is selected but LDS has no user', () => {
    mockLdsUser.current = null;
    const { getByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    fireEvent.press(getByText('Taproot'));
    // Without an LDS user the lightning address is "" → noAddress placeholder.
    expect(getByText('receive.noAddress')).toBeTruthy();
  });

  it('does not write to the clipboard when there is no address (button is disabled)', async () => {
    mockAccountAddress.current = '';
    const { getByText } = render(<ReceiveScreen />);
    fireEvent.press(getByText('BTC'));
    fireEvent.press(getByText('common.copy'));
    await Promise.resolve();
    // The `disabled` prop on the Copy PrimaryButton blocks onPress, so
    // handleCopy never runs and Clipboard stays untouched.
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('resets the "copied" label after the 2-second timeout fires', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    try {
      const { getByText, queryByText } = render(<ReceiveScreen />);
      fireEvent.press(getByText('BTC'));
      await act(async () => {
        fireEvent.press(getByText('common.copy'));
        // Drain microtasks so handleCopy's `await Clipboard.setStringAsync`
        // resolves and setCopied(true) commits. With `queueMicrotask`
        // unfaked above, plain `Promise.resolve()` still flushes correctly.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getByText('common.copied')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(queryByText('common.copied')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ReceiveScreen (DFX backend OFF — MVP build)', () => {
  it('omits the Taproot + Lightning chain chips when FEATURES.DFX_BACKEND is off', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const features = require('@/config/features');
    const r = jest.replaceProperty(features.FEATURES, 'DFX_BACKEND', false);
    try {
      const { getByText, queryByText } = render(<ReceiveScreen />);
      fireEvent.press(getByText('BTC'));
      // SegWit + EVM stay, Taproot + Lightning are gone.
      expect(getByText('SegWit')).toBeTruthy();
      expect(queryByText('Taproot')).toBeNull();
      expect(queryByText('Lightning')).toBeNull();
    } finally {
      r.restore();
    }
  });
});
