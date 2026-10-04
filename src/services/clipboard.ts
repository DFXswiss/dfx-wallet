import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import * as Clipboard from 'expo-clipboard';

type PendingClipboardCleanup = {
  value: string;
  deadline: number;
  clearAfterMs: number;
  attempts: number;
  isClearing: boolean;
  timeout: ReturnType<typeof setTimeout> | null;
  subscription: NativeEventSubscription | null;
};

const MAX_CLEAR_ATTEMPTS = 3;

let pendingCleanup: PendingClipboardCleanup | null = null;

function scheduleClipboardClear(cleanup: PendingClipboardCleanup): void {
  if (cleanup.timeout !== null) clearTimeout(cleanup.timeout);
  cleanup.timeout = setTimeout(() => {
    cleanup.timeout = null;
    if (pendingCleanup === cleanup && AppState.currentState === 'active') {
      void clearClipboardIfUnchanged(cleanup);
    }
  }, cleanup.clearAfterMs);
}

function cancelPendingCleanup(): void {
  if (!pendingCleanup) return;
  if (pendingCleanup.timeout !== null) clearTimeout(pendingCleanup.timeout);
  pendingCleanup.subscription?.remove();
  pendingCleanup = null;
}

async function clearClipboardIfUnchanged(cleanup: PendingClipboardCleanup): Promise<void> {
  if (pendingCleanup !== cleanup || cleanup.isClearing) return;
  cleanup.isClearing = true;
  try {
    const currentValue = await Clipboard.getStringAsync();
    if (pendingCleanup !== cleanup) return;
    if (currentValue !== cleanup.value) return cancelPendingCleanup();
    await Clipboard.setStringAsync('');
    if (pendingCleanup === cleanup) cancelPendingCleanup();
  } catch {
    // Clipboard access can be denied after the app is backgrounded.
    if (pendingCleanup === cleanup) {
      cleanup.attempts += 1;
      if (cleanup.attempts >= MAX_CLEAR_ATTEMPTS) {
        if (cleanup.timeout !== null) clearTimeout(cleanup.timeout);
        cleanup.timeout = null;
      } else if (AppState.currentState === 'active') {
        scheduleClipboardClear(cleanup);
      }
    }
  } finally {
    cleanup.isClearing = false;
  }
}

export async function copySensitive(value: string, clearAfterMs = 60_000): Promise<void> {
  cancelPendingCleanup();
  await Clipboard.setStringAsync(value);

  const deadline = Date.now() + clearAfterMs;
  const cleanup: PendingClipboardCleanup = {
    value,
    deadline,
    clearAfterMs,
    attempts: 0,
    isClearing: false,
    timeout: null,
    subscription: null,
  };
  pendingCleanup = cleanup;
  const onAppStateChange = (state: AppStateStatus) => {
    if (state === 'active' && Date.now() >= cleanup.deadline) {
      void clearClipboardIfUnchanged(cleanup);
    }
  };
  cleanup.subscription = AppState.addEventListener('change', onAppStateChange);
  scheduleClipboardClear(cleanup);
}
