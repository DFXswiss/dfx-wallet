import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <View {...props} />;
  }
  return { BlurView };
});

// eslint-disable-next-line import/first
import { NetworkBar } from '../../src/features/transfer/NetworkBar';

const OPTIONS = [
  { key: 'bitcoin', label: 'Bitcoin', caption: 'recommended' },
  { key: 'ethereum', label: 'Ethereum', caption: 'as Wrapped BTC' },
];

describe('NetworkBar', () => {
  it('renders multiple two-line options and selects an inactive network', () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = render(
      <NetworkBar options={OPTIONS} value="bitcoin" onChange={onChange} testIDPrefix="chain" />,
    );

    expect(getByTestId('chain-bar')).toBeTruthy();
    expect(getByText('Bitcoin')).toBeTruthy();
    expect(getByText('recommended')).toBeTruthy();
    expect(getByTestId('chain-bitcoin').props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    });

    fireEvent.press(getByTestId('chain-ethereum'));

    expect(onChange).toHaveBeenCalledWith('ethereum');
  });

  it('keeps one full-width option visible and disables interaction', () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = render(
      <NetworkBar
        options={[{ key: 'ethereum', label: 'Ethereum', caption: 'only network for CHF' }]}
        value="ethereum"
        onChange={onChange}
        testIDPrefix="chain"
      />,
    );

    expect(getByTestId('chain-bar')).toBeTruthy();
    expect(getByText('only network for CHF')).toBeTruthy();
    expect(getByTestId('chain-ethereum').props.accessibilityState).toEqual({
      selected: true,
      disabled: true,
    });

    fireEvent.press(getByTestId('chain-ethereum'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
