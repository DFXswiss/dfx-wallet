import { Platform } from 'react-native';

/**
 * Cheap MVP-side OS gate for passkey + PRF support. Returns true on
 * iOS 18+ and Android 14+ (API 34). Used by the welcome screen to
 * decide whether to render the "create passkey" affordance.
 *
 * Intentionally does not import `react-native-passkey` — that would
 * pull the full passkey native module into the MVP bundle even when
 * `EXPO_PUBLIC_ENABLE_PASSKEY` is off. The runtime capability check
 * via `Passkey.isSupported()` runs inside the passkey feature module
 * when the user actually starts the flow.
 */
export function isPasskeyOsSupported(): boolean {
  if (Platform.OS === 'ios') {
    const version = parseInt(Platform.Version as string, 10);
    return version >= 18;
  }
  if (Platform.OS === 'android') {
    return typeof Platform.Version === 'number' && Platform.Version >= 34;
  }
  return false;
}
