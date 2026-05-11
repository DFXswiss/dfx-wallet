import { useMemo } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { getEvmRpcUrl, type ChainId } from '@/config/chains';
import { DISCOVERABLE_TOKENS_BY_CHAIN, type DiscoverableToken } from '@/config/discoverable-tokens';
import { formatBalance, toNumeric } from '@/config/portfolio-presentation';
import { fetchBtcBalance } from '@/services/balances/btc-fetcher';
import { EvmBalanceFetcher, type EvmAssetSpec } from '@/services/balances/evm-fetcher';
import type { UserAddressDto } from '@/services/dfx/dto';
import { getTokenList, isBlockscoutSupported } from '@/services/explorer/blockscout';
import { lookupCoinIds } from '@/services/pricing/coingecko-coins-list';
import { fetchSimplePrices } from '@/services/pricing/coingecko-simple-price';
import { FiatCurrency, pricingService } from '@/services/pricing-service';

const sharedFetcher = new EvmBalanceFetcher(getEvmRpcUrl);

const BLOCKCHAIN_TO_CHAIN: Record<string, ChainId> = {
  Ethereum: 'ethereum',
  Arbitrum: 'arbitrum',
  Polygon: 'polygon',
  Base: 'base',
  Bitcoin: 'bitcoin',
};

/** Native gas tokens for the EVM chains we surface — used to top up the
 *  curated discovery list so a wallet holding pure ETH/POL still shows
 *  up with a non-zero card. */
const NATIVE_ASSETS: Record<
  ChainId,
  { symbol: string; coingeckoId: string; decimals: number } | null
> = {
  ethereum: { symbol: 'ETH', coingeckoId: 'ethereum', decimals: 18 },
  arbitrum: { symbol: 'ETH', coingeckoId: 'ethereum', decimals: 18 },
  base: { symbol: 'ETH', coingeckoId: 'ethereum', decimals: 18 },
  polygon: { symbol: 'POL', coingeckoId: 'polygon-ecosystem-token', decimals: 18 },
  bitcoin: null,
  'bitcoin-taproot': null,
  'bitcoin-lightning': null,
  spark: null,
  plasma: null,
  sepolia: null,
};

export type DiscoveredAsset = {
  chain: ChainId;
  symbol: string;
  name: string;
  /** Empty for the native asset, ERC-20 contract address otherwise. */
  contract: string | null;
  /** Raw on-chain balance string (smallest unit). */
  rawBalance: string;
  /** Human-readable balance number (with decimals applied). */
  balance: number;
  /** Fiat value in the user's display currency. `null` when CoinGecko
   *  didn't have a price for this contract. */
  fiatValue: number | null;
};

export type WalletDiscovery = {
  /** Lower-cased address; matches the keys used by selection/name hooks. */
  address: string;
  assets: DiscoveredAsset[];
  totalFiat: number;
  /** True when at least one chain scan succeeded, false when every scan
   *  errored — drives the `—` placeholder on the Portfolio card. */
  known: boolean;
};

// Wallet holdings + prices must read as "minute-fresh". The 60s
// staleTime lets a brand-new mount short-circuit on an in-cache result
// (no `—` flash) while still kicking off a background refetch as soon
// as the cache passes a minute. `refetchInterval` keeps the displayed
// value live without the user having to pull.
const STALE_TIME_MS = 60_000;
const REFETCH_INTERVAL_MS = 60_000;
const EMPTY = new Map<string, WalletDiscovery>();

export const LINKED_WALLET_DISCOVERY_KEY = ['balances', 'linked-wallet-discovery'] as const;

/**
 * Scan every linked DFX wallet for on-chain holdings the curated
 * {@link DISCOVERABLE_TOKENS} list captures on each of the wallet's
 * supported chains. Returns per-wallet asset breakdowns plus a fiat
 * total derived from CoinGecko prices.
 *
 * Scope decisions:
 *   - Bitcoin: balance via mempool.space (already wired in
 *     {@link fetchBtcBalance}), no token discovery.
 *   - EVM: native ETH/POL + every curated ERC-20 on the chain. Batched
 *     JSON-RPC POST per chain per wallet via {@link EvmBalanceFetcher}.
 *   - Lightning / Spark / BSC: out of scope for v1 — there's no shared
 *     balance API we can pivot on, and DFX' wallet list rarely surfaces
 *     real holdings on those.
 *
 * Only tokens whose CoinGecko ID has a known price land in `totalFiat`.
 * Tokens without a price (`fiatValue: null`) still appear in `assets`
 * so the linked-wallet detail screen can show the raw balance with a
 * "no price available" note.
 */
