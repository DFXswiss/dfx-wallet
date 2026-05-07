import { DfxApiError } from './api';

/**
 * Distinguishes the recoverable auth/onboarding states the DFX API returns
 * during a Buy/Sell call. The screen presents a different CTA in each case
 * (sign in, finish KYC, link or merge wallet).
 */
export type DfxAuthGateKind = 'login' | 'kyc' | 'registration';

export type DfxAuthGateState = {
  kind: DfxAuthGateKind;
  message: string;
};

/**
 * Map a thrown error to a user-facing recovery flow. Returns null if the
 * caller should keep the existing inline error path (e.g. validation,
 * server outage).
 */
export function interpretDfxAuthError(err: unknown): DfxAuthGateState | null {
  if (!(err instanceof DfxApiError)) return null;

  if (err.statusCode === 401 || err.statusCode === 403) {
    return { kind: 'login', message: err.message };
  }
  if (err.isRegistrationRequired) {
    return { kind: 'registration', message: err.message };
  }
  if (err.isKycRequired) {
    return { kind: 'kyc', message: err.message };
  }
  return null;
}
