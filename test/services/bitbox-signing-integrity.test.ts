/**
 * Tests for the signing-integrity layer added in audit commit 4:
 *   • CC-6 RLP chainId validation gate
 *   • CC-7 verifyAddress via re-derived xpub
 *   • CC-16 branded DeviceDisplay (no-display ack)
 *
 * These close the chain-replay and trust-the-device-address gaps that
 * the audit flagged as CRITICAL.
 */

import { Transaction, getBytes } from 'ethers';
import { BitboxProvider } from '@/features/hardware-wallet/services/bitbox';
import {
  HwAddressMismatchError,
  HwInvalidPayloadError,
} from '@/features/hardware-wallet/services/errors';
import {
  parseEthTx,
  assertChainIdMatchesRlp,
} from '@/features/hardware-wallet/services/eth-tx-validation';
import {
  splitDerivationPath,
  verifyEthAddressByXpub,
} from '@/features/hardware-wallet/services/eth-address-verify';
import { setHwLogger } from '@/features/hardware-wallet/services/log';

beforeAll(() => setHwLogger({ log: () => undefined }));

function rlp1559(chainId: bigint): Uint8Array {
  const tx = Transaction.from({
    type: 2,
    chainId,
    nonce: 0,
    maxFeePerGas: 1n,
    maxPriorityFeePerGas: 1n,
    gasLimit: 21000n,
    to: '0x0000000000000000000000000000000000000000',
    value: 0n,
    data: '0x',
    accessList: [],
  });
  return getBytes(tx.unsignedSerialized);
}

function rlpLegacy(chainId: bigint): Uint8Array {
  const tx = Transaction.from({
    type: 0,
    chainId,
    nonce: 0,
    gasPrice: 1n,
    gasLimit: 21000n,
    to: '0x0000000000000000000000000000000000000000',
    value: 0n,
    data: '0x',
  });
  return getBytes(tx.unsignedSerialized);
}

describe('CC-6 — RLP chainId validation', () => {
  it('parses an EIP-1559 RLP and exposes chainId / value / recipient', () => {
    const parsed = parseEthTx(rlp1559(137n), true);
    expect(parsed.chainId).toBe(137n);
    expect(parsed.type).toBe(2);
    expect(parsed.recipient).toBe('0x0000000000000000000000000000000000000000');
    expect(parsed.value).toBe(0n);
    expect(parsed.gasLimit).toBe(21000n);
  });

  it('parses a legacy EIP-155 RLP and exposes chainId', () => {
    const parsed = parseEthTx(rlpLegacy(1n), false);
    expect(parsed.chainId).toBe(1n);
    expect(parsed.type).toBe(0);
  });

  it('rejects an empty RLP payload', () => {
    expect(() => parseEthTx(new Uint8Array(0), true)).toThrow(HwInvalidPayloadError);
  });

  it('rejects junk bytes that do not parse as RLP', () => {
    expect(() => parseEthTx(new Uint8Array([0xff, 0xff, 0xff]), true)).toThrow(
      HwInvalidPayloadError,
    );
  });

  it('rejects when isEIP1559 disagrees with the wire-format envelope', () => {
    expect(() => parseEthTx(rlp1559(1n), false)).toThrow(/type 2/);
    expect(() => parseEthTx(rlpLegacy(1n), true)).toThrow(/type 0/);
  });

  it('assertChainIdMatchesRlp passes when body and opts agree', () => {
    expect(() => assertChainIdMatchesRlp(rlp1559(137n), 137n, true)).not.toThrow();
    expect(() => assertChainIdMatchesRlp(rlpLegacy(1n), 1n, false)).not.toThrow();
  });

  it('assertChainIdMatchesRlp throws when body and opts disagree', () => {
    // Polygon RLP but caller asks the SDK to sign as mainnet — classic
    // chain-replay setup.
    expect(() => assertChainIdMatchesRlp(rlp1559(137n), 1n, true)).toThrow(/chainId mismatch/);
    // Reverse: mainnet RLP shipped with the L2 chainId display.
    expect(() => assertChainIdMatchesRlp(rlp1559(1n), 137n, true)).toThrow(/chainId mismatch/);
  });

  it('signEthTransaction surfaces the mismatch as HwInvalidPayloadError', async () => {
    const bridge = {
      call: async () => ({
        r: Array.from(new Uint8Array(32)),
        s: Array.from(new Uint8Array(32)),
        v: [0x1b],
      }),
      waitReady: async () => undefined,
      setWebView: () => undefined,
      getSessionNonce: () => 'test-nonce',
      onMessage: () => undefined,
      sendTransportData: () => undefined,
      notifyTransportFailure: () => undefined,
      failPending: () => undefined,
      destroy: () => undefined,
      onTransportRead: null,
      onTransportWrite: null,
    };
    const provider = new BitboxProvider(bridge as never);
    (provider as unknown as { transport: object }).transport = {};
    await expect(
      provider.signEthTransaction({
        chainId: 1n,
        derivationPath: "m/44'/60'/0'/0/0",
        rlpPayload: rlp1559(137n),
        isEIP1559: true,
      }),
    ).rejects.toBeInstanceOf(HwInvalidPayloadError);
  });
});

