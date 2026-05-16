/**
 * Inlined subset of the bitbox-testkit (joshuakrueger-dfx/bitbox-testkit).
 *
 * Once the testkit is published to npm, replace this file with:
 *
 *   export {
 *     scenarioRegressionUmlautEIP712,
 *     scenarioPanicMidQuery,
 *     scenarioErrInvalidInput,
 *     scenarioSlowResponse,
 *     scenarioChannelHashEarly,
 *     scenarioUnknownNetwork,
 *     ErrInvalidInput101,
 *     ErrUserAbort,
 *   } from '@joshuakrueger-dfx/bitbox-testkit/scenarios';
 *
 * Inline copies let the tests run without a separate package install.
 */

export class FirmwareError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'FirmwareError';
    this.code = code;
  }
}

/** Wire-level firmware response for malformed input. Most BitBox quirks. */
export const ErrInvalidInput101 = new FirmwareError(101, 'firmware: invalid input (101)');

/** User cancelled on-device. */
export const ErrUserAbort = new FirmwareError(104, 'firmware: user abort (104)');

/** Bridge handler shape: takes a method name and its args, returns/rejects. */
export type BridgeHandler = (method: string, args: readonly unknown[]) => Promise<unknown>;

/** Successful 65-byte signature shape used by ETH sign methods. */
const dummySignature = () => ({
  r: Array.from(new Uint8Array(32)),
  s: Array.from(new Uint8Array(32)),
  v: [0],
});

/**
 * Quirk E1: firmware rejects EIP-712 / signMessage payloads containing
 * non-ASCII bytes. Pure-ASCII payloads succeed; anything with byte >= 0x80
 * surfaces ErrInvalidInput101.
 */
export function scenarioRegressionUmlautEIP712(): BridgeHandler {
  return async (_method, args) => {
    if (containsNonAscii(args)) throw ErrInvalidInput101;
    return dummySignature();
  };
}

/**
 * Quirk A1: bridge throws synchronously on the n-th call. Used to assert
 * the consumer's promise chain stays well-behaved when the WebView bridge
 * surfaces unexpected exceptions.
 */
export function scenarioPanicMidQuery(n = 1, value: unknown = 'simulated panic'): BridgeHandler {
  let seen = 0;
  return async () => {
    seen += 1;
    if (seen === n) throw value;
    return dummySignature();
  };
}

/**
 * Generic firmware-reject scenario: every call rejects with ErrInvalidInput101.
 * Use for quirks E2..E10, B1..B7, C1..C4, M1, M3 where the wire-level
 * shape is identical — the only thing that varies is which CLIENT input
 * trips the rejection (which is what your test asserts).
 */
export function scenarioErrInvalidInput(): BridgeHandler {
  return async () => {
    throw ErrInvalidInput101;
  };
}

/**
 * Quirk A2: every call resolves only after `delayMs`. Use to prove the
 * client's timeouts are context-driven (long user-confirm flows succeed).
 */
export function scenarioSlowResponse(delayMs = 15_000, payload: unknown = dummySignature()): BridgeHandler {
  return () => new Promise((resolve) => setTimeout(() => resolve(payload), delayMs));
}

/**
 * Quirk P1: pairing race. The first `hashRepeats` calls return a fake
 * channel-hash payload; subsequent calls reject with "awaiting confirm"
 * until signalConfirm() is invoked. Mirrors the production race where
 * the channel hash is observable BEFORE the user has confirmed on-device.
 */
export function scenarioChannelHashEarly(hashRepeats = 2): {
  handler: BridgeHandler;
  signalConfirm: () => void;
} {
  let hashCount = 0;
  let confirmed = false;
  const handler: BridgeHandler = async () => {
    if (hashCount < hashRepeats) {
      hashCount++;
      return { channelHash: [0xde, 0xad, 0xbe, 0xef] };
    }
    if (!confirmed) {
      throw new Error('awaiting user confirmation');
    }
    return dummySignature();
  };
  return { handler, signalConfirm: () => { confirmed = true; } };
}

/**
 * Quirk E10: firmware on older versions doesn't recognise a chain ID.
 * Tolerates the chainId arriving as either number, bigint or string
 * (BitboxProvider serialises bigint → string for the JSON-over-postMessage
 * wire format). Returns ErrInvalidInput101 when the chainId matches the
 * "known unknown" set; otherwise succeeds with a dummy signature.
 * the firmware-side allowlist is more elaborate). ASCII payloads on
 * known chains succeed.
 */
export function scenarioUnknownNetwork(unknownChainIds: (number | bigint)[] = [999, 146]): BridgeHandler {
  const set = new Set(unknownChainIds.map((id) => String(id)));
  return async (_method, args) => {
    const chainId = args[0];
    let key: string | null = null;
    if (typeof chainId === 'string') key = chainId;
    else if (typeof chainId === 'number') key = String(chainId);
    else if (typeof chainId === 'bigint') key = chainId.toString();
    if (key !== null && set.has(key)) {
      throw ErrInvalidInput101;
    }
    return dummySignature();
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
