/**
 * Tiny JWT payload decoder. We only ever need to read non-sensitive claims
 * (account id) to detect when the backend has merged a wallet-only account
 * into an email-bound one — never to verify the signature client-side.
 */
export type DfxJwtPayload = {
  account?: number;
  address?: string;
  [key: string]: unknown;
};

export function decodeDfxJwt(token: string): DfxJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4 !== 0) payload += '=';
    return JSON.parse(atob(payload)) as DfxJwtPayload;
  } catch {
    return null;
  }
}
