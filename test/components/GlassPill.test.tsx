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
import { GlassPill } from '../../src/components/GlassPill';
// eslint-disable-next-line import/first
import { GlassSurface } from '../../src/components/GlassSurface';
// eslint-disable-next-line import/first
import {
  Card,
  Radius,
  ThemeProvider,
  useThemeStore,
  Interaction,
  darkColors,
  lightColors,
} from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

describe('GlassPill', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'light' }));

  it('renders the "default" glass variant when not selected, "lead" when selected', () => {
    const notSelected = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined}>Kauf</GlassPill>
      </ThemeProvider>,
    );
    expect(notSelected.UNSAFE_getByType(GlassSurface).props.variant).toBe('default');
    notSelected.unmount();

    const selected = render(
      <ThemeProvider>
        <GlassPill selected onPress={() => undefined}>
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    expect(selected.UNSAFE_getByType(GlassSurface).props.variant).toBe('lead');
  });

  it('tints a text child with colors.primary when selected', () => {
    const { getByText } = render(
      <ThemeProvider>
        <GlassPill selected onPress={() => undefined}>
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    const label = getByText('Kauf');
    const flat = StyleSheet.flatten(label.props.style) as Record<string, unknown>;
    expect(flat.color).toBe(lightColors.primary);
  });

  it('gives an unselected text child colors.text, in light and dark', () => {
    useThemeStore.setState({ mode: 'light' });
    const light = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined}>Kauf</GlassPill>
      </ThemeProvider>,
    );
    expect(flatten(light.getByText('Kauf').props.style).color).toBe(lightColors.text);
    light.unmount();

    useThemeStore.setState({ mode: 'dark' });
    const dark = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined}>Kauf</GlassPill>
      </ThemeProvider>,
    );
    expect(flatten(dark.getByText('Kauf').props.style).color).toBe(darkColors.text);
  });

  it('fires onPress when tapped and ignores taps while disabled', () => {
    const onPress = jest.fn();
    const { getByTestId, rerender } = render(
      <ThemeProvider>
        <GlassPill onPress={onPress} testID="pill">
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('pill'));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(
      <ThemeProvider>
        <GlassPill onPress={onPress} disabled testID="pill">
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('pill'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sets accessibilityState.selected automatically, overridable by an explicit state', () => {
    const { getByTestId, rerender } = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined} selected testID="pill">
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    // `toMatchObject` — RN's own renderer may add further accessibility-state
    // keys (e.g. `busy: undefined`) beyond what was actually passed in.
    expect(getByTestId('pill').props.accessibilityState).toMatchObject({ selected: true });

    rerender(
      <ThemeProvider>
        <GlassPill
          onPress={() => undefined}
          selected
          disabled
          accessibilityState={{ selected: false }}
          testID="pill"
        >
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    expect(getByTestId('pill').props.accessibilityState).toMatchObject({
      selected: false,
      disabled: true,
    });
  });

  it('passes accessibilityRole/Label/Hint through to the Pressable', () => {
    const { getByLabelText } = render(
      <ThemeProvider>
        <GlassPill
          onPress={() => undefined}
          accessibilityRole="button"
          accessibilityLabel="Filter: all"
          accessibilityHint="Shows every transaction"
        >
          All
        </GlassPill>
      </ThemeProvider>,
    );
    const node = getByLabelText('Filter: all');
    expect(node.props.accessibilityRole).toBe('button');
    expect(node.props.accessibilityHint).toBe('Shows every transaction');
  });

  it('switches an unselected, enabled pill to "lead" while pressed', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined} testID="pill">
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    expect(getByTestId('pill').findByType(GlassSurface).props.variant).toBe('default');

    fireEvent(getByTestId('pill'), 'pressIn');
    expect(getByTestId('pill').findByType(GlassSurface).props.variant).toBe('lead');

    fireEvent(getByTestId('pill'), 'pressOut');
    expect(getByTestId('pill').findByType(GlassSurface).props.variant).toBe('default');
  });

  it('a disabled pill dims but never shows the pressed "lead" swap', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined} disabled testID="pill">
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    const restSurface = getByTestId('pill').findByType(GlassSurface);
    expect(flatten(restSurface.props.style).opacity).toBe(Interaction.disabledOpacity);

    fireEvent(getByTestId('pill'), 'pressIn');
    expect(getByTestId('pill').findByType(GlassSurface).props.variant).toBe('default');
  });

  it('shape="tile" renders at Radius.lg instead of the pill radius', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined} shape="tile" testID="tile">
          <Text>Quorum option</Text>
        </GlassPill>
      </ThemeProvider>,
    );
    expect(getByTestId('tile').findByType(GlassSurface).props.radius).toBe(Radius.lg);
  });

  it('defaults shape="pill" to the pill radius', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined} testID="pill">
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    expect(getByTestId('pill').findByType(GlassSurface).props.radius).toBe(Radius.pill);
  });

  it.each([
    ['accent', lightColors.primary],
    ['warning', lightColors.warning],
    ['danger', lightColors.error],
    ['success', lightColors.success],
  ] as const)('tone="%s" tints the glass edge with the theme token', (tone, expected) => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassPill onPress={() => undefined} tone={tone} testID="pill">
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    const style = flatten(getByTestId('pill').findByType(GlassSurface).props.style);
    expect(style.borderColor).toBe(expected);
    expect(style.borderWidth).toBe(Card.borderWidth + 0.5);
  });

  it('contentStyle reaches the inner surface while style reaches the outer Pressable', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassPill
          onPress={() => undefined}
          style={{ flex: 1 }}
          contentStyle={{ paddingVertical: 30 }}
          testID="pill"
        >
          Kauf
        </GlassPill>
      </ThemeProvider>,
    );
    expect(flatten(getByTestId('pill').props.style).flex).toBe(1);
    const surfaceStyle = flatten(getByTestId('pill').findByType(GlassSurface).props.style);
    expect(surfaceStyle.paddingVertical).toBe(30);
  });
});
