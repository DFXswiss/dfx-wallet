import { Image, View } from 'react-native';
import Svg, { LinearGradient, Rect, Stop } from 'react-native-svg';
import { render } from '@testing-library/react-native';
import { ScreenBackdrop, type ScreenBackdropVariant } from '../../src/components/ScreenBackdrop';
import { ThemeProvider, useThemeStore } from '@/theme';

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
});
