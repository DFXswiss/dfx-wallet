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
  });
});
