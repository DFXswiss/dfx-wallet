import React from 'react';
import { render } from '@testing-library/react-native';

const mockSegments: { current: string[] } = { current: ['(onboarding)', 'welcome'] };
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
    Stack: () => <Text testID="stack-rendered">stack</Text>,
    useSegments: () => mockSegments.current,
  };
});

const mockActiveWalletId: { current: string | null } = { current: null };
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => ({ activeWalletId: mockActiveWalletId.current }),
}));

import OnboardingLayout from '../../app/(onboarding)/_layout';
import { useAuthStore } from '@/store';

describe('OnboardingLayout routing guards', () => {
  beforeEach(() => {
    useAuthStore.setState({ isOnboarded: false, isAuthenticated: false });
    mockSegments.current = ['(onboarding)', 'welcome'];
    mockActiveWalletId.current = null;
  });

  it('renders the onboarding stack on the welcome screen when nothing is set up', () => {
    const { getByTestId, queryByTestId } = render(<OnboardingLayout />);
    expect(queryByTestId('redirect')).toBeNull();
    expect(getByTestId('stack-rendered')).toBeTruthy();
  });

  it('redirects to the dashboard when an onboarded + authenticated user enters /(onboarding)/*', () => {
    useAuthStore.setState({ isOnboarded: true, isAuthenticated: true });
    mockSegments.current = ['(onboarding)', 'welcome'];
    const { getByTestId } = render(<OnboardingLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(auth)/(tabs)/dashboard');
  });

  it('redirects to PIN verify when onboarded but not yet authenticated in-memory', () => {
    useAuthStore.setState({ isOnboarded: true, isAuthenticated: false });
    mockSegments.current = ['(onboarding)', 'welcome'];
    const { getByTestId } = render(<OnboardingLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(pin)/verify');
  });

  it('stays on the legal-disclaimer screen even when onboarded (post-create flow)', () => {
    useAuthStore.setState({ isOnboarded: true, isAuthenticated: true });
    mockSegments.current = ['(onboarding)', 'legal-disclaimer'];
    const { queryByTestId, getByTestId } = render(<OnboardingLayout />);
    expect(queryByTestId('redirect')).toBeNull();
    expect(getByTestId('stack-rendered')).toBeTruthy();
  });

  it('jumps to setup-pin when a wallet exists but PIN has not been set yet', () => {
    useAuthStore.setState({ isOnboarded: false, isAuthenticated: false });
    mockActiveWalletId.current = 'default';
    mockSegments.current = ['(onboarding)', 'welcome'];
    const { getByTestId } = render(<OnboardingLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(onboarding)/setup-pin');
  });

  it('does not bounce the user out of setup-pin when a wallet exists', () => {
    useAuthStore.setState({ isOnboarded: false });
    mockActiveWalletId.current = 'default';
    mockSegments.current = ['(onboarding)', 'setup-pin'];
    const { queryByTestId, getByTestId } = render(<OnboardingLayout />);
    expect(queryByTestId('redirect')).toBeNull();
    expect(getByTestId('stack-rendered')).toBeTruthy();
  });
});
