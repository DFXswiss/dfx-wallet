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
      expect((err as { kind: string }).kind).toBe(kind);
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
});
