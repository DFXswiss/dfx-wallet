import { execSync } from 'child_process';
import { by, device, element, waitFor } from 'detox';

/**
 * Resets the iOS Simulator Keychain.
 *
 * expo-secure-store persists data in the Keychain, which can survive
 * app uninstall/reinstall. This must run AFTER the simulator is booted
 * (i.e. after the first `device.launchApp()` call).
 */
function clearKeychain(): void {
  execSync('xcrun simctl keychain booted reset', { stdio: 'ignore' });
}

/**
 * Launches the app fresh and waits for the welcome screen.
 *
 * Synchronization is disabled because the WDK keeps the main queue
 * permanently busy with background tasks. This is expected and safe —
 * we use explicit `waitFor` calls throughout the tests instead.
 *
 * Launch sequence:
 * 1. First launchApp boots the simulator (needed for keychain access)
 * 2. Clear Keychain to remove stale expo-secure-store data
 * 3. Relaunch with clean state
 */
export async function launchAndWaitForWelcome(): Promise<void> {
  await device.launchApp({ newInstance: true, delete: true });
  clearKeychain();
  await device.launchApp({ newInstance: true, delete: true });
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
