import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

// Send screen consumes `useSendFlow` directly; mock the public re-export so
// the test never touches `useAccount` / WDK and we can drive the flow's
// state (estimate result, send result, error, isLoading) per test.
const mockSend = jest.fn();
const mockEstimate = jest.fn();
const mockReset = jest.fn();
const flowState: {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
} = { isLoading: false, txHash: null, error: null };

jest.mock('@/hooks', () => ({
  useSendFlow: () => ({
    send: mockSend,
    estimate: mockEstimate,
    reset: mockReset,
    isLoading: flowState.isLoading,
    txHash: flowState.txHash,
    error: flowState.error,
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

const RECIPIENT = '0x1234567890123456789012345678901234567890';

function fillRecipientAndAmount(getByPlaceholderText: ReturnType<typeof render>['getByPlaceholderText']) {
  fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), RECIPIENT);
  fireEvent.changeText(getByPlaceholderText('0.00'), '1');
}

describe('SendScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSend.mockReset();
    mockEstimate.mockReset();
    mockEstimate.mockResolvedValue({ success: true, fee: '21000000000000' });
    mockReset.mockReset();
    flowState.isLoading = false;
    flowState.txHash = null;
    flowState.error = null;
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
    it('renders the chain bar with multiple chains when the asset has >1 chain', () => {
      const { getAllByText, getByText } = render(<SendScreen />);
      // CHF has 4 EVM chains — picking it should render the chain bar.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fireEvent.press(getAllByText('CHF')[0]!);
      expect(getByText('Ethereum')).toBeTruthy();
      expect(getByText('Arbitrum')).toBeTruthy();
      expect(getByText('Polygon')).toBeTruthy();
      expect(getByText('Base')).toBeTruthy();
    });

    it('switches the selected chain when a different chip is pressed', () => {
      const { getAllByText, getByText } = render(<SendScreen />);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
      const { getByText, getByPlaceholderText, findByText } = render(<SendScreen />);
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
      // The fee row is rendered (BTC uses spark which has no paymaster,
      // so the fee text falls through to `—`). Asserting that the
      // network-fee label exists is enough to lock the transition.
      expect(getByText('send.networkFee')).toBeTruthy();
    });

    it('shows the "fee unavailable" copy when the estimate fails', async () => {
      mockEstimate.mockResolvedValueOnce({ success: false, error: 'rpc-error' });
      const { getByText, getByPlaceholderText, findByText, getAllByText } = render(<SendScreen />);
      // CHF has a paymaster — the fee row actually renders.
      // CHF has 2 occurrences (symbol + label) — press the first.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fireEvent.press(getAllByText('CHF')[0]!);
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      expect(await findByText('send.feeUnavailable')).toBeTruthy();
    });

    it('renders the irreversibility warning + confirm + cancel CTAs', async () => {
      const { getByText, getByPlaceholderText, findByText, getAllByText } = render(<SendScreen />);
      // CHF has 2 occurrences (symbol + label) — press the first.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fireEvent.press(getAllByText('CHF')[0]!);
      fillRecipientAndAmount(getByPlaceholderText);
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
      const { getByText, getByPlaceholderText, findByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      // The input step renders the error too.
      expect(await findByText('insufficient funds')).toBeTruthy();
    });
  });
});
