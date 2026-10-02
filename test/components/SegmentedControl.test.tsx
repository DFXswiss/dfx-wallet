import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { SegmentedControl } from '../../src/components/SegmentedControl';

const OPTIONS = [
  { key: 'btc', label: 'BTC' },
  { key: 'chf', label: 'CHF' },
];

describe('SegmentedControl', () => {
  it('calls onChange with the selected key', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <SegmentedControl
        options={OPTIONS}
        value="btc"
        onChange={onChange}
        testIDPrefix="asset"
      />,
    );

    fireEvent.press(getByTestId('asset-chf'));
    expect(onChange).toHaveBeenCalledWith('chf');
  });

  it('marks only the active key as selected', () => {
    const { getByTestId } = render(
      <SegmentedControl
        options={OPTIONS}
        value="chf"
        onChange={jest.fn()}
        testIDPrefix="asset"
      />,
    );

    expect(getByTestId('asset-btc').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('asset-chf').props.accessibilityState.selected).toBe(true);
  });
});
