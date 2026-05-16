// audit-skip-file: the ethSign* tokens in this file are not direct
// signing calls — they parse and validate RLP payloads BEFORE signing,
// closing the chain-replay gap (audit CC-6). Antiklepto stays inside
// bitbox-api WASM.

/**
 * Parse and validate the ETH transaction payload the caller is about to
 * hand to the hardware wallet for signing.
 *
 * Closes the chain-replay gap (audit CC-6). The bitbox-api SDK takes the
 * EIP-1559 / legacy chainId as a separate argument and uses it for both
 * (a) the on-device display and (b) the EIP-155 `v` calculation. But the
 * RLP body ALSO commits to a chainId. If the two disagree, the device
 * signs the body's chainId while displaying the SDK-arg chainId — a
 * malicious dApp can ask the user to sign "10 MATIC on Polygon" while
 * the signed bytes commit chainId=1 and 10 ETH.
 *
 * We parse the payload via ethers and assert chainId-in-body equals
 * chainId-in-opts. Mismatch → HwInvalidPayloadError (a typed throw the
 * UI maps to "Transaction data is inconsistent").
 *
 * We do NOT execute or re-serialize the tx; we only inspect. The bytes
 * the device receives are unchanged.
 */

import { Transaction, getBytes, hexlify } from 'ethers';
import { HwInvalidPayloadError } from './errors';

/**
 * Parse the RLP payload and return the canonical view (chainId, nonce,
 * recipient, value, gasLimit, fee fields, data) plus the underlying
 * ethers Transaction for callers that want richer inspection.
 *
 * isEIP1559 disambiguates the type-0 (legacy) vs type-2 wire format —
 * legacy txs are raw RLP, type-2 has a `0x02 || rlp(...)` envelope.
 * ethers' `Transaction.from(hex)` detects the type automatically, but
 * we still cross-check against the caller's expectation.
 */
export function parseEthTx(
  rlpPayload: Uint8Array,
  isEIP1559: boolean,
): {
  chainId: bigint;
  nonce: bigint;
  recipient: string | null;
  value: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint | null;
  gasPrice: bigint | null;
  data: string;
  type: 0 | 2;
} {
  if (!(rlpPayload instanceof Uint8Array) || rlpPayload.length === 0) {
    throw new HwInvalidPayloadError('rlpPayload is empty');
  }

  let tx: Transaction;
  try {
    // Type-2 (EIP-1559) txs are wire-encoded as 0x02 || rlp(...). Legacy
    // txs are raw rlp(...). ethers detects the prefix automatically.
    tx = Transaction.from(hexlify(rlpPayload));
  } catch (err) {
    throw new HwInvalidPayloadError(
      `RLP payload could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Cross-check expected type against the parsed envelope.
  const actualType = tx.type ?? 0;
  if (isEIP1559 && actualType !== 2) {
    throw new HwInvalidPayloadError(
      `isEIP1559=true but RLP envelope is type ${actualType} (expected 2)`,
    );
  }
  if (!isEIP1559 && actualType !== 0) {
    throw new HwInvalidPayloadError(
      `isEIP1559=false but RLP envelope is type ${actualType} (expected 0)`,
    );
  }

  if (tx.chainId === null || tx.chainId === undefined) {
    throw new HwInvalidPayloadError('RLP payload is missing a chainId');
  }

  return {
    chainId: BigInt(tx.chainId),
    nonce: BigInt(tx.nonce),
    recipient: tx.to,
    value: tx.value,
    gasLimit: tx.gasLimit,
    maxFeePerGas: tx.maxFeePerGas,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    gasPrice: tx.gasPrice,
    data: tx.data,
    type: actualType === 2 ? 2 : 0,
  };
}

/**
 * Validate that the chainId the caller is about to pass to the device
 * (as the separate SDK argument) matches the chainId committed inside
 * the RLP body. Throws HwInvalidPayloadError on mismatch.
 *
 * This is the gate the provider runs BEFORE bridging into WASM. Bypass
 * the validation only with a documented reason — and review carefully.
 */
export function assertChainIdMatchesRlp(
  rlpPayload: Uint8Array,
  expectedChainId: bigint,
  isEIP1559: boolean,
): void {
  const parsed = parseEthTx(rlpPayload, isEIP1559);
  if (parsed.chainId !== expectedChainId) {
    throw new HwInvalidPayloadError(
      `chainId mismatch: RLP body commits to ${parsed.chainId}, opts.chainId is ${expectedChainId}`,
    );
  }
}

/** Test-only re-export of getBytes for round-trip helpers. */
export { getBytes };
