import { by, device, element, waitFor } from 'detox';

/**
 * Launches the app fresh and waits for the welcome screen.
 *
 * App files and the iOS Keychain are independent stores: expo-secure-store
 * survives uninstall/reinstall (`delete: true`). Reset both together so an
 * MMKV onboarded-flag cannot disagree with a leftover seed (or the reverse).
 *
 * Synchronization is disabled because the WDK keeps the main queue
 * permanently busy with background tasks. This is expected and safe —
 * we use explicit `waitFor` calls throughout the tests instead.
 *
 * Launch sequence:
 * 1. First launchApp boots the simulator (needed for keychain / app-state APIs)
 * 2. Terminate, then reset app data and the Keychain together
 * 3. Relaunch with both stores empty
 */
export async function launchAndWaitForWelcome(): Promise<void> {
  await device.launchApp({ newInstance: true, delete: true });
  await device.terminateApp();
  await device.resetAppState();
  await device.clearKeychain();
  await device.launchApp({ newInstance: true });
  await device.disableSynchronization();
  await waitFor(element(by.id('welcome-screen')))
    .toBeVisible()
    .withTimeout(30_000);
}

/**
 * Launches the app without clearing state (for PIN unlock tests).
 * Synchronization remains disabled.
 */
export async function launchWithExistingState(): Promise<void> {
  await device.launchApp({ newInstance: true, delete: false });
  await device.disableSynchronization();
}
