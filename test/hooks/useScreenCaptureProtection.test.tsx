import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

const mockActiveTags = new Set<string>();
const mockNativePrevent = jest.fn<Promise<void>, []>();
const mockNativeAllow = jest.fn<Promise<void>, []>();
const mockPrevent = jest.fn<Promise<void>, [string?]>(async (key = 'default') => {
  if (!mockActiveTags.has(key)) {
    mockActiveTags.add(key);
    await mockNativePrevent();
  }
});
const mockAllow = jest.fn<Promise<void>, [string?]>(async (key = 'default') => {
  mockActiveTags.delete(key);
  if (mockActiveTags.size === 0) {
    await mockNativeAllow();
  }
});
let mockScreenCaptureAvailable = true;

jest.mock('expo-screen-capture', () => ({
  get preventScreenCaptureAsync() {
    return mockScreenCaptureAvailable ? (key?: string) => mockPrevent(key) : undefined;
  },
  get allowScreenCaptureAsync() {
    return mockScreenCaptureAvailable ? (key?: string) => mockAllow(key) : undefined;
  },
}));

import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';

function Harness({ active, captureKey }: { active: boolean; captureKey: string }) {
  const state = useScreenCaptureProtection(active, captureKey);
  return <Text testID="capture-state">{state}</Text>;
}

describe('useScreenCaptureProtection', () => {
  beforeEach(() => {
    mockScreenCaptureAvailable = true;
    mockActiveTags.clear();
    mockNativePrevent.mockReset();
    mockNativeAllow.mockReset();
    mockPrevent.mockClear();
    mockAllow.mockClear();
    mockNativePrevent.mockResolvedValue(undefined);
    mockNativeAllow.mockResolvedValue(undefined);
  });

  it('transitions from pending to active after native protection resolves', async () => {
    let resolveProtection: (() => void) | undefined;
    mockNativePrevent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveProtection = resolve;
        }),
    );

    const view = render(<Harness active captureKey="seed" />);
    expect(view.getByTestId('capture-state').props.children).toBe('pending');
    await waitFor(() => expect(mockPrevent).toHaveBeenCalledWith('seed'));

    await act(async () => {
      resolveProtection!();
    });

    expect(view.getByTestId('capture-state').props.children).toBe('active');
  });

  it('reports unavailable when the native module is missing', async () => {
    mockScreenCaptureAvailable = false;
    const view = render(<Harness active captureKey="seed" />);

    await waitFor(() =>
      expect(view.getByTestId('capture-state').props.children).toBe('unavailable'),
    );
    expect(mockPrevent).not.toHaveBeenCalled();
  });

  it('reports unavailable when native protection rejects', async () => {
    mockNativePrevent.mockRejectedValueOnce(new Error('native failure'));
    const view = render(<Harness active captureKey="seed" />);

    await waitFor(() =>
      expect(view.getByTestId('capture-state').props.children).toBe('unavailable'),
    );
  });

  // Red mutation: omit allow after a rejected prevent; the second mount short-circuits to active.
  it('releases a rejected tag so a same-key remount retries native protection', async () => {
    mockNativePrevent
      .mockRejectedValueOnce(new Error('first native failure'))
      .mockRejectedValueOnce(new Error('second native failure'));
    const firstView = render(<Harness active captureKey="seed" />);

    await waitFor(() =>
      expect(firstView.getByTestId('capture-state').props.children).toBe('unavailable'),
    );
    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith('seed'));
    expect(mockActiveTags.has('seed')).toBe(false);
    firstView.unmount();

    const secondView = render(<Harness active captureKey="seed" />);

    await waitFor(() =>
      expect(secondView.getByTestId('capture-state').props.children).toBe('unavailable'),
    );
    expect(mockNativePrevent).toHaveBeenCalledTimes(2);
  });

  // Red mutation: omit allow from the cancelled rejection path; the tag remains registered.
  it('releases the tag when an unmounted protection attempt later rejects', async () => {
    let rejectProtection: ((reason: Error) => void) | undefined;
    mockNativePrevent.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectProtection = reject;
        }),
    );
    const view = render(<Harness active captureKey="seed" />);
    await waitFor(() => expect(mockNativePrevent).toHaveBeenCalledTimes(1));

    view.unmount();
    await act(async () => {
      rejectProtection!(new Error('native failure'));
    });

    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith('seed'));
    expect(mockActiveTags.has('seed')).toBe(false);
  });

  it('protects only while active and releases the same key', async () => {
    const view = render(<Harness active={false} captureKey="seed" />);
    expect(mockPrevent).not.toHaveBeenCalled();

    view.rerender(<Harness active captureKey="seed" />);
    await waitFor(() =>
      expect(view.getByTestId('capture-state').props.children).toBe('active'),
    );

    view.rerender(<Harness active={false} captureKey="seed" />);
    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith('seed'));
  });

  it('releases active protection on unmount and contains cleanup rejection', async () => {
    mockNativeAllow.mockRejectedValueOnce(new Error('native failure'));
    const view = render(<Harness active captureKey="export" />);
    await waitFor(() =>
      expect(view.getByTestId('capture-state').props.children).toBe('active'),
    );

    view.unmount();

    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith('export'));
  });
});
