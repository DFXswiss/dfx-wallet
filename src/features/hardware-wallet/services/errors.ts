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
 * isUserAbort heuristically classifies an unknown error as the on-device
 * user-rejected case. Used at the layer that converts bridge errors into
 * the typed classes above. Pattern-matches the bitbox-api conventions
 * (`Error.isUserAbort` flag, code 104, "user abort" in message).
 */
export function isUserAbort(err: unknown): boolean {
  if (err instanceof HwUserAbortError) return true;
  if (err instanceof Error) {
    if (/\buser[ -]?abort\b/i.test(err.message)) return true;
    if (/\b104\b/.test(err.message)) return true;
  }
  if (typeof err === 'object' && err !== null) {
    const o = err as { isUserAbort?: boolean; code?: number };
    if (o.isUserAbort === true) return true;
    if (o.code === 104) return true;
  }
  return false;
}

/** Parse a firmware-reject from a raw bridge error. */
export function parseFirmwareError(err: unknown): HwFirmwareRejectError | null {
  if (err instanceof HwFirmwareRejectError) return err;
  // Bridges that preserve the firmware code attach it as `code` on the
  // Error (see WasmBridge.onMessage). Fast-path that case — keeps the
  // original message intact instead of trying to regex it.
  if (typeof err === 'object' && err !== null) {
    const o = err as { code?: unknown; message?: unknown; name?: unknown };
    if (typeof o.code === 'number' && typeof o.message === 'string') {
      // Don't reclassify user-aborts here; isUserAbort() handles those.
      if (o.code === 104) return null;
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
  // Fallback: bitbox-api may surface firmware errors as messages like
  // "firmware error 101: invalid input". Extract a (code, message) pair.
  const m = err.message.match(/firmware[^0-9]*?(\d{1,3})\b/i);
  if (!m) return null;
  const code = parseInt(m[1]!, 10);
  if (code === 104) return null;
  return new HwFirmwareRejectError(code, err.message);
}

/**
 * Compare two firmware version strings ("9.21.0" vs "9.24.0"). Returns
 * negative if a < b, zero if equal, positive if a > b. Non-numeric
 * suffixes are treated as 0.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .replace(/^v/, '')
    .split('.')
    .map((p) => parseInt(p, 10) || 0);
  const pb = b
    .replace(/^v/, '')
    .split('.')
    .map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
