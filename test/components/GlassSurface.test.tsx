import React from 'react';
import { Text } from 'react-native';
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

function renderGlass() {
  return render(
    <ThemeProvider>
      <GlassSurface>
        <Text>inner</Text>
      </GlassSurface>
    </ThemeProvider>,
  );
}

describe('GlassSurface', () => {
  it('renders no BlurView in light and exactly one in dark', () => {
    useThemeStore.setState({ mode: 'light' });
    const light = renderGlass();
    expect(light.UNSAFE_queryAllByType(BlurView)).toHaveLength(0);
    light.unmount();

    useThemeStore.setState({ mode: 'dark' });
    const dark = renderGlass();
    expect(dark.UNSAFE_queryAllByType(BlurView)).toHaveLength(1);
  });
});
