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

const mockSetAuthenticated = jest.fn();

jest.mock('@/config/features', () => ({ FEATURES: { PIN: true } }));

jest.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: { setAuthenticated: typeof mockSetAuthenticated }) => unknown) =>
    selector({ setAuthenticated: mockSetAuthenticated }),
}));

import { AUTO_LOCK_AFTER_MS, useAutoLock } from '@/hooks/useAutoLock';

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
    mockSetAuthenticated.mockReset();
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

  it('locks after returning from more than sixty seconds in the background', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    render(<AutoLockHarness />);

    act(() => listener?.('background'));
    now.mockReturnValue(1_000 + AUTO_LOCK_AFTER_MS + 1);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).toHaveBeenCalledWith(false);
  });

  it('locks at exactly sixty seconds and clears the background timestamp', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(2_000);
    render(<AutoLockHarness />);

    act(() => listener?.('background'));
    now.mockReturnValue(2_000 + AUTO_LOCK_AFTER_MS);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).toHaveBeenCalledTimes(1);
    expect(mockSetAuthenticated).toHaveBeenCalledWith(false);

    now.mockReturnValue(2_000 + AUTO_LOCK_AFTER_MS * 2);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('treats a mount that is already backgrounded as the start of the lock window', () => {
    setCurrentAppState('background');
    const now = jest.spyOn(Date, 'now').mockReturnValue(4_000);
    render(<AutoLockHarness />);

    now.mockReturnValue(4_000 + AUTO_LOCK_AFTER_MS);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).toHaveBeenCalledTimes(1);
    expect(mockSetAuthenticated).toHaveBeenCalledWith(false);
  });

  it('does not lock when the app returns before the window elapses', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(5_000);
    render(<AutoLockHarness />);

    act(() => listener?.('background'));
    now.mockReturnValue(5_000 + AUTO_LOCK_AFTER_MS - 1);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).not.toHaveBeenCalled();
  });

  it('does not lock when a backgrounded mount returns before the window elapses', () => {
    setCurrentAppState('background');
    const now = jest.spyOn(Date, 'now').mockReturnValue(6_000);
    render(<AutoLockHarness />);

    now.mockReturnValue(6_000 + AUTO_LOCK_AFTER_MS - 1);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).not.toHaveBeenCalled();
  });

  it('does not start the lock window when mounted inactive', () => {
    setCurrentAppState('inactive');
    const now = jest.spyOn(Date, 'now').mockReturnValue(7_000);
    render(<AutoLockHarness />);

    now.mockReturnValue(7_000 + AUTO_LOCK_AFTER_MS + 1);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).not.toHaveBeenCalled();
  });

  it('does not treat an inactive system-dialog transition as backgrounding', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(3_000);
    render(<AutoLockHarness />);

    act(() => listener?.('inactive'));
    now.mockReturnValue(3_000 + AUTO_LOCK_AFTER_MS + 1);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).not.toHaveBeenCalled();
  });

  it('removes its AppState listener on unmount', () => {
    const { unmount } = render(<AutoLockHarness />);
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
