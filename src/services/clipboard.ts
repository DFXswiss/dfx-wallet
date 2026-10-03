import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import * as Clipboard from 'expo-clipboard';

type PendingClipboardCleanup = {
  value: string;
  deadline: number;
  timeout: ReturnType<typeof setTimeout> | null;
  subscription: NativeEventSubscription | null;
};

let pendingCleanup: PendingClipboardCleanup | null = null;

function cancelPendingCleanup(): void {
  if (!pendingCleanup) return;
  if (pendingCleanup.timeout !== null) clearTimeout(pendingCleanup.timeout);
  pendingCleanup.subscription?.remove();
  pendingCleanup = null;
}

async function clearClipboardIfUnchanged(cleanup: PendingClipboardCleanup): Promise<void> {
  try {
    const currentValue = await Clipboard.getStringAsync();
    if (pendingCleanup === cleanup && currentValue === cleanup.value) {
      await Clipboard.setStringAsync('');
    }
  } catch {
    // Clipboard access can be denied after the app is backgrounded.
  } finally {
    if (pendingCleanup === cleanup) cancelPendingCleanup();
  }
}

export async function copySensitive(value: string, clearAfterMs = 60_000): Promise<void> {
  await Clipboard.setStringAsync(value);
  cancelPendingCleanup();

  const deadline = Date.now() + clearAfterMs;
  const cleanup: PendingClipboardCleanup = {
    value,
    deadline,
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
  cleanup.timeout = setTimeout(() => {
    if (AppState.currentState === 'active') {
      void clearClipboardIfUnchanged(cleanup);
    }
  }, clearAfterMs);
}
