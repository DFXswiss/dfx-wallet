import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <View {...props} />;
  }
  return { BlurView };
});

// eslint-disable-next-line import/first
import { GlassIconButton } from '../../src/components/GlassIconButton';
// eslint-disable-next-line import/first
import { GlassSurface } from '../../src/components/GlassSurface';
// eslint-disable-next-line import/first
import { ThemeProvider, useThemeStore } from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

describe('GlassIconButton', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'light' }));

  it('defaults to a 40x40 button with a proportional radius', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassIconButton
          icon={<Text>i</Text>}
          onPress={() => undefined}
          accessibilityLabel="test"
          testID="btn"
        />
      </ThemeProvider>,
    );
    const surface = getByTestId('btn').findByType(GlassSurface);
    const style = flatten(surface.props.style);
    expect(style.width).toBe(40);
    expect(style.height).toBe(40);
    expect(surface.props.radius).toBe(12);
  });

  it('scales the radius with an explicit size', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassIconButton
          icon={<Text>i</Text>}
          onPress={() => undefined}
          size={44}
          accessibilityLabel="test"
          testID="btn"
        />
      </ThemeProvider>,
    );
    const surface = getByTestId('btn').findByType(GlassSurface);
    expect(surface.props.radius).toBe(13);
  });

  it('fires onPress and carries the accessibility label', () => {
    const onPress = jest.fn();
    const { getByTestId, getByLabelText } = render(
      <ThemeProvider>
        <GlassIconButton
          icon={<Text>i</Text>}
          onPress={onPress}
          accessibilityLabel="Menu"
          testID="btn"
        />
      </ThemeProvider>,
    );
    expect(getByLabelText('Menu')).toBeTruthy();
    fireEvent.press(getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
