/**
 * URL allow-listing for outbound links and WebView loads. Server responses
 * (KYC redirects, support links, deep-link payloads) flow into native URL
 * handlers and an in-app WebView; without a guard a compromised or
 * misconfigured backend could push a `javascript:` / `data:` / `file:`
 * scheme, or redirect the user to an attacker-controlled host.
 *
 * `isSafeHttpsUrl` enforces the absolute minimum (https only, valid URL).
 * `isAllowedDfxHost` additionally locks the host to DFX-owned and
 * KYC-vendor domains we explicitly trust today.
 */

const ALLOWED_HOSTS = new Set([
  'dfx.swiss',
  'app.dfx.swiss',
  'services.dfx.swiss',
  'api.dfx.swiss',
  'docs.dfx.swiss',
  'lightning.space',
  'lightning.dfx.swiss',
  // KYC providers DFX uses today (Sumsub, IDnow). Listed explicitly because
  // any URL we open inside the in-app WebView runs with the wallet's
  // credentials in adjacent tabs.
  'sumsub.com',
  'in.sumsub.com',
  'cockpit.idnow.de',
  'go.idnow.de',
]);

const DFX_OWNED_HOSTS = new Set([
  'dfx.swiss',
  'app.dfx.swiss',
  'services.dfx.swiss',
  'api.dfx.swiss',
  'docs.dfx.swiss',
  'lightning.space',
  'lightning.dfx.swiss',
]);

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Reject anything that isn't an https:// URL — blocks `javascript:`,
 * `data:`, `file:`, and plain http traffic that could be MITMed.
 */
export function isSafeHttpsUrl(raw: string): boolean {
  const parsed = parseUrl(raw);
  return !!parsed && parsed.protocol === 'https:';
}

/**
 * Stricter check used before loading a URL into the in-app WebView. The
 * host must match (or be a subdomain of) one of the explicitly allow-listed
 * domains.
 */
export function isAllowedDfxHost(raw: string): boolean {
  const parsed = parseUrl(raw);
  if (!parsed || parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  for (const allowed of ALLOWED_HOSTS) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

export function isDfxOwnedHost(raw: string): boolean {
  const parsed = parseUrl(raw);
  if (!parsed || parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  for (const allowed of DFX_OWNED_HOSTS) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}
