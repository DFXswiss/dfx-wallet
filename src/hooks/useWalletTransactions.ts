import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChainId } from '@/config/chains';
import {
  getErc20Txs,
  getNormalTxs,
  isEtherscanConfigured,
  type NormalErc20Tx,
  type NormalNativeTx,
} from '@/services/explorer/etherscan';
import type { UserAddressDto } from '@/services/dfx/dto';

/**
 * Block-explorer-driven transaction feed for a single linked wallet,
 * merged across every chain it lives on. Powers the wallet detail
 * screen's "TRANSAKTIONEN" section — replaces the previous per-chain
 * explorer-link rows so the user reads a single chronological list
 * inside the app instead of bouncing out to ten separate web pages.
 *
 * Output shape:
 *   - One row per on-chain transaction (native + ERC-20 are merged).
 *   - `direction` tells the renderer whether to colour the amount
 *     positive (`receive`) or negative (`send`); `self` covers the rare
 *     case where the user's address shows up on both legs of a swap
 *     contract.
 *   - Sorted by timestamp DESC so the latest activity sits at the top.
 *
 * Etherscan-V2 free-tier rate-limit: 5 calls/sec, 100k/day. Each chain
 * fans out two calls (`txlist` + `tokentx`). React-query's staleTime
 * keeps us well under that ceiling even when several wallets get
 * inspected back-to-back.
 */

export type WalletTxDirection = 'send' | 'receive' | 'self';

export type WalletTransaction = {
  /** Composite key — chain + tx hash + log-index (for ERC-20 rows that
   *  share a hash with the native row). Stable across refetches so React
   *  list reconciliation doesn't blink. */
  id: string;
  chain: ChainId;
  hash: string;
  timestamp: number;
  symbol: string;
  /** Human-readable amount (already scaled by decimals). */
  amount: string;
  direction: WalletTxDirection;
  /** The counterparty address — `to` when sending, `from` when
   *  receiving. Truncated by the renderer. */
  counterparty: string;
  /** ERC-20 contract for token rows, undefined for native rows. */
  contract?: string;
};

export const WALLET_TX_QUERY_KEY = ['linked-wallet-transactions'] as const;

const STALE_TIME_MS = 30_000;
const REFETCH_INTERVAL_MS = 60_000;

const CHAIN_KEYS: Record<string, ChainId> = {
  Ethereum: 'ethereum',
  Arbitrum: 'arbitrum',
  Polygon: 'polygon',
  Base: 'base',
};

/**
 * Scale a raw integer balance string by `decimals` while preserving
 * precision past Number.MAX_SAFE_INTEGER. Returns a short decimal —
 * "1.2345" not "1.234500000000000000" — so the UI doesn't have to trim
 * trailing zeros for every row.
 */
