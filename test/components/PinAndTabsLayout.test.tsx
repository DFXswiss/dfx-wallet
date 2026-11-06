import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  function Stack({ children }: { children?: React.ReactNode }) {
    return <View testID="stack-rendered">{children}</View>;
  }
  // The TabsLayout passes children as <Stack.Screen> declarations.
  function Screen({ name }: { name?: string }) {
    const { Text } = jest.requireActual('react-native');
    return <Text testID={`stack-screen-${name ?? 'unknown'}`}>{name}</Text>;
  }
  Stack.Screen = Screen;
  return { Stack };
});

import PinLayout from '../../app/(pin)/_layout';
import TabsLayout, { unstable_settings } from '../../app/(auth)/(tabs)/_layout';

describe('PinLayout', () => {
  it('renders a single Stack with no Screen children', () => {
    const { getByTestId } = render(<PinLayout />);
    expect(getByTestId('stack-rendered')).toBeTruthy();
  });
});

describe('TabsLayout', () => {
  it('registers the dashboard + settings screens explicitly', () => {
    const { getByTestId } = render(<TabsLayout />);
    expect(getByTestId('stack-rendered')).toBeTruthy();
    expect(getByTestId('stack-screen-dashboard')).toBeTruthy();
    expect(getByTestId('stack-screen-settings')).toBeTruthy();
  });

  it('pins the initial route to "dashboard" so reloads / deep-links land there', () => {
    expect(unstable_settings.initialRouteName).toBe('dashboard');
  });
});
