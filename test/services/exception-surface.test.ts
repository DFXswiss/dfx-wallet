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
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DfxApiError } from '@/features/dfx-backend/services/api';
import { PasskeyPrfUnsupportedError } from '@/features/passkey/services/passkey-service';
import { OpenCryptoPayError } from '@/services/opencryptopay/opencryptopay-service';

/** Recursively list every non-test .ts/.tsx file under a directory. */
function tsSourceFiles(dir: string): string[] {
  const out: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only walk rooted at the literal 'src'; paths derive solely from that subtree, no external input
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...tsSourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(path);
    }
  }
  return out;
}

// passkey-service pulls in react-native-passkey, whose native module probes
// Platform at import time — irrelevant for the error class under test.
jest.mock('react-native-passkey', () => ({ Passkey: {} }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: () => undefined } }));

describe('exception surface', () => {
  it('enumerates every typed exception defined under src/', () => {
    // Node FS walk instead of `grep`: independent of the runner's CWD and of a
    // POSIX `grep` being on PATH (a missing binary would have reddened this
    // suite without anything being wrong). Matching is identical — any line
    // containing `extends Error` in a non-test source file under src/.
    const declarations = tsSourceFiles('src').flatMap((file) =>
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- `file` comes only from the literal-rooted tsSourceFiles('src') walk, no external input
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => line.includes('extends Error'))
        .map(({ line, n }) => `${file}:${n}:${line}`),
    );

    // One entry per typed exception. Adding a new `extends Error` class?
    // Register it below AND add identity tests for it in this file.
    const registered = ['DfxApiError', 'PasskeyPrfUnsupportedError', 'OpenCryptoPayError'];

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

  describe('OpenCryptoPayError', () => {
    it('keeps its identity across the instanceof and name channels, and carries its code', () => {
      const err = new OpenCryptoPayError('invalid-qr', 'Not an OpenCryptoPay QR code');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(OpenCryptoPayError);
      expect(err.name).toBe('OpenCryptoPayError');
      expect(err.message).toBe('Not an OpenCryptoPay QR code');
      expect(err.code).toBe('invalid-qr');
    });
  });
});
