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
    useAuthStore.setState({ isOnboarded: false, isAuthenticated: false, pinHash: null });
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

  it('redirects an onboarded, unauthenticated legal-disclaimer deep link to PIN verification', () => {
    useAuthStore.setState({ isOnboarded: true, isAuthenticated: false, pinHash: 'hash' });
    mockSegments.current = ['(onboarding)', 'legal-disclaimer'];
    const { getByTestId } = render(<OnboardingLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(pin)/verify');
  });

  it('redirects a legal-disclaimer deep link without a wallet to welcome', () => {
    useAuthStore.setState({ isOnboarded: false, isAuthenticated: true });
    mockSegments.current = ['(onboarding)', 'legal-disclaimer'];
    const { getByTestId } = render(<OnboardingLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(onboarding)/welcome');
  });

  it('renders legal-disclaimer only for an authenticated wallet before onboarding completes', () => {
    useAuthStore.setState({ isOnboarded: false, isAuthenticated: true });
    mockActiveWalletId.current = 'default';
    mockSegments.current = ['(onboarding)', 'legal-disclaimer'];
    const { queryByTestId, getByTestId } = render(<OnboardingLayout />);
    expect(queryByTestId('redirect')).toBeNull();
    expect(getByTestId('stack-rendered')).toBeTruthy();
  });

  it('redirects an unauthenticated, not-onboarded legal-disclaimer deep link with a PIN to PIN verification', () => {
    useAuthStore.setState({ isOnboarded: false, isAuthenticated: false, pinHash: 'hash' });
    mockActiveWalletId.current = 'default';
    mockSegments.current = ['(onboarding)', 'legal-disclaimer'];
    const { getByTestId } = render(<OnboardingLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(pin)/verify');
  });

  it('redirects an unauthenticated, not-onboarded legal-disclaimer deep link without a PIN to PIN setup', () => {
    useAuthStore.setState({ isOnboarded: false, isAuthenticated: false, pinHash: null });
    mockActiveWalletId.current = 'default';
    mockSegments.current = ['(onboarding)', 'legal-disclaimer'];
    const { getByTestId } = render(<OnboardingLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(onboarding)/setup-pin');
  });

  it('stays on restore-wallet when onboarded but unauthenticated (recovery path)', () => {
    useAuthStore.setState({ isOnboarded: true, isAuthenticated: false, pinHash: 'hash' });
    mockActiveWalletId.current = 'default';
    mockSegments.current = ['(onboarding)', 'restore-wallet'];
    const { queryByTestId, getByTestId } = render(<OnboardingLayout />);
    expect(queryByTestId('redirect')).toBeNull();
    expect(getByTestId('stack-rendered')).toBeTruthy();
  });

  it('redirects a wallet with a PIN to verification instead of allowing PIN replacement', () => {
    useAuthStore.setState({ isOnboarded: false, isAuthenticated: false, pinHash: 'hash' });
    mockActiveWalletId.current = 'default';
    mockSegments.current = ['(onboarding)', 'setup-pin'];
    const { getByTestId } = render(<OnboardingLayout />);
    expect(getByTestId('redirect').props.children).toBe('/(pin)/verify');
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
