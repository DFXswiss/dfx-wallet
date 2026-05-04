// Mock for expo-local-authentication used by src/services/biometric.ts.
// Each test resets behaviour via mockResolvedValue / mockImplementationOnce.

export const hasHardwareAsync = jest.fn(async () => true);
export const isEnrolledAsync = jest.fn(async () => true);
export const supportedAuthenticationTypesAsync = jest.fn(async () => [] as number[]);
export const authenticateAsync = jest.fn(async (_options?: unknown) => ({ success: true }));

export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
} as const;
