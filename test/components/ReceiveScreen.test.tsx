import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key}:${Object.values(values).join(':')}` : key,
  }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

const mockAddresses: {
  current: Partial<Record<string, string | null | undefined>>;
} = {
  current: {
    bitcoin: 'bc1qbitcoinaddress',
    ethereum: '0x1111222233334444555566667777888899990000',
    spark: 'spark-address',
  },
};
const mockLdsUser: {
  current: { lightning: { address: string } } | null;
} = { current: null };
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: jest.fn(({ network }: { network: string }) => ({
    address: mockAddresses.current[network],
  })),
}));
jest.mock('@/hooks', () => ({
  useLdsWallet: () => ({
    user: mockLdsUser.current,
    isLoading: false,
    error: null,
    signIn: jest.fn(),
  }),
}));

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

// eslint-disable-next-line import/first
import ReceiveScreen from '../../app/(auth)/receive/index';

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockLdsUser.current = null;
  mockAddresses.current = {
    bitcoin: 'bc1qbitcoinaddress',
    ethereum: '0x1111222233334444555566667777888899990000',
    spark: 'spark-address',
  };
  jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
});

describe('ReceiveScreen', () => {
  it('starts on BTC and shows the BTC chain selector on the same screen', () => {
    const { getByTestId, getByText } = render(<ReceiveScreen />);

    expect(getByTestId('receive-asset-btc').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByTestId('receive-chain-bar')).toBeTruthy();
    expect(getByTestId('receive-chain-bitcoin').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByText('SegWit')).toBeTruthy();
    expect(getByText('Taproot')).toBeTruthy();
    expect(getByText('Lightning')).toBeTruthy();
    expect(getByText('EVM')).toBeTruthy();
    expect(getByText('receive.onlyCorrectNetwork:BTC:SegWit')).toBeTruthy();
    expect(getByTestId('receive-address').props.selectable).toBe(true);
    expect(getByTestId('receive-address').props.children).toBe('bc1qbitcoinaddress');
  });

  it('switches to CHF, hides the chain selector, and uses the Ethereum address', () => {
    const { getByTestId, queryByTestId } = render(<ReceiveScreen />);

    fireEvent.press(getByTestId('receive-asset-chf'));

    expect(getByTestId('receive-asset-chf').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(queryByTestId('receive-chain-bar')).toBeNull();
    expect(getByTestId('receive-address').props.children).toBe(
      '0x1111222233334444555566667777888899990000',
    );
  });

  it('switches BTC chains without leaving the screen', () => {
    const { getByTestId } = render(<ReceiveScreen />);

    fireEvent.press(getByTestId('receive-chain-ethereum'));

    expect(getByTestId('receive-chain-ethereum').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByTestId('receive-address').props.children).toBe(
      '0x1111222233334444555566667777888899990000',
    );
  });

  it('renders the buy card when BUY_SELL is enabled and passes the selected asset', () => {
    const { getByTestId, getByText } = render(<ReceiveScreen />);

    expect(getByTestId('receive-buy').props.accessibilityRole).toBe('button');
    expect(getByText('receive.buyAsset:BTC')).toBeTruthy();
    fireEvent.press(getByTestId('receive-asset-usd'));
    expect(getByText('receive.buyAsset:USD')).toBeTruthy();
    fireEvent.press(getByTestId('receive-buy'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/buy',
      params: { asset: 'USD' },
    });
  });

  it('omits the buy card when BUY_SELL is disabled', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const features = require('@/config/features');
    const replacement = jest.replaceProperty(features.FEATURES, 'BUY_SELL', false);
    try {
      const { queryByTestId } = render(<ReceiveScreen />);
      expect(queryByTestId('receive-buy')).toBeNull();
    } finally {
      replacement.restore();
    }
  });

  it('copies with success haptics, shares, and shows the copied state', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    try {
      const notificationAsync = jest
        .spyOn(Haptics, 'notificationAsync')
        .mockResolvedValue(undefined);
      const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
      const { getByTestId, getByText } = render(<ReceiveScreen />);

      await act(async () => {
        fireEvent.press(getByTestId('receive-copy-button'));
        await Promise.resolve();
      });
      fireEvent.press(getByTestId('receive-share-button'));

      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('bc1qbitcoinaddress');
      expect(notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
      expect(getByText('common.copied')).toBeTruthy();
      expect(share).toHaveBeenCalledWith({ message: 'bc1qbitcoinaddress' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens the full-screen code from the QR with the selected asset and chain', () => {
    const { getByTestId } = render(<ReceiveScreen />);
    fireEvent.press(getByTestId('receive-chain-ethereum'));

    fireEvent.press(getByTestId('receive-qr'));

    expect(getByTestId('own-code-qr')).toBeTruthy();
    expect(getByTestId('own-code-asset-BTC').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByTestId('own-code-chain-ethereum').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it('opens the full-screen code from the hint with the selected asset', () => {
    const { getByTestId } = render(<ReceiveScreen />);
    fireEvent.press(getByTestId('receive-asset-chf'));

    fireEvent.press(getByTestId('receive-qr-hint'));

    expect(getByTestId('own-code-qr')).toBeTruthy();
    expect(getByTestId('own-code-asset-CHF').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByTestId('own-code-address').props.children).toBe(
      '0x1111222233334444555566667777888899990000',
    );
  });

  it('uses the LDS address for Taproot', () => {
    mockLdsUser.current = { lightning: { address: 'lnbc1taprootaddress' } };
    const { getByTestId } = render(<ReceiveScreen />);

    fireEvent.press(getByTestId('receive-chain-bitcoin-taproot'));

    expect(getByTestId('receive-address').props.children).toBe('lnbc1taprootaddress');
  });

  it('shows the no-address placeholder and disables copy and share', async () => {
    mockAddresses.current.bitcoin = '';
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const { getAllByText, getByTestId } = render(<ReceiveScreen />);

    expect(getAllByText('receive.noAddress')).toHaveLength(2);
    expect(getByTestId('receive-copy-button').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('receive-share-button').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('receive-copy-button'));
    fireEvent.press(getByTestId('receive-share-button'));
    await Promise.resolve();

    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it('resets the copied label after two seconds', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    try {
      const { getByTestId, getByText, queryByText } = render(<ReceiveScreen />);
      await act(async () => {
        fireEvent.press(getByTestId('receive-copy-button'));
        await Promise.resolve();
      });
      expect(getByText('common.copied')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(queryByText('common.copied')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns directly through router.back()', () => {
    const { getByLabelText } = render(<ReceiveScreen />);
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('ReceiveScreen with DFX_BACKEND disabled', () => {
  it('keeps SegWit and EVM but omits Taproot and Lightning', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const features = require('@/config/features');
    const replacement = jest.replaceProperty(features.FEATURES, 'DFX_BACKEND', false);
    try {
      const { getByTestId, queryByTestId } = render(<ReceiveScreen />);
      expect(getByTestId('receive-chain-bitcoin')).toBeTruthy();
      expect(getByTestId('receive-chain-ethereum')).toBeTruthy();
      expect(queryByTestId('receive-chain-bitcoin-taproot')).toBeNull();
      expect(queryByTestId('receive-chain-spark')).toBeNull();
    } finally {
      replacement.restore();
    }
  });
});
