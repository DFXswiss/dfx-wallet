import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <View {...props} />;
  }
  return { BlurView };
});

// eslint-disable-next-line import/first
import { SeedWordTile } from '../../src/components/SeedWordTile';
// eslint-disable-next-line import/first
import { ThemeProvider, useThemeStore } from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

describe('SeedWordTile', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'light' }));

  it('renders the 1-based index and the word', () => {
    const { getByText } = render(
      <ThemeProvider>
        <SeedWordTile index={0} word="abandon" />
      </ThemeProvider>,
    );
    expect(getByText('1.')).toBeTruthy();
    expect(getByText('abandon')).toBeTruthy();
  });

  it('masks the word behind dots when hidden, keeping the index', () => {
    const { getByText, queryByText } = render(
      <ThemeProvider>
        <SeedWordTile index={11} word="zoo" hidden />
      </ThemeProvider>,
    );
    expect(getByText('12.')).toBeTruthy();
    expect(queryByText('zoo')).toBeNull();
    expect(getByText('••••')).toBeTruthy();
  });

  it('style reaches the tile itself, for width/flex in a grid', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <SeedWordTile index={0} word="abandon" style={{ width: '31%' }} testID="tile" />
      </ThemeProvider>,
    );
    expect(flatten(getByTestId('tile').props.style).width).toBe('31%');
  });
});
