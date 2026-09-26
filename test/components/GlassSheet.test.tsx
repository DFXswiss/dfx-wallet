import React from 'react';
import { Modal, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <View {...props} />;
  }
  return { BlurView };
});

// eslint-disable-next-line import/first
import { GlassSheet } from '../../src/components/GlassSheet';
// eslint-disable-next-line import/first
import { ThemeProvider, useThemeStore, lightColors } from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

describe('GlassSheet', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'light' }));

  it('renders nothing when not visible, and its content when visible', () => {
    const closed = render(
      <ThemeProvider>
        <GlassSheet visible={false} onRequestClose={() => undefined}>
          <Text>sheet body</Text>
        </GlassSheet>
      </ThemeProvider>,
    );
    expect(closed.queryByText('sheet body')).toBeNull();
    closed.unmount();

    const open = render(
      <ThemeProvider>
        <GlassSheet visible onRequestClose={() => undefined}>
          <Text>sheet body</Text>
        </GlassSheet>
      </ThemeProvider>,
    );
    expect(open.getByText('sheet body')).toBeTruthy();
  });

  it('scrims the backdrop with colors.scrimStrong', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassSheet visible onRequestClose={() => undefined} testID="sheet">
          <Text>sheet body</Text>
        </GlassSheet>
      </ThemeProvider>,
    );
    const backdrop = getByTestId('sheet-backdrop');
    expect(flatten(backdrop.props.style).backgroundColor).toBe(lightColors.scrimStrong);
  });

  it('calls onRequestClose when the backdrop is tapped, but not when the body is tapped', () => {
    const onRequestClose = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassSheet visible onRequestClose={onRequestClose} testID="sheet">
          <Text>sheet body</Text>
        </GlassSheet>
      </ThemeProvider>,
    );

    fireEvent.press(getByTestId('sheet-body'), { stopPropagation: jest.fn() });
    expect(onRequestClose).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('sheet-backdrop'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('forwards onRequestClose to the Modal (hardware back / swipe-down)', () => {
    const onRequestClose = jest.fn();
    const { UNSAFE_getByType } = render(
      <ThemeProvider>
        <GlassSheet visible onRequestClose={onRequestClose}>
          <Text>sheet body</Text>
        </GlassSheet>
      </ThemeProvider>,
    );
    expect(UNSAFE_getByType(Modal).props.onRequestClose).toBe(onRequestClose);
  });
});
