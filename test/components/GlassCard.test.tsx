import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';

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
import { ThemeProvider, useThemeStore, Card } from '@/theme';

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
});
