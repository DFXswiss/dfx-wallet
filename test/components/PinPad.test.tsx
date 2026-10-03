import type { ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render, within } from '@testing-library/react-native';
import { GlassSurface } from '../../src/components/GlassSurface';
import { PinPad } from '../../src/components/PinPad';
import { lightColors } from '@/theme';

type PinPadProps = ComponentProps<typeof PinPad>;

function renderPad(overrides: Partial<PinPadProps> = {}) {
  const onDigit = jest.fn();
  const onDelete = jest.fn();
  const utils = render(
    <PinPad
      value=""
      onDigit={onDigit}
      onDelete={onDelete}
      dotsTestID="test-dots"
      {...overrides}
    />,
  );
  return { ...utils, onDigit, onDelete };
}

function flatStyles(views: readonly { props: { style?: unknown } }[]) {
  return views.map((v) => StyleSheet.flatten(v.props.style as StyleProp<ViewStyle>));
}

describe('PinPad', () => {
  it('renders 12 cells: 11 keys plus the blank spacer', () => {
    const { getAllByTestId } = renderPad();
    expect(getAllByTestId(/^pin-key-|^pin-pad-spacer$/)).toHaveLength(12);
  });

  it('renders a GlassSurface with the quiet variant for every key', () => {
    const { UNSAFE_getAllByType } = renderPad();
    const surfaces = UNSAFE_getAllByType(GlassSurface);
    expect(surfaces).toHaveLength(11);
    for (const surface of surfaces) {
      expect(surface.props.variant).toBe('quiet');
    }
  });

  it('calls onDigit with the pressed digit', () => {
    const { getByTestId, onDigit } = renderPad();
    fireEvent.press(getByTestId('pin-key-5'));
    expect(onDigit).toHaveBeenCalledWith('5');
  });

  it('calls onDelete when the delete key is pressed', () => {
    const { getByTestId, onDelete } = renderPad();
    fireEvent.press(getByTestId('pin-key-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call back when disabled', () => {
    const { getByTestId, onDigit, onDelete } = renderPad({ disabled: true });
    fireEvent.press(getByTestId('pin-key-5'));
    fireEvent.press(getByTestId('pin-key-delete'));
    expect(onDigit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('fills dots up to value.length', () => {
    const { getByTestId } = renderPad({ value: '123' });
    const dots = flatStyles(within(getByTestId('test-dots')).UNSAFE_getAllByType(View));
    expect(dots).toHaveLength(6);
    expect(dots.filter((s) => s.backgroundColor === lightColors.primary)).toHaveLength(3);
  });

  it('colors the dot ring with the error color when error is set', () => {
    const { getByTestId } = renderPad({ value: '1', error: true });
    const dots = flatStyles(within(getByTestId('test-dots')).UNSAFE_getAllByType(View));
    expect(dots.every((s) => s.borderColor === lightColors.error)).toBe(true);
  });
});
