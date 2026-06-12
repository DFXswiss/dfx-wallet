/**
 * Exception-surface enumeration.
 *
 * Every typed exception the app defines must be enumerated here, in the same
 * PR that introduces it. This is drift-catching by enumeration: when someone
 * adds `class FooError extends Error` without registering it here, the
 * companion check (count of `extends Error` declarations under src/) fails
 * and forces a conscious decision about the error's name, identity and
 * user-facing surface.
 *
 * Why it matters in a wallet: error identity is control flow. DfxApiError's
 * `code` decides whether the user is routed into KYC; an exception whose
 * `name` regresses to 'Error' breaks every `err.name === ...` branch
 * silently.
 */
import { execSync } from 'node:child_process';
import { DfxApiError } from '@/features/dfx-backend/services/api';
import { PasskeyPrfUnsupportedError } from '@/features/passkey/services/passkey-service';

// passkey-service pulls in react-native-passkey, whose native module probes
// Platform at import time — irrelevant for the error class under test.
jest.mock('react-native-passkey', () => ({ Passkey: {} }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: () => undefined } }));

describe('exception surface', () => {
  it('enumerates every typed exception defined under src/', () => {
    const declarations = execSync(
      "grep -rn 'extends Error' src --include='*.ts' --include='*.tsx' | grep -v '\\.test\\.' || true",
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);

    // One entry per typed exception. Adding a new `extends Error` class?
    // Register it below AND add identity tests for it in this file.
    const registered = ['DfxApiError', 'PasskeyPrfUnsupportedError'];

    expect(declarations).toHaveLength(registered.length);
    for (const cls of registered) {
      expect(declarations.some((d) => d.includes(`class ${cls} `))).toBe(true);
    }
  });

  describe('DfxApiError', () => {
    it('keeps its identity across the instanceof and name channels', () => {
      const err = new DfxApiError(403, 'KYC_LEVEL_REQUIRED', 'KYC required');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DfxApiError);
      expect(err.name).toBe('DfxApiError');
      expect(err.message).toBe('KYC required');
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('KYC_LEVEL_REQUIRED');
    });

    it('routes KYC codes through isKycRequired', () => {
      expect(new DfxApiError(403, 'KYC_LEVEL_REQUIRED', '').isKycRequired).toBe(true);
      expect(new DfxApiError(403, 'KYC_DATA_REQUIRED', '').isKycRequired).toBe(true);
      expect(new DfxApiError(403, 'REGISTRATION_REQUIRED', '').isKycRequired).toBe(false);
      expect(new DfxApiError(500, '', '').isKycRequired).toBe(false);
    });

    it('routes registration through isRegistrationRequired', () => {
      expect(new DfxApiError(403, 'REGISTRATION_REQUIRED', '').isRegistrationRequired).toBe(true);
      expect(new DfxApiError(403, 'KYC_LEVEL_REQUIRED', '').isRegistrationRequired).toBe(false);
    });
  });

  describe('PasskeyPrfUnsupportedError', () => {
    it('keeps its identity and fixed message', () => {
      const err = new PasskeyPrfUnsupportedError();
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PasskeyPrfUnsupportedError);
      expect(err.name).toBe('PasskeyPrfUnsupportedError');
      expect(err.message).toBe('PRF extension not supported by this authenticator');
    });
  });
});
