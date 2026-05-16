/**
 * Distinct Error subclasses for hardware-wallet flows. Throwing distinct
 * classes (not just `new Error('something')`) lets UI code use
 * `err instanceof UserAbortError` instead of brittle string matching, and
 * lets logs redact safely without losing semantic context.
 *
 * Naming mirrors the HardwareWalletError discriminated union in types.ts;
 * every error class corresponds to one `kind`.
 */

export class HwUserAbortError extends Error {
  readonly kind = 'UserAbort' as const;
  constructor() {
    super('User rejected the operation on the device');
    this.name = 'HwUserAbortError';
  }
}

export class HwFirmwareRejectError extends Error {
  readonly kind = 'FirmwareReject' as const;
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'HwFirmwareRejectError';
  }
}

export class HwFirmwareTooOldError extends Error {
  readonly kind = 'FirmwareTooOld' as const;
  constructor(
    readonly minRequired: string,
    readonly actual: string,
  ) {
    super(`Firmware ${actual} is below the required minimum ${minRequired}`);
    this.name = 'HwFirmwareTooOldError';
  }
}

export class HwFirmwareUnsupportedOperationError extends Error {
  readonly kind = 'FirmwareUnsupportedOperation' as const;
  constructor(
    readonly operation: string,
    readonly firmware: string,
  ) {
    super(`Operation "${operation}" is not supported on firmware ${firmware}`);
    this.name = 'HwFirmwareUnsupportedOperationError';
  }
}

export class HwNotConnectedError extends Error {
  readonly kind = 'NotConnected' as const;
  constructor() {
    super('Hardware wallet is not connected. Call connect() first.');
    this.name = 'HwNotConnectedError';
  }
}

export class HwBridgeNotReadyError extends Error {
  readonly kind = 'BridgeNotReady' as const;
  constructor(detail?: string) {
    super(`WASM bridge is not initialised${detail ? `: ${detail}` : ''}`);
    this.name = 'HwBridgeNotReadyError';
  }
}

export class HwBridgeTimeoutError extends Error {
  readonly kind = 'BridgeTimeout' as const;
  constructor(
    readonly method: string,
    readonly timeoutMs: number,
  ) {
    super(`WASM bridge call ${method} did not return within ${timeoutMs}ms`);
    this.name = 'HwBridgeTimeoutError';
  }
}

export class HwTransportFailureError extends Error {
  readonly kind = 'TransportFailure' as const;
  readonly transportCause: string;
  constructor(transportCause: string, original?: Error) {
    super(`Transport failure: ${transportCause}`);
    this.name = 'HwTransportFailureError';
    this.transportCause = transportCause;
    // Standard Error.cause for downstream stack-walking.
    if (original) (this as Error).cause = original;
  }
}

export class HwPermissionDeniedError extends Error {
  readonly kind = 'PermissionDenied' as const;
  constructor(readonly platform: 'android' | 'ios' | 'unknown') {
    super(`Permission denied on ${platform}`);
    this.name = 'HwPermissionDeniedError';
  }
}

export class HwAddressMismatchError extends Error {
  readonly kind = 'AddressMismatch' as const;
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    // Do NOT include the addresses in `message` — `toString()` ends up in
    // logs and crash reports. The constructor parameters are available
    // structurally for the UI layer to render with appropriate redaction.
    super('Device returned a different address than the cached one');
    this.name = 'HwAddressMismatchError';
  }
}

/**
 * Valid firmware reject code range. bitbox-api convention: 100-199 for
 * device rejects; 104 is reserved for user-abort and handled separately.
 */
const FIRMWARE_REJECT_CODE_MIN = 100;
const FIRMWARE_REJECT_CODE_MAX = 199;
const USER_ABORT_CODE = 104;

/**
 * isUserAbort classifies an unknown error as the on-device user-rejected
 * case. Used at the layer that converts bridge errors into the typed
 * classes above. Only relies on structural signals (`code === 104`,
 * `isUserAbort === true`) and the explicit `"user abort"` token in the
 * message — never on `\b104\b` alone, which previously misclassified
 * transport errors that happened to mention "104ms" or "errno 104".
 */
