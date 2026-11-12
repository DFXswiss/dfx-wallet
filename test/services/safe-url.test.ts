import {
  isAllowedDfxHost,
  isDfxTokenHost,
  isSafeHttpsUrl,
} from '../../src/services/security/safe-url';

describe('isSafeHttpsUrl', () => {
  it('accepts plain https URLs', () => {
    expect(isSafeHttpsUrl('https://example.com')).toBe(true);
    expect(isSafeHttpsUrl('https://example.com/path?q=1')).toBe(true);
  });

  it.each([
    'http://example.com',
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'file:///etc/passwd',
    'ftp://example.com',
    '',
    'not-a-url',
    '///example.com',
  ])('rejects %s', (input) => {
    expect(isSafeHttpsUrl(input)).toBe(false);
  });
});

describe('isAllowedDfxHost', () => {
  it('accepts the exact allow-listed DFX hosts', () => {
    expect(isAllowedDfxHost('https://dfx.swiss')).toBe(true);
    expect(isAllowedDfxHost('https://api.dfx.swiss/v1/health')).toBe(true);
    expect(isAllowedDfxHost('https://lightning.space/x')).toBe(true);
  });

  it('accepts subdomains of allow-listed hosts (.dfx.swiss tree)', () => {
    expect(isAllowedDfxHost('https://anything.dfx.swiss')).toBe(true);
    expect(isAllowedDfxHost('https://deep.nested.app.dfx.swiss/path')).toBe(true);
  });

  it('accepts KYC provider hosts and their subdomains', () => {
    expect(isAllowedDfxHost('https://sumsub.com/foo')).toBe(true);
    expect(isAllowedDfxHost('https://in.sumsub.com/foo')).toBe(true);
    expect(isAllowedDfxHost('https://cockpit.idnow.de')).toBe(true);
    expect(isAllowedDfxHost('https://go.idnow.de')).toBe(true);
  });

  it('rejects non-https schemes even on allow-listed hosts', () => {
    expect(isAllowedDfxHost('http://dfx.swiss')).toBe(false);
    expect(isAllowedDfxHost('javascript:fetch("https://dfx.swiss")')).toBe(false);
  });

  it('rejects unrelated hosts', () => {
    expect(isAllowedDfxHost('https://attacker.com')).toBe(false);
    expect(isAllowedDfxHost('https://example.com')).toBe(false);
  });

  it('rejects host-suffix tricks ("evil-dfx.swiss")', () => {
    // Naive endsWith without the dot prefix would match here — the
    // implementation guards against that by requiring `.${allowed}`.
    expect(isAllowedDfxHost('https://evil-dfx.swiss')).toBe(false);
    expect(isAllowedDfxHost('https://evildfx.swiss')).toBe(false);
  });

  it('rejects malformed / empty input', () => {
    expect(isAllowedDfxHost('')).toBe(false);
    expect(isAllowedDfxHost('not-a-url')).toBe(false);
  });
});

describe('isDfxTokenHost', () => {
  it.each([
    'https://app.dfx.swiss',
    'https://services.dfx.swiss/path',
    'https://api.dfx.swiss/v1/user',
  ])('accepts exact HTTPS token host %s', (input) => {
    expect(isDfxTokenHost(input)).toBe(true);
  });

  it.each(['http://app.dfx.swiss'])('rejects a token host with the wrong scheme %s', (input) => {
    expect(isDfxTokenHost(input)).toBe(false);
  });

  it.each([
    'https://x.app.dfx.swiss',
    'https://app.dfx.swiss.evil.com',
    'https://docs.dfx.swiss',
  ])('rejects a host that is not an exact token host %s', (input) => {
    expect(isDfxTokenHost(input)).toBe(false);
  });

  it.each(['not-a-url'])('rejects an invalid token URL %s', (input) => {
    expect(isDfxTokenHost(input)).toBe(false);
  });

  it.each([
    'https://dfx.swiss@evil.com',
    'https://app.dfx.swiss@evil.com/login',
    'https://dfx.swiss:443@evil.com',
    'https://user:dfx.swiss@evil.com',
    'https://dfx.swiss%2f@evil.com',
    'https://evil.com#@app.dfx.swiss',
  ])('rejects a token URL whose userinfo or fragment hides another host %s', (input) => {
    expect(isDfxTokenHost(input)).toBe(false);
  });
});
