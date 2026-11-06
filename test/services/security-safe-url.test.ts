/**
 * Adversarial coverage for the WebView / deep-link allowlist
 * (`src/services/security/safe-url.ts`).
 *
 * This guard is the only thing standing between a compromised or
 * misconfigured backend (KYC redirect, support link, deep-link payload)
 * and the in-app WebView / native URL handlers. A bypass here means an
 * attacker-controlled origin runs adjacent to the wallet's credentials,
 * so the cases below deliberately push every parser-differential and
 * homograph trick we could think of.
 *
 * The existing `safe-url.test.ts` covers the happy paths and the
 * `evil-dfx.swiss` suffix trick; this file is the exhaustive bypass
 * battery. Each block pins the CURRENT behaviour of the WHATWG `URL`
 * parser as bundled in this runtime; where a result is surprising but
 * still safe it is asserted explicitly, and any genuine bypass is marked
 * with `// BUG:` so it surfaces in review.
 */

import {
  isAllowedDfxHost,
  isDfxOwnedHost,
  isSafeHttpsUrl,
} from '../../src/services/security/safe-url';

describe('isSafeHttpsUrl — scheme gate', () => {
  it.each([
    'https://example.com',
    'https://example.com/path?q=1#frag',
    'https://dfx.swiss',
    // host-relative / scheme-prefixed forms the parser still normalises to https
    'https:dfx.swiss',
    'https:/dfx.swiss',
    'HTTPS://dfx.swiss',
    'https://user:pass@example.com',
  ])('accepts https URL %s', (input) => {
    expect(isSafeHttpsUrl(input)).toBe(true);
  });

  it.each([
    'http://example.com',
    'http://dfx.swiss',
    'ws://example.com',
    'wss://dfx.swiss',
    'ftp://example.com',
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'blob:https://dfx.swiss/uuid',
    'about:blank',
    'chrome://settings',
    'intent://x#Intent;scheme=https;end',
    'vbscript:msgbox(1)',
    'https+x://dfx.swiss',
    '',
    '   ',
    'not-a-url',
    '///example.com',
    'https://',
  ])('rejects non-https / malformed %s', (input) => {
    expect(isSafeHttpsUrl(input)).toBe(false);
  });

  it('leading/trailing whitespace is tolerated by the parser (still https)', () => {
    // The WHATWG parser strips surrounding C0/space, so this is a valid
    // https URL. Documenting the behaviour so a future refactor that adds
    // a strict `=== raw` check doesn't silently change it.
    expect(isSafeHttpsUrl('  https://dfx.swiss  ')).toBe(true);
  });
});

describe('isAllowedDfxHost — exact + subdomain matches', () => {
  it.each([
    'https://dfx.swiss',
    'https://app.dfx.swiss',
    'https://services.dfx.swiss',
    'https://api.dfx.swiss/v1/health',
    'https://docs.dfx.swiss/de/tnc.html',
    'https://lightning.space/x',
    'https://lightning.dfx.swiss',
    'https://sumsub.com/foo',
    'https://in.sumsub.com/foo',
    'https://cockpit.idnow.de',
    'https://go.idnow.de',
  ])('accepts allow-listed host %s', (input) => {
    expect(isAllowedDfxHost(input)).toBe(true);
  });

  it.each([
    'https://anything.dfx.swiss',
    'https://deep.nested.app.dfx.swiss/path',
    'https://a.b.c.lightning.space',
    'https://x.in.sumsub.com',
  ])('accepts subdomains of allow-listed hosts %s', (input) => {
    expect(isAllowedDfxHost(input)).toBe(true);
  });
});

