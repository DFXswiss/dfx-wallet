import type { ChainId } from '@/config/chains';

/**
 * Blockscout explorer client — the primary EVM data source for the
 * linked-wallet detail screen.
 *
 * Why Blockscout over Etherscan: each chain has a free, public,
 * key-free host (`eth.blockscout.com`, `base.blockscout.com`,
 * `arbitrum.blockscout.com`, `polygon.blockscout.com`). Endpoints
 * mirror Etherscan's legacy `account.tokenlist` / `account.txlist` /
 * `account.tokentx` schema so the rest of the app didn't need a new
 * data model — only the transport changes.
 *
 * Three actions are wired up:
 *   1. {@link getTokenList} — current ERC-20 holdings (balance baked
 *      in, no second RPC roundtrip per contract).
 *   2. {@link getNormalTxs} — native (ETH/POL) transactions.
 *   3. {@link getErc20Txs}  — ERC-20 transfer history, fed into the
 *      cross-chain TX feed on the wallet-detail screen.
 *
 * Discovery still passes every contract through CoinGecko's
 * `lookupCoinIds` so only listed tokens reach the UI.
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

/**
 * Blockscout's legacy `txlist` and `tokentx` rows are wire-compatible
 * with Etherscan's free-tier responses (Blockscout deliberately mirrors
 * that schema). We re-use field names verbatim so callers can share
 * normalisation code with the Etherscan path.
 */
export type BlockscoutNativeTx = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasUsed: string;
  isError: string;
  contractAddress: string;
  input?: string;
};

export type BlockscoutErc20Tx = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
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

/**
 * Native (ETH/POL/…) transactions for an address — `account/txlist`. Same
 * envelope as Etherscan; we normalise the empty-result reply to a
 * `{ ok: true, value: [] }` so callers don't have to special-case the
 * "No transactions found" status string.
 */
export async function getNormalTxs(
  chain: ChainId,
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch; offset?: number },
): Promise<{ ok: true; value: BlockscoutNativeTx[] } | { ok: false; error: BlockscoutFailure }> {
  return callList<BlockscoutNativeTx>(
    chain,
    {
      module: 'account',
      action: 'txlist',
      address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: String(options?.offset ?? 50),
      sort: 'desc',
    },
    options,
  );
}

/**
 * ERC-20 token transfers for an address — `account/tokentx`. Powers the
 * in-app TX feed for the linked-wallet detail screen.
 */
export async function getErc20Txs(
  chain: ChainId,
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch; offset?: number },
): Promise<{ ok: true; value: BlockscoutErc20Tx[] } | { ok: false; error: BlockscoutFailure }> {
  return callList<BlockscoutErc20Tx>(
    chain,
    {
      module: 'account',
      action: 'tokentx',
      address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: String(options?.offset ?? 100),
      sort: 'desc',
    },
    options,
  );
}

/**
 * Shared list-endpoint dispatcher for txlist / tokentx. Mirrors the
 * Etherscan service's `call` shape — `status: "1"` is the happy path,
 * `status: "0"` with an empty array is treated as benign empty.
 */
async function callList<T>(
  chain: ChainId,
  params: Record<string, string>,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<{ ok: true; value: T[] } | { ok: false; error: BlockscoutFailure }> {
  // eslint-disable-next-line security/detect-object-injection -- typed ChainId literal
  const host = BLOCKSCOUT_HOST[chain];
  if (!host) {
    return failure('no-chain', `Blockscout has no host mapping for ${chain}`);
  }
  const qs = new URLSearchParams(params);
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = `${host}/api?${qs.toString()}`;
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    if (!res.ok) return failure('http', `HTTP ${res.status}`);
    const json = (await res.json()) as { status?: string; message?: string; result?: T[] | string };
    if (Array.isArray(json.result)) return { ok: true, value: json.result };
    // Non-array result (typically the "No transactions found" sentinel).
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
