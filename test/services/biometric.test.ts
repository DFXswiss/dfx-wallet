import {
  isBiometricAvailable,
  getBiometricType,
  authenticateWithBiometric,
} from '../../src/features/biometric/biometric';
import * as LA from 'expo-local-authentication';

const hasHardware = LA.hasHardwareAsync as jest.Mock;
const isEnrolled = LA.isEnrolledAsync as jest.Mock;
const supportedTypes = LA.supportedAuthenticationTypesAsync as jest.Mock;
const authenticate = LA.authenticateAsync as jest.Mock;

beforeEach(() => {
  hasHardware.mockReset();
  isEnrolled.mockReset();
  supportedTypes.mockReset();
  authenticate.mockReset();
});

describe('isBiometricAvailable', () => {
  it('returns true only when device has hardware AND user is enrolled', async () => {
    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(true);
    expect(await isBiometricAvailable()).toBe(true);
  });

  it('returns false when no hardware is present (does not even check enrolment)', async () => {
    hasHardware.mockResolvedValue(false);
    isEnrolled.mockResolvedValue(true);
    expect(await isBiometricAvailable()).toBe(false);
    expect(isEnrolled).not.toHaveBeenCalled();
  });

  it('returns false when hardware exists but no biometric is enrolled', async () => {
    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(false);
    expect(await isBiometricAvailable()).toBe(false);
  });
});

describe('getBiometricType', () => {
  it('returns "facial" when face recognition is supported', async () => {
    supportedTypes.mockResolvedValue([LA.AuthenticationType.FACIAL_RECOGNITION]);
    expect(await getBiometricType()).toBe('facial');
  });

  it('returns "fingerprint" when fingerprint is supported', async () => {
    supportedTypes.mockResolvedValue([LA.AuthenticationType.FINGERPRINT]);
    expect(await getBiometricType()).toBe('fingerprint');
  });

  it('returns "iris" when iris is supported', async () => {
    supportedTypes.mockResolvedValue([LA.AuthenticationType.IRIS]);
    expect(await getBiometricType()).toBe('iris');
  });

  it('prefers facial over fingerprint when both are reported', async () => {
    supportedTypes.mockResolvedValue([
      LA.AuthenticationType.FINGERPRINT,
      LA.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    expect(await getBiometricType()).toBe('facial');
  });

  it('returns "none" for an empty list', async () => {
    supportedTypes.mockResolvedValue([]);
    expect(await getBiometricType()).toBe('none');
  });
});

describe('authenticateWithBiometric', () => {
  it('returns true when LocalAuthentication reports success', async () => {
    authenticate.mockResolvedValue({ success: true });
    expect(await authenticateWithBiometric()).toBe(true);
  });

  it('returns false on a failed authentication', async () => {
    authenticate.mockResolvedValue({ success: false });
    expect(await authenticateWithBiometric()).toBe(false);
  });

  it('forwards the prompt message and disables device fallback', async () => {
    authenticate.mockResolvedValue({ success: true });
    await authenticateWithBiometric('Custom prompt');
    expect(authenticate).toHaveBeenCalledWith({
      promptMessage: 'Custom prompt',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
  });
});