export function useLinkedWalletDiscovery(
  wallets: UserAddressDto[],
  fiatCurrency: FiatCurrency,
  pricingReady: boolean,
): {
  data: ReadonlyMap<string, WalletDiscovery>;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => {
    const ids = wallets
      .map((w) => {
        const chains = (w.blockchains?.length ? w.blockchains : [w.blockchain]).slice().sort();
        return `${w.address.toLowerCase()}@${chains.join(',')}`;
      })
      .sort()
      .join('|');
    return [...LINKED_WALLET_DISCOVERY_KEY, ids, fiatCurrency, pricingReady] as const;
  }, [wallets, fiatCurrency, pricingReady]);

  const enabled = wallets.length > 0;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Map<string, WalletDiscovery>> => {
      const out = new Map<string, WalletDiscovery>();

      const tasks = wallets.map(async (wallet) => {
        const cleanAddress = wallet.address.trim();
        const lc = cleanAddress.toLowerCase();
        const blockchains = wallet.blockchains?.length ? wallet.blockchains : [wallet.blockchain];

        const chains: ChainId[] = [];
        for (const bc of blockchains) {
          // eslint-disable-next-line security/detect-object-injection -- BLOCKCHAIN_TO_CHAIN is a closed lookup; misses fall through
          const c = BLOCKCHAIN_TO_CHAIN[bc];
          if (c && !chains.includes(c)) chains.push(c);
        }

        const assets: DiscoveredAsset[] = [];
        let anyKnown = false;

        for (const chain of chains) {
          if (chain === 'bitcoin') {
            const r = await fetchBtcBalance(cleanAddress);
            if ('rawBalance' in r) {
              anyKnown = true;
              const balanceNum = toNumeric(formatBalance(r.rawBalance, 8));
              if (balanceNum > 0) {
                // Always pull a fresh BTC price for the active fiat
                // rather than reading the singleton cache — the cache is
                // primed once at app boot and can be minutes stale.
                const fresh = await fetchSimplePrices(['bitcoin'], [fiatCurrency]);
                // eslint-disable-next-line security/detect-object-injection -- fiatCurrency is a typed FiatCurrency enum
                const priceFresh = fresh.get('bitcoin')?.[fiatCurrency];
                const priceCached = pricingService.getPriceById('bitcoin', fiatCurrency);
                const price =
                  typeof priceFresh === 'number' && priceFresh > 0 ? priceFresh : priceCached;
                if (price != null && price > 0) {
                  const fiatValue = balanceNum * price;
                  if (fiatValue > 0) {
                    assets.push({
                      chain: 'bitcoin',
                      symbol: 'BTC',
                      name: 'Bitcoin',
                      contract: null,
                      rawBalance: r.rawBalance,
                      balance: balanceNum,
                      fiatValue,
                    });
                  }
                }
              }
            }
            continue;
          }

          // EVM chain — native gas token + every ERC-20 the wallet
          // currently holds. Primary discovery uses Blockscout's no-key
          // `tokenlist` endpoint (each chain has its own public host),
          // which returns every fungible ERC-20 the address holds with
          // the current balance baked in. That short-circuits the
          // per-contract JSON-RPC fan-out for those tokens.
          //
          // The curated `DISCOVERABLE_TOKENS_BY_CHAIN` list survives as
          // a safety net for chains Blockscout doesn't index or for the
          // rare case where the host is unreachable, so a freshly
          // installed wallet still surfaces popular holdings.
          // eslint-disable-next-line security/detect-object-injection -- `chain` is a literal ChainId; NATIVE_ASSETS is a closed lookup
          const native = NATIVE_ASSETS[chain];
          const curatedTokens: DiscoverableToken[] = DISCOVERABLE_TOKENS_BY_CHAIN.get(chain) ?? [];

          /** Per-contract metadata for the EVM scan — keyed by the
           *  EvmBalanceFetcher's synthetic `assetId` so we can look up
           *  symbol / decimals / coingeckoId after balances come back. */
          type ChainToken = {
            assetId: string;
            symbol: string;
            name: string;
            contract: string;
            decimals: number;
            coingeckoId: string;
          };
          const tokenSpecs: ChainToken[] = [];

          // Primary path: Blockscout `tokenlist` for discovery. We use
          // it ONLY to find out which contracts the address has ever
          // touched — Blockscout's own balance index lags actual chain
          // state by several minutes, so we ignore the balance it
          // reports and re-read each contract via the JSON-RPC
          // `balanceOf` fan-out further down (which is always at-head).
          if (isBlockscoutSupported(chain)) {
            try {
              const list = await getTokenList(chain, cleanAddress);
              if (list.ok) {
                if (list.value.length > 0) {
                  const coinIdByContract = await lookupCoinIds(
                    chain,
                    list.value.map((t) => t.contractAddress),
                  );
                  for (const t of list.value) {
                    const coingeckoId = coinIdByContract.get(t.contractAddress.toLowerCase());
                    if (!coingeckoId) continue;
                    tokenSpecs.push({
                      assetId: `discovery:${chain}:${t.contractAddress.toLowerCase()}`,
                      symbol: t.symbol || 'ERC20',
                      name: t.name || t.symbol || 'Unknown',
                      contract: t.contractAddress,
                      decimals: t.decimals,
                      coingeckoId,
                    });
                  }
                }
                // A successful Blockscout probe counts the chain as
                // "known" — drives the `—` placeholder semantics on the
                // Portfolio card. Empty result is still a known-empty.
                anyKnown = true;
              }
            } catch {
              // Blockscout errored — fall through to the curated path.
            }
          }

          if (tokenSpecs.length === 0) {
            for (const token of curatedTokens) {
              tokenSpecs.push({
                assetId: `discovery:${chain}:${token.contract.toLowerCase()}`,
                symbol: token.symbol,
                name: token.name,
                contract: token.contract,
                decimals: token.decimals,
                coingeckoId: token.coingeckoId,
              });
            }
          }

          // Always hit /simple/price for every discovered token + native
          // — never trust the singleton pricingService cache here, since
          // it only refreshes on Portfolio pull-to-refresh and goes
          // arbitrarily stale (5+ minutes between user gestures). React
          // Query's staleTime/refetchInterval gives us at-most-60s
          // freshness for the linked-wallet view this way.
          const allCoingeckoIds = tokenSpecs.map((t) => t.coingeckoId);
          if (native) allCoingeckoIds.push(native.coingeckoId);
          const dynamicPrices = allCoingeckoIds.length
            ? await fetchSimplePrices(Array.from(new Set(allCoingeckoIds)), [fiatCurrency])
            : new Map();
          const priceFor = (coingeckoId: string): number | undefined => {
            const entry = dynamicPrices.get(coingeckoId);
            // eslint-disable-next-line security/detect-object-injection -- fiatCurrency is a typed FiatCurrency enum
            const fresh = entry?.[fiatCurrency];
            if (typeof fresh === 'number' && Number.isFinite(fresh)) return fresh;
            // CoinGecko missed this id in the live call — fall back to the
            // singleton cache. Rare; mostly happens during the brief
            // window between coins/list discovery and the first /simple/price
            // batch on a fresh wallet.
            return pricingService.getPriceById(coingeckoId, fiatCurrency);
          };

          // Build the EVM spec list: native gas token (when the chain
          // has one) + every discovered ERC-20. Every balance is read
          // via JSON-RPC `eth_getBalance` / `balanceOf` so we read
          // chain-head state, never a Blockscout index that lags by
          // minutes.
          const specs: EvmAssetSpec[] = [];
          if (native) {
            specs.push({
              assetId: `discovery:${chain}:native`,
              network: chain,
              isNative: true,
              tokenAddress: null,
            });
          }
          for (const t of tokenSpecs) {
            specs.push({
              assetId: t.assetId,
              network: chain,
              isNative: false,
              tokenAddress: t.contract,
            });
          }
          if (specs.length === 0) continue;

          // Fan out balance reads via JSON-RPC (cheap, no rate-limit pain)
          // for the native + any tokens whose balance Blockscout didn't
          // already give us. Prices were resolved above.
          try {
            const result = await sharedFetcher.fetch(specs, new Map([[chain, cleanAddress]]));

            for (const spec of specs) {
              const r = result.get(spec.assetId);
              if (!r) continue;
              if (!('rawBalance' in r)) continue;
              anyKnown = true;

              if (spec.isNative && native) {
                const balanceNum = toNumeric(formatBalance(r.rawBalance, native.decimals));
                if (balanceNum <= 0) continue;
                const price = priceFor(native.coingeckoId);
                if (price == null || price <= 0) continue;
                const fiatValue = balanceNum * price;
                if (fiatValue <= 0) continue;
                assets.push({
                  chain,
                  symbol: native.symbol,
                  name: native.symbol,
                  contract: null,
                  rawBalance: r.rawBalance,
                  balance: balanceNum,
                  fiatValue,
                });
                continue;
              }

              const token = tokenSpecs.find((t) => t.assetId === spec.assetId);
              if (!token) continue;
              const balanceNum = toNumeric(formatBalance(r.rawBalance, token.decimals));
              if (balanceNum <= 0) continue;
              const price = priceFor(token.coingeckoId);
              if (price == null || price <= 0) continue;
              const fiatValue = balanceNum * price;
              if (fiatValue <= 0) continue;
              assets.push({
                chain,
                symbol: token.symbol,
                name: token.name,
                contract: token.contract,
                rawBalance: r.rawBalance,
                balance: balanceNum,
                fiatValue,
              });
            }
          } catch {
            // Per-chain failure is contained — other chains for this
            // wallet still report. Pricing-only tokens with no fetch
            // result fall through as missing.
          }
        }

        const totalFiat = assets.reduce((sum, a) => sum + (a.fiatValue ?? 0), 0);
        out.set(lc, { address: lc, assets, totalFiat, known: anyKnown });
      });

      await Promise.all(tasks);
      return out;
    },
    enabled: enabled && pricingReady,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    // Show the previous (still-valid) result while a refetch — or a
    // queryKey change like the pricing service flipping to "ready" —
    // is in flight. Without this the UI flashed `—` on every linked
    // wallet card during the seconds it took the new fetch to land.
    placeholderData: keepPreviousData,
  });

  const refetch = useMemo(
    () => async () => {
      await queryClient.invalidateQueries({ queryKey: LINKED_WALLET_DISCOVERY_KEY });
    },
    [queryClient],
  );

  return { data: data ?? EMPTY, isLoading: enabled && isLoading, refetch };
}
