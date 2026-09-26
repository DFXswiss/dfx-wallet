import React from 'react';
import { StyleSheet } from 'react-native';
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
import { ThemeProvider, useThemeStore, lightColors } from '@/theme';

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
});
