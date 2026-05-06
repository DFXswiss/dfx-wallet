import { execSync } from 'child_process';
import { by, device, element, waitFor } from 'detox';

/**
 * Clears the iOS Simulator Keychain.
 *
 * expo-secure-store persists data in the Keychain, which survives app
 * deletion / reinstall. Without clearing it, the app will see stale
 * onboarding state from previous runs.
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
 */
export async function launchAndWaitForWelcome(): Promise<void> {
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
