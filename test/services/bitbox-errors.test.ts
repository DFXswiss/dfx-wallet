/**
 * Tests for the typed Hw* error classes and helpers (parseFirmwareError,
 * isUserAbort, compareVersions). These are the foundation of the UI's
 * ability to branch on user-abort vs firmware-reject vs transport-failure;
 * silent regressions here mask production bugs.
 */

import {
  compareVersions,
  HwAddressMismatchError,
  HwBridgeNotReadyError,
  HwBridgeTimeoutError,
  HwFirmwareRejectError,
  HwFirmwareTooOldError,
  HwFirmwareUnsupportedOperationError,
  HwNotConnectedError,
  HwPermissionDeniedError,
  HwTransportFailureError,
  HwUserAbortError,
  isUserAbort,
  parseFirmwareError,
} from '@/features/hardware-wallet/services/errors';

describe('Hw* error classes carry their kind discriminant', () => {
  const cases: Array<[Error, string]> = [
    [new HwUserAbortError(), 'UserAbort'],
    [new HwFirmwareRejectError(101, 'oops'), 'FirmwareReject'],
    [new HwFirmwareTooOldError('9.19.0', '9.10.0'), 'FirmwareTooOld'],
    [new HwFirmwareUnsupportedOperationError('cardano', '9.21.0'), 'FirmwareUnsupportedOperation'],
    [new HwNotConnectedError(), 'NotConnected'],
    [new HwBridgeNotReadyError(), 'BridgeNotReady'],
    [new HwBridgeTimeoutError('pair', 30_000), 'BridgeTimeout'],
    [new HwTransportFailureError('cause'), 'TransportFailure'],
    [new HwPermissionDeniedError('android'), 'PermissionDenied'],
    [new HwAddressMismatchError('0xa', '0xb'), 'AddressMismatch'],
  ];
  for (const [err, kind] of cases) {
    it(`${err.constructor.name}.kind === ${kind}`, () => {
      expect((err as unknown as { kind: string }).kind).toBe(kind);
    });
  }
});

describe('HwAddressMismatchError redacts addresses from message/toString', () => {
  it('does not leak the addresses into the user-facing message', () => {
    const err = new HwAddressMismatchError(
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    );
    expect(err.message).not.toContain('0x1111111111111111111111111111111111111111');
    expect(err.message).not.toContain('0x2222222222222222222222222222222222222222');
    expect(err.toString()).not.toContain('0x1111111111111111111111111111111111111111');
    expect(err.toString()).not.toContain('0x2222222222222222222222222222222222222222');
  });

  it('keeps the addresses structurally accessible for the UI to render', () => {
    const err = new HwAddressMismatchError('0xabc', '0xdef');
    expect(err.expected).toBe('0xabc');
    expect(err.actual).toBe('0xdef');
  });
});

describe('isUserAbort', () => {
  it('matches HwUserAbortError instances', () => {
    expect(isUserAbort(new HwUserAbortError())).toBe(true);
  });

  it('matches errors with a code-104 property', () => {
    const e = new Error('something');
    (e as Error & { code?: number }).code = 104;
    expect(isUserAbort(e)).toBe(true);
  });

  it('matches messages containing "user abort"', () => {
    expect(isUserAbort(new Error('user abort triggered'))).toBe(true);
    expect(isUserAbort(new Error('User-Abort happened'))).toBe(true);
    expect(isUserAbort(new Error('something else'))).toBe(false);
  });

  it('matches { isUserAbort: true } objects', () => {
    expect(isUserAbort({ isUserAbort: true })).toBe(true);
  });

  it('ignores random throw values', () => {
    expect(isUserAbort('a string')).toBe(false);
    expect(isUserAbort(42)).toBe(false);
    expect(isUserAbort(null)).toBe(false);
    expect(isUserAbort(undefined)).toBe(false);
  });

  // Regression: previously /\b104\b/.test(err.message) would misclassify
  // transport errors whose message coincidentally contained the number 104.
  // The fix removes the message-regex match for 104, keeping only the
  // structural code === 104 check.
  it('does NOT misclassify transport errors that mention 104 in text', () => {
    expect(isUserAbort(new Error('BLE timeout after 104ms'))).toBe(false);
    expect(isUserAbort(new Error('ENOENT errno 104'))).toBe(false);
    expect(isUserAbort(new Error('Transport read failed at offset 104'))).toBe(false);
    expect(isUserAbort(new Error('Got 104 bytes; expected 65'))).toBe(false);
  });
});

