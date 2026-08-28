import React from 'react';
import { render } from '@testing-library/react-native';

// `Redirect` from expo-router writes nothing to the DOM by default — stub
// it to emit a Text node carrying the target href so we can assert on
// `app/index.tsx`'s routing decisions.
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text testID="redirect-target">{href}</Text>;
  },
}));

import Index from '../../app/index';
import { useAuthStore } from '@/store';

describe('app/index.tsx initial routing', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isOnboarded: false,
      isAuthenticated: false,
      isDfxAuthenticated: false,
    });
  });

  it('redirects to the welcome flow when the user has never onboarded', () => {
    useAuthStore.setState({ isOnboarded: false });
    const { getByTestId } = render(<Index />);
    expect(getByTestId('redirect-target').props.children).toBe('/(onboarding)/welcome');
  });

  it('redirects to PIN verify when onboarded but not yet authenticated', () => {
    useAuthStore.setState({ isOnboarded: true, isAuthenticated: false });
    const { getByTestId } = render(<Index />);
    expect(getByTestId('redirect-target').props.children).toBe('/(pin)/verify');
  });

  it('redirects to the dashboard when the user is fully authenticated', () => {
    useAuthStore.setState({ isOnboarded: true, isAuthenticated: true });
    const { getByTestId } = render(<Index />);
    expect(getByTestId('redirect-target').props.children).toBe('/(auth)/(tabs)/dashboard');
  });
});
