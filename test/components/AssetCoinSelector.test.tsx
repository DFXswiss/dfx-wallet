import { fireEvent, render } from '@testing-library/react-native';

import { AssetCoinSelector } from '../../src/features/transfer/AssetCoinSelector';

const OPTIONS = [
  { key: 'btc', symbol: 'BTC' },
  { key: 'chf', symbol: 'CHF' },
];

describe('AssetCoinSelector', () => {
  it('marks only the active key as selected and shows every symbol', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <AssetCoinSelector options={OPTIONS} value="btc" onChange={jest.fn()} testIDPrefix="asset" />,
    );

    expect(getByTestId('asset-btc').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('asset-chf').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('asset-btc-check')).toBeTruthy();
    expect(queryByTestId('asset-chf-check')).toBeNull();
    expect(getByText('BTC')).toBeTruthy();
    expect(getByText('CHF')).toBeTruthy();
  });

  it('calls onChange with an inactive key', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <AssetCoinSelector options={OPTIONS} value="btc" onChange={onChange} testIDPrefix="asset" />,
    );

    fireEvent.press(getByTestId('asset-chf'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('chf');
  });

  it('does not call onChange when the active key is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <AssetCoinSelector options={OPTIONS} value="btc" onChange={onChange} testIDPrefix="asset" />,
    );

    fireEvent.press(getByTestId('asset-btc'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