export function isUserAbort(err: unknown): boolean {
  if (err instanceof HwUserAbortError) return true;
  if (typeof err === 'object' && err !== null) {
    const o = err as { isUserAbort?: boolean; code?: number };
    if (o.isUserAbort === true) return true;
    if (o.code === USER_ABORT_CODE) return true;
  }
  if (err instanceof Error) {
    if (/\buser[ -]?abort\b/i.test(err.message)) return true;
  }
  return false;
}

/**
 * Parse a firmware-reject from a raw bridge error.
 *
 * Strict by design — only returns a HwFirmwareRejectError when:
 *   • The error carries `code: number` in the bitbox-api reject range
 *     (100-199, excluding 104), OR
 *   • The message contains the explicit phrase "firmware error NNN" where
 *     NNN is a 3-digit code in the reject range.
 *
 * The previous heuristic (`/firmware[^0-9]*?(\d{1,3})\b/i`) over-matched on
 * unrelated text like "firmware update available v9" → code 9, surfacing
 * spurious HwFirmwareRejectErrors to users.
 */
export function parseFirmwareError(err: unknown): HwFirmwareRejectError | null {
  if (err instanceof HwFirmwareRejectError) return err;
  if (typeof err === 'object' && err !== null) {
    const o = err as { code?: unknown; message?: unknown; name?: unknown };
    if (typeof o.code === 'number' && typeof o.message === 'string') {
      if (o.code === USER_ABORT_CODE) return null;
      if (o.code < FIRMWARE_REJECT_CODE_MIN || o.code > FIRMWARE_REJECT_CODE_MAX) return null;
      // Don't reclassify our own non-firmware error classes.
      if (
        typeof o.name === 'string' &&
        o.name.startsWith('Hw') &&
        o.name !== 'HwFirmwareRejectError'
      ) {
        return null;
      }
      return new HwFirmwareRejectError(o.code, o.message);
    }
  }
  if (!(err instanceof Error)) return null;
  // Require the literal pattern "firmware error NNN" (3 digits exactly).
  // No more loose `\d{1,3}` that matches `"v9"` in "firmware update v9".
  const m = err.message.match(/firmware\s+error\s+(\d{3})\b/i);
  if (!m) return null;
  const code = parseInt(m[1]!, 10);
  if (code === USER_ABORT_CODE) return null;
  if (code < FIRMWARE_REJECT_CODE_MIN || code > FIRMWARE_REJECT_CODE_MAX) return null;
  return new HwFirmwareRejectError(code, err.message);
}

/**
 * Compare two semver-ish firmware version strings ("9.21.0" vs "9.24.0").
 * Returns negative if a < b, zero if equal, positive if a > b.
 *
 * Pre-release suffixes (`9.20.0-rc1`, `9.20.0-beta`) sort STRICTLY BELOW
 * the corresponding release (`9.20.0`) per semver §11. A numeric segment
 * with a non-digit tail is interpreted as `numeric.preRelease`. Garbage
 * inputs (empty, non-numeric prefix, "latest") parse as `0.0.0`, which
 * the MIN_FIRMWARE gate then rejects as too-old — fail-closed.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const max = Math.max(pa.numeric.length, pb.numeric.length);
  for (let i = 0; i < max; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i is bounded by max above
    const av = pa.numeric[i] ?? 0;
    // eslint-disable-next-line security/detect-object-injection -- i is bounded by max above
    const bv = pb.numeric[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  // Numeric segments equal — apply semver pre-release rule.
  // Release (no pre-release) > pre-release (any pre-release).
  if (!pa.preRelease && pb.preRelease) return 1;
  if (pa.preRelease && !pb.preRelease) return -1;
  if (pa.preRelease && pb.preRelease) {
    return pa.preRelease < pb.preRelease ? -1 : pa.preRelease > pb.preRelease ? 1 : 0;
  }
  return 0;
}

function parseVersion(v: string): { numeric: number[]; preRelease: string } {
  const cleaned = v.replace(/^v/, '');
  const dashIdx = cleaned.indexOf('-');
  const head = dashIdx >= 0 ? cleaned.slice(0, dashIdx) : cleaned;
  const preRelease = dashIdx >= 0 ? cleaned.slice(dashIdx + 1) : '';
  const numeric = head.split('.').map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return { numeric, preRelease };
}
