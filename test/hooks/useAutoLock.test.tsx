import { AppState, type AppStateStatus } from 'react-native';
import { act, render } from '@testing-library/react-native';

const mockSetAuthenticated = jest.fn();

jest.mock('@/config/features', () => ({ FEATURES: { PIN: true } }));

jest.mock('@/store/auth', () => ({
  useAuthStore: (
    selector: (state: { setAuthenticated: typeof mockSetAuthenticated }) => unknown,
  ) => selector({ setAuthenticated: mockSetAuthenticated }),
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
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, nextListener) => {
      listener = nextListener;
      return { remove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('locks after returning from more than sixty seconds in the background', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    render(<AutoLockHarness />);

    act(() => listener?.('background'));
    now.mockReturnValue(1_000 + AUTO_LOCK_AFTER_MS + 1);
    act(() => listener?.('active'));

    expect(mockSetAuthenticated).toHaveBeenCalledWith(false);
  });

  it('does not lock at exactly sixty seconds and clears the background timestamp', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(2_000);
    render(<AutoLockHarness />);

    act(() => listener?.('background'));
    now.mockReturnValue(2_000 + AUTO_LOCK_AFTER_MS);
    act(() => listener?.('active'));
    now.mockReturnValue(2_000 + AUTO_LOCK_AFTER_MS * 2);
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
