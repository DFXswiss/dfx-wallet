import { fireEvent, render } from '@testing-library/react-native';

import { NetworkTextTabs } from '../../src/features/transfer/NetworkTextTabs';

const OPTIONS = [
  { key: 'bitcoin', label: 'SegWit' },
  { key: 'ethereum', label: 'EVM' },
];

describe('NetworkTextTabs', () => {
  it('marks only the active key as selected and shows every label', () => {
    const { getByTestId, getByText } = render(
      <NetworkTextTabs
        options={OPTIONS}
        value="bitcoin"
        onChange={jest.fn()}
        testIDPrefix="chain"
      />,
    );

    expect(getByTestId('chain-bitcoin').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('chain-ethereum').props.accessibilityState.selected).toBe(false);
    expect(getByText('SegWit')).toBeTruthy();
    expect(getByText('EVM')).toBeTruthy();
  });

  it('calls onChange with an inactive key', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <NetworkTextTabs
        options={OPTIONS}
        value="bitcoin"
        onChange={onChange}
        testIDPrefix="chain"
      />,
    );

    fireEvent.press(getByTestId('chain-ethereum'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('ethereum');
  });

  it('does not call onChange when the active key is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <NetworkTextTabs
        options={OPTIONS}
        value="bitcoin"
        onChange={onChange}
        testIDPrefix="chain"
      />,
    );

    fireEvent.press(getByTestId('chain-bitcoin'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
