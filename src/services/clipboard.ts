import * as Clipboard from 'expo-clipboard';

async function clearClipboardIfUnchanged(value: string): Promise<void> {
  try {
    if ((await Clipboard.getStringAsync()) === value) {
      await Clipboard.setStringAsync('');
    }
  } catch {
    // Clipboard access can be denied after the app is backgrounded.
  }
}

export async function copySensitive(value: string, clearAfterMs = 60_000): Promise<void> {
  await Clipboard.setStringAsync(value);
  setTimeout(() => {
    void clearClipboardIfUnchanged(value);
  }, clearAfterMs);
}
