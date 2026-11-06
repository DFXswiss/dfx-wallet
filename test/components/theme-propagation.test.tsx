/**
 * JK's core question: "if I change a token, does the design adapt on its
 * own, everywhere?" This overrides a live `ThemeColors` value at test time
 * — no edit to any component file — and shows a consumer picks up the new
 * value on its next render.
 *
 * `GlassCard`'s own look (blur/overlay/edge) comes from the shared glass
 * *recipe* in `theme/glass.ts`, not from a `ThemeColors` field, so it isn't
 * a live-value example itself — `GlassListGroup.Row`'s divider is used
 * instead, since it (like `GlassCard`) is one of the new Part-B glass
 * modules and it does read a live `ThemeColors` field per render.
 */
import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import { BrandLogo } from '../../src/components/BrandLogo';
import { GlassListGroup } from '../../src/components/GlassListGroup';
import { ThemeProvider, useThemeStore, lightColors, darkColors } from '@/theme';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <View {...props} />;
  }
  return { BlurView };
});

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

describe('theme propagation', () => {
  it('BrandLogo renders whatever ThemeColors.logoInk holds, without touching BrandLogo.tsx', () => {
    useThemeStore.setState({ mode: 'light' });
    const original = lightColors.logoInk;

    const before = render(
      <ThemeProvider>
        <BrandLogo />
      </ThemeProvider>,
    );
    const wordmarkBefore = before.UNSAFE_getByProps({ fillRule: 'evenodd' });
    expect(wordmarkBefore.props.fill).toBe(original);
    before.unmount();

    lightColors.logoInk = '#123456';
    try {
      const after = render(
        <ThemeProvider>
          <BrandLogo />
        </ThemeProvider>,
      );
      const wordmarkAfter = after.UNSAFE_getByProps({ fillRule: 'evenodd' });
      expect(wordmarkAfter.props.fill).toBe('#123456');
    } finally {
      lightColors.logoInk = original;
    }
  });

  it('GlassListGroup.Row renders whatever ThemeColors.divider holds, no code change', () => {
    useThemeStore.setState({ mode: 'dark' });
    const original = darkColors.divider;

    darkColors.divider = 'rgba(1,2,3,0.9)';
    try {
      const { getByTestId } = render(
        <ThemeProvider>
          <GlassListGroup>
            <GlassListGroup.Row testID="row-a">
              <Text>a</Text>
            </GlassListGroup.Row>
            <GlassListGroup.Row testID="row-b" last>
              <Text>b</Text>
            </GlassListGroup.Row>
          </GlassListGroup>
        </ThemeProvider>,
      );
      expect(flatten(getByTestId('row-a').props.style).borderBottomColor).toBe(
        'rgba(1,2,3,0.9)',
      );
    } finally {
      darkColors.divider = original;
    }
  });
});
