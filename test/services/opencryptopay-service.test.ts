import {
  cancelQuote,
  commitTx,
  fetchQuote,
  getPaymentTarget,
  OpenCryptoPayError,
  parsePaymentUri,
} from '../../src/services/opencryptopay/opencryptopay-service';

describe('opencryptopay service', () => {
  describe('fetchQuote', () => {
    it('parses a happy-path response into the typed invoice shape', async () => {
      const fetchImpl = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              displayName: 'DFX Coffee Shop',
              callback: 'https://lightning.space/cb/abc',
              quote: { id: 'q-123', expiration: '2030-01-01T00:00:00Z' },
              transferAmounts: [
                {
                  method: 'Ethereum',
                  minFee: 100,
                  assets: [{ asset: 'ZCHF', amount: '12.50' }],
                },
                {
                  method: 'Polygon',
                  minFee: 50,
                  assets: [{ asset: 'ZCHF', amount: '12.50' }],
                },
              ],
            }),
          }) as unknown as Response,
      );
      const invoice = await fetchQuote(new URL('https://lightning.space/.well-known/lnurlp/abc'), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(invoice.displayName).toBe('DFX Coffee Shop');
      expect(invoice.callbackUrl).toBe('https://lightning.space/cb/abc');
      expect(invoice.quote.id).toBe('q-123');
      expect(invoice.quote.expiresAt).toBeGreaterThan(0);
      expect(invoice.transferAmounts).toHaveLength(2);
      expect(invoice.transferAmounts[0]?.method).toBe('Ethereum');
      expect(invoice.transferAmounts[0]?.assets[0]?.asset).toBe('ZCHF');
    });

    it('throws OpenCryptoPayError on HTTP failure', async () => {
      const fetchImpl = jest.fn(
        async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
      );
      await expect(
        fetchQuote(new URL('https://lightning.space/foo'), {
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ).rejects.toBeInstanceOf(OpenCryptoPayError);
    });

    it('throws when the response is missing callback/transferAmounts/quote', async () => {
      const fetchImpl = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ displayName: 'incomplete' }),
          }) as unknown as Response,
      );
      await expect(
        fetchQuote(new URL('https://lightning.space/foo'), {
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ).rejects.toMatchObject({ code: 'invalid-response' });
    });
  });

  describe('getPaymentTarget', () => {
    it('appends quote/asset/method query params and parses the uri', async () => {
      const calls: string[] = [];
      const fetchImpl = jest.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uri: 'ethereum:0x1f9840a85d5af5bf1d1762f925bdaddc4201f984@1/transfer?address=0xab1234567890ABCDEFabcdef1234567890ABCDEF&uint256=12500000000000000000',
            expiryDate: 1700000000000,
          }),
        } as unknown as Response;
      });
      const target = await getPaymentTarget(
        'https://lightning.space/cb/abc',
        'q-123',
        'ZCHF',
        'Ethereum',
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      );
      expect(target.paymentUri).toMatch(/transfer\?address=0xab1234567890ABCDEFabcdef1234567890ABCDEF/);
      expect(target.expiresAt).toBe(1700000000000);
      expect(calls[0]).toContain('quote=q-123');
      expect(calls[0]).toContain('asset=ZCHF');
      expect(calls[0]).toContain('method=Ethereum');
    });
  });

  describe('commitTx', () => {
    it('rewrites /cb/ to /tx/ and posts the hex with 0x prefix', async () => {
      const calls: string[] = [];
      const fetchImpl = jest.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ txId: '0xchain-hash' }),
        } as unknown as Response;
      });
      const r = await commitTx(
        'https://lightning.space/cb/abc',
        { quoteId: 'q-123', asset: 'ZCHF', method: 'Ethereum', txHex: 'deadbeef' },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      );
      expect(r.txId).toBe('0xchain-hash');
      expect(calls[0]).toContain('/tx/abc');
      expect(calls[0]).toContain('hex=0xdeadbeef');
    });

    it('passes already-prefixed hex through unchanged', async () => {
      const calls: string[] = [];
      const fetchImpl = jest.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ txId: '0x123' }),
        } as unknown as Response;
      });
      await commitTx(
        'https://lightning.space/cb/abc',
        { quoteId: 'q-1', asset: 'ZCHF', method: 'Ethereum', txHex: '0xdeadbeef' },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      );
      expect(calls[0]).toMatch(/hex=0xdeadbeef(?!d)/);
    });
  });

  describe('cancelQuote', () => {
    it('rewrites /cb/ to /cancel/ and issues a DELETE', async () => {
      const calls: { url: string; init: RequestInit | undefined }[] = [];
      const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return { ok: true, status: 200 } as unknown as Response;
      });
      await cancelQuote('https://lightning.space/cb/abc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(calls[0]?.url).toContain('/cancel/abc');
      expect(calls[0]?.init?.method).toBe('DELETE');
    });

    it('swallows network errors silently (fire-and-forget)', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('offline');
      });
      await expect(
        cancelQuote('https://lightning.space/cb/abc', {
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('parsePaymentUri', () => {
    it('parses a native-send ERC-681 URI', () => {
      const r = parsePaymentUri('ethereum:0xab1234567890ABCDEFabcdef1234567890ABCDEF@1?value=12500000000000000000');
      expect(r.chainSlug).toBe('ethereum');
      expect(r.contract).toBeNull();
      expect(r.recipient).toBe('0xab1234567890ABCDEFabcdef1234567890ABCDEF');
      expect(r.amount).toBe('12500000000000000000');
    });

    it('parses an ERC-20 transfer URI', () => {
      const r = parsePaymentUri(
        'ethereum:0x1f9840a85d5af5bf1d1762f925bdaddc4201f984@1/transfer?address=0xab1234567890ABCDEFabcdef1234567890ABCDEF&uint256=12500000000000000000',
      );
      expect(r.chainSlug).toBe('ethereum');
      expect(r.contract).toBe('0x1f9840a85d5af5bf1d1762f925bdaddc4201f984');
      expect(r.recipient).toBe('0xab1234567890ABCDEFabcdef1234567890ABCDEF');
      expect(r.amount).toBe('12500000000000000000');
    });

    it('throws on an unparseable URI', () => {
      expect(() => parsePaymentUri('not a uri')).toThrow();
    });
  });
});
