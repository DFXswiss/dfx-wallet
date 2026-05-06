import { by, device, element, waitFor } from 'detox';

/**
 * Enters a 6-digit PIN by tapping numpad keys.
 *
 * Temporarily re-enables Detox synchronization so the framework waits
 * for layout to settle before tapping. Without this, Fabric (New Architecture)
 * views report incorrect visible bounds during transitions.
 */
export async function enterPin(digits: string): Promise<void> {
  await device.enableSynchronization();
  await waitFor(element(by.id(`pin-key-${digits[0]}`)))
    .toBeVisible()
    .withTimeout(30_000);

  for (const digit of digits) {
    await element(by.id(`pin-key-${digit}`)).tap();
  }
  await device.disableSynchronization();
}
