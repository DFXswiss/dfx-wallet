import { env } from '@/config/env';
import type { ChainId } from '@/config/chains';

/**
 * Etherscan V2 unified-API client.
 *
 * Free-tier surface (https://etherscan.io/apis):
 *   - One API host, every supported chain reachable via the `chainid` query
 *     parameter — no more per-chain hosts (etherscan.io / arbiscan.io /…).
 *   - 5 calls/sec, 100k/day with a free account.
 *
 * Behaviour when no key is configured ({@link env.etherscanApiKey} empty):
 *   - Every method short-circuits with an empty result and the
 *     `keyMissing: true` flag so the calling hook can render a hint
 *     ("Set EXPO_PUBLIC_ETHERSCAN_API_KEY for live transactions") instead
 *     of showing an authentication-failure noise toast.
 *
 * The free-tier covers Ethereum mainnet + all major L2s (Arbitrum,
 * Optimism, Polygon, Base, BNB, …). Per-chain CHAINID below — extend when
 * Etherscan adds support.
 */

const CHAINID: Record<ChainId, number | null> = {
  ethereum: 1,
  arbitrum: 42161,
  polygon: 137,
  base: 8453,
  bitcoin: null,
  'bitcoin-taproot': null,
  'bitcoin-lightning': null,
  spark: null,
  plasma: null,
  sepolia: 11155111,
};

const BASE_URL = 'https://api.etherscan.io/v2/api';

type EtherscanOk<T> = { status: '1'; message: 'OK' | string; result: T };
type EtherscanEmpty = { status: '0'; message: 'No transactions found' | string; result: [] };
type EtherscanError = { status: '0'; message: string; result: string };
type EtherscanResponse<T> = EtherscanOk<T> | EtherscanEmpty | EtherscanError;

export type NormalNativeTx = {
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

export type NormalErc20Tx = {
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

export type EtherscanFailure = { code: 'no-chain' | 'no-key' | 'http' | 'error'; message: string };

const failure = (
  code: EtherscanFailure['code'],
  message: string,
): { ok: false; error: EtherscanFailure } => ({
  ok: false,
  error: { code, message },
});

/**
 * Generic typed call to /v2/api. Returns `{ ok: true, value }` on a
 * successful response (status === '1' OR a benign empty-list response),
 * and `{ ok: false, error }` for any other shape so callers can fan out
 * recovery (rate-limit retries, key-missing toasts, …) instead of pattern-
 * matching on stringly-typed message fields.
 */
async function call<T>(
  chain: ChainId,
  params: Record<string, string>,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<{ ok: true; value: T } | { ok: false; error: EtherscanFailure }> {
  // eslint-disable-next-line security/detect-object-injection -- `chain` is a typed ChainId literal
  const chainid = CHAINID[chain];
  if (chainid == null) {
    return failure('no-chain', `Etherscan V2 has no chainid mapping for ${chain}`);
  }
  if (!env.etherscanApiKey) {
    return failure('no-key', 'EXPO_PUBLIC_ETHERSCAN_API_KEY is not configured');
  }

  const qs = new URLSearchParams({
    chainid: String(chainid),
    apikey: env.etherscanApiKey,
    ...params,
  });
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${BASE_URL}?${qs.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    if (!res.ok) return failure('http', `HTTP ${res.status}`);
    const json = (await res.json()) as EtherscanResponse<T>;
    if (json.status === '1') {
      return { ok: true, value: json.result };
    }
    // "No transactions found" is the standard empty-list reply; treat as
    // success-with-empty so the caller doesn't have to know the wire
    // dialect.
    if (json.status === '0' && Array.isArray(json.result) && json.result.length === 0) {
      return { ok: true, value: [] as unknown as T };
    }
    return failure('error', String(json.message ?? json.result ?? 'Etherscan error'));
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return failure('error', 'aborted');
    }
    return failure('error', err instanceof Error ? err.message : 'Etherscan fetch failed');
  }
}

/**
 * Native (ETH/POL/…) transactions for an address — the `txlist` action.
 * Sorted server-side desc by block. The free tier caps each call at
 * 10 000 rows; callers that need more can page via `startblock` /
 * `endblock`.
 */
export async function getNormalTxs(
  chain: ChainId,
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch; offset?: number },
): Promise<{ ok: true; value: NormalNativeTx[] } | { ok: false; error: EtherscanFailure }> {
  return call<NormalNativeTx[]>(
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
 * ERC-20 token transfers for an address — the `tokentx` action. Two uses:
 *   1. The TX feed dedupes these into the chronological list per chain.
 *   2. Token discovery: the unique `contractAddress` set across this
 *      response is the list of tokens the wallet has ever touched, fed
 *      back into a `tokenbalance` round-trip per contract to fetch the
 *      current holding.
 */
export async function getErc20Txs(
  chain: ChainId,
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch; offset?: number },
): Promise<{ ok: true; value: NormalErc20Tx[] } | { ok: false; error: EtherscanFailure }> {
  return call<NormalErc20Tx[]>(
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
 * Current native balance via Etherscan (mirrors the `eth_getBalance` JSON-
 * RPC call but keyed on Etherscan's quota and avoids a second RPC URL
 * config for users who already have an Etherscan key).
 */
export async function getNativeBalance(
  chain: ChainId,
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<{ ok: true; value: string } | { ok: false; error: EtherscanFailure }> {
  return call<string>(
    chain,
    {
      module: 'account',
      action: 'balance',
      address,
      tag: 'latest',
    },
    options,
  );
}

/** Current ERC-20 balance via Etherscan (`tokenbalance` action). */
export async function getTokenBalance(
  chain: ChainId,
  contractAddress: string,
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<{ ok: true; value: string } | { ok: false; error: EtherscanFailure }> {
  return call<string>(
    chain,
    {
      module: 'account',
      action: 'tokenbalance',
      contractaddress: contractAddress,
      address,
      tag: 'latest',
    },
    options,
  );
}

export function isEtherscanConfigured(): boolean {
  return env.etherscanApiKey.length > 0;
}

/** Etherscan V2 chainid for a wallet chain — exported for tests + UI
 *  fallback (e.g. show "We don't index transactions on $chain yet"). */
export function getEtherscanChainId(chain: ChainId): number | null {
  // eslint-disable-next-line security/detect-object-injection -- typed ChainId
  return CHAINID[chain];
}
