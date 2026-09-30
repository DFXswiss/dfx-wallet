/**
 * Block-explorer transaction URLs per chain. One table for every screen that
 * links to a transaction (history detail, send success), so a new chain is
 * added in exactly one place. Chains without a public explorer entry (Spark /
 * Lightning, Bitcoin variants) return `undefined` and callers fall back to
 * showing the hash itself.
 */
const EXPLORER_TX_BASE = new Map<string, string>([
  ['ethereum', 'https://etherscan.io/tx/'],
  ['arbitrum', 'https://arbiscan.io/tx/'],
  ['polygon', 'https://polygonscan.com/tx/'],
  ['base', 'https://basescan.org/tx/'],
  ['plasma', 'https://explorer.plasma.to/tx/'],
  ['sepolia', 'https://sepolia.etherscan.io/tx/'],
]);

export function getExplorerTxUrl(chain: string, txHash: string): string | undefined {
  const base = EXPLORER_TX_BASE.get(chain);
  return base && txHash ? `${base}${txHash}` : undefined;
}
