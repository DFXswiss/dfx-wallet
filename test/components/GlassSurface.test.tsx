import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <View {...props} />;
  }
  return { BlurView };
});

// eslint-disable-next-line import/first
import { BlurView } from 'expo-blur';
// eslint-disable-next-line import/first
import { GlassSurface } from '../../src/components/GlassSurface';
// eslint-disable-next-line import/first
import { ThemeProvider, useThemeStore } from '@/theme';

type GlassVariant = 'quiet' | 'default' | 'lead';

function renderGlass(variant?: GlassVariant) {
  return render(
    <ThemeProvider>
      <GlassSurface {...(variant ? { variant } : {})}>
        <Text>inner</Text>
      </GlassSurface>
    </ThemeProvider>,
  );
}

function hasBackgroundColor(
  views: readonly { props: { style?: unknown } }[],
  color: string,
): boolean {
  return views.some(
    (node) =>
      StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>).backgroundColor === color,
  );
}

describe('GlassSurface', () => {
  it('renders BlurView tinted per scheme: light in light mode, dark in dark mode', () => {
    useThemeStore.setState({ mode: 'light' });
    const light = renderGlass();
    const lightBlurs = light.UNSAFE_queryAllByType(BlurView);
    expect(lightBlurs).toHaveLength(1);
    expect(lightBlurs[0]?.props.tint).toBe('light');
    light.unmount();

    useThemeStore.setState({ mode: 'dark' });
    const dark = renderGlass();
    expect(dark.UNSAFE_queryAllByType(BlurView)).toHaveLength(1);
  });
});

describe('GlassSurface light glass — "Stufe 2"', () => {
  it.each([
    ['quiet', 'rgba(255,255,255,0.18)'],
    ['default', 'rgba(255,255,255,0.24)'],
    ['lead', 'rgba(255,255,255,0.32)'],
  ] as const)('tints the %s variant with the light overlay', (variant, expectedColor) => {
    useThemeStore.setState({ mode: 'light' });
    const { UNSAFE_getAllByType } = renderGlass(variant);
    expect(hasBackgroundColor(UNSAFE_getAllByType(View), expectedColor)).toBe(true);
  });

  it('does not render an opaque #FFFFFF card fill', () => {
    useThemeStore.setState({ mode: 'light' });
    const { UNSAFE_getAllByType } = renderGlass();
    expect(hasBackgroundColor(UNSAFE_getAllByType(View), '#FFFFFF')).toBe(false);
  });

  it('renders the top hairline highlight in light mode', () => {
    useThemeStore.setState({ mode: 'light' });
    const { UNSAFE_getAllByType } = renderGlass();
    expect(hasBackgroundColor(UNSAFE_getAllByType(View), 'rgba(255,255,255,0.85)')).toBe(true);
  });
});

describe('GlassSurface dark glass — unchanged by the light "Stufe 2" pass', () => {
  it('keeps the dark overlay, no top hairline highlight', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { UNSAFE_getAllByType } = renderGlass();
    const views = UNSAFE_getAllByType(View);
    expect(hasBackgroundColor(views, 'rgba(11,30,54,0.38)')).toBe(true);
    expect(hasBackgroundColor(views, 'rgba(255,255,255,0.85)')).toBe(false);
  });
});
