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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
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

  it('does not start a second clipboard clear while the first one is still running', async () => {
    const pendingRead = deferred<string>();
    jest.mocked(Clipboard.getStringAsync).mockReturnValue(pendingRead.promise);
    await copySensitive('secret seed', 500);
    const subscription = mockSubscriptions[0]!;

    await jest.advanceTimersByTimeAsync(500);
    subscription.listener('active');

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);

    pendingRead.resolve('secret seed');
    await flushClipboardCleanup();

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(2);
    expect(Clipboard.setStringAsync).toHaveBeenNthCalledWith(1, 'secret seed');
    expect(Clipboard.setStringAsync).toHaveBeenNthCalledWith(2, '');
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('invalidates an in-flight clear before writing a new sensitive value', async () => {
    const pendingRead = deferred<string>();
    const pendingSecondWrite = deferred<boolean>();
    jest
      .mocked(Clipboard.getStringAsync)
      .mockReturnValueOnce(pendingRead.promise)
      .mockResolvedValue('second');
    jest.mocked(Clipboard.setStringAsync).mockImplementation((value) => {
      if (value === 'second') return pendingSecondWrite.promise;
      return Promise.resolve(true);
    });
    await copySensitive('first', 500);
    const firstSubscription = mockSubscriptions[0]!;
    await jest.advanceTimersByTimeAsync(500);

    const secondCopy = copySensitive('second', 500);
    pendingRead.resolve('first');
    await flushClipboardCleanup();

    expect(firstSubscription.remove).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(2);
    expect(Clipboard.setStringAsync).not.toHaveBeenCalledWith('');

    pendingSecondWrite.resolve(true);
    await secondCopy;
    const secondSubscription = mockSubscriptions[1]!;
    await jest.advanceTimersByTimeAsync(500);

    expect(Clipboard.setStringAsync).toHaveBeenNthCalledWith(3, '');
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

  it('retries a failed clear by timer while the app stays active', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('secret seed');
    jest
      .mocked(Clipboard.setStringAsync)
      .mockImplementationOnce(async () => true)
      .mockImplementationOnce(async () => {
        throw new Error('write denied');
      })
      .mockResolvedValue(true);

    await copySensitive('secret seed', 500);
    const subscription = mockSubscriptions[0]!;
    await jest.advanceTimersByTimeAsync(500);

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    expect(subscription.remove).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(500);

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(2);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('');
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('stops the retry timer after the maximum attempts', async () => {
    jest.mocked(Clipboard.getStringAsync).mockRejectedValue(new Error('permission denied'));

    await copySensitive('secret seed', 500);
    const subscription = mockSubscriptions[0]!;

    await jest.advanceTimersByTimeAsync(500);
    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(500);
    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(500);

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(3);
    expect(subscription.remove).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1_000);

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(3);
  });

  it('does not schedule the retry timer while the app is backgrounded', async () => {
    const pendingRead = deferred<string>();
    jest
      .mocked(Clipboard.getStringAsync)
      .mockReturnValueOnce(pendingRead.promise)
      .mockResolvedValue('secret seed');
    await copySensitive('secret seed', 500);
    const subscription = mockSubscriptions[0]!;

    await jest.advanceTimersByTimeAsync(500);
    setCurrentAppState('background');
    pendingRead.reject(new Error('permission denied'));
    await flushClipboardCleanup();

    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(500);
    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    expect(subscription.remove).not.toHaveBeenCalled();

    setCurrentAppState('active');
    subscription.listener('active');
    await flushClipboardCleanup();
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('retries a failed read on the next active event', async () => {
    jest
      .mocked(Clipboard.getStringAsync)
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce('secret seed');

    await copySensitive('secret seed', 1);
    const subscription = mockSubscriptions[0]!;
    await jest.advanceTimersByTimeAsync(1);

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(subscription.remove).not.toHaveBeenCalled();

    subscription.listener('active');
    await flushClipboardCleanup();

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(2);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('');
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('stops retrying after three failed reads', async () => {
    jest.mocked(Clipboard.getStringAsync).mockRejectedValue(new Error('permission denied'));

    await copySensitive('secret seed', 1);
    const subscription = mockSubscriptions[0]!;
    await jest.advanceTimersByTimeAsync(1);

    subscription.listener('active');
    await flushClipboardCleanup();
    expect(subscription.remove).not.toHaveBeenCalled();

    subscription.listener('active');
    await flushClipboardCleanup();

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(3);
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('counts overlapping triggers as a single failed attempt', async () => {
    const pendingRead = deferred<string>();
    jest
      .mocked(Clipboard.getStringAsync)
      .mockReturnValueOnce(pendingRead.promise)
      .mockRejectedValue(new Error('permission denied'));
    await copySensitive('secret seed', 500);
    const subscription = mockSubscriptions[0]!;

    await jest.advanceTimersByTimeAsync(500);
    subscription.listener('active');
    pendingRead.reject(new Error('permission denied'));
    await flushClipboardCleanup();

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    expect(subscription.remove).not.toHaveBeenCalled();

    subscription.listener('active');
    await flushClipboardCleanup();

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(2);
    expect(subscription.remove).not.toHaveBeenCalled();

    subscription.listener('active');
    await flushClipboardCleanup();

    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(3);
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('counts failed clipboard clears toward the retry limit', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue('secret seed');
    jest.mocked(Clipboard.setStringAsync).mockImplementation(async (value) => {
      if (value === '') throw new Error('write denied');
      return true;
    });

    await copySensitive('secret seed', 1);
    const subscription = mockSubscriptions[0]!;
    await jest.advanceTimersByTimeAsync(1);

    subscription.listener('active');
    await flushClipboardCleanup();
    expect(subscription.remove).not.toHaveBeenCalled();

    subscription.listener('active');
    await flushClipboardCleanup();

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(4);
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });
});
