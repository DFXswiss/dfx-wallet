import { render } from '@testing-library/react-native';

const mockPrevent = jest.fn(async (_key?: string) => undefined);
const mockAllow = jest.fn(async (_key?: string) => undefined);

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: (key?: string) => mockPrevent(key),
  allowScreenCaptureAsync: (key?: string) => mockAllow(key),
}));

import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';

function Harness({ active, captureKey }: { active: boolean; captureKey: string }) {
  useScreenCaptureProtection(active, captureKey);
  return null;
}

describe('useScreenCaptureProtection', () => {
  beforeEach(() => {
    mockPrevent.mockReset();
    mockAllow.mockReset();
    mockPrevent.mockResolvedValue(undefined);
    mockAllow.mockResolvedValue(undefined);
  });

  it('protects only while active and releases the same key', () => {
    const view = render(<Harness active={false} captureKey="seed" />);
    expect(mockPrevent).not.toHaveBeenCalled();

    view.rerender(<Harness active captureKey="seed" />);
    expect(mockPrevent).toHaveBeenCalledWith('seed');

    view.rerender(<Harness active={false} captureKey="seed" />);
    expect(mockAllow).toHaveBeenCalledWith('seed');
  });

  it('releases protection on unmount', () => {
    const view = render(<Harness active captureKey="export" />);
    view.unmount();
    expect(mockAllow).toHaveBeenCalledWith('export');
  });

  it('contains native-module promise rejections', async () => {
    mockPrevent.mockRejectedValueOnce(new Error('unavailable'));
    mockAllow.mockRejectedValueOnce(new Error('unavailable'));
    const view = render(<Harness active captureKey="seed" />);
    view.unmount();
    await Promise.resolve();
  });
});
