import {
  getErc20Txs,
  getNormalTxs,
  getTokenList,
  isBlockscoutSupported,
} from '../../src/services/explorer/blockscout';

describe('blockscout explorer service', () => {
  describe('isBlockscoutSupported', () => {
    it('is true for every EVM chain we surface in the discovery scan', () => {
      expect(isBlockscoutSupported('ethereum')).toBe(true);
      expect(isBlockscoutSupported('arbitrum')).toBe(true);
      expect(isBlockscoutSupported('polygon')).toBe(true);
      expect(isBlockscoutSupported('base')).toBe(true);
    });

    it('is false for non-EVM and non-indexed chains', () => {
      expect(isBlockscoutSupported('bitcoin')).toBe(false);
      expect(isBlockscoutSupported('spark')).toBe(false);
      expect(isBlockscoutSupported('plasma')).toBe(false);
    });
  });

  describe('getTokenList', () => {
    it('parses a Blockscout tokenlist payload into typed BlockscoutToken rows', async () => {
      const calls: string[] = [];
      const fetchImpl = jest.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: '1',
            message: 'OK',
            result: [
              {
                balance: '1443999302840000000000',
                contractAddress: '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3',
                decimals: '18',
                name: 'Ondo Finance',
                symbol: 'ONDO',
                type: 'ERC-20',
              },
              {
                // ERC-721 should be filtered out — not a fungible holding.
                balance: '1',
                contractAddress: '0xnft',
                decimals: '0',
                name: 'Cool NFT',
                symbol: 'NFT',
                type: 'ERC-721',
              },
            ],
          }),
        } as unknown as Response;
      });
      const r = await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toHaveLength(1);
        expect(r.value[0]?.symbol).toBe('ONDO');
        expect(r.value[0]?.decimals).toBe(18);
        expect(r.value[0]?.balance).toBe('1443999302840000000000');
      }
      expect(calls[0]).toContain('base.blockscout.com');
      expect(calls[0]).toContain('action=tokenlist');
      expect(calls[0]).toContain('address=0xabc');
    });

    it('treats a non-array result as empty success', async () => {
      const fetchImpl = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ status: '0', message: 'No tokens found', result: '' }),
          }) as unknown as Response,
      );
      const r = await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r).toEqual({ ok: true, value: [] });
    });

    it('flags non-indexed chains without hitting the network', async () => {
      const fetchImpl = jest.fn();
      const r = await getTokenList('bitcoin', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('no-chain');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('surfaces HTTP failures', async () => {
      const fetchImpl = jest.fn(
        async () => ({ ok: false, status: 502, json: async () => ({}) }) as unknown as Response,
      );
      const r = await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe('http');
        expect(r.error.message).toMatch(/502/);
      }
    });

    it('forwards the AbortSignal option through to fetch', async () => {
      const seen: { signal?: AbortSignal | undefined } = {};
      const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
        seen.signal = init?.signal ?? undefined;
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: '0', message: 'No tokens found', result: '' }),
        } as unknown as Response;
      });
      const controller = new AbortController();
      await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        signal: controller.signal,
      });
      expect(seen.signal).toBe(controller.signal);
    });

    it('falls back to 18 decimals when the row omits the decimals field', async () => {
      const fetchImpl = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              status: '1',
              message: 'OK',
              result: [
                {
                  balance: '1',
                  contractAddress: '0xnodec',
                  // no `decimals` key at all
                  name: 'NoDec',
                  symbol: 'NDC',
                },
              ],
            }),
          }) as unknown as Response,
      );
      const r = await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value[0]?.decimals).toBe(18);
    });

    it('returns a generic error for non-Error throws (token list path)', async () => {
      const fetchImpl = jest.fn(async () => {
        throw 'connection dropped';
      });
      const r = await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toBe('Blockscout fetch failed');
    });

    it('filters and normalises rows with missing / non-string fields', async () => {
      const fetchImpl = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              status: '1',
              message: 'OK',
              result: [
                // null row — must be skipped.
                null,
                // Non-object row — must be skipped.
                'oops',
                // Missing balance — must be skipped.
                { contractAddress: '0xa', decimals: '18', name: 'A', symbol: 'A' },
                // Missing contractAddress — must be skipped.
                { balance: '1', decimals: '18', name: 'A', symbol: 'A' },
                // decimals not a parseable number → fall back to 18.
                {
                  balance: '5',
                  contractAddress: '0xdec',
                  decimals: 'NaN',
                  name: 'Token D',
                  symbol: 'TKD',
                },
                // No `name`, no `symbol` → fall back to "ERC20".
                {
                  balance: '7',
                  contractAddress: '0xnonames',
                  decimals: '6',
                },
                // No `name` but with `symbol` → name falls back to symbol.
                {
                  balance: '11',
                  contractAddress: '0xsym',
                  decimals: '6',
                  symbol: 'SYM',
                },
              ],
            }),
          }) as unknown as Response,
      );
      const r = await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toHaveLength(3);
        const [decRow, noNamesRow, symRow] = r.value;
        expect(decRow?.decimals).toBe(18); // unparseable → 18
        expect(noNamesRow?.name).toBe('ERC20');
        expect(noNamesRow?.symbol).toBe('ERC20');
        expect(symRow?.name).toBe('SYM'); // name <- symbol
      }
    });

    it('falls back to global fetch when no fetchImpl is provided', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = jest.fn(
          async () =>
            ({
              ok: true,
              status: 200,
              json: async () => ({ status: '0', message: 'No tokens found', result: '' }),
            }) as unknown as Response,
        ) as unknown as typeof fetch;
        const r = await getTokenList('base', '0xabc');
        expect(r).toEqual({ ok: true, value: [] });
        expect(globalThis.fetch).toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('flags AbortError as a typed cancellation (token list path)', async () => {
      const fetchImpl = jest.fn(async () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        throw e;
      });
      const r = await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toBe('aborted');
    });

    it('surfaces network / parse errors as { code: error }', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      });
      const r = await getTokenList('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe('error');
        expect(r.error.message).toMatch(/ECONNREFUSED/);
      }
    });
  });

  describe('getNormalTxs + getErc20Txs', () => {
    it('hit the right action + chain host without an API key', async () => {
      const calls: string[] = [];
      const fetchImpl = jest.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: '1', message: 'OK', result: [] }),
        } as unknown as Response;
      });
      const impl = fetchImpl as unknown as typeof fetch;
      await getNormalTxs('base', '0xabc', { fetchImpl: impl });
      await getErc20Txs('base', '0xabc', { fetchImpl: impl });
      expect(calls[0]).toContain('base.blockscout.com');
      expect(calls[0]).toContain('action=txlist');
      expect(calls[1]).toContain('action=tokentx');
      // No api-key parameter on any call — Blockscout's public endpoints
      // are key-free, that's the whole point of the switch.
      for (const url of calls) expect(url).not.toContain('apikey');
    });

    it('surfaces HTTP failures from the txlist endpoint', async () => {
      const fetchImpl = jest.fn(
        async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
      );
      const r = await getNormalTxs('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe('http');
        expect(r.error.message).toMatch(/503/);
      }
    });

    it('forwards the AbortSignal option through to fetch (callList path)', async () => {
      const seen: { signal?: AbortSignal | undefined } = {};
      const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
        seen.signal = init?.signal ?? undefined;
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: '1', message: 'OK', result: [] }),
        } as unknown as Response;
      });
      const controller = new AbortController();
      await getNormalTxs('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        signal: controller.signal,
      });
      expect(seen.signal).toBe(controller.signal);
    });

    it('surfaces non-AbortError Error throws by message (callList path)', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      });
      const r = await getNormalTxs('ethereum', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toMatch(/ECONNREFUSED/);
    });

    it('falls back to global fetch when callList is invoked without an override', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = jest.fn(
          async () =>
            ({
              ok: true,
              status: 200,
              json: async () => ({ status: '1', message: 'OK', result: [] }),
            }) as unknown as Response,
        ) as unknown as typeof fetch;
        const r = await getNormalTxs('base', '0xabc');
        expect(r).toEqual({ ok: true, value: [] });
        expect(globalThis.fetch).toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('treats a non-array result (rate-limit string) as an empty list', async () => {
      // When Blockscout returns `result: "Max rate limit reached"` instead
      // of an array, the dispatcher normalises it to a benign empty list.
      const fetchImpl = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ status: '0', message: 'NOTOK', result: 'Max rate limit reached' }),
          }) as unknown as Response,
      );
      const r = await getNormalTxs('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r).toEqual({ ok: true, value: [] });
    });

    it('returns an empty list for the "No transactions found" sentinel', async () => {
      const fetchImpl = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ status: '0', message: 'No transactions found', result: [] }),
          }) as unknown as Response,
      );
      const r = await getNormalTxs('base', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r).toEqual({ ok: true, value: [] });
    });

    it('flags non-indexed chains without hitting the network', async () => {
      const fetchImpl = jest.fn();
      const r = await getNormalTxs('bitcoin', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('no-chain');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('flags AbortError as a typed cancellation', async () => {
      const fetchImpl = jest.fn(async () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        throw e;
      });
      const r = await getNormalTxs('ethereum', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toBe('aborted');
    });

    it('returns a generic error for non-Error throws', async () => {
      const fetchImpl = jest.fn(async () => {
        throw 'connection dropped';
      });
      const r = await getNormalTxs('ethereum', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toBe('Blockscout fetch failed');
    });
  });
});
