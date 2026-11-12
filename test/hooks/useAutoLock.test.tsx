import { AppState, type AppStateStatus } from 'react-native';
import { act, render } from '@testing-library/react-native';

const originalCurrentState = Object.getOwnPropertyDescriptor(AppState, 'currentState');

function setCurrentAppState(value: AppStateStatus): void {
  Object.defineProperty(AppState, 'currentState', {
    value,
    configurable: true,
    writable: true,
  });
}

jest.mock('@/config/features', () => ({ FEATURES: { PIN: true } }));

import { AUTO_LOCK_AFTER_MS, useAutoLock } from '@/hooks/useAutoLock';
import { useAuthStore } from '@/store/auth';

function AutoLockHarness() {
  useAutoLock();
  return null;
}

describe('useAutoLock', () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    listener = undefined;
    remove.mockReset();
    useAuthStore.setState({ isAuthenticated: false, sessionEpoch: 0 });
    setCurrentAppState('active');
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, nextListener) => {
      listener = nextListener;
      return { remove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalCurrentState) {
      Object.defineProperty(AppState, 'currentState', originalCurrentState);
    }
  });

  it('increases the session epoch after the lock window while signed out', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    render(<AutoLockHarness />);

    act(() => listener?.('background'));
    now.mockReturnValue(1_000 + AUTO_LOCK_AFTER_MS + 1);
    act(() => listener?.('active'));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().sessionEpoch).toBe(1);
  });

  it('locks at exactly sixty seconds and clears the background timestamp', () => {
    useAuthStore.setState({ isAuthenticated: true });
    expect(AUTO_LOCK_AFTER_MS).toBe(60_000);
    const now = jest.spyOn(Date, 'now').mockReturnValue(2_000);
    render(<AutoLockHarness />);

    act(() => listener?.('background'));
    now.mockReturnValue(2_000 + AUTO_LOCK_AFTER_MS);
    act(() => listener?.('active'));

    expect(useAuthStore.getState().sessionEpoch).toBe(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    now.mockReturnValue(2_000 + AUTO_LOCK_AFTER_MS * 2);
    act(() => listener?.('active'));

    expect(useAuthStore.getState().sessionEpoch).toBe(1);
  });

  it('treats a mount that is already backgrounded as the start of the lock window', () => {
    setCurrentAppState('background');
    const now = jest.spyOn(Date, 'now').mockReturnValue(4_000);
    render(<AutoLockHarness />);

    now.mockReturnValue(4_000 + AUTO_LOCK_AFTER_MS);
    act(() => listener?.('active'));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().sessionEpoch).toBe(1);
  });

  it('does not increase the session epoch when the app returns before the window elapses', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(5_000);
    render(<AutoLockHarness />);

    act(() => listener?.('background'));
    now.mockReturnValue(5_000 + AUTO_LOCK_AFTER_MS - 1);
    act(() => listener?.('active'));

    expect(useAuthStore.getState().sessionEpoch).toBe(0);
  });

  it('does not lock when a backgrounded mount returns before the window elapses', () => {
    setCurrentAppState('background');
    const now = jest.spyOn(Date, 'now').mockReturnValue(6_000);
    render(<AutoLockHarness />);

    now.mockReturnValue(6_000 + AUTO_LOCK_AFTER_MS - 1);
    act(() => listener?.('active'));

    expect(useAuthStore.getState().sessionEpoch).toBe(0);
  });

  it('starts the lock window when mounted inactive', () => {
    setCurrentAppState('inactive');
    const now = jest.spyOn(Date, 'now').mockReturnValue(7_000);
    render(<AutoLockHarness />);

    now.mockReturnValue(7_000 + AUTO_LOCK_AFTER_MS + 1);
    act(() => listener?.('active'));

    expect(useAuthStore.getState().sessionEpoch).toBe(1);
  });

  it('locks after an inactive transition reaches the threshold', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(3_000);
    render(<AutoLockHarness />);

    act(() => listener?.('inactive'));
    now.mockReturnValue(3_000 + AUTO_LOCK_AFTER_MS + 1);
    act(() => listener?.('active'));

    expect(useAuthStore.getState().sessionEpoch).toBe(1);
  });

  it('does not lock when inactive for less than the threshold', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(8_000);
    render(<AutoLockHarness />);
    act(() => listener?.('inactive'));
    now.mockReturnValue(8_000 + AUTO_LOCK_AFTER_MS - 1);
    act(() => listener?.('active'));
    expect(useAuthStore.getState().sessionEpoch).toBe(0);
  });

  it('counts from inactive when background follows', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(9_000);
    render(<AutoLockHarness />);
    act(() => listener?.('inactive'));
    now.mockReturnValue(9_000 + AUTO_LOCK_AFTER_MS - 1);
    act(() => listener?.('background'));
    now.mockReturnValue(9_000 + AUTO_LOCK_AFTER_MS);
    act(() => listener?.('active'));
    expect(useAuthStore.getState().sessionEpoch).toBe(1);
  });

  it('removes its AppState listener on unmount', () => {
    const { unmount } = render(<AutoLockHarness />);
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
