/**
 * Tests for the structured hardware-wallet logger. The logger must NEVER
 * emit raw key material — these tests fail loudly if redaction breaks.
 */

import { _redactValueForTest, logHw, setHwLogger, type HwLogger } from '@/features/hardware-wallet/services/log';

describe('hardware-wallet logger — redaction', () => {
  it('redacts known sensitive field names regardless of value', () => {
    const out = _redactValueForTest(undefined, {
      seed: 'abandon abandon …',
      password: 'topSecret',
      passphrase: 'topSecret2',
      privateKey: '0xabc',
      pin: '1234',
      token: 'eyJ…',
      apiKey: 'sk_live_…',
      // Address-class fields too — UI displays them but logs should not.
      recipient: '0x1234567890123456789012345678901234567890',
      keypath: "m/44'/60'/0'/0/0",
    }) as Record<string, string>;
    for (const v of Object.values(out)) {
      expect(v).toBe('[REDACTED]');
    }
  });

  it('redacts long hex strings even outside known fields', () => {
    const out = _redactValueForTest('arbitrary', '0xdeadbeef' + 'cafe'.repeat(16)) as string;
    expect(out).toContain('[REDACTED]');
  });

  it('redacts EVM addresses embedded in strings', () => {
    const out = _redactValueForTest('arbitrary', 'sending to 0x1234567890123456789012345678901234567890 now') as string;
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('0x1234567890123456789012345678901234567890');
  });

  it('redacts extended keys', () => {
    // Synthetic xpub: matches the regex shape but split to avoid the
    // no-secrets lint rule rejecting a literal that "looks too entropic".
    const xpub = 'xpub' + '6'.padEnd(108, 'A');
    const out = _redactValueForTest('arbitrary', `xpub is ${xpub} keep secret`) as string;
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain(xpub);
  });

  it('redacts long byte-array-like buffers', () => {
    const sig = Array.from({ length: 65 }, (_, i) => i);
    const out = _redactValueForTest('something', sig) as string;
    expect(out).toBe('[65-byte buffer]');
  });

  it('redacts Uint8Array values', () => {
    const buf = new Uint8Array(64);
    const out = _redactValueForTest('something', buf) as string;
    expect(out).toBe('[64-byte buffer]');
  });

  it('redacts inside Error.message but keeps the Error.name', () => {
    const err = new Error('signing failed for recipient 0x1234567890123456789012345678901234567890');
    const out = _redactValueForTest(undefined, err) as { name: string; message: string };
    expect(out.name).toBe('Error');
    expect(out.message).toContain('[REDACTED]');
    expect(out.message).not.toContain('0x1234567890123456789012345678901234567890');
  });

  it('passes booleans / numbers / bigints through unchanged', () => {
    expect(_redactValueForTest('flag', true)).toBe(true);
    expect(_redactValueForTest('count', 42)).toBe(42);
    expect(_redactValueForTest('big', 1234567890123456789n)).toBe('1234567890123456789');
  });

  it('recursively redacts nested structures', () => {
    const out = _redactValueForTest(undefined, {
      outer: {
        inner: {
          seed: 'should-disappear',
          ok: 'visible',
        },
      },
    }) as { outer: { inner: { seed: string; ok: string } } };
    expect(out.outer.inner.seed).toBe('[REDACTED]');
    expect(out.outer.inner.ok).toBe('visible');
  });
});

describe('hardware-wallet logger — pluggability', () => {
  it('captures entries through a substituted logger', () => {
    const captured: Array<{ level: string; msg: string }> = [];
    const fake: HwLogger = {
      log: (entry) => {
        captured.push({ level: entry.level, msg: entry.msg });
      },
    };
    setHwLogger(fake);
    logHw('info', 'connected', { chainId: 1 });
    logHw('error', 'wasm crashed', { stack: 'at foo (anonymous)' });
    expect(captured).toEqual([
      { level: 'info', msg: 'connected' },
      { level: 'error', msg: 'wasm crashed' },
    ]);
    // Restore the default logger so subsequent tests aren't affected.
    setHwLogger({ log: () => undefined });
  });
});

/**
 * Regression for CC-12: top-level msg argument must be pattern-redacted
 * before dispatch. Without this guard, a caller that interpolates an
 * address or long hex into the msg (e.g. `logHw('warn', `failed for
 * ${address}`)`) leaks it to every downstream logger — including any
 * Sentry forwarder a maintainer wires up later.
 */
describe('hardware-wallet logger — top-level msg redaction', () => {
  function captureOne(act: () => void): { msg: string; ctx?: Record<string, unknown> } {
    const entries: Array<{ msg: string; ctx?: Record<string, unknown> }> = [];
    setHwLogger({
      log: (e) => {
        const captured: { msg: string; ctx?: Record<string, unknown> } = { msg: e.msg };
        if (e.ctx !== undefined) captured.ctx = e.ctx;
        entries.push(captured);
      },
    });
    try {
      act();
    } finally {
      setHwLogger({ log: () => undefined });
    }
    expect(entries).toHaveLength(1);
    return entries[0]!;
  }

  it('redacts an EVM address interpolated into msg', () => {
    const addr = '0x' + 'a'.repeat(40);
    const { msg } = captureOne(() => logHw('warn', `connected to ${addr}`));
    expect(msg).not.toContain(addr);
    expect(msg).toContain('[REDACTED]');
  });

  it('redacts a long hex string interpolated into msg', () => {
    const hex = '0x' + 'deadbeef'.repeat(16);
    const { msg } = captureOne(() => logHw('error', `failed: ${hex}`));
    expect(msg).not.toContain('deadbeef');
    expect(msg).toContain('[REDACTED]');
  });

  it('passes plain operational text through unchanged', () => {
    const { msg } = captureOne(() => logHw('info', 'connected to BitBox via USB'));
    expect(msg).toBe('connected to BitBox via USB');
  });

  it('redacts a bech32-prefixed address in msg', () => {
    const addr = 'bc1' + 'q'.repeat(40);
    const { msg } = captureOne(() => logHw('warn', `unexpected output to ${addr}`));
    expect(msg).not.toContain(addr);
    expect(msg).toContain('[REDACTED]');
  });

  it('redacts ctx by structural key-name + value-pattern', () => {
    const { ctx } = captureOne(() => logHw('info', 'pair done', { keypath: "m/44'/60'/0'/0/0" }));
    expect(ctx?.keypath).toBe('[REDACTED]');
  });
});
