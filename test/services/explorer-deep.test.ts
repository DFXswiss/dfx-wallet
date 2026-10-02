/**
 * Coverage for explorer-client behaviours not exercised by
 * `blockscout.test.ts` / `etherscan.test.ts`:
 *   - Blockscout tokenlist NFT filtering (only ERC-20 reaches the fiat scan;
 *     ERC-721 / ERC-1155 rows are dropped) and decimals coercion edge cases;
 *   - the exact URL / query-string each action builds (address encoding,
 *     module/action params, the `offset` paging override);
 *   - Etherscan native + token balance happy paths (string `result`, not an
 *     array) and the `no-key` short-circuit ordering vs `no-chain`.
 *
 * All network access is injected via `fetchImpl` so nothing leaves the
 * process. Etherscan needs a key in the env at import time, so its cases run
 * through an isolated re-import helper mirroring the sibling test file.
 */

import {
  getTokenList,
  getNormalTxs,
  getErc20Txs,
  isBlockscoutSupported,
  type BlockscoutToken,
} from '../../src/services/explorer/blockscout';

type FetchArgs = { url: string; init: RequestInit };

/** A fetch stub that records the URL it was called with and returns `json`. */
const recordingFetch = (json: unknown, ok = true, status = 200) => {
  const calls: FetchArgs[] = [];
  const fn = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok, status, json: async () => json } as unknown as Response;
  });
  return { fn: fn as unknown as typeof fetch, calls };
};

describe('blockscout — tokenlist type filtering + decimals coercion', () => {
  it('keeps ERC-20 rows and drops ERC-721 / ERC-1155', async () => {
    const { fn } = recordingFetch({
      status: '1',
      result: [
        { type: 'ERC-20', contractAddress: '0xaaa', balance: '100', decimals: '6', symbol: 'USDC' },
        { type: 'ERC-721', contractAddress: '0xnft', balance: '1', decimals: '0', symbol: 'PUNK' },
        { type: 'ERC-1155', contractAddress: '0xmulti', balance: '5', symbol: 'ITEM' },
        // bare "ERC20" (no hyphen) is also accepted as fungible
        { type: 'ERC20', contractAddress: '0xbbb', balance: '200', decimals: '18', symbol: 'DAI' },
      ],
    });
    const r = await getTokenList('ethereum', '0xowner', { fetchImpl: fn });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const symbols = r.value.map((t: BlockscoutToken) => t.symbol);
    expect(symbols).toEqual(['USDC', 'DAI']);
  });

  it('keeps a row with no type field (treated as fungible)', async () => {
    const { fn } = recordingFetch({
      status: '1',
      result: [{ contractAddress: '0xaaa', balance: '100', decimals: '6', symbol: 'USDC' }],
    });
    const r = await getTokenList('ethereum', '0xowner', { fetchImpl: fn });
    expect(r.ok && r.value).toHaveLength(1);
  });

  it('falls back to 18 decimals when the decimals string is non-numeric (NaN)', async () => {
    const { fn } = recordingFetch({
      status: '1',
      result: [{ type: 'ERC-20', contractAddress: '0xaaa', balance: '1', decimals: 'garbage', symbol: 'X' }],
    });
    const r = await getTokenList('ethereum', '0xowner', { fetchImpl: fn });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]!.decimals).toBe(18);
  });

  it('falls back symbol→name and a literal "ERC20" when both are missing', async () => {
    const { fn } = recordingFetch({
      status: '1',
      result: [
        // name missing → uses symbol; symbol present
        { type: 'ERC-20', contractAddress: '0xaaa', balance: '1', decimals: '6', symbol: 'ZZZ' },
        // both name and symbol missing → literal ERC20 fallbacks
        { type: 'ERC-20', contractAddress: '0xbbb', balance: '2', decimals: '6' },
      ],
    });
    const r = await getTokenList('ethereum', '0xowner', { fetchImpl: fn });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0]).toMatchObject({ name: 'ZZZ', symbol: 'ZZZ' });
    expect(r.value[1]).toMatchObject({ name: 'ERC20', symbol: 'ERC20' });
  });

  it('skips rows whose contract or balance is not a string', async () => {
    const { fn } = recordingFetch({
      status: '1',
      result: [
        { type: 'ERC-20', contractAddress: 123, balance: '1', symbol: 'A' },
        { type: 'ERC-20', contractAddress: '0xbbb', balance: 42, symbol: 'B' },
        { type: 'ERC-20', contractAddress: '0xccc', balance: '3', symbol: 'C', decimals: '6' },
        null,
      ],
    });
    const r = await getTokenList('ethereum', '0xowner', { fetchImpl: fn });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map((t) => t.symbol)).toEqual(['C']);
  });
});