/**
 * Derive a real xpub at m/44'/60'/0' for the canonical "abandon …" test
 * mnemonic. Not a secret — the mnemonic itself is the most famously
 * public test vector in Ethereum tooling — but no-secrets/no-secrets
 * cannot tell the difference from base58 entropy alone. Computing the
 * xpub at runtime sidesteps the literal-string-entropy check entirely.
 */
function abandonXpub(): { xpub: string; addressAt0_0: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HDNodeWallet, Mnemonic } = require('ethers');
  const ABANDON =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const mn = Mnemonic.fromPhrase(ABANDON);
  const master = HDNodeWallet.fromSeed(mn.computeSeed());
  const parent = master.derivePath("m/44'/60'/0'");
  const child = parent.derivePath('0/0');
  return { xpub: parent.neuter().extendedKey, addressAt0_0: child.address };
}

describe('CC-7 — verifyEthAddressByXpub', () => {
  it('splits a BIP44 ETH path into parent (hardened) + suffix (non-hardened)', () => {
    expect(splitDerivationPath("m/44'/60'/0'/0/0")).toEqual({
      parent: "m/44'/60'/0'",
      suffix: '0/0',
    });
    expect(splitDerivationPath("m/44'/60'/1'/0/5")).toEqual({
      parent: "m/44'/60'/1'",
      suffix: '0/5',
    });
  });

  it('rejects paths without an "m/" prefix', () => {
    expect(() => splitDerivationPath("44'/60'/0'/0/0")).toThrow(/m\//);
  });

  it('rejects paths whose tail is all hardened (cannot derive publicly)', () => {
    expect(() => splitDerivationPath("m/44'/60'/0'/0'/0'")).toThrow(/non-hardened tail/);
  });

  it('matches a device address derived from the same xpub', async () => {
    const { xpub, addressAt0_0 } = abandonXpub();
    const result = await verifyEthAddressByXpub({
      derivationPath: "m/44'/60'/0'/0/0",
      deviceReturnedAddress: addressAt0_0,
      fetchXpub: async (path) => {
        expect(path).toBe("m/44'/60'/0'");
        return xpub;
      },
    });
    expect(result.toLowerCase()).toBe(addressAt0_0.toLowerCase());
  });

  it('throws HwAddressMismatchError when the device returns a different address', async () => {
    const { xpub, addressAt0_0 } = abandonXpub();
    // Wrong by one hex character — flip the last nibble. Use lowercase
    // so ethers' getAddress doesn't reject on a malformed checksum
    // before our verifier gets a chance to compare.
    const wrongLower = addressAt0_0.toLowerCase().slice(0, -1) + '5';
    await expect(
      verifyEthAddressByXpub({
        derivationPath: "m/44'/60'/0'/0/0",
        deviceReturnedAddress: wrongLower,
        fetchXpub: async () => xpub,
      }),
    ).rejects.toBeInstanceOf(HwAddressMismatchError);
  });

  it('case-insensitively compares EIP-55 vs lowercase device output', async () => {
    const { xpub, addressAt0_0 } = abandonXpub();
    // Lowercase device output — should still match (and return the
    // EIP-55 checksummed form so the UI can render it canonically).
    const result = await verifyEthAddressByXpub({
      derivationPath: "m/44'/60'/0'/0/0",
      deviceReturnedAddress: addressAt0_0.toLowerCase(),
      fetchXpub: async () => xpub,
    });
    expect(result).toBe(addressAt0_0);
  });
});

describe('CC-16 — branded DeviceDisplay opt-out', () => {
  it('default (omit displayOnDevice) signals true to the bridge', async () => {
    const calls: (readonly unknown[])[] = [];
    const bridge = {
      call: async (_m: string, args: readonly unknown[]) => {
        calls.push(args);
        return '0xabc';
      },
      waitReady: async () => undefined,
      setWebView: () => undefined,
      getSessionNonce: () => 'test',
      onMessage: () => undefined,
      sendTransportData: () => undefined,
      notifyTransportFailure: () => undefined,
      failPending: () => undefined,
      destroy: () => undefined,
      onTransportRead: null,
      onTransportWrite: null,
    };
    const provider = new BitboxProvider(bridge as never);
    (provider as unknown as { transport: object }).transport = {};
    await provider.getEthAddress({ chainId: 1n });
    expect(calls[0]![2]).toBe(true);
  });

  it('branded ack opt-out flows false to the bridge AND logs a warning', async () => {
    const logged: { level: string; msg: string }[] = [];
    setHwLogger({
      log: (e) => logged.push({ level: e.level, msg: e.msg }),
    });
    const bridge = {
      call: async () => '0xabc',
      waitReady: async () => undefined,
      setWebView: () => undefined,
      getSessionNonce: () => 'test',
      onMessage: () => undefined,
      sendTransportData: () => undefined,
      notifyTransportFailure: () => undefined,
      failPending: () => undefined,
      destroy: () => undefined,
      onTransportRead: null,
      onTransportWrite: null,
    };
    const provider = new BitboxProvider(bridge as never);
    (provider as unknown as { transport: object }).transport = {};
    await provider.getEthAddress({
      chainId: 1n,
      displayOnDevice: {
        acknowledgeNoDisplay: 'I_ACCEPT_THE_RISK_OF_NOT_DISPLAYING_ON_DEVICE',
        reason: 'unit test',
      },
    });
    expect(logged.some((e) => e.level === 'warn' && e.msg.includes('display_on_device_off'))).toBe(
      true,
    );
    setHwLogger({ log: () => undefined });
  });
});