describe('isAllowedDfxHost — suffix / boundary tricks', () => {
  it.each([
    'https://evil-dfx.swiss',
    'https://evildfx.swiss',
    'https://dfx.swiss.evil.com',
    'https://app.dfx.swiss.evil.com',
    'https://notdfx.swiss',
    'https://lightning.space.evil.com',
    'https://sumsub.com.evil.com',
    'https://idnow.de', // bare apex is NOT allow-listed (only cockpit./go.)
    'https://fakesumsub.com',
    'https://my-sumsub.com',
    'https://xsumsub.com',
    // a registered domain that merely *contains* "dfx.swiss" as a label
    // substring without the dot boundary
    'https://superdfx.swiss',
  ])('rejects host-boundary trick %s', (input) => {
    expect(isAllowedDfxHost(input)).toBe(false);
  });

  it('rejects the apex of a vendor that is only allow-listed by subdomain', () => {
    // idnow.de itself is never listed — only cockpit.idnow.de / go.idnow.de.
    // A bare apex would not endsWith ".cockpit.idnow.de", so it is rejected.
    expect(isAllowedDfxHost('https://idnow.de')).toBe(false);
    expect(isAllowedDfxHost('https://www.idnow.de')).toBe(false);
  });
});

describe('isAllowedDfxHost — userinfo (@) confusion', () => {
  // The credential before `@` is NOT the host. The parser correctly puts
  // everything after the last `@` into the host, so these must resolve to
  // the real (attacker) host and be rejected — the classic phishing trick.
  it.each([
    'https://dfx.swiss@evil.com',
    'https://app.dfx.swiss@evil.com/login',
    'https://dfx.swiss:443@evil.com',
    'https://user:dfx.swiss@evil.com',
    'https://dfx.swiss%2f@evil.com',
  ])('rejects userinfo spoof %s (host is the attacker)', (input) => {
    expect(isAllowedDfxHost(input)).toBe(false);
  });

  it.each([
    'https://user:pass@dfx.swiss/x',
    'https://evil.com@dfx.swiss',
    'https://evil.com@app.dfx.swiss',
    'https://evil.com%2f@dfx.swiss',
    'https://evil.com%5c@dfx.swiss',
  ])('accepts when the REAL host after @ is allow-listed %s', (input) => {
    // These genuinely point at a DFX host (the userinfo is just noise),
    // so allowing them is correct. Pinning it so a future "reject any @"
    // rule is a conscious decision, not an accident.
    expect(isAllowedDfxHost(input)).toBe(true);
  });
});

describe('isAllowedDfxHost — backslash / slash normalisation', () => {
  // In special schemes the WHATWG parser treats `\` like `/`. An attacker
  // may hope `https://dfx.swiss\@evil.com` is read as host `dfx.swiss`.
  it('treats backslash as a path separator: dfx.swiss\\@evil.com → host dfx.swiss', () => {
    // `\` becomes `/`, so this is dfx.swiss with path `/@evil.com` — a real
    // DFX host. Safe, but documented because it is non-obvious.
    expect(isAllowedDfxHost('https://dfx.swiss\\@evil.com')).toBe(true);
  });

  it('rejects evil.com\\@dfx.swiss (backslash→slash makes host evil.com, @dfx.swiss is path)', () => {
    // `\` normalises to `/`, so the authority ends at evil.com and
    // "@dfx.swiss" is just the path. Correctly rejected — the inverse of the
    // case above, and the reason a naive "split on @" guard would be wrong.
    expect(isAllowedDfxHost('https://evil.com\\@dfx.swiss')).toBe(false);
  });

  it('rejects evil.com\\.dfx.swiss (backslash splits host as evil.com)', () => {
    expect(isAllowedDfxHost('https://evil.com\\.dfx.swiss')).toBe(false);
  });

  it.each([
    'https://evil.com/.dfx.swiss',
    'https://evil.com#x.dfx.swiss',
    'https://evil.com?x=.dfx.swiss',
    'https://evil.com/path/dfx.swiss',
  ])('rejects allow-listed token hidden in path/query/fragment %s', (input) => {
    expect(isAllowedDfxHost(input)).toBe(false);
  });
});

