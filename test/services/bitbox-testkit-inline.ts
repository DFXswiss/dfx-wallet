/**
 * Inlined subset of the bitbox-testkit (joshuakrueger-dfx/bitbox-testkit).
 *
 * Once the testkit is published to npm, replace this file with:
 *
 *   export {
 *     scenarioRegressionUmlautEIP712,
 *     scenarioPanicMidQuery,
 *     ErrInvalidInput101,
 *   } from '@joshuakrueger-dfx/bitbox-testkit/scenarios';
 *
 * Until then, the inline copies below let the tests run without a separate
 * package install. Drift between this file and the testkit's TS source is
 * checked by tooling planned in Chunk 3.
 */

export class FirmwareError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'FirmwareError';
    this.code = code;
  }
}

/** ErrInvalidInput101 — firmware's "invalid input" response (quirk E1, B*, etc.) */
export const ErrInvalidInput101 = new FirmwareError(101, 'firmware: invalid input (101)');

/**
 * scenarioRegressionUmlautEIP712 — firmware rejects non-ASCII payloads in
 * EIP-712 / signMessage flows. Returns a bridge.call replacement that
 * mirrors firmware behaviour.
 *
 * Quirk E1: BitBox firmware rejects EIP-712 string values containing bytes
 * >= 0x80 with ErrInvalidInput (code 101). Clients must transliterate
 * (e.g. NFKD + ASCII fallback) before signing.
 */
export function scenarioRegressionUmlautEIP712() {
  return async (_method: string, args: readonly unknown[]) => {
    // signMessage args: [chainId, derivationPath, msgArrayLike]
    // ethSignTypedMessage args: [chainId, keypath, typedData] — typedData
    // is a structured object; we just check args recursively for non-ASCII.
    if (containsNonAscii(args)) {
      throw ErrInvalidInput101;
    }
    // Dummy successful signature payload (65 bytes split into r/s/v).
    return {
      r: Array.from(new Uint8Array(32)),
      s: Array.from(new Uint8Array(32)),
      v: [0],
    };
  };
}

/**
 * scenarioPanicMidQuery — bridge throws synchronously on the n-th call. Used
 * to assert dfx-wallet's promise chain stays well-behaved when the WebView
 * bridge surfaces unexpected exceptions (quirk A1 — every gomobile export
 * needs panic recovery; in the WebView world, the bridge needs catch+reject).
 */
export function scenarioPanicMidQuery(n = 1, value: unknown = 'simulated panic'): (m: string, a: readonly unknown[]) => Promise<unknown> {
  let seen = 0;
  return async () => {
    seen += 1;
    if (seen === n) {
      throw value;
    }
    return {
      r: Array.from(new Uint8Array(32)),
      s: Array.from(new Uint8Array(32)),
      v: [0],
    };
  };
}

function containsNonAscii(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) > 0x7f) return true;
    }
    return false;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return false;
  if (value instanceof Uint8Array) {
    for (let i = 0; i < value.length; i++) {
      if (value[i]! > 0x7f) return true;
    }
    return false;
  }
  if (Array.isArray(value)) {
    // Production code passes Uint8Array.from-style byte arrays as
    // `Array.from(uint8array)`, i.e. plain Array<number>. Recognise that
    // shape and treat the values as bytes.
    const looksLikeBytes =
      value.length > 0 &&
      value.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 255);
    if (looksLikeBytes) {
      return value.some((v) => (v as number) > 0x7f);
    }
    return value.some(containsNonAscii);
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(containsNonAscii);
  }
  return false;
}