describe('parseFirmwareError', () => {
  it('passes through HwFirmwareRejectError unchanged', () => {
    const original = new HwFirmwareRejectError(101, 'invalid input');
    expect(parseFirmwareError(original)).toBe(original);
  });

  it('detects code+message objects', () => {
    const e = new Error('invalid input (101)');
    (e as Error & { code?: number }).code = 101;
    const parsed = parseFirmwareError(e);
    expect(parsed).toBeInstanceOf(HwFirmwareRejectError);
    expect(parsed?.code).toBe(101);
  });

  it('does NOT misclassify a user-abort (code 104)', () => {
    const e = new Error('user abort');
    (e as Error & { code?: number }).code = 104;
    expect(parseFirmwareError(e)).toBeNull();
  });

  it('does NOT reclassify our own typed errors', () => {
    expect(parseFirmwareError(new HwBridgeNotReadyError())).toBeNull();
    expect(parseFirmwareError(new HwTransportFailureError('x'))).toBeNull();
  });

  it('falls back to message regex extraction', () => {
    const e = new Error('firmware error 102: bad state');
    const parsed = parseFirmwareError(e);
    expect(parsed?.code).toBe(102);
  });

  it('returns null for unrelated errors', () => {
    expect(parseFirmwareError(new Error('network unreachable'))).toBeNull();
    expect(parseFirmwareError('a string')).toBeNull();
    expect(parseFirmwareError(null)).toBeNull();
  });

  // Regression: previously /firmware[^0-9]*?(\d{1,3})\b/i would over-match
  // unrelated text like "firmware update available v9" → code=9 → spurious
  // HwFirmwareRejectError. The fix tightens the regex to the literal
  // "firmware error NNN" form AND requires NNN ∈ [100,199] \ {104}.
  it('does NOT extract a code from unrelated firmware-mentioning text', () => {
    expect(parseFirmwareError(new Error('firmware update available v9'))).toBeNull();
    expect(parseFirmwareError(new Error('current firmware 9.21.0 is outdated'))).toBeNull();
    expect(parseFirmwareError(new Error('please update firmware to 1.0'))).toBeNull();
  });

  it('rejects codes outside the bitbox-api firmware-reject range (100-199)', () => {
    const tooLow = new Error('firmware error 099: ?');
    expect(parseFirmwareError(tooLow)).toBeNull();
    const tooHigh = new Error('firmware error 200: ?');
    expect(parseFirmwareError(tooHigh)).toBeNull();

    const lowStructural = new Error('?');
    (lowStructural as Error & { code?: number }).code = 50;
    expect(parseFirmwareError(lowStructural)).toBeNull();
    const highStructural = new Error('?');
    (highStructural as Error & { code?: number }).code = 9999;
    expect(parseFirmwareError(highStructural)).toBeNull();
  });

  it('accepts the explicit "firmware error NNN" pattern for valid codes', () => {
    expect(parseFirmwareError(new Error('firmware error 101: invalid input'))?.code).toBe(101);
    expect(parseFirmwareError(new Error('FIRMWARE ERROR 199'))?.code).toBe(199);
    expect(parseFirmwareError(new Error('firmware  error   150  bad'))?.code).toBe(150);
  });
});

describe('compareVersions', () => {
  it('correctly orders semantic versions', () => {
    expect(compareVersions('9.19.0', '9.20.0')).toBeLessThan(0);
    expect(compareVersions('9.20.0', '9.19.9')).toBeGreaterThan(0);
    expect(compareVersions('9.21.0', '9.21.0')).toBe(0);
  });

  it('tolerates v prefix', () => {
    expect(compareVersions('v9.20.0', '9.20.0')).toBe(0);
    expect(compareVersions('9.20.0', 'v9.20.0')).toBe(0);
  });

  it('handles different segment counts', () => {
    expect(compareVersions('9.20', '9.20.0')).toBe(0);
    expect(compareVersions('9.20.1', '9.20')).toBeGreaterThan(0);
  });

  it('does not crash on empty strings', () => {
    expect(compareVersions('', '')).toBe(0);
    expect(compareVersions('9.0.0', '')).toBeGreaterThan(0);
  });

  // Regression: pre-release suffixes (-rc1, -beta) must sort STRICTLY
  // BELOW the corresponding release (semver §11). Previously parseInt
  // would consume only the numeric prefix and drop the suffix entirely,
  // so 9.20.0-rc1 compared equal to 9.20.0 — letting unreleased firmware
  // past the MIN_FIRMWARE gate as if it were the final.
  it('orders pre-release strictly below the corresponding release', () => {
    expect(compareVersions('9.20.0-rc1', '9.20.0')).toBeLessThan(0);
    expect(compareVersions('9.20.0', '9.20.0-rc1')).toBeGreaterThan(0);
    expect(compareVersions('9.20.0-rc1', '9.20.0-rc2')).toBeLessThan(0);
    expect(compareVersions('9.20.0-rc1', '9.20.0-rc1')).toBe(0);
    expect(compareVersions('9.20.0-beta', '9.20.0-rc1')).toBeLessThan(0);
  });

  it('still orders by numeric segments before comparing pre-release', () => {
    // A higher-numeric pre-release outranks a lower-numeric release.
    expect(compareVersions('9.21.0-rc1', '9.20.0')).toBeGreaterThan(0);
  });

  it('treats garbage versions as 0.0.0 (fail-closed)', () => {
    expect(compareVersions('latest', '9.19.0')).toBeLessThan(0);
    expect(compareVersions('not-a-version', '9.19.0')).toBeLessThan(0);
  });
});
