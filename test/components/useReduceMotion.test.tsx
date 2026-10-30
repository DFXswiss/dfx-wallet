import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from '../../src/hooks/useReduceMotion';

describe('useReduceMotion', () => {
  let changeHandler: ((value: boolean) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    changeHandler = undefined;
    remove.mockClear();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    // `addEventListener` is overloaded; cast to a plain mock so we can capture
    // the boolean handler without TS resolving the wrong overload signature.
    const addSpy = jest.spyOn(AccessibilityInfo, 'addEventListener') as unknown as jest.Mock;
    addSpy.mockImplementation((_event: string, handler: (value: boolean) => void) => {
      changeHandler = handler;
      return { remove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts false and reflects the probed OS preference', async () => {
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('updates when the OS reduce-motion preference changes', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { result } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    expect(result.current).toBe(false);
    act(() => changeHandler?.(true));
    expect(result.current).toBe(true);
  });

  it('stays false and does not throw when the probe rejects', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('removes the OS listener on unmount', () => {
    const { unmount } = renderHook(() => useReduceMotion());
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
