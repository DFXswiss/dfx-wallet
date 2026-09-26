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
import { GlassCard } from '../../src/components/GlassCard';
// eslint-disable-next-line import/first
import { GlassSurface } from '../../src/components/GlassSurface';
// eslint-disable-next-line import/first
import { ThemeProvider, useThemeStore, Card, Interaction, lightColors } from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

describe('GlassCard', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'light' }));

  it('defaults to Card.padding and Card.radius', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassCard testID="card">
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    const style = flatten(getByTestId('card').props.style);
    expect(style.padding).toBe(Card.padding);
    expect(style.borderRadius).toBe(Card.radius);
  });

  it('accepts explicit padding/radius overrides', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassCard testID="card" padding={4} radius={2}>
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    const style = flatten(getByTestId('card').props.style);
    expect(style.padding).toBe(4);
    expect(style.borderRadius).toBe(2);
  });

  it('is not pressable without onPress: exactly one glass surface, no Pressable wrapper', () => {
    const { UNSAFE_queryAllByType } = render(
      <ThemeProvider>
        <GlassCard testID="card">
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    expect(UNSAFE_queryAllByType(GlassSurface)).toHaveLength(1);
  });

  it('with onPress: fires the callback and switches the glass to "lead" while pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassCard testID="card" onPress={onPress}>
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('card'));
    expect(onPress).toHaveBeenCalledTimes(1);

    expect(getByTestId('card').findByType(GlassSurface).props.variant).toBe('default');

    fireEvent(getByTestId('card'), 'pressIn');
    expect(getByTestId('card').findByType(GlassSurface).props.variant).toBe('lead');

    fireEvent(getByTestId('card'), 'pressOut');
    expect(getByTestId('card').findByType(GlassSurface).props.variant).toBe('default');
  });

  it('when disabled: dims by Interaction.disabledOpacity and drops the callback', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassCard testID="card" onPress={onPress} disabled>
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('card'));
    expect(onPress).not.toHaveBeenCalled();

    const surface = getByTestId('card').findByType(GlassSurface);
    expect(flatten(surface.props.style).opacity).toBe(Interaction.disabledOpacity);
  });

  it('passes accessibility props through to the interactive element', () => {
    const { getByLabelText } = render(
      <ThemeProvider>
        <GlassCard
          onPress={() => undefined}
          accessibilityRole="button"
          accessibilityLabel="Delete wallet"
          accessibilityHint="Removes the wallet"
        >
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    const node = getByLabelText('Delete wallet');
    expect(node.props.accessibilityRole).toBe('button');
    expect(node.props.accessibilityHint).toBe('Removes the wallet');
  });

  it.each([
    ['accent', lightColors.primary],
    ['warning', lightColors.warning],
    ['danger', lightColors.error],
    ['success', lightColors.success],
  ] as const)('tone="%s" tints the glass edge with the theme token', (tone, expected) => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassCard testID="card" tone={tone}>
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    const style = flatten(getByTestId('card').props.style);
    expect(style.borderColor).toBe(expected);
    expect(style.borderWidth).toBe(Card.borderWidth + 0.5);
  });

  it('tone="default" renders no edge tint', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassCard testID="card">
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    const style = flatten(getByTestId('card').props.style);
    expect(style.borderColor).toBeUndefined();
  });

  it('contentStyle reaches the inner surface while style reaches the outer Pressable', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassCard
          testID="card"
          onPress={() => undefined}
          style={{ flex: 1 }}
          contentStyle={{ paddingVertical: 30 }}
        >
          <Text>content</Text>
        </GlassCard>
      </ThemeProvider>,
    );
    const outer = flatten(getByTestId('card').props.style);
    expect(outer.flex).toBe(1);
    expect(outer.paddingVertical).toBeUndefined();

    const surface = getByTestId('card').findByType(GlassSurface);
    expect(flatten(surface.props.style).paddingVertical).toBe(30);
  });
});
