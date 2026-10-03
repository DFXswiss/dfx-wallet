import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { copySensitive } from '@/services/clipboard';

type MockSubscription = NativeEventSubscription & {
  listener: (state: AppStateStatus) => void;
  remove: jest.Mock<void, []>;
};

const mockSubscriptions: MockSubscription[] = [];
const originalCurrentState = Object.getOwnPropertyDescriptor(AppState, 'currentState');

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(),
  setStringAsync: jest.fn(),
}));

function setCurrentAppState(value: AppStateStatus): void {
  Object.defineProperty(AppState, 'currentState', {
    value,
    configurable: true,
    writable: true,
  });
}

async function flushClipboardCleanup(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('copySensitive', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: 1_000 });
    jest.mocked(Clipboard.getStringAsync).mockReset();
    jest.mocked(Clipboard.setStringAsync).mockReset();
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true);
    setCurrentAppState('active');
    mockSubscriptions.length = 0;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener): NativeEventSubscription => {
        const subscription: MockSubscription = { listener, remove: jest.fn() };
        mockSubscriptions.push(subscription);
        return subscription;
      });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalCurrentState) {
      Object.defineProperty(AppState, 'currentState', originalCurrentState);
    }
  });

  it('copies and clears the same sensitive value after the default timeout', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('secret seed');

    await copySensitive('secret seed');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('secret seed');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('');
    expect(mockSubscriptions[0]?.remove).toHaveBeenCalledTimes(1);
  });

  it('waits for the next active event when the deadline passes in the background', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('secret seed');
    await copySensitive('secret seed', 500);
    const subscription = mockSubscriptions[0]!;
    setCurrentAppState('background');

    await jest.advanceTimersByTimeAsync(500);

    expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
    expect(subscription.remove).not.toHaveBeenCalled();

    setCurrentAppState('active');
    subscription.listener('active');
    await flushClipboardCleanup();

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('');
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('does not clear on an active event before the deadline', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('secret seed');
    await copySensitive('secret seed', 500);

    mockSubscriptions[0]!.listener('active');
    await flushClipboardCleanup();

    expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(500);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('');
  });

  it('replaces the timer and listener when sensitive content is copied again', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('second secret');
    await copySensitive('first secret', 500);
    const firstSubscription = mockSubscriptions[0]!;

    await copySensitive('second secret', 500);
    const secondSubscription = mockSubscriptions[1]!;

    expect(firstSubscription.remove).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(500);
    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('');
    expect(secondSubscription.remove).toHaveBeenCalledTimes(1);
  });

  it('preserves clipboard content that changed before the custom timeout', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('new content');

    await copySensitive('secret seed', 500);
    await jest.advanceTimersByTimeAsync(500);

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('secret seed');
    expect(mockSubscriptions[0]?.remove).toHaveBeenCalledTimes(1);
  });

  it('silently handles clipboard read failures during cleanup', async () => {
    jest.mocked(Clipboard.getStringAsync).mockRejectedValue(new Error('permission denied'));

    await copySensitive('secret seed', 1);
    await jest.advanceTimersByTimeAsync(1);

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(mockSubscriptions[0]?.remove).toHaveBeenCalledTimes(1);
  });
});
