import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// Capture the href that the disabled stubs hand to `router.replace`. Each
// stub flips two pieces of auth-store state and replaces to the dashboard;
// asserting on the replace call is the lightest way to verify behavior
// without booting the router.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// The verify-pin disabled stub calls WDK's `useWalletManager.unlock` so
// the seed is read into the worklet before redirecting. Mock that
// surface — the test verifies that unlock is called and that the
// redirect lands on the dashboard even when unlock throws.
const mockUnlock = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => ({ unlock: mockUnlock }),
}));

import SetupPinDisabled from '../../src/features/pin/SetupPinDisabled';
import VerifyPinDisabled from '../../src/features/pin/VerifyPinDisabled';
import { useAuthStore } from '@/store';

describe('SetupPinDisabled', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    void useAuthStore.getState().reset();
  });

  it('marks the user as onboarded + authenticated and replaces to the dashboard', async () => {
    render(<SetupPinDisabled />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));
    const { isOnboarded, isAuthenticated } = useAuthStore.getState();
    expect(isOnboarded).toBe(true);
    expect(isAuthenticated).toBe(true);
  });
});

describe('VerifyPinDisabled', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockUnlock.mockReset();
    mockUnlock.mockResolvedValue(undefined);
    void useAuthStore.getState().reset();
  });

  it('unlocks the WDK wallet, flips isAuthenticated, and replaces to the dashboard', async () => {
    render(<VerifyPinDisabled />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockUnlock).toHaveBeenCalledWith('default');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });

  it('still proceeds to the dashboard when unlock throws (no hard fail)', async () => {
    mockUnlock.mockRejectedValueOnce(new Error('worklet not booted'));
    render(<VerifyPinDisabled />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });
});
