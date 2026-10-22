import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AmountKeypad, type AmountKey } from '../../src/components/AmountKeypad';
import { GlassSurface } from '../../src/components/GlassSurface';
import {
  PIN_KEY_MARGIN,
  PIN_KEY_SIZE,
  PIN_PAD_WIDTH,
  PinPad,
} from '../../src/components/PinPad';

const flat = (node: { props: { style?: unknown } }): ViewStyle =>
  StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {};

const ORDER: [AmountKey, string][] = [
  ['1', 'amount-key-1'],
  ['2', 'amount-key-2'],
  ['3', 'amount-key-3'],
  ['4', 'amount-key-4'],
  ['5', 'amount-key-5'],
  ['6', 'amount-key-6'],
  ['7', 'amount-key-7'],
  ['8', 'amount-key-8'],
  ['9', 'amount-key-9'],
  ['.', 'amount-key-dot'],
  ['0', 'amount-key-0'],
  ['del', 'amount-key-delete'],
];

describe('AmountKeypad', () => {
  it('renders twelve keys in the PIN pad order: 1-9, separator, 0, delete', () => {
    const { getAllByTestId } = render(<AmountKeypad onKey={jest.fn()} />);
    const ids = getAllByTestId(/^amount-key-/).map((node) => node.props.testID);
    expect(ids).toEqual(ORDER.map(([, id]) => id));
  });

  it.each(ORDER)('reports key %s when %s is pressed', (key, testID) => {
    const onKey = jest.fn();
    const { getByTestId } = render(<AmountKeypad onKey={onKey} />);
    fireEvent.press(getByTestId(testID));
    expect(onKey).toHaveBeenCalledTimes(1);
    expect(onKey).toHaveBeenCalledWith(key);
  });

  it('does not report presses while disabled', () => {
    const onKey = jest.fn();
    const { getByTestId } = render(<AmountKeypad onKey={onKey} disabled />);
    fireEvent.press(getByTestId('amount-key-5'));
    expect(onKey).not.toHaveBeenCalled();
  });

  it('sits on the same 280 px raster as the PIN pad', () => {
    const { getByTestId } = render(<AmountKeypad onKey={jest.fn()} testID="pad" />);
    expect(PIN_PAD_WIDTH).toBe(280);
    expect(flat(getByTestId('pad')).width).toBe(PIN_PAD_WIDTH);
    expect(flat(getByTestId('amount-key-1')).width).toBe(PIN_KEY_SIZE + 2 * PIN_KEY_MARGIN);

    // The PIN pad's own numpad is exactly as wide, so the two line up.
    const pin = render(<PinPad value="" onDigit={jest.fn()} onDelete={jest.fn()} dotsTestID="d" />);
    const widths = pin.UNSAFE_getAllByType(View).map((view) => flat(view).width);
    expect(widths).toContain(PIN_PAD_WIDTH);
  });

  it('draws plain text keys without a glass surface per key', () => {
    const { UNSAFE_queryAllByType, getByText } = render(<AmountKeypad onKey={jest.fn()} />);
    expect(UNSAFE_queryAllByType(GlassSurface)).toHaveLength(0);
    expect(getByText('7')).toBeTruthy();
  });

  it('labels the non-digit keys for screen readers', () => {
    const { getByLabelText } = render(<AmountKeypad onKey={jest.fn()} />);
    expect(getByLabelText('Delete')).toBeTruthy();
    expect(getByLabelText('Decimal separator')).toBeTruthy();
  });
});
