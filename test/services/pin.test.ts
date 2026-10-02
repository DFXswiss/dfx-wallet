import { argon2idAsync as mockArgon2idAsync } from '@noble/hashes/argon2';

// The native module isn't available under the unit Jest project (which maps
// `react-native-nitro-modules` to an empty stub), so `argon2` is replaced
// with a stand-in. By default that stand-in is the same fast, deterministic
// fake develop previously used for `@noble/hashes/argon2` (XOR over
// `${password}:${salt}`), just reshaped for the native callback API —
// running the real Argon2id (m=32768, t=3) for every hashPin/verifyPin call
// in this file pushed the suite past Jest's default 5s test timeout. Only
// the cross-implementation compatibility test below overrides this with a
// real computation, since that's the one assertion the fake can't carry.
type NativeArgon2Params = {
  message: Uint8Array;
  nonce: Uint8Array;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
  version: number;
};

jest.mock('react-native-quick-crypto', () => ({
  argon2: jest.fn(
    (
      _algorithm: string,
      params: NativeArgon2Params,
      callback: (err: Error | null, result: Uint8Array) => void,
    ) => {
      const password = new TextDecoder().decode(params.message);
      const bytes = new Uint8Array(params.tagLength);
      const input = `${password}:${Array.from(params.nonce).join(',')}`;
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = input.charCodeAt(i % input.length) ^ i;
      }
      callback(null, bytes);
    },
  ),
}));

import { argon2 as nativeArgon2 } from 'react-native-quick-crypto';
import { hashPin, needsPinRehash, verifyPin } from '../../src/services/pin';

const nativeArgon2Mock = nativeArgon2 as jest.Mock;

// Fixed vector produced with the real @noble/hashes/argon2id implementation
// for pin "123456", salt 01..10, m=32768, t=3, p=1, dkLen=32.
const NOBLE_REFERENCE_HASH =
  'pin$argon2id$v=19$m=32768,t=3,p=1$0102030405060708090a0b0c0d0e0f10$290f6d27da53a775a6caec821f712e73069a6693d7c29ac2abde127e08a07e34';

const legacyHashPin = async (pin: string): Promise<string> => {
  const Crypto = await import('expo-crypto');
  let hash = `dfx-wallet-pin-v1:${pin}`;
  for (let i = 0; i < 10000; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  return hash;
};

describe('hashPin', () => {
  it('uses a random salt for the same input', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).not.toBe(b);
  });

  it('returns different hashes for different PINs', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('5678');
    expect(a).not.toBe(b);
  });

  it('returns different hashes for similar PINs (no truncation collision)', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('12345');
    expect(a).not.toBe(b);
  });

  it('handles empty input without throwing', async () => {
    await expect(hashPin('')).resolves.toMatch(/^pin\$argon2id\$/);
  });

  it('handles unicode / non-ASCII input', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234✨');
    expect(a).not.toBe(b);
  });
});

describe('verifyPin', () => {
  it('returns true when the PIN matches the stored hash', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('1234', hash)).toBe(true);
  });

  it('returns false for a wrong PIN', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('0000', hash)).toBe(false);
  });

  it('returns false for an empty PIN against a real hash', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('', hash)).toBe(false);
  });

  it('returns false against a malformed stored hash', async () => {
    expect(await verifyPin('1234', 'not-a-real-hash')).toBe(false);
  });

  it('returns false (fail-closed) when a well-formed hash record has invalid hex', async () => {
    // Passes the FORMAT/version/params checks, but saltHex isn't valid hex —
    // exercises the try/catch fail-closed path around hexToBytes/argon2idAsync.
    const bogus = `pin$argon2id$v=19$m=32768,t=3,p=1$${'zz'.repeat(16)}$${'00'.repeat(32)}`;
    expect(await verifyPin('1234', bogus)).toBe(false);
  });

  it('accepts legacy hashes so existing users can migrate', async () => {
    const legacyHash = await legacyHashPin('1234');
    expect(await verifyPin('1234', legacyHash)).toBe(true);
    expect(needsPinRehash(legacyHash)).toBe(true);
  });

  it('does not mark current Argon2id hashes for rehash', async () => {
    const hash = await hashPin('1234');
    expect(needsPinRehash(hash)).toBe(false);
  });
});

describe('native argon2 call', () => {
  it('calls the native argon2 with the exact algorithm, parameters and the PIN as UTF-8 bytes', async () => {
    await hashPin('123456');

    expect(nativeArgon2Mock).toHaveBeenCalledWith(
      'argon2id',
      expect.objectContaining({
        message: new TextEncoder().encode('123456'),
        parallelism: 1,
        tagLength: 32,
        memory: 32768,
        passes: 3,
        version: 0x13,
      }),
      expect.any(Function),
    );
  });

  it('fails closed when the native call rejects: hashPin throws, verifyPin returns false', async () => {
    nativeArgon2Mock.mockImplementationOnce(
      (
        _algorithm: string,
        _params: NativeArgon2Params,
        callback: (err: Error | null, result: Uint8Array) => void,
      ) => {
        callback(new Error('native rejection'), new Uint8Array(0));
      },
    );
    await expect(hashPin('123456')).rejects.toThrow('native rejection');

    const hash = await hashPin('123456');
    nativeArgon2Mock.mockImplementationOnce(
      (
        _algorithm: string,
        _params: NativeArgon2Params,
        callback: (err: Error | null, result: Uint8Array) => void,
      ) => {
        callback(new Error('native rejection'), new Uint8Array(0));
      },
    );
    expect(await verifyPin('123456', hash)).toBe(false);
  });

  it('fails closed when the native call throws synchronously: hashPin rejects, verifyPin returns false', async () => {
    nativeArgon2Mock.mockImplementationOnce(() => {
      throw new Error('native module missing');
    });
    await expect(hashPin('123456')).rejects.toThrow('native module missing');

    const hash = await hashPin('123456');
    nativeArgon2Mock.mockImplementationOnce(() => {
      throw new Error('native module missing');
    });
    expect(await verifyPin('123456', hash)).toBe(false);
  });
});

describe('cross-implementation compatibility', () => {
  it(
    'verifies a hash produced by the real @noble/hashes argon2id implementation',
    async () => {
      // This one assertion needs the real native call, not the fast fake
      // above — it's proving that the native path is byte-compatible with
      // @noble/hashes' Argon2id, not just internally consistent with itself.
      nativeArgon2Mock.mockImplementationOnce(
        (
          _algorithm: string,
          params: NativeArgon2Params,
          callback: (err: Error | null, result: Uint8Array) => void,
        ) =>
          mockArgon2idAsync(params.message, params.nonce, {
            t: params.passes,
            m: params.memory,
            p: params.parallelism,
            dkLen: params.tagLength,
          })
            .then((hash: Uint8Array) => callback(null, hash))
            .catch((err: Error) => callback(err, new Uint8Array(0))),
      );

      expect(await verifyPin('123456', NOBLE_REFERENCE_HASH)).toBe(true);
    },
    30000,
  );
});
