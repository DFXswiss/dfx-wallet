import { decodeLNURL, isOpenCryptoPayQR } from '../../src/services/opencryptopay/lnurl';

/**
 * Canonical bech32 LNURL test vector — encodes the URL
 * `https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df`,
 * as published in the LUD-01 spec examples and reproducible with any
 * bech32 LNURL encoder.
 */
const TEST_LNURL =
  // eslint-disable-next-line no-secrets/no-secrets -- public LUD-01 example vector, not a credential
  'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5RGD';

describe('opencryptopay lnurl', () => {
  describe('isOpenCryptoPayQR', () => {
    it('matches a bare lnurl prefix (case-insensitive)', () => {
      expect(isOpenCryptoPayQR('lnurl1abc')).toBe(true);
      expect(isOpenCryptoPayQR('LNURL1ABC')).toBe(true);
    });

    it('matches a BIP-21 URI carrying a lightning= parameter', () => {
      expect(isOpenCryptoPayQR('bitcoin:bc1qabc?lightning=lnurl1xyz')).toBe(true);
      expect(isOpenCryptoPayQR('bitcoin:bc1qabc?LIGHTNING=LNURL1XYZ')).toBe(true);
    });

    it('rejects random QR payloads', () => {
      expect(isOpenCryptoPayQR('https://example.com')).toBe(false);
      expect(isOpenCryptoPayQR('bc1qabc')).toBe(false);
      expect(isOpenCryptoPayQR('')).toBe(false);
    });
  });

  describe('decodeLNURL', () => {
    it('decodes a bare bech32 LNURL into an https URL', () => {
      const url = decodeLNURL(TEST_LNURL);
      expect(url.protocol).toBe('https:');
      expect(url.host).toBe('service.com');
      expect(url.pathname).toBe('/api');
      expect(url.searchParams.get('q')).toBe(
        '3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df',
      );
    });

    it('strips a leading "lightning:" scheme', () => {
      const url = decodeLNURL(`lightning:${TEST_LNURL}`);
      expect(url.host).toBe('service.com');
    });

    it('pulls the lightning= parameter out of a BIP-21 URI', () => {
      const url = decodeLNURL(`bitcoin:bc1qabc?lightning=${TEST_LNURL}`);
      expect(url.host).toBe('service.com');
    });

    it('rewrites a LUD-17 lnurlp:// scheme to https', () => {
      const url = decodeLNURL('lnurlp://service.com/.well-known/lnurlp/alice');
      expect(url.protocol).toBe('https:');
      expect(url.host).toBe('service.com');
      expect(url.pathname).toBe('/.well-known/lnurlp/alice');
    });

    it('rewrites a LUD-17 lnurlp:// .onion host to http', () => {
      const url = decodeLNURL('lnurlp://example.onion/.well-known/lnurlp/alice');
      expect(url.protocol).toBe('http:');
      expect(url.host).toBe('example.onion');
    });

    it('throws on a non-LNURL payload', () => {
      expect(() => decodeLNURL('https://example.com/not-lnurl')).toThrow();
      expect(() => decodeLNURL('hello world')).toThrow();
    });
  });
});
