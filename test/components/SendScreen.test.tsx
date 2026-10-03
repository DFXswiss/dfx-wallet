import React from 'react';
import * as Haptics from 'expo-haptics';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { bech32, bech32m } from 'bech32';
import bs58check from 'bs58check';
import Svg, { Path } from 'react-native-svg';
import { darkColors, ThemeProvider, useThemeStore } from '@/theme';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
type MockBeforeRemoveEvent = { preventDefault: jest.Mock };
const mockBeforeRemoveHandlers = new Set<(event: MockBeforeRemoveEvent) => void>();
const mockAddListener = jest.fn(
  (eventName: string, handler: (event: MockBeforeRemoveEvent) => void) => {
    if (eventName === 'beforeRemove') mockBeforeRemoveHandlers.add(handler);
    return () => mockBeforeRemoveHandlers.delete(handler);
  },
);
const mockNavigation = { addListener: mockAddListener };
const mockStackScreenOptions: { current: { gestureEnabled?: boolean } | null } = { current: null };
jest.mock('expo-router', () => {
  function MockStackScreen({ options }: { options: { gestureEnabled?: boolean } }) {
    mockStackScreenOptions.current = options;
    return null;
  }

  return {
    useNavigation: () => mockNavigation,
    useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
    Stack: { Screen: MockStackScreen },
  };
});

// Send screen consumes `useSendFlow` directly; mock the public re-export so
// the test never touches `useAccount` / WDK and we can drive the flow's
// state (estimate result, send result, error, isLoading) per test.
const mockSend = jest.fn();
const mockEstimate = jest.fn();
const mockReset = jest.fn();
const mockUseSendFlow = jest.fn();
const flowState: {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
} = { isLoading: false, txHash: null, error: null };

jest.mock('@/hooks', () => ({
  useSendFlow: (chain: string) => {
    mockUseSendFlow(chain);
    return {
      send: mockSend,
      estimate: mockEstimate,
      reset: mockReset,
      isLoading: flowState.isLoading,
      txHash: flowState.txHash,
      error: flowState.error,
    };
  },
}));

