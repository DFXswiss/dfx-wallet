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
import { GlassListGroup } from '../../src/components/GlassListGroup';
// eslint-disable-next-line import/first
import { ThemeProvider, useThemeStore, lightColors } from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

function renderGroup() {
  return render(
    <ThemeProvider>
      <GlassListGroup testID="group">
        <GlassListGroup.Row testID="row-1">
          <Text>one</Text>
        </GlassListGroup.Row>
        <GlassListGroup.Row testID="row-2" last>
          <Text>two</Text>
        </GlassListGroup.Row>
      </GlassListGroup>
    </ThemeProvider>,
  );
}

describe('GlassListGroup', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'light' }));

  it('renders a divider on every row except the one marked last', () => {
    const { getByTestId } = renderGroup();
    const row1 = flatten(getByTestId('row-1').props.style);
    const row2 = flatten(getByTestId('row-2').props.style);
    expect(row1.borderBottomColor).toBe(lightColors.divider);
    expect(row2.borderBottomColor).toBeUndefined();
  });

  it('renders a Pressable row (not a plain View) when onPress is given, and fires it', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassListGroup>
          <GlassListGroup.Row testID="pressable-row" onPress={onPress} last>
            <Text>tap me</Text>
          </GlassListGroup.Row>
        </GlassListGroup>
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('pressable-row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
