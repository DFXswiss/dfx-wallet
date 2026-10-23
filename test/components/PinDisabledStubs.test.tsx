import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Capture the href that the disabled stubs hand to `router.replace`. Each
// stub flips the relevant auth-store state and replaces to the next route;
// asserting on the replace call is the lightest way to verify behavior
// without booting the router.
const mockReplace = jest.fn();
const mockRouter = { replace: (...args: unknown[]) => mockReplace(...args) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/config/features', () => ({ FEATURES: { LEGAL: true } }));
const { FEATURES: mockFeatures } = jest.requireMock('@/config/features') as {
  FEATURES: { LEGAL: boolean };
};

// The verify-pin disabled stub calls WDK's `useWalletManager.unlock` so
// the seed is read into the worklet before redirecting. Mock that
// surface — the test verifies that the redirect only happens once the
// unlock promise resolves, and that a rejection stays on the screen.
const mockUnlock = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => ({ unlock: mockUnlock }),
}));

import SetupPinDisabled from '../../src/features/pin/SetupPinDisabled';
import VerifyPinDisabled from '../../src/features/pin/VerifyPinDisabled';
import { useAuthStore } from '@/store';

describe('SetupPinDisabled', () => {
  beforeEach(async () => {
    mockReplace.mockReset();
    mockFeatures.LEGAL = true;
    await useAuthStore.getState().reset();
  });

  it('keeps onboarding incomplete and opens legal when legal is enabled', async () => {
    render(<SetupPinDisabled />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/legal-disclaimer'),
    );
    const { isOnboarded, isAuthenticated } = useAuthStore.getState();
    expect(isOnboarded).toBe(false);
    expect(isAuthenticated).toBe(true);
  });

  it('marks onboarding complete and opens the dashboard when legal is disabled', async () => {
    mockFeatures.LEGAL = false;
    render(<SetupPinDisabled />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));
    const { isOnboarded, isAuthenticated } = useAuthStore.getState();
    expect(isOnboarded).toBe(true);
    expect(isAuthenticated).toBe(true);
  });

  it('shows an error and does not navigate when finishing authentication rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFeatures.LEGAL = false;
    const originalSetOnboarded = useAuthStore.getState().setOnboarded;
    useAuthStore.setState({
      setOnboarded: jest.fn(async () => {
        throw new Error('keychain unavailable');
      }),
    });

    const view = render(<SetupPinDisabled />);

    await waitFor(() => expect(view.getByText('pin.finishError')).toBeTruthy());
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
    useAuthStore.setState({ setOnboarded: originalSetOnboarded });
    warn.mockRestore();
  });

  it('retries finishing authentication and navigates after the retry succeeds', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFeatures.LEGAL = false;
    const originalSetOnboarded = useAuthStore.getState().setOnboarded;
    const setOnboarded = jest.fn(originalSetOnboarded);
    setOnboarded.mockImplementationOnce(async () => {
      throw new Error('keychain unavailable');
    });
    useAuthStore.setState({ setOnboarded });
    const view = render(<SetupPinDisabled />);

    await waitFor(() => expect(view.getByTestId('setup-pin-disabled-retry')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByTestId('setup-pin-disabled-retry'));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
    expect(setOnboarded).toHaveBeenCalledTimes(2);
    expect(view.queryByTestId('setup-pin-disabled-error')).toBeNull();
    useAuthStore.setState({ setOnboarded: originalSetOnboarded });
    warn.mockRestore();
  });
});

describe('VerifyPinDisabled', () => {
  beforeEach(async () => {
    mockReplace.mockReset();
    mockUnlock.mockReset();
    mockUnlock.mockResolvedValue(undefined);
    mockFeatures.LEGAL = true;
    await useAuthStore.getState().reset();
  });

  it('unlocks the WDK wallet, flips isAuthenticated, and replaces to the dashboard', async () => {
    useAuthStore.setState({ isOnboarded: true });
    render(<VerifyPinDisabled />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockUnlock).toHaveBeenCalledWith('default');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });

  it('routes unfinished onboarding to the legal disclaimer after unlocking', async () => {
    render(<VerifyPinDisabled />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/legal-disclaimer'),
    );

    expect(mockUnlock).toHaveBeenCalledWith('default');
    expect(useAuthStore.getState().isOnboarded).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('authenticates and routes only after the unlock promise resolves', async () => {
    const calls: string[] = [];
    let resolveUnlock: () => void = () => {};
    mockUnlock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUnlock = resolve;
          calls.push('unlock');
        }),
    );
    const spy = jest.spyOn(useAuthStore.getState(), 'setAuthenticated');
    spy.mockImplementation((value: boolean) => {
      calls.push('auth');
      useAuthStore.setState({ isAuthenticated: value });
    });
    mockReplace.mockImplementation(() => void calls.push('route'));

    render(<VerifyPinDisabled />);
    await act(async () => {});

    // Unlock still pending: nothing authenticated, nothing routed.
    expect(calls).toEqual(['unlock']);

    await act(async () => {
      resolveUnlock();
    });

    expect(calls).toEqual(['unlock', 'auth', 'route']);
    spy.mockRestore();
  });

  it('stays fail-closed when unlock rejects: no auth, no route, visible recovery path', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockUnlock.mockRejectedValue(new Error('secret unlock detail'));
    const { getByTestId } = render(<VerifyPinDisabled />);

    await waitFor(() => expect(getByTestId('verify-pin-unlock-error')).toBeTruthy());

    const message = getByTestId('verify-pin-unlock-error').children.join('');
    expect(message).toBe('pin.unlockFailed');
    expect(message).not.toContain('secret unlock detail');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(getByTestId('verify-pin-recovery-button')).toBeTruthy();
    warn.mockRestore();
  });

  it('does not retry unlock in a loop after a rejection', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockUnlock.mockRejectedValue(new Error('worklet not booted'));
    const { getByTestId } = render(<VerifyPinDisabled />);

    await waitFor(() => expect(getByTestId('verify-pin-recovery-button')).toBeTruthy());
    await act(async () => {});

    expect(mockUnlock).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('routes the recovery button to the restore-wallet screen', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockUnlock.mockRejectedValue(new Error('worklet not booted'));
    const { getByTestId } = render(<VerifyPinDisabled />);

    await waitFor(() => expect(getByTestId('verify-pin-recovery-button')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('verify-pin-recovery-button'));
    });

    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/restore-wallet');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    warn.mockRestore();
  });
});
