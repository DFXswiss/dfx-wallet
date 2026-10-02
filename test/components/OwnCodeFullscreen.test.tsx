import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useAccount } from '@tetherto/wdk-react-native-core';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-qrcode-svg', () => {
  const { Text } = jest.requireActual('react-native');
  function QRCode({
    value,
    size,
    quietZone,
  }: {
    value: string;
    size: number;
    quietZone: number;
  }) {
    return (
      <Text
        testID="qrcode-stub"
        accessibilityLabel={`${size}`}
        accessibilityHint={`${quietZone}`}
      >
        {value}
      </Text>
    );
  }
  return QRCode;
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
  };
});

const mockLdsUser: {
  current: { lightning: { address: string } } | null;
} = { current: null };

jest.mock('@/hooks', () => ({
  useLdsWallet: () => ({
    user: mockLdsUser.current,
    isLoading: false,
    error: null,
    signIn: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import { OwnCodeFullscreen } from '../../src/features/transfer/OwnCodeFullscreen';

const BTC_ADDRESS = 'bc1qfullscreen';
const ETH_ADDRESS = '0xfullscreen';

const flatten = (style: unknown): Record<string, unknown> =>
  StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;

beforeEach(() => {
  mockLdsUser.current = null;
  (useAccount as jest.Mock).mockImplementation(({ network }: { network: string }) => ({
    address: network === 'ethereum' ? ETH_ADDRESS : BTC_ADDRESS,
  }));
});

describe('OwnCodeFullscreen', () => {
  it('starts with BTC, its first chain and the corresponding address', () => {
    const { getByTestId } = render(<OwnCodeFullscreen visible onClose={jest.fn()} />);

    expect(getByTestId('own-code-asset-BTC').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('own-code-chain-bitcoin').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('own-code-address').props.children).toBe(BTC_ADDRESS);
    expect(getByTestId('qrcode-stub').props.children).toBe(BTC_ADDRESS);
  });

  it('switches to the Ethereum address for CHF and hides the chain control', () => {
    const { getByTestId, queryByTestId } = render(
      <OwnCodeFullscreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(getByTestId('own-code-asset-CHF'));
    expect(getByTestId('own-code-address').props.children).toBe(ETH_ADDRESS);
    expect(queryByTestId('own-code-chain-bitcoin')).toBeNull();
  });

  it('switches the BTC address when its EVM chain is selected', () => {
    const { getByTestId } = render(<OwnCodeFullscreen visible onClose={jest.fn()} />);

    fireEvent.press(getByTestId('own-code-chain-ethereum'));
    expect(getByTestId('own-code-address').props.children).toBe(ETH_ADDRESS);
    expect(getByTestId('qrcode-stub').props.children).toBe(ETH_ADDRESS);
  });

  it('closes from the close button and from the backdrop', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<OwnCodeFullscreen visible onClose={onClose} />);

    fireEvent.press(getByTestId('own-code-close'));
    fireEvent.press(getByTestId('own-code-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close when the QR, a segment or the address is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<OwnCodeFullscreen visible onClose={onClose} />);

    fireEvent.press(getByTestId('own-code-qr'));
    fireEvent.press(getByTestId('own-code-asset-CHF'));
    fireEvent.press(getByTestId('own-code-address'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing while hidden', () => {
    const { toJSON } = render(<OwnCodeFullscreen visible={false} onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('shows receive.noAddress instead of a QR for an empty address', () => {
    (useAccount as jest.Mock).mockReturnValue({ address: '' });
    const { getAllByText, queryByTestId } = render(
      <OwnCodeFullscreen visible onClose={jest.fn()} />,
    );

    expect(getAllByText('receive.noAddress')).toHaveLength(2);
    expect(queryByTestId('qrcode-stub')).toBeNull();
  });

  it('uses one symmetric 20px tile padding around a zero-quiet-zone QR', () => {
    const { getByTestId } = render(<OwnCodeFullscreen visible onClose={jest.fn()} />);
    const tileStyle = flatten(getByTestId('own-code-qr').props.style);
    const qr = getByTestId('qrcode-stub');

    expect(tileStyle.padding).toBe(20);
    expect(tileStyle.width).toBe(Number(qr.props.accessibilityLabel) + 40);
    expect(qr.props.accessibilityHint).toBe('0');
    expect(tileStyle.overflow).toBeUndefined();
  });
});