function formatTokenAmount(raw: string, decimals: number): string {
  if (!raw || raw === '0') return '0';
  const d = Math.max(0, Math.min(36, decimals));
  let value: bigint;
  try {
    value = BigInt(raw);
  } catch {
    return '0';
  }
  if (value === 0n) return '0';
  const negative = value < 0n;
  if (negative) value = -value;
  const divisor = 10n ** BigInt(d);
  const whole = value / divisor;
  const fractional = value % divisor;
  if (fractional === 0n) return `${negative ? '-' : ''}${whole}`;
  const fracStr = fractional.toString().padStart(d, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fracStr.length > 0 ? '.' : ''}${fracStr}`;
}

function directionFor(fromAddress: string, toAddress: string, walletLc: string): WalletTxDirection {
  const f = fromAddress.toLowerCase();
  const t = toAddress.toLowerCase();
  if (f === walletLc && t === walletLc) return 'self';
  if (f === walletLc) return 'send';
  return 'receive';
}

function normalizeNative(
  chain: ChainId,
  walletLc: string,
  tx: NormalNativeTx,
  nativeSymbol: string,
): WalletTransaction {
  return {
    id: `${chain}:${tx.hash}:native`,
    chain,
    hash: tx.hash,
    timestamp: Number(tx.timeStamp) * 1000,
    symbol: nativeSymbol,
    amount: formatTokenAmount(tx.value, 18),
    direction: directionFor(tx.from, tx.to, walletLc),
    counterparty: directionFor(tx.from, tx.to, walletLc) === 'send' ? tx.to : tx.from,
  };
}

function normalizeErc20(chain: ChainId, walletLc: string, tx: NormalErc20Tx): WalletTransaction {
  const decimals = Number(tx.tokenDecimal) || 18;
  return {
    id: `${chain}:${tx.hash}:${tx.contractAddress.toLowerCase()}`,
    chain,
    hash: tx.hash,
    timestamp: Number(tx.timeStamp) * 1000,
    symbol: tx.tokenSymbol || 'ERC20',
    amount: formatTokenAmount(tx.value, decimals),
    direction: directionFor(tx.from, tx.to, walletLc),
    counterparty: directionFor(tx.from, tx.to, walletLc) === 'send' ? tx.to : tx.from,
    contract: tx.contractAddress,
  };
}

const NATIVE_SYMBOL: Record<ChainId, string> = {
  ethereum: 'ETH',
  arbitrum: 'ETH',
  base: 'ETH',
  polygon: 'POL',
  bitcoin: 'BTC',
  'bitcoin-taproot': 'BTC',
  'bitcoin-lightning': 'BTC',
  spark: 'SPARK',
  plasma: 'XPL',
  sepolia: 'ETH',
};

export function useWalletTransactions(wallet: UserAddressDto | null): {
  data: WalletTransaction[];
  isLoading: boolean;
  /** True only when the explorer API isn't configured — UI surfaces a
   *  hint pointing the user at the env var setup. */
  keyMissing: boolean;
  refetch: () => Promise<void>;
} {
  const queryClient = useQueryClient();

  const chains = useMemo<ChainId[]>(() => {
    if (!wallet) return [];
    const blockchains = wallet.blockchains?.length ? wallet.blockchains : [wallet.blockchain];
    const seen = new Set<ChainId>();
    const out: ChainId[] = [];
    for (const bc of blockchains) {
      // eslint-disable-next-line security/detect-object-injection -- CHAIN_KEYS is closed
      const c = CHAIN_KEYS[bc];
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
    return out;
  }, [wallet]);

  const queryKey = useMemo(() => {
    const addr = wallet?.address.toLowerCase() ?? '';
    return [...WALLET_TX_QUERY_KEY, addr, chains.join(',')] as const;
  }, [wallet, chains]);

  const enabled = wallet !== null && chains.length > 0 && isEtherscanConfigured();

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<WalletTransaction[]> => {
      if (!wallet) return [];
      const walletLc = wallet.address.toLowerCase();

      const perChain = await Promise.all(
        chains.map(async (chain) => {
          const [native, erc20] = await Promise.all([
            getNormalTxs(chain, wallet.address),
            getErc20Txs(chain, wallet.address),
          ]);
          const txs: WalletTransaction[] = [];
          if (native.ok) {
            // eslint-disable-next-line security/detect-object-injection -- closed ChainId map
            const sym = NATIVE_SYMBOL[chain] ?? '?';
            for (const t of native.value) txs.push(normalizeNative(chain, walletLc, t, sym));
          }
          if (erc20.ok) {
            for (const t of erc20.value) txs.push(normalizeErc20(chain, walletLc, t));
          }
          return txs;
        }),
      );

      const flat = perChain.flat();
      flat.sort((a, b) => b.timestamp - a.timestamp);
      // Etherscan returns one tokentx row per ERC-20 transfer plus one
      // txlist row for the same hash if the wallet was also the native
      // sender (gas payment). Keep both — they read as separate events
      // (e.g. "Sent 100 USDC" + "Gas −0.0002 ETH"). De-duplicate only on
      // the composite id we synthesised above.
      const dedup = new Map<string, WalletTransaction>();
      for (const tx of flat) dedup.set(tx.id, tx);
      return Array.from(dedup.values());
    },
    enabled,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const refetch = useMemo(
    () => async () => {
      await queryClient.invalidateQueries({ queryKey: WALLET_TX_QUERY_KEY });
    },
    [queryClient],
  );

  return {
    data: data ?? [],
    isLoading: enabled && isLoading,
    keyMissing: wallet !== null && chains.length > 0 && !isEtherscanConfigured(),
    refetch,
  };
}
