import React from 'react';
import { render } from '@testing-library/react-native';

// `react-native-qrcode-svg` is stubbed to a string-typed component in
// `test/setup.ts` via jest-expo's preset. We re-export it here so the
// render output is observable: a host component rendered with the value
// prop attached.
jest.mock('react-native-qrcode-svg', () => {
  const { Text } = jest.requireActual('react-native');
  function QRCode({ value, size }: { value: string; size: number }) {
    return <Text testID="qrcode-stub">{`${value}|${size}`}</Text>;
  }
  return QRCode;
});

import { QrCode } from '../../src/components/QrCode';

describe('QrCode', () => {
  it('renders the underlying QRCode at the default 200px size', () => {
    const { getByTestId } = render(<QrCode value="hello" />);
    expect(getByTestId('qrcode-stub').props.children).toBe('hello|200');
  });

  it('forwards the custom size', () => {
    const { getByTestId } = render(<QrCode value="hello" size={320} />);
    expect(getByTestId('qrcode-stub').props.children).toBe('hello|320');
  });

  it('substitutes a single space when value is empty (prevents qrcode-svg crash on "")', () => {
    const { getByTestId } = render(<QrCode value="" />);
    expect(getByTestId('qrcode-stub').props.children).toBe(' |200');
  });
});