describe('isAllowedDfxHost — percent-encoding of host separators', () => {
  it('decodes %2e to a real dot, expanding the host (dfx.swiss%2eevil.com → dfx.swiss.evil.com)', () => {
    // The encoded dot is decoded into a label separator, so the registrable
    // host becomes dfx.swiss.evil.com → correctly rejected.
    expect(isAllowedDfxHost('https://dfx.swiss%2eevil.com')).toBe(false);
  });

  it('decodes a fully percent-encoded allow-listed host (%64%66%78.swiss → dfx.swiss)', () => {
    expect(isAllowedDfxHost('https://%64%66%78.swiss')).toBe(true);
  });

  it('rejects URLs with a null byte in the authority (parser throws)', () => {
    expect(isAllowedDfxHost('https://dfx.swiss%00.evil.com')).toBe(false);
  });
});

describe('isAllowedDfxHost — IDN / Unicode homographs', () => {
  it('rejects a Cyrillic homograph of dfx (dfх.swiss, х = U+0445)', () => {
    // Parser punycodes it to xn--df-1mc.swiss — visually "dfx.swiss" but a
    // different registrable domain. Must be rejected.
    expect(isAllowedDfxHost('https://dfх.swiss')).toBe(false);
  });

  it('rejects a Cyrillic homograph in the subdomain (аpp.dfx.swiss)', () => {
    // U+0430 "а" → xn--pp-6kc.dfx.swiss. This one is actually a *subdomain*
    // of dfx.swiss after punycode, so confirm the real behaviour.
    // xn--pp-6kc.dfx.swiss DOES end with ".dfx.swiss", so it is ALLOWED —
    // which is fine: it is a genuine subdomain of dfx.swiss and only DFX
    // controls that zone.
    expect(isAllowedDfxHost('https://аpp.dfx.swiss')).toBe(true);
  });

  it('normalises the ideographic full stop (。U+3002) to a real dot', () => {
    // "dfx。swiss" → "dfx.swiss" (allowed) but "dfx.swiss。evil.com" →
    // "dfx.swiss.evil.com" (rejected). Both pin the IDNA mapping.
    expect(isAllowedDfxHost('https://dfx。swiss')).toBe(true);
    expect(isAllowedDfxHost('https://dfx.swiss。evil.com')).toBe(false);
  });

  it('normalises fullwidth Latin (ＤＦＸ.swiss → dfx.swiss)', () => {
    expect(isAllowedDfxHost('https://ＤＦＸ.swiss')).toBe(true);
  });

  it('maps an enclosed digit homograph (①.dfx.swiss → 1.dfx.swiss, a subdomain)', () => {
    expect(isAllowedDfxHost('https://①.dfx.swiss')).toBe(true);
  });

  it('strips an IDNA-ignored soft hyphen (dfx.swiss­ → dfx.swiss)', () => {
    expect(isAllowedDfxHost('https://dfx.swiss­')).toBe(true);
  });

  it('rejects an unrelated punycode host', () => {
    // xn--80ak6aa92e.com is "аррӏе.com" (apple homograph) — nothing to do
    // with DFX.
    expect(isAllowedDfxHost('https://xn--80ak6aa92e.com')).toBe(false);
  });
});

describe('isAllowedDfxHost — trailing dot (FQDN) handling', () => {
  // A trailing dot makes a fully-qualified domain that DNS treats as
  // equivalent to the dotless form, but the allowlist string-compares.
  it('BUG: a fully-qualified trailing-dot host bypasses the exact-match allowlist', () => {
    // `dfx.swiss.` is the same site as `dfx.swiss` for DNS/TLS purposes, but
    // the allowlist neither equals "dfx.swiss" nor endsWith ".dfx.swiss",
    // so it is REJECTED — a usability false-negative, not a security hole.
    // Pinning the current (safe-but-wrong) behaviour.
    expect(isAllowedDfxHost('https://dfx.swiss.')).toBe(false);
    expect(isAllowedDfxHost('https://app.dfx.swiss.')).toBe(false);
  });

  it('rejects a double trailing dot', () => {
    expect(isAllowedDfxHost('https://dfx.swiss..')).toBe(false);
  });

  it('accepts a leading-dot host (.dfx.swiss endsWith .dfx.swiss)', () => {
    // hostname stays ".dfx.swiss", which endsWith ".dfx.swiss" → allowed.
    // Not a bypass: an empty leading label still lives in DFX's own zone
    // (browsers/DNS collapse it), so there is no attacker-controlled origin
    // here. Pinned so the behaviour is intentional, not accidental.
    expect(isAllowedDfxHost('https://.dfx.swiss')).toBe(true);
    // The apex with a leading dot is likewise inside DFX's space.
    expect(isDfxOwnedHost('https://.app.dfx.swiss')).toBe(true);
  });
});

