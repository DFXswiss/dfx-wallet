/**
 * Tiny JWT payload decoder. We only ever need to read non-sensitive claims
 * (account id, registered blockchains) to skip redundant link-signature
 * prompts — never to verify the signature client-side.
 */
export type DfxJwtPayload = {
  account?: number;
  address?: string;
  /** Blockchains the active user has registered with DFX (controls
   *  `/buy/quote` blockchain-mismatch validation). */
  blockchains?: string[];
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

/**
 * Quick check: does the active JWT already declare `blockchain` in its
 * `user.blockchains` claim? If yes, the auto-link / linkChain flow can skip
 * the signature prompt entirely — DFX already accepts /buy/quote requests
 * for that chain.
 */
export function jwtCoversBlockchain(token: string | null, blockchain: string): boolean {
  if (!token) return false;
  const payload = decodeDfxJwt(token);
  if (!payload?.blockchains) return false;
  const target = blockchain.toLowerCase();
  return payload.blockchains.some((b) => b.toLowerCase() === target);
}
