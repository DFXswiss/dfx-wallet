import { DfxApiError } from './api';

/**
 * Distinguishes the recoverable auth/onboarding states the DFX API returns
 * during a Buy/Sell call. The screen presents a different CTA in each case
 * (sign in, finish KYC, link the missing chain).
 */
export type DfxAuthGateKind = 'login' | 'kyc' | 'registration' | 'linkChain' | 'email';

export type DfxAuthGateState = {
  kind: DfxAuthGateKind;
  message: string;
  /**
   * For `linkChain`: the WDK chain id that has to be signed and attached to
   * the active DFX account before the request can succeed (`'bitcoin'`,
   * `'spark'`, etc.).
   */
  chain?: string;
};

/**
 * Map a thrown error to a user-facing recovery flow. Returns null if the
 * caller should keep the inline error path (validation, server outage).
 *
 * Ordering matters: specific error codes win over the generic status fallback
 * so we don't push a "DFX-Login nötig" popup at users who are actually just
 * missing KYC, have to attach another chain, or merge an email account.
 */
export function interpretDfxAuthError(err: unknown): DfxAuthGateState | null {
  if (!(err instanceof DfxApiError)) return null;

  if (err.isKycRequired) {
    return { kind: 'kyc', message: err.message };
  }
  if (err.isRegistrationRequired) {
    return { kind: 'registration', message: err.message };
  }
  // The buy/sell quote endpoint throws this BadRequest when the asset's
  // blockchain isn't part of the user's authenticated `jwt.blockchains`.
  // Surface it as a recoverable "link this chain" gate; the caller fills in
  // the WDK chain id from the request params it already has.
  if (err.statusCode === 400 && /asset blockchain mismatch/i.test(err.message)) {
    return { kind: 'linkChain', message: err.message };
  }
  // DFX returns the literal string `EmailRequired` (a `QuoteError` enum) when
  // a buy/sell quote needs the user to set + verify a contact email first.
  if (/^email\s*required$/i.test(err.message)) {
    return { kind: 'email', message: err.message };
  }
  if (err.statusCode === 401) {
    return { kind: 'login', message: err.message };
  }
  return null;
}
