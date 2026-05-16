import React from 'react';
import { render } from '@testing-library/react-native';

// jest.mock factories are hoisted above any local const. We create the
// spy fns inside each factory and expose them via a non-API export so the
// test can grab them after import.
jest.mock('@/hooks', () => {
  const useDeepLinkSpy = jest.fn();
  const useDfxAutoLinkSpy = jest.fn();
  const authenticateSilent = jest.fn();
  return {
    useReduceMotion: () => false,
    useDeepLink: () => useDeepLinkSpy(),
    useDfxAuth: () => ({
      authenticate: jest.fn(),
      authenticateSilent,
      reauthenticateAsOwner: jest.fn(),
      logout: jest.fn(),
      isAuthenticating: false,
      error: null,
    }),
    useDfxAutoLink: () => useDfxAutoLinkSpy(),
    __spies: { useDeepLinkSpy, useDfxAutoLinkSpy, authenticateSilent },
  };
});

jest.mock('@/features/dfx-backend/services', () => {
  const setOnUnauthorized = jest.fn();
  return { dfxApi: { setOnUnauthorized }, __spies: { setOnUnauthorized } };
});

const mockSegments: { current: string[] } = { current: ['(auth)', '(tabs)', 'dashboard'] };
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
    Stack: () => <Text testID="stack-rendered">stack</Text>,
    useSegments: () => mockSegments.current,
  };
});

import AuthLayout from '../../app/(auth)/_layout';
import { useAuthStore } from '@/store';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const hookSpies = (require('@/hooks') as { __spies: Record<string, jest.Mock> }).__spies;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dfxSpies = (require('@/features/dfx-backend/services') as { __spies: Record<string, jest.Mock> })
  .__spies;

describe('AuthLayout', () => {
  beforeEach(() => {
    Object.values(hookSpies).forEach((s) => s.mockReset());
    Object.values(dfxSpies).forEach((s) => s.mockReset());
    useAuthStore.setState({ isAuthenticated: false });
    mockSegments.current = ['(auth)', '(tabs)', 'dashboard'];
  });

  it('redirects to PIN verify when unauthenticated and the route is under (auth)/*', () => {
    useAuthStore.setState({ isAuthenticated: false });
    const { getByTestId } = render(<AuthLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(pin)/verify');
  });

  it('renders the stack outright when unauthenticated but the route is not under (auth)/*', () => {
    useAuthStore.setState({ isAuthenticated: false });
    mockSegments.current = ['(pin)', 'verify'];
    const { getByTestId, queryByTestId } = render(<AuthLayout />);
    expect(queryByTestId('redirect')).toBeNull();
    expect(getByTestId('stack-rendered')).toBeTruthy();
  });

  it('wires the silent 401 handler + auto-link hook once the user is authenticated', () => {
    useAuthStore.setState({ isAuthenticated: true });
    render(<AuthLayout />);
    expect(dfxSpies.setOnUnauthorized).toHaveBeenCalledWith(hookSpies.authenticateSilent);
    expect(hookSpies.useDfxAutoLinkSpy).toHaveBeenCalled();
  });

  it('invokes useDeepLink on every render (unconditional hook call)', () => {
    useAuthStore.setState({ isAuthenticated: false });
    render(<AuthLayout />);
    expect(hookSpies.useDeepLinkSpy).toHaveBeenCalled();
  });
});
