/**
 * Most tests below hit a re-imported version of the etherscan module so
 * the EXPO_PUBLIC_ETHERSCAN_API_KEY can be set per-case. The env module
 * captures `process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY` at import time;
 * jest.isolateModules + a fresh `require` lets us flip the value
 * without leaking state across cases.
 */

function withEtherscanKey<T>(key: string | undefined, fn: (mod: typeof import('../../src/services/explorer/etherscan')) => T): T {
  const previous = process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY;
  if (key === undefined) delete process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY;
  else process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY = key;
  let result!: T;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../src/services/explorer/etherscan') as typeof import('../../src/services/explorer/etherscan');
    result = fn(mod);
  });
  if (previous === undefined) delete process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY;
  else process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY = previous;
  return result;
}

describe('etherscan explorer service', () => {
  describe('isEtherscanConfigured', () => {
    it('is false when the API key is empty', () => {
      withEtherscanKey('', (mod) => {
        expect(mod.isEtherscanConfigured()).toBe(false);
      });
    });

    it('is true when the API key is set', () => {
      withEtherscanKey('TEST_KEY', (mod) => {
        expect(mod.isEtherscanConfigured()).toBe(true);
      });
    });
  });

  describe('getEtherscanChainId', () => {
    it('maps every EVM chain we support', () => {
      withEtherscanKey('TEST_KEY', (mod) => {
        expect(mod.getEtherscanChainId('ethereum')).toBe(1);
        expect(mod.getEtherscanChainId('arbitrum')).toBe(42161);
        expect(mod.getEtherscanChainId('polygon')).toBe(137);
        expect(mod.getEtherscanChainId('base')).toBe(8453);
        expect(mod.getEtherscanChainId('sepolia')).toBe(11155111);
      });
    });

    it('returns null for non-EVM chains', () => {
      withEtherscanKey('TEST_KEY', (mod) => {
        expect(mod.getEtherscanChainId('bitcoin')).toBeNull();
        expect(mod.getEtherscanChainId('spark')).toBeNull();
      });
    });
  });

  describe('getNormalTxs', () => {
    it('returns the txlist payload on a successful call', async () => {
      await withEtherscanKey('TEST_KEY', async (mod) => {
        const fetchImpl = jest.fn(async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              status: '1',
              message: 'OK',
              result: [
                {
                  blockNumber: '100',
                  timeStamp: '1700000000',
                  hash: '0xabc',
                  from: '0xfrom',
                  to: '0xto',
                  value: '1000000000000000000',
                  gas: '21000',
                  gasUsed: '21000',
                  isError: '0',
                  contractAddress: '',
                },
              ],
            }),
          }) as unknown as Response,
        );
        const r = await mod.getNormalTxs('ethereum', '0xabc', { fetchImpl: fetchImpl as unknown as typeof fetch });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toHaveLength(1);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
      });
    });

    it('treats "No transactions found" as an empty success', async () => {
      await withEtherscanKey('TEST_KEY', async (mod) => {
        const fetchImpl = jest.fn(async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ status: '0', message: 'No transactions found', result: [] }),
          }) as unknown as Response,
        );
        const r = await mod.getNormalTxs('ethereum', '0xabc', { fetchImpl: fetchImpl as unknown as typeof fetch });
        expect(r).toEqual({ ok: true, value: [] });
      });
    });

    it('flags missing keys without hitting the network', async () => {
      await withEtherscanKey('', async (mod) => {
        const fetchImpl = jest.fn();
        const r = await mod.getNormalTxs('ethereum', '0xabc', { fetchImpl: fetchImpl as unknown as typeof fetch });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe('no-key');
        expect(fetchImpl).not.toHaveBeenCalled();
      });
    });

    it('flags non-EVM chains without hitting the network', async () => {
      await withEtherscanKey('TEST_KEY', async (mod) => {
        const fetchImpl = jest.fn();
        const r = await mod.getNormalTxs('bitcoin', '0xabc', { fetchImpl: fetchImpl as unknown as typeof fetch });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe('no-chain');
        expect(fetchImpl).not.toHaveBeenCalled();
      });
    });

    it('surfaces Etherscan error messages', async () => {
      await withEtherscanKey('TEST_KEY', async (mod) => {
        const fetchImpl = jest.fn(async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ status: '0', message: 'NOTOK', result: 'Invalid API Key' }),
          }) as unknown as Response,
        );
        const r = await mod.getNormalTxs('ethereum', '0xabc', { fetchImpl: fetchImpl as unknown as typeof fetch });
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe('error');
          expect(r.error.message).toMatch(/NOTOK|Invalid API Key/);
        }
      });
    });

    it('surfaces HTTP failures', async () => {
      await withEtherscanKey('TEST_KEY', async (mod) => {
        const fetchImpl = jest.fn(async () =>
          ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
        );
        const r = await mod.getNormalTxs('ethereum', '0xabc', { fetchImpl: fetchImpl as unknown as typeof fetch });
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe('http');
          expect(r.error.message).toMatch(/503/);
        }
      });
    });
  });

  describe('getErc20Txs + getTokenBalance + getNativeBalance', () => {
    it('passes the right action params per method', async () => {
      await withEtherscanKey('TEST_KEY', async (mod) => {
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
        await mod.getErc20Txs('ethereum', '0xa', { fetchImpl: impl });
        await mod.getTokenBalance('ethereum', '0xC', '0xa', { fetchImpl: impl });
        await mod.getNativeBalance('ethereum', '0xa', { fetchImpl: impl });
        expect(calls[0]).toContain('action=tokentx');
        expect(calls[1]).toContain('action=tokenbalance');
        expect(calls[1]).toContain('contractaddress=0xC');
        expect(calls[2]).toContain('action=balance');
        // chainid is always set on every call
        for (const url of calls) expect(url).toContain('chainid=1');
      });
    });
  });
});
