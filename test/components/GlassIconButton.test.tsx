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
import { Interaction, ThemeProvider, useThemeStore } from '@/theme';

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

  it('defaults accessibilityRole to "button" but lets a caller override it', () => {
    const { getByTestId, rerender } = render(
      <ThemeProvider>
        <GlassIconButton
          icon={<Text>i</Text>}
          onPress={() => undefined}
          accessibilityLabel="Menu"
          testID="btn"
        />
      </ThemeProvider>,
    );
    expect(getByTestId('btn').props.accessibilityRole).toBe('button');

    rerender(
      <ThemeProvider>
        <GlassIconButton
          icon={<Text>i</Text>}
          onPress={() => undefined}
          accessibilityLabel="Menu"
          accessibilityRole="link"
          accessibilityHint="Opens the menu"
          testID="btn"
        />
      </ThemeProvider>,
    );
    expect(getByTestId('btn').props.accessibilityRole).toBe('link');
    expect(getByTestId('btn').props.accessibilityHint).toBe('Opens the menu');
  });

  it('when disabled: dims via Interaction.disabledOpacity, no callback, no "lead" on press', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassIconButton
          icon={<Text>i</Text>}
          onPress={onPress}
          disabled
          accessibilityLabel="Menu"
          testID="btn"
        />
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();

    const surface = getByTestId('btn').findByType(GlassSurface);
    expect(flatten(surface.props.style).opacity).toBe(Interaction.disabledOpacity);

    // A disabled Pressable never registers the touch, so no pressed re-render
    // happens — the surface should still read the resting `quiet` variant.
    fireEvent(getByTestId('btn'), 'pressIn');
    expect(getByTestId('btn').findByType(GlassSurface).props.variant).toBe('quiet');
  });

  it('switches to "lead" while pressed when enabled', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassIconButton
          icon={<Text>i</Text>}
          onPress={() => undefined}
          accessibilityLabel="Menu"
          testID="btn"
        />
      </ThemeProvider>,
    );
    expect(getByTestId('btn').findByType(GlassSurface).props.variant).toBe('quiet');

    fireEvent(getByTestId('btn'), 'pressIn');
    expect(getByTestId('btn').findByType(GlassSurface).props.variant).toBe('lead');

    fireEvent(getByTestId('btn'), 'pressOut');
    expect(getByTestId('btn').findByType(GlassSurface).props.variant).toBe('quiet');
  });

  it('style reaches the outer Pressable, contentStyle reaches the inner surface', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassIconButton
          icon={<Text>i</Text>}
          onPress={() => undefined}
          accessibilityLabel="Menu"
          testID="btn"
          style={{ marginTop: 12 }}
          contentStyle={{ borderColor: 'red' }}
        />
      </ThemeProvider>,
    );
    expect(flatten(getByTestId('btn').props.style).marginTop).toBe(12);

    const surface = getByTestId('btn').findByType(GlassSurface);
    expect(flatten(surface.props.style).borderColor).toBe('red');
  });
});