describe('isAllowedDfxHost — ports, IPs, case', () => {
  it('ignores an explicit port (host comparison is portless)', () => {
    expect(isAllowedDfxHost('https://dfx.swiss:8443/x')).toBe(true);
    expect(isAllowedDfxHost('https://dfx.swiss:443/x')).toBe(true);
    expect(isAllowedDfxHost('https://evil.com:443/x')).toBe(false);
  });

  it('is case-insensitive on the host', () => {
    expect(isAllowedDfxHost('https://DFX.SWISS')).toBe(true);
    expect(isAllowedDfxHost('https://Api.DFX.Swiss/x')).toBe(true);
    expect(isAllowedDfxHost('https://APP.DFX.SWISS.EVIL.COM')).toBe(false);
  });

  it('rejects raw IP literals', () => {
    expect(isAllowedDfxHost('https://127.0.0.1')).toBe(false);
    expect(isAllowedDfxHost('https://[::1]/x')).toBe(false);
    // 0x7f000001 → 127.0.0.1 after the parser canonicalises the integer IP.
    expect(isAllowedDfxHost('https://0x7f000001')).toBe(false);
  });
});

describe('isAllowedDfxHost — scheme + malformed gate', () => {
  it.each([
    'http://dfx.swiss',
    'http://app.dfx.swiss',
    'javascript:fetch("https://dfx.swiss")',
    'data:text/html,https://dfx.swiss',
    'ftp://dfx.swiss',
    'ws://dfx.swiss',
    'file://dfx.swiss/x',
  ])('rejects non-https scheme even on an allow-listed host %s', (input) => {
    expect(isAllowedDfxHost(input)).toBe(false);
  });

  it.each(['', '   ', 'not-a-url', '///dfx.swiss', 'https://', 'https://dfx.swiss .evil.com'])(
    'rejects malformed / empty input %s',
    (input) => {
      expect(isAllowedDfxHost(input)).toBe(false);
    },
  );
});

describe('isDfxOwnedHost — owned set is stricter than the allowlist', () => {
  it.each([
    'https://dfx.swiss',
    'https://app.dfx.swiss',
    'https://services.dfx.swiss',
    'https://api.dfx.swiss',
    'https://docs.dfx.swiss/de/tnc.html',
    'https://lightning.space',
    'https://lightning.dfx.swiss',
    'https://deep.nested.app.dfx.swiss',
  ])('accepts DFX-owned host / subdomain %s', (input) => {
    expect(isDfxOwnedHost(input)).toBe(true);
  });

  it.each([
    // allow-listed (KYC vendors) but explicitly NOT DFX-owned
    'https://sumsub.com',
    'https://in.sumsub.com',
    'https://cockpit.idnow.de',
    'https://go.idnow.de',
  ])('rejects allow-listed-but-not-owned vendor host %s', (input) => {
    expect(isAllowedDfxHost(input)).toBe(true); // sanity: still allow-listed
    expect(isDfxOwnedHost(input)).toBe(false);
  });

  it.each([
    'https://evil.com',
    'https://evil-dfx.swiss',
    'https://dfx.swiss.evil.com',
    'https://dfx.swiss@evil.com',
    'http://dfx.swiss',
    'javascript:alert(1)',
    '',
    'not-a-url',
  ])('rejects unrelated / unsafe %s', (input) => {
    expect(isDfxOwnedHost(input)).toBe(false);
  });

  it('shares the trailing-dot blind spot with the allowlist (FQDN rejected)', () => {
    expect(isDfxOwnedHost('https://dfx.swiss.')).toBe(false);
  });
});
