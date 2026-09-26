import React from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Svg, { LinearGradient, Rect, Stop } from 'react-native-svg';
import { render } from '@testing-library/react-native';
import { ScreenBackdrop, type ScreenBackdropVariant } from '../../src/components/ScreenBackdrop';
import { ThemeProvider, useThemeStore } from '@/theme';

// Only needed for the DfxBackgroundScreen passthrough test below: jest-expo
// does not mock react-native-safe-area-context, and SafeAreaView needs an
// insets provider to render in a plain jest environment.
jest.mock('react-native-safe-area-context', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <RNView {...rest}>{children}</RNView>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => (
      <RNView>{children}</RNView>
    ),
  };
});

// eslint-disable-next-line import/first
import { DfxBackgroundScreen } from '../../src/components/DfxBackgroundScreen';

function renderBackdrop(variant?: ScreenBackdropVariant) {
  return render(
    <ThemeProvider>
      <ScreenBackdrop {...(variant ? { variant } : {})} />
    </ThemeProvider>,
  );
}

describe('ScreenBackdrop', () => {
  it('renders the same layer structure (View/Image/Svg/gradients/rects) in both themes', () => {
    useThemeStore.setState({ mode: 'light' });
    const light = renderBackdrop();
    const lightCounts = {
      views: light.UNSAFE_getAllByType(View).length,
      images: light.UNSAFE_getAllByType(Image).length,
      svgs: light.UNSAFE_getAllByType(Svg).length,
      gradients: light.UNSAFE_getAllByType(LinearGradient).length,
      rects: light.UNSAFE_getAllByType(Rect).length,
    };
    light.unmount();

    useThemeStore.setState({ mode: 'dark' });
    const dark = renderBackdrop();
    const darkCounts = {
      views: dark.UNSAFE_getAllByType(View).length,
      images: dark.UNSAFE_getAllByType(Image).length,
      svgs: dark.UNSAFE_getAllByType(Svg).length,
      gradients: dark.UNSAFE_getAllByType(LinearGradient).length,
      rects: dark.UNSAFE_getAllByType(Rect).length,
    };

    expect(lightCounts).toEqual(darkCounts);
    expect(lightCounts).toEqual({ views: 2, images: 1, svgs: 1, gradients: 2, rects: 2 });
  });

  it('uses the light photo in light mode and the dark photo in dark mode', () => {
    useThemeStore.setState({ mode: 'light' });
    const light = renderBackdrop();
    expect(light.UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/dashboard-bg-light.jpg'),
    );
    light.unmount();

    useThemeStore.setState({ mode: 'dark' });
    const dark = renderBackdrop();
    expect(dark.UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/dashboard-bg-dark.jpg'),
    );
  });

  it('sizes the Image explicitly to the window dimensions (regression: an unsized Image kept the asset intrinsic size and cropped off-centre)', () => {
    useThemeStore.setState({ mode: 'light' });
    const { UNSAFE_getByType } = renderBackdrop();
    const { width, height } = Dimensions.get('window');
    const flat = StyleSheet.flatten(UNSAFE_getByType(Image).props.style);
    expect(flat.width).toBe(width);
    expect(flat.height).toBe(height);
  });

  it('swaps in the pay photo for variant="pay" in light mode', () => {
    useThemeStore.setState({ mode: 'light' });
    const light = renderBackdrop('pay');
    expect(light.UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/pay-bg.png'),
    );
  });

  it('keeps the dark photo for variant="pay" in dark mode', () => {
    useThemeStore.setState({ mode: 'dark' });
    const dark = renderBackdrop('pay');
    expect(dark.UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/dashboard-bg-dark.jpg'),
    );
  });

  it('renders the dark top scrim with the spec stops', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { UNSAFE_getAllByType } = renderBackdrop();
    const topStops = UNSAFE_getAllByType(Stop).slice(0, 4);
    expect(topStops.map((stop) => [stop.props.offset, stop.props.stopOpacity])).toEqual([
      ['0%', '0.78'],
      ['14%', '0.44'],
      ['32%', '0.36'],
      ['52%', '0'],
    ]);
  });

  it('renders the light bottom scrim fully transparent', () => {
    useThemeStore.setState({ mode: 'light' });
    const { UNSAFE_getAllByType } = renderBackdrop();
    // Light's top scrim has 3 stops; everything after that is the bottom scrim.
    const bottomStops = UNSAFE_getAllByType(Stop).slice(3);
    expect(bottomStops.length).toBeGreaterThan(0);
    for (const stop of bottomStops) {
      expect(stop.props.stopOpacity).toBe('0');
    }
  });

  it('renders the same layer structure for variant="pin" as for "default"', () => {
    useThemeStore.setState({ mode: 'light' });
    const countsOf = (result: ReturnType<typeof renderBackdrop>) => ({
      views: result.UNSAFE_getAllByType(View).length,
      images: result.UNSAFE_getAllByType(Image).length,
      svgs: result.UNSAFE_getAllByType(Svg).length,
      gradients: result.UNSAFE_getAllByType(LinearGradient).length,
      rects: result.UNSAFE_getAllByType(Rect).length,
    });

    const defaultResult = renderBackdrop();
    const defaultCounts = countsOf(defaultResult);
    defaultResult.unmount();

    const pinResult = renderBackdrop('pin');
    expect(countsOf(pinResult)).toEqual(defaultCounts);
  });

  it('uses the default photo (not the pay photo) for variant="pin" in both themes', () => {
    useThemeStore.setState({ mode: 'light' });
    const light = renderBackdrop('pin');
    expect(light.UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/dashboard-bg-light.jpg'),
    );
    light.unmount();

    useThemeStore.setState({ mode: 'dark' });
    const dark = renderBackdrop('pin');
    expect(dark.UNSAFE_getByType(Image).props.source).toEqual(
      require('../../assets/dashboard-bg-dark.jpg'),
    );
  });

  it('renders the pin top scrim with the stronger spec stops in light mode', () => {
    useThemeStore.setState({ mode: 'light' });
    const { UNSAFE_getAllByType } = renderBackdrop('pin');
    const topStops = UNSAFE_getAllByType(Stop).slice(0, 4);
    expect(topStops.map((stop) => [stop.props.offset, stop.props.stopOpacity])).toEqual([
      ['0%', '0.62'],
      ['30%', '0.52'],
      ['44%', '0.38'],
      ['58%', '0'],
    ]);
  });

  it('renders the pin top scrim with the stronger spec stops in dark mode', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { UNSAFE_getAllByType } = renderBackdrop('pin');
    const topStops = UNSAFE_getAllByType(Stop).slice(0, 4);
    expect(topStops.map((stop) => [stop.props.offset, stop.props.stopOpacity])).toEqual([
      ['0%', '0.86'],
      ['30%', '0.66'],
      ['44%', '0.50'],
      ['58%', '0'],
    ]);
  });
});

describe('DfxBackgroundScreen backdropVariant passthrough', () => {
  it('passes backdropVariant="pin" through to ScreenBackdrop', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { UNSAFE_getAllByType } = render(
      <ThemeProvider>
        <DfxBackgroundScreen backdropVariant="pin">
          <View />
        </DfxBackgroundScreen>
      </ThemeProvider>,
    );
    // Dark pin's first top-scrim stop (0.86) only appears when the variant
    // prop actually reached ScreenBackdrop; default's dark stop is 0.78.
    const firstTopStop = UNSAFE_getAllByType(Stop)[0];
    expect(firstTopStop?.props.stopOpacity).toBe('0.86');
  });
});
