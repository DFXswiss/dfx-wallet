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
    await waitFor(() =>
      expect(mockPrevent).toHaveBeenCalledWith(expect.stringMatching(/^seed:/)),
    );

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

  // Red mutation: omit allow after a rejected prevent; the rejected tag remains registered.
  it('releases a rejected tag so a same-key remount retries native protection', async () => {
    mockNativePrevent
      .mockRejectedValueOnce(new Error('first native failure'))
      .mockRejectedValueOnce(new Error('second native failure'));
    const firstView = render(<Harness active captureKey="seed" />);

    await waitFor(() =>
      expect(firstView.getByTestId('capture-state').props.children).toBe('unavailable'),
    );
    const firstTag = mockPrevent.mock.calls[0]![0]!;
    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith(firstTag));
    expect(mockActiveTags.has(firstTag)).toBe(false);
    firstView.unmount();

    const secondView = render(<Harness active captureKey="seed" />);

    await waitFor(() =>
      expect(secondView.getByTestId('capture-state').props.children).toBe('unavailable'),
    );
    expect(mockNativePrevent).toHaveBeenCalledTimes(2);
  });

  // Red mutation: use the static key; unmounting the first instance releases the shared tag.
  it('keeps same-key concurrent mounts protected until both instances unmount', async () => {
    const firstView = render(<Harness active captureKey="seed-export" />);
    const secondView = render(<Harness active captureKey="seed-export" />);

    await waitFor(() => expect(mockPrevent).toHaveBeenCalledTimes(2));
    const firstTag = mockPrevent.mock.calls[0]![0]!;
    const secondTag = mockPrevent.mock.calls[1]![0]!;
    expect(firstTag).toMatch(/^seed-export:/);
    expect(secondTag).toMatch(/^seed-export:/);
    expect(firstTag).not.toBe(secondTag);
    expect(mockActiveTags.has(firstTag)).toBe(true);
    expect(mockActiveTags.has(secondTag)).toBe(true);

    firstView.unmount();

    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith(firstTag));
    expect(mockAllow).not.toHaveBeenCalledWith(secondTag);
    expect(mockActiveTags.has(firstTag)).toBe(false);
    expect(mockActiveTags.has(secondTag)).toBe(true);
    expect(mockNativeAllow).not.toHaveBeenCalled();

    secondView.unmount();

    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith(secondTag));
    expect(mockActiveTags.size).toBe(0);
    expect(mockNativeAllow).toHaveBeenCalledTimes(1);
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

    const protectionTag = mockPrevent.mock.calls[0]![0]!;
    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith(protectionTag));
    expect(mockActiveTags.has(protectionTag)).toBe(false);
  });

  it('protects only while active and releases the same key', async () => {
    const view = render(<Harness active={false} captureKey="seed" />);
    expect(mockPrevent).not.toHaveBeenCalled();

    view.rerender(<Harness active captureKey="seed" />);
    await waitFor(() =>
      expect(view.getByTestId('capture-state').props.children).toBe('active'),
    );
    const protectionTag = mockPrevent.mock.calls[0]![0]!;

    view.rerender(<Harness active={false} captureKey="seed" />);
    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith(protectionTag));
  });

  it('releases active protection on unmount and contains cleanup rejection', async () => {
    mockNativeAllow.mockRejectedValueOnce(new Error('native failure'));
    const view = render(<Harness active captureKey="export" />);
    await waitFor(() =>
      expect(view.getByTestId('capture-state').props.children).toBe('active'),
    );
    const protectionTag = mockPrevent.mock.calls[0]![0]!;

    view.unmount();

    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith(protectionTag));
  });
});