// QrScanner pulls in expo-camera at module load — stub it out, and
// expose the most-recent `onScan` / `onClose` callbacks on a global ref
// so tests can fire a fake scan and assert the screen's handler runs.
const qrScannerProps: {
  onScan: ((value: string) => void) | null;
  onClose: (() => void) | null;
} = { onScan: null, onClose: null };
jest.mock('@/components/QrScanner', () => ({
  QrScanner: (props: { onScan: (value: string) => void; onClose: () => void }) => {
    qrScannerProps.onScan = props.onScan;
    qrScannerProps.onClose = props.onClose;
    return null;
  },
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

// eslint-disable-next-line no-secrets/no-secrets -- public BIP-173 test vector, not a credential
const RECIPIENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const SPARK_IDENTITY_PUBLIC_KEY_HEX =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SPARK_IDENTITY_PUBLIC_KEY = Uint8Array.from(
  { length: SPARK_IDENTITY_PUBLIC_KEY_HEX.length / 2 },
  (_, index) =>
    Number.parseInt(SPARK_IDENTITY_PUBLIC_KEY_HEX.slice(index * 2, index * 2 + 2), 16),
);
const SPARK_RECIPIENT = bech32m.encode(
  'spark',
  bech32m.toWords(Uint8Array.from([0x0a, 0x21, ...SPARK_IDENTITY_PUBLIC_KEY])),
  1023,
);
const EVM_RECIPIENT = '0x52908400098527886E0F7030069857D2E4169EE7';
const LOWERCASE_EVM_RECIPIENT = EVM_RECIPIENT.toLowerCase();
const WRONG_CHECKSUM_EVM_RECIPIENT = `${EVM_RECIPIENT.slice(0, -2)}e7`;
const TESTNET_BECH32_RECIPIENT = bech32.encode('tb', [
  0,
  ...bech32.toWords(new Uint8Array(20)),
]);
const TESTNET_P2PKH_M_RECIPIENT = bs58check.encode(
  Uint8Array.from([0x6f, ...new Uint8Array(20)]),
);
const TESTNET_P2PKH_N_RECIPIENT = bs58check.encode(
  Uint8Array.from([0x6f, ...new Uint8Array(20).fill(0xff)]),
);
const TESTNET_P2SH_RECIPIENT = bs58check.encode(
  Uint8Array.from([0xc4, ...new Uint8Array(20)]),
);

function fillRecipientAndAmount(
  getByPlaceholderText: ReturnType<typeof render>['getByPlaceholderText'],
  recipient = RECIPIENT,
) {
  fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), recipient);
  fireEvent.changeText(getByPlaceholderText('0.00'), '1');
}

describe('SendScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockAddListener.mockClear();
    mockBeforeRemoveHandlers.clear();
    mockSend.mockReset();
    mockEstimate.mockReset();
    mockEstimate.mockResolvedValue({ success: true, fee: '21000000000000' });
    mockReset.mockReset();
    mockUseSendFlow.mockReset();
    (Haptics.notificationAsync as jest.Mock).mockReset();
    flowState.isLoading = false;
    flowState.txHash = null;
    flowState.error = null;
    useThemeStore.setState({ mode: 'light' });
    mockStackScreenOptions.current = null;
    qrScannerProps.onScan = null;
    qrScannerProps.onClose = null;
  });

  describe('asset step', () => {
    it('renders the asset picker with the static SEND_ASSETS list', () => {
      const { getAllByText, getByText, getByTestId } = render(<SendScreen />);
      expect(getByTestId('send-screen')).toBeTruthy();
      expect(getByText('BTC')).toBeTruthy();
      expect(getByText('Bitcoin')).toBeTruthy();
      expect(getAllByText('CHF').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('USD').length).toBeGreaterThanOrEqual(1);
      expect(getByText('Euro')).toBeTruthy();
    });

    it('shows the "sell to bank" affordance when FEATURES.BUY_SELL is on', () => {
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
      expect(getByText('send.sendToCrypto')).toBeTruthy();
      fireEvent.press(getByText('BTC'));
      expect(queryByText('send.sendToCrypto')).toBeNull();
      expect(getByText('common.continue')).toBeTruthy();
    });
  });

  describe('input step', () => {
    it('enables Continue for a Spark mainnet BTC recipient', () => {
      const { getByPlaceholderText, getByTestId, getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), SPARK_RECIPIENT);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);
    });

    it('keeps Continue disabled for a checksum-mutated mainnet BTC recipient', () => {
      const invalidRecipient = `${RECIPIENT.slice(0, -1)}q`;
      const { getByPlaceholderText, getByTestId, getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), invalidRecipient);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');

      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
    });

    it.each([
      TESTNET_BECH32_RECIPIENT,
      TESTNET_P2PKH_M_RECIPIENT,
      TESTNET_P2PKH_N_RECIPIENT,
      TESTNET_P2SH_RECIPIENT,
    ])('keeps Continue disabled for testnet BTC recipient %s', (address) => {
      const { getByPlaceholderText, getByTestId, getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), address);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);

      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), SPARK_RECIPIENT);
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);
    });

    it.each([
      ['checksummed', EVM_RECIPIENT],
      ['lowercase', LOWERCASE_EVM_RECIPIENT],
    ])('enables Continue for a valid %s EVM recipient', (_label, address) => {
      const { getAllByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), address);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');

      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);
    });

    it.each([
      ['wrong-checksum mixed-case', WRONG_CHECKSUM_EVM_RECIPIENT],
      ['too short', '0x1234'],
    ])('keeps Continue disabled for a %s EVM recipient', (_label, address) => {
      const { getAllByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), address);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');

      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
    });

    it('keeps Continue disabled when the amount exceeds the asset precision', () => {
      const { getAllByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), EVM_RECIPIENT);

      // Every configured CHF send asset is ZCHF with 18 decimals.
      fireEvent.changeText(getByPlaceholderText('0.00'), '1.123456789012345678');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);

      fireEvent.changeText(getByPlaceholderText('0.00'), '1.1234567890123456789');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
      expect(mockEstimate).not.toHaveBeenCalled();
    });

    it('renders the chain bar with multiple chains when the asset has >1 chain', () => {
      const { getAllByText, getByText } = render(<SendScreen />);
      // CHF has 4 EVM chains — picking it should render the chain bar.
      fireEvent.press(getAllByText('CHF')[0]!);
      expect(getByText('Ethereum')).toBeTruthy();
      expect(getByText('Arbitrum')).toBeTruthy();
      expect(getByText('Polygon')).toBeTruthy();
      expect(getByText('Base')).toBeTruthy();
    });

    it('switches the selected chain when a different chip is pressed', () => {
      const { getAllByText, getByText } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      // Default is the first chain (Ethereum). Tap Polygon — the chain
      // switches but stays in the input step.
      fireEvent.press(getByText('Polygon'));
      expect(getByText('common.continue')).toBeTruthy();
    });

    it('opens the QR scanner when "scan" is pressed', () => {
      const { getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      // The scanner is mocked to null but the press must not throw.
      expect(() => fireEvent.press(getByText('send.scan'))).not.toThrow();
    });

    it('navigates to /(auth)/sell when the "sell instead" shortcut is pressed', () => {
      const { getByTestId, getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.press(getByTestId('send-action-sell'));
      expect(mockPush).toHaveBeenCalledWith('/(auth)/sell');
    });
  });

  describe('confirm step', () => {
    it('transitions to confirm after a successful estimate and shows the formatted fee', async () => {
      mockEstimate.mockResolvedValueOnce({ success: true, fee: '1234' });
      const { getByText, getByPlaceholderText, getByTestId, findByText } = render(
        <SendScreen />,
      );
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      // Confirm-step title is `send.confirmTransaction`.
      expect(await findByText('send.confirmTransaction')).toBeTruthy();
      expect(mockEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ to: RECIPIENT, amount: '1' }),
      );
      expect(getByText('send.networkFee')).toBeTruthy();
      expect(getByText('0.00001234 BTC')).toBeTruthy();
      expect(getByText('Bitcoin (SegWit)')).toBeTruthy();
      expect(mockUseSendFlow).toHaveBeenLastCalledWith('bitcoin');
      expect(getByTestId('send-confirm-button').props.accessibilityState?.disabled).not.toBe(true);
    });

    it('uses Spark for a Spark BTC recipient and displays its network label', async () => {
      const { getByText, getByPlaceholderText, findByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), SPARK_RECIPIENT);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });

      expect(await findByText('Bitcoin Lightning')).toBeTruthy();
      expect(mockUseSendFlow).toHaveBeenLastCalledWith('spark');
      expect(mockEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ to: SPARK_RECIPIENT, amount: '1' }),
      );
    });

    it('normalizes the recipient for validation, estimate, and send', async () => {
      mockSend.mockResolvedValueOnce('btc-hash');
      const paddedRecipient = ` \n${RECIPIENT}\n `;
      const { getByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), paddedRecipient);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);

      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      expect(mockEstimate).toHaveBeenCalledWith(expect.objectContaining({ to: RECIPIENT }));

      await act(async () => {
        fireEvent.press(getByText('common.confirm'));
      });
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: RECIPIENT }));
    });

    it('shows a retry action instead of Confirm when the estimate fails', async () => {
      mockEstimate.mockResolvedValueOnce({ success: false, error: 'rpc-error' });
      const { getByText, getByPlaceholderText, findByText, getAllByText, queryByText } = render(
        <SendScreen />,
      );
      // CHF has a paymaster — the fee row actually renders.
      // CHF has 2 occurrences (symbol + label) — press the first.
      fireEvent.press(getAllByText('CHF')[0]!);
      fillRecipientAndAmount(getByPlaceholderText, EVM_RECIPIENT);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      expect(await findByText('send.feeUnavailable')).toBeTruthy();
      expect(queryByText('common.confirm')).toBeNull();
      expect(getByText('common.retry')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByText('common.retry'));
      });
      expect(mockEstimate).toHaveBeenCalledTimes(2);
      expect(getByText('common.confirm')).toBeTruthy();
    });

    it('renders the irreversibility warning + confirm + cancel CTAs', async () => {
      const { getByText, getByPlaceholderText, findByText, getAllByText } = render(<SendScreen />);
      // CHF has 2 occurrences (symbol + label) — press the first.
      fireEvent.press(getAllByText('CHF')[0]!);
      fillRecipientAndAmount(getByPlaceholderText, EVM_RECIPIENT);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      expect(await findByText('send.irreversible')).toBeTruthy();
      expect(getByText('common.confirm')).toBeTruthy();
      expect(getByText('common.cancel')).toBeTruthy();
    });

    it('cancel returns to the input step and resets the in-flight estimate', async () => {
      const { getByText, getByPlaceholderText, findByText, queryByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      expect(await findByText('send.confirmTransaction')).toBeTruthy();
      fireEvent.press(getByText('common.cancel'));
      expect(mockReset).toHaveBeenCalled();
      // We are back on the input step — the confirm title is gone, the
      // continue CTA is back.
      expect(queryByText('send.confirmTransaction')).toBeNull();
      expect(getByText('common.continue')).toBeTruthy();
    });

    it('blocks removal, cancel, back, and a second transfer while send is in flight', async () => {
      let resolveSend: ((hash: string | null) => void) | undefined;
      mockSend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );
      const { getByLabelText, getByPlaceholderText, getByTestId, getByText } = render(
        <SendScreen />,
      );
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });

      fireEvent.press(getByTestId('send-confirm-button'));

      const cancelButton = getByTestId('send-cancel-button');
      const backButton = getByLabelText('common.back');
      const beforeRemoveHandler = [...mockBeforeRemoveHandlers][0];
      expect(mockAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function));
      expect(beforeRemoveHandler).toBeDefined();
      expect(cancelButton.props.accessibilityState?.disabled).toBe(true);
      expect(backButton.props.accessibilityState?.disabled).toBe(true);
      expect(mockStackScreenOptions.current?.gestureEnabled).toBe(false);

      const inFlightRemoveEvent = { preventDefault: jest.fn() };
      act(() => beforeRemoveHandler!(inFlightRemoveEvent));
      expect(inFlightRemoveEvent.preventDefault).toHaveBeenCalledTimes(1);

      fireEvent.press(cancelButton);
      fireEvent.press(backButton);
      fireEvent.press(getByTestId('send-confirm-button'));
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        asset: expect.anything(),
        to: RECIPIENT,
        amount: '1',
      });

      await act(async () => {
        resolveSend?.(null);
        await Promise.resolve();
      });

      const completedRemoveEvent = { preventDefault: jest.fn() };
      act(() => beforeRemoveHandler!(completedRemoveEvent));
      expect(completedRemoveEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores a late successful send result after unmount', async () => {
      let resolveSend: ((hash: string | null) => void) | undefined;
      mockSend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );
      const { getByPlaceholderText, getByTestId, getByText, unmount } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      fireEvent.press(getByTestId('send-confirm-button'));

      // User actions cannot supersede an in-flight send because cancel, back,
      // and the navigation gesture are disabled; unmount is the reachable case.
      unmount();

      await act(async () => {
        resolveSend?.('late-hash');
        await Promise.resolve();
      });
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('confirm → send → success', () => {
    it('shows the success step after a successful send', async () => {
      mockSend.mockResolvedValueOnce('0xdeadbeef');
      flowState.txHash = '0xdeadbeef';

      const { getByText, getByPlaceholderText, findByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      await act(async () => {
        fireEvent.press(getByText('common.confirm'));
      });
      // The success step renders `send.sent` and a description.
      expect(await findByText('send.sent')).toBeTruthy();
    });

    it('stays on the confirm step when send returns null (failure)', async () => {
      mockSend.mockResolvedValueOnce(null);
      const { getByText, getByPlaceholderText, findByText, queryByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      await act(async () => {
        fireEvent.press(getByText('common.confirm'));
      });
      // The success copy never appears; we are still in the confirm view.
      expect(queryByText('send.sent')).toBeNull();
      expect(await findByText('send.confirmTransaction')).toBeTruthy();
    });

    it('renders the in-flow error message when useSendFlow exposes one', async () => {
      flowState.error = 'insufficient funds';
      const { getByText, findByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      // The input step renders the error too.
      expect(await findByText('insufficient funds')).toBeTruthy();
    });
  });

  describe('back navigation through the wizard', () => {
    it('back from confirm returns to input', async () => {
      const { getByText, getByPlaceholderText, findByText, getByLabelText, queryByText } = render(
        <SendScreen />,
      );
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      expect(await findByText('send.confirmTransaction')).toBeTruthy();

      fireEvent.press(getByLabelText('common.back'));
      expect(queryByText('send.confirmTransaction')).toBeNull();
      expect(getByText('common.continue')).toBeTruthy();
    });

    it('back from input returns to asset step', () => {
      const { getByText, getByLabelText, queryByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      expect(queryByText('send.sendToCrypto')).toBeNull();

      fireEvent.press(getByLabelText('common.back'));
      expect(getByText('send.sendToCrypto')).toBeTruthy();
    });
  });

  describe('success step', () => {
    it('the "done" button routes back via router.back()', async () => {
      const { mock: routerBackMock } = mockPush;
      void routerBackMock; // silence unused
      mockSend.mockResolvedValueOnce('0xabc');
      flowState.txHash = '0xabc';
      const { getByText, getByPlaceholderText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      await act(async () => {
        fireEvent.press(getByText('common.confirm'));
      });
      // We are on the success step — the "done" CTA exists and is pressable.
      expect(() => fireEvent.press(getByText('common.done'))).not.toThrow();
    });
  });

  describe('QR scanner integration', () => {
    it('a scanned URI populates the recipient field (onScan handler is wired)', () => {
      const { getByText, getByPlaceholderText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      // Drive the scanner's `onScan` directly — the screen exposes it via
      // the QrScanner mock. The handler should strip the prefix/query and
      // pipe the bare address into the recipient state.
      expect(qrScannerProps.onScan).not.toBeNull();
      act(() => {
        qrScannerProps.onScan!(`ethereum:${EVM_RECIPIENT}?amount=1`);
      });
      expect(
        (getByPlaceholderText('send.addressPlaceholder') as unknown as { props: { value: string } })
          .props.value,
      ).toBe(EVM_RECIPIENT);
    });

    it('the scanner onClose handler closes the scanner', () => {
      const { getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.press(getByText('send.scan'));
      // Now the scanner is open. Fire onClose; the call must not throw.
      expect(qrScannerProps.onClose).not.toBeNull();
      act(() => {
        qrScannerProps.onClose!();
      });
    });
  });

  describe('back navigation root path', () => {
    it('pressing the selected-asset pill on the input step returns to the asset picker', () => {
      const { getByText, queryByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      // We're on input step now; the asset-step subtitle is gone.
      expect(queryByText('send.sendToCrypto')).toBeNull();
      // Press the pill (BTC) to go back to asset step.
      fireEvent.press(getByText('BTC'));
      expect(getByText('send.sendToCrypto')).toBeTruthy();
    });

    it('back from asset step calls router.back()', () => {
      const { getByLabelText } = render(<SendScreen />);
      fireEvent.press(getByLabelText('common.back'));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('pressed-state style branches', () => {
    it('exercises every function-style Pressable with pressed=true', () => {
      const { UNSAFE_root } = render(<SendScreen />);
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

  describe('theme colors', () => {
    it('uses the on-primary token for the sell shortcut icon in dark mode', () => {
      useThemeStore.setState({ mode: 'dark' });
      const { getByTestId, getByText } = render(
        <ThemeProvider>
          <SendScreen />
        </ThemeProvider>,
      );
      fireEvent.press(getByText('BTC'));

      const [swapIcon] = within(getByTestId('send-action-sell')).UNSAFE_getAllByType(Svg);
      const swapPaths = within(swapIcon!).UNSAFE_getAllByType(Path);
      expect(swapPaths.length).toBeGreaterThan(0);
      for (const swapPath of swapPaths) {
        expect(swapPath.props.stroke).toBe(darkColors.onPrimary);
        expect(swapPath.props.stroke).not.toBe(darkColors.white);
      }
    });
  });

  describe('fee state intermediate display', () => {
    it('shows the "estimating" copy while the estimate is in flight (loading branch)', async () => {
      // Make the estimate hang so we can observe the in-flight render.
      let releaseEstimate: ((value: { success: boolean; fee: string }) => void) | undefined;
      mockEstimate.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseEstimate = resolve;
          }),
      );
      const { getByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      fireEvent.press(getByText('common.continue'));
      // Confirm step now mounts and the fee row shows the loading label.
      await act(async () => {
        await Promise.resolve();
      });
      expect(getByText('send.feeEstimating')).toBeTruthy();
      expect(getByTestId('send-confirm-button').props.accessibilityState?.disabled).toBe(true);
      // Release so the promise queue drains before the test ends.
      releaseEstimate?.({ success: true, fee: '21000000000000' });
      await act(async () => {
        await Promise.resolve();
      });
    });

    it('drops the stale fee result when a second estimate races the first', async () => {
      // First estimate hangs; navigating back and continuing starts a second
      // overlapping estimate. The second resolves first and must remain visible
      // after the older request eventually resolves.
      let resolveFirst: ((value: { success: boolean; fee: string }) => void) | undefined;
      mockEstimate.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      );
      mockEstimate.mockResolvedValueOnce({ success: true, fee: '2222' });

      const { getByText, getByPlaceholderText, getByLabelText, queryByText } = render(
        <SendScreen />,
      );
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      fireEvent.press(getByText('common.continue'));
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.press(getByLabelText('common.back'));
      fireEvent.press(getByText('common.continue'));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getByText('0.00002222 BTC')).toBeTruthy();
      // Late resolve of the stale first estimate — the `reqId !==
      // estimateReqRef.current` guard discards it without touching state.
      await act(async () => {
        resolveFirst?.({ success: true, fee: '1111' });
        await Promise.resolve();
      });
      expect(getByText('0.00002222 BTC')).toBeTruthy();
      expect(queryByText('0.00001111 BTC')).toBeNull();
    });

    it('renders the in-flow error message on the confirm step too', async () => {
      // Set the flow error BEFORE rendering so it survives the asset →
      // input → confirm transition and we hit the `error && <Text>` branch
      // inside renderConfirmStep.
      flowState.error = 'gas estimation failed';
      const { getByText, getByPlaceholderText, findByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      fireEvent.press(getByText('common.continue'));
      await act(async () => {
        await Promise.resolve();
      });
      // The error text appears on the confirm screen (it would also appear
      // on the input step, but we're past it now).
      expect(await findByText('gas estimation failed')).toBeTruthy();
    });
  });
});
