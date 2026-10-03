import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

const mockPrevent = jest.fn<Promise<void>, [string?]>();
const mockAllow = jest.fn<Promise<void>, [string?]>();
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
    mockPrevent.mockReset();
    mockAllow.mockReset();
    mockPrevent.mockResolvedValue(undefined);
    mockAllow.mockResolvedValue(undefined);
  });

  it('transitions from pending to active after native protection resolves', async () => {
    let resolveProtection: (() => void) | undefined;
    mockPrevent.mockImplementationOnce(
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
    mockPrevent.mockRejectedValueOnce(new Error('native failure'));
    const view = render(<Harness active captureKey="seed" />);

    await waitFor(() =>
      expect(view.getByTestId('capture-state').props.children).toBe('unavailable'),
    );
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
    mockAllow.mockRejectedValueOnce(new Error('native failure'));
    const view = render(<Harness active captureKey="export" />);
    await waitFor(() =>
      expect(view.getByTestId('capture-state').props.children).toBe('active'),
    );

    view.unmount();

    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith('export'));
  });
});
