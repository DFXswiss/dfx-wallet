import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { pricingService } from '@/services/pricing-service';

// expo-router's Stack + StatusBar are stubbed so the Root layout can mount
// in the test runtime without booting a navigator.
jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  function Stack({ children }: { children?: React.ReactNode }) {
    return <View testID="root-stack">{children}</View>;
  }
  function Screen({ name }: { name?: string }) {
    const { Text } = jest.requireActual('react-native');
    return <Text testID={`root-stack-screen-${name ?? 'unknown'}`}>{name}</Text>;
  }
  Stack.Screen = Screen;
  return { Stack };
});

jest.mock('expo-status-bar', () => {
  const { View } = jest.requireActual('react-native');
  function StatusBar() {
    return <View testID="status-bar" />;
  }
  return { StatusBar };
});

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  function GestureHandlerRootView({ children }: { children?: React.ReactNode }) {
    return <View testID="gh-root">{children}</View>;
  }
  return { GestureHandlerRootView };
});

// WdkAppProvider takes a `bundle` prop and renders children — stub the
// whole tree so the test does not touch the Bare worklet.
jest.mock('@tetherto/wdk-react-native-core', () => {
  const { View } = jest.requireActual('react-native');
  function WdkAppProvider({ children }: { children?: React.ReactNode }) {
    return <View testID="wdk-provider">{children}</View>;
  }
  return { WdkAppProvider };
});

// The Root layout imports `../.wdk` for the worklet bundle — replace with
// an empty object via the same path.
jest.mock('../../.wdk', () => ({ bundle: {} }), { virtual: true });

// OfflineBanner (mounted inside RootLayout) calls useNetInfo from
// `@react-native-community/netinfo`, which under jest-expo tries to
// reach into a native bridge. Replace it with a stable "online" reading
// so the banner returns null without throwing.
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}));

import RootLayout from '../../app/_layout';
import { useAuthStore, useWalletStore } from '@/store';

describe('RootLayout', () => {
  beforeEach(() => {
    // Both stores expose a manual hydrate(); spy on them to make sure the
    // root layout fires both on mount, not just one.
    jest.spyOn(useAuthStore.getState(), 'hydrate').mockResolvedValue(undefined);
    jest.spyOn(useWalletStore.getState(), 'hydrate').mockResolvedValue(undefined);
    useAuthStore.setState({ isHydrated: false });
    jest.spyOn(pricingService, 'startAutoRefresh').mockImplementation(() => undefined);
    jest.spyOn(pricingService, 'stopAutoRefresh').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('triggers both store hydrate() calls on mount', async () => {
    render(<RootLayout />);
    await waitFor(() => {
      expect(useAuthStore.getState().hydrate).toHaveBeenCalled();
      expect(useWalletStore.getState().hydrate).toHaveBeenCalled();
    });
  });

  it('starts the pricing auto-refresh timer with the 60s cadence', () => {
    render(<RootLayout />);
    expect(pricingService.startAutoRefresh).toHaveBeenCalledWith(60_000);
  });

  it('stops the pricing auto-refresh timer on unmount', () => {
    const { unmount } = render(<RootLayout />);
    unmount();
    expect(pricingService.stopAutoRefresh).toHaveBeenCalled();
  });

  it('renders a loading state until the auth store reports hydrated', () => {
    useAuthStore.setState({ isHydrated: false });
    const { queryByTestId } = render(<RootLayout />);
    // The Stack is only rendered once hydration completes; otherwise the
    // ActivityIndicator branch is active.
    expect(queryByTestId('root-stack')).toBeNull();
  });

  it('renders the stack once the auth store finishes hydration', () => {
    useAuthStore.setState({ isHydrated: true });
    const { getByTestId } = render(<RootLayout />);
    expect(getByTestId('root-stack')).toBeTruthy();
    expect(getByTestId('root-stack-screen-(onboarding)')).toBeTruthy();
    expect(getByTestId('root-stack-screen-(pin)')).toBeTruthy();
    expect(getByTestId('root-stack-screen-(auth)')).toBeTruthy();
  });
});