describe('blockscout — URL construction', () => {
  it('URL-encodes the address and hits the right host + action', async () => {
    const { fn, calls } = recordingFetch({ status: '1', result: [] });
    await getTokenList('polygon', '0xAbC&evil=1', { fetchImpl: fn });
    expect(calls[0]!.url).toBe(
      'https://polygon.blockscout.com/api?module=account&action=tokenlist&address=0xAbC%26evil%3D1',
    );
  });

  it('sends an Accept: application/json header and GET method', async () => {
    const { fn, calls } = recordingFetch({ status: '1', result: [] });
    await getTokenList('base', '0xowner', { fetchImpl: fn });
    expect(calls[0]!.init.method).toBe('GET');
    expect((calls[0]!.init.headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('uses the default offset (50 for txlist, 100 for tokentx) and overrides when given', async () => {
    const txl = recordingFetch({ status: '1', result: [] });
    await getNormalTxs('ethereum', '0xowner', { fetchImpl: txl.fn });
    expect(txl.calls[0]!.url).toContain('action=txlist');
    expect(txl.calls[0]!.url).toContain('offset=50');

    const tok = recordingFetch({ status: '1', result: [] });
    await getErc20Txs('ethereum', '0xowner', { fetchImpl: tok.fn });
    expect(tok.calls[0]!.url).toContain('action=tokentx');
    expect(tok.calls[0]!.url).toContain('offset=100');

    const custom = recordingFetch({ status: '1', result: [] });
    await getNormalTxs('ethereum', '0xowner', { fetchImpl: custom.fn, offset: 7 });
    expect(custom.calls[0]!.url).toContain('offset=7');
  });

  it('targets the sepolia testnet host', async () => {
    const { fn, calls } = recordingFetch({ status: '1', result: [] });
    await getNormalTxs('sepolia', '0xowner', { fetchImpl: fn });
    expect(calls[0]!.url).toContain('https://eth-sepolia.blockscout.com/api?');
  });
});

describe('blockscout — chain support matrix', () => {
  it.each([
    ['ethereum', true],
    ['arbitrum', true],
    ['polygon', true],
    ['base', true],
    ['sepolia', true],
    ['bitcoin', false],
    ['bitcoin-taproot', false],
    ['bitcoin-lightning', false],
    ['spark', false],
    ['plasma', false],
  ] as const)('isBlockscoutSupported(%s) === %s', (chain, expected) => {
    expect(isBlockscoutSupported(chain)).toBe(expected);
  });

  it('every list endpoint short-circuits a non-indexed chain with code no-chain (no fetch)', async () => {
    const { fn } = recordingFetch({ status: '1', result: [] });
    for (const call of [getTokenList, getNormalTxs, getErc20Txs]) {
      const r = await call('bitcoin', '0xowner', { fetchImpl: fn });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('no-chain');
    }
    expect(fn).not.toHaveBeenCalled();
  });
});

/**
 * Etherscan needs the API key present at module import time. Re-import per
 * case with the key set so the `no-key` short-circuit doesn't fire.
 */
function withEtherscan<T>(
  key: string | undefined,
  fn: (mod: typeof import('../../src/services/explorer/etherscan')) => T,
): T {
  const previous = process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY;
  if (key === undefined) delete process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY;
  else process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY = key;
  let result!: T;
  jest.isolateModules(() => {
    const mod =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/services/explorer/etherscan') as typeof import('../../src/services/explorer/etherscan');
    result = fn(mod);
  });
  if (previous === undefined) delete process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY;
  else process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY = previous;
  return result;
}

describe('etherscan — balance endpoints (string result, not array)', () => {
  it('getNativeBalance returns the raw wei string on status "1"', async () => {
    await withEtherscan('KEY', async (mod) => {
      const { fn, calls } = recordingFetch({ status: '1', message: 'OK', result: '12345' });
      const r = await mod.getNativeBalance('ethereum', '0xowner', { fetchImpl: fn });
      expect(r).toEqual({ ok: true, value: '12345' });
      expect(calls[0]!.url).toContain('action=balance');
      expect(calls[0]!.url).toContain('tag=latest');
      expect(calls[0]!.url).toContain('chainid=1');
    });
  });

  it('getTokenBalance passes the contract address and returns the balance string', async () => {
    await withEtherscan('KEY', async (mod) => {
      const { fn, calls } = recordingFetch({ status: '1', message: 'OK', result: '999' });
      const r = await mod.getTokenBalance('polygon', '0xtoken', '0xowner', { fetchImpl: fn });
      expect(r).toEqual({ ok: true, value: '999' });
      expect(calls[0]!.url).toContain('action=tokenbalance');
      expect(calls[0]!.url).toContain('contractaddress=0xtoken');
      expect(calls[0]!.url).toContain('chainid=137');
    });
  });

  it('embeds the apikey in the query string', async () => {
    await withEtherscan('SECRET_KEY', async (mod) => {
      const { fn, calls } = recordingFetch({ status: '1', message: 'OK', result: '1' });
      await mod.getNativeBalance('ethereum', '0xowner', { fetchImpl: fn });
      expect(calls[0]!.url).toContain('apikey=SECRET_KEY');
    });
  });
});

describe('etherscan — short-circuit ordering', () => {
  it('no-chain fires before no-key (chain check precedes the key check, no fetch)', async () => {
    await withEtherscan(undefined, async (mod) => {
      const { fn } = recordingFetch({ status: '1', result: [] });
      const r = await mod.getNormalTxs('bitcoin', '0xowner', { fetchImpl: fn });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('no-chain');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  it('no-key fires for a supported chain when the key is absent (no fetch)', async () => {
    await withEtherscan(undefined, async (mod) => {
      const { fn } = recordingFetch({ status: '1', result: [] });
      const r = await mod.getTokenBalance('ethereum', '0xtoken', '0xowner', { fetchImpl: fn });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('no-key');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  it('surfaces a status "0" non-empty error result as an error (not an empty success)', async () => {
    await withEtherscan('KEY', async (mod) => {
      const { fn } = recordingFetch({
        status: '0',
        message: 'NOTOK',
        result: 'Max rate limit reached',
      });
      const r = await mod.getNormalTxs('ethereum', '0xowner', { fetchImpl: fn });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe('error');
        expect(r.error.message).toBe('NOTOK');
      }
    });
  });
});
