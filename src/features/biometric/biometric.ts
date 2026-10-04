import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export type BiometricPromptOptions = {
  promptMessage: string;
  cancelLabel: string;
};

/**
 * Check if biometric authentication is available on the device.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/**
 * Get the type of biometric authentication available.
 */
export async function getBiometricType(): Promise<BiometricType> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'facial';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
    return 'none';
  } catch {
    return 'none';
  }
}

/**
 * Prompt the user for biometric authentication.
 */
export async function authenticateWithBiometric({
  promptMessage,
  cancelLabel,
}: BiometricPromptOptions): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    });
    return result.success;
  } catch {
    return false;
  }
}
