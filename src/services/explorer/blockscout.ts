import type { ChainId } from '@/config/chains';

/**
 * Blockscout token-discovery fallback.
 *
 * Etherscan V2's `tokentx` endpoint gives us every ERC-20 a wallet has
 * ever touched — but it's API-key gated, and a freshly built wallet
 * without `EXPO_PUBLIC_ETHERSCAN_API_KEY` ends up using the curated
 * token list (~20 Base entries) which misses everything else the user
 * actually holds.
 *
 * Blockscout exposes a per-chain public host with a *no-key* endpoint:
 *
 *   GET {host}/api?module=account&action=tokenlist&address={0x…}
 *
 * Which returns the current ERC-20 holdings as
 *   {
 *     balance: "1234000000000000000000",
 *     contractAddress: "0x…",
 *     decimals: "18",
 *     name: "Token Name",
 *     symbol: "TKN",
 *     type: "ERC-20"
 *   }[]
 *
 * That's exactly the shape the discovery hook needs: balance + contract
 * already in hand, so we can skip the per-contract `tokenbalance` RPC
 * fan-out for these tokens entirely.
 *
 * We still pass the resulting contracts through CoinGecko's
 * `lookupCoinIds` so only the user-spec'd "CoinGecko-listed" subset
 * surfaces.
 */

const BLOCKSCOUT_HOST: Record<ChainId, string | null> = {
  ethereum: 'https://eth.blockscout.com',
  arbitrum: 'https://arbitrum.blockscout.com',
  polygon: 'https://polygon.blockscout.com',
  base: 'https://base.blockscout.com',
  bitcoin: null,
  'bitcoin-taproot': null,
  'bitcoin-lightning': null,
  spark: null,
  plasma: null,
  sepolia: 'https://eth-sepolia.blockscout.com',
};

export type BlockscoutToken = {
  /** Raw on-chain balance (smallest unit) as a string. */
  balance: string;
  contractAddress: string;
  decimals: number;
  name: string;
  symbol: string;
};

export type BlockscoutFailure = {
  code: 'no-chain' | 'http' | 'error';
  message: string;
};

type BlockscoutResponse = {
  status?: string;
  message?: string;
  result?:
    | {
        balance?: string;
        contractAddress?: string;
        decimals?: string;
        name?: string;
        symbol?: string;
        type?: string;
      }[]
    | string;
};

const failure = (
  code: BlockscoutFailure['code'],
  message: string,
): { ok: false; error: BlockscoutFailure } => ({ ok: false, error: { code, message } });

/**
 * Fetch every ERC-20 the address currently holds on the given chain.
 * Returns `{ ok: true, value }` even on the "no transactions found"
 * empty-list reply so callers don't have to special-case that wire
 * dialect — only network / parse failures get `{ ok: false }`.
 */
export async function getTokenList(
  chain: ChainId,
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<{ ok: true; value: BlockscoutToken[] } | { ok: false; error: BlockscoutFailure }> {
  // eslint-disable-next-line security/detect-object-injection -- typed ChainId literal
  const host = BLOCKSCOUT_HOST[chain];
  if (!host) {
    return failure('no-chain', `Blockscout has no host mapping for ${chain}`);
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = `${host}/api?module=account&action=tokenlist&address=${encodeURIComponent(address)}`;

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    if (!res.ok) return failure('http', `HTTP ${res.status}`);
    const json = (await res.json()) as BlockscoutResponse;

    // Blockscout uses the legacy Etherscan-style envelope. `status: "1"`
    // with an array `result` is the happy path; `status: "0"` with an
    // empty array or "No tokens found" message is benign — fold both
    // into success-with-empty.
    if (Array.isArray(json.result)) {
      const tokens: BlockscoutToken[] = [];
      for (const row of json.result) {
        if (!row || typeof row !== 'object') continue;
        const type = row.type;
        // Some Blockscout instances also return ERC-721 / ERC-1155 in
        // the same response. We only want fungible ERC-20s for the
        // fiat-sum scan.
        if (type && type !== 'ERC-20' && type !== 'ERC20') continue;
        const contract = row.contractAddress;
        const balance = row.balance;
        if (typeof contract !== 'string' || typeof balance !== 'string') continue;
        const decimals = Number(row.decimals ?? '18');
        tokens.push({
          balance,
          contractAddress: contract,
          decimals: Number.isFinite(decimals) ? decimals : 18,
          name: typeof row.name === 'string' ? row.name : (row.symbol ?? 'ERC20'),
          symbol: typeof row.symbol === 'string' ? row.symbol : 'ERC20',
        });
      }
      return { ok: true, value: tokens };
    }

    // Non-array result (typically the "No tokens found" sentinel) — treat
    // as empty so the caller can fall through to curated tokens cleanly.
    return { ok: true, value: [] };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return failure('error', 'aborted');
    }
    return failure('error', err instanceof Error ? err.message : 'Blockscout fetch failed');
  }
}

/** Whether Blockscout indexes the given chain. */
export function isBlockscoutSupported(chain: ChainId): boolean {
  // eslint-disable-next-line security/detect-object-injection -- typed ChainId literal
  return BLOCKSCOUT_HOST[chain] !== null;
}
