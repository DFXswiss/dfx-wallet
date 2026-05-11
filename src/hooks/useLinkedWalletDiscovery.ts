import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getEvmRpcUrl, type ChainId } from '@/config/chains';
import { DISCOVERABLE_TOKENS_BY_CHAIN, type DiscoverableToken } from '@/config/discoverable-tokens';
import { formatBalance, toNumeric } from '@/config/portfolio-presentation';
import { fetchBtcBalance } from '@/services/balances/btc-fetcher';
import { EvmBalanceFetcher, type EvmAssetSpec } from '@/services/balances/evm-fetcher';
import type { UserAddressDto } from '@/services/dfx/dto';
import { getErc20Txs, isEtherscanConfigured } from '@/services/explorer/etherscan';
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

const STALE_TIME_MS = 30_000;
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
                const priceUsd = pricingService.getPriceById('bitcoin', fiatCurrency);
                assets.push({
                  chain: 'bitcoin',
                  symbol: 'BTC',
                  name: 'Bitcoin',
                  contract: null,
                  rawBalance: r.rawBalance,
                  balance: balanceNum,
                  fiatValue: priceUsd != null ? balanceNum * priceUsd : null,
                });
              }
            }
            continue;
          }

          // EVM chain — native gas token + every ERC-20 we can either
          // (a) discover from the address's `tokentx` history via the
          // Etherscan-V2 unified API, or (b) fall back to the curated
          // list if no API key is configured. The dynamic path captures
          // anything the wallet ever held; the curated fallback covers
          // the ~50 most popular tokens per chain so users see *something*
          // even without provisioning a key.
          // eslint-disable-next-line security/detect-object-injection -- `chain` is a literal ChainId; NATIVE_ASSETS is a closed lookup
          const native = NATIVE_ASSETS[chain];
          const useDynamic = isEtherscanConfigured();
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

          if (useDynamic) {
            try {
              const txs = await getErc20Txs(chain, cleanAddress, { offset: 100 });
              if (txs.ok) {
                // Unique contracts in tokentx — preserve insertion order
                // (most recent first per Etherscan's `sort=desc`).
                const seen = new Set<string>();
                const ordered: {
                  contract: string;
                  symbol: string;
                  name: string;
                  decimals: number;
                }[] = [];
                for (const t of txs.value) {
                  const lcContract = t.contractAddress.toLowerCase();
                  if (seen.has(lcContract)) continue;
                  seen.add(lcContract);
                  ordered.push({
                    contract: t.contractAddress,
                    symbol: t.tokenSymbol || 'ERC20',
                    name: t.tokenName || t.tokenSymbol || 'Unknown',
                    decimals: Number(t.tokenDecimal) || 18,
                  });
                }
                // Filter to tokens that are on CoinGecko (user-spec).
                const coinIdByContract = await lookupCoinIds(
                  chain,
                  ordered.map((o) => o.contract),
                );
                for (const t of ordered) {
                  const coingeckoId = coinIdByContract.get(t.contract.toLowerCase());
                  if (!coingeckoId) continue;
                  tokenSpecs.push({
                    assetId: `discovery:${chain}:${t.contract.toLowerCase()}`,
                    symbol: t.symbol,
                    name: t.name,
                    contract: t.contract,
                    decimals: t.decimals,
                    coingeckoId,
                  });
                }
              }
            } catch {
              // Dynamic discovery errored — fall through to the curated
              // path so the user still sees their popular holdings.
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
          // and prime any prices we don't already have in the cache.
          try {
            const result = await sharedFetcher.fetch(specs, new Map([[chain, cleanAddress]]));

            // Resolve prices for discovery-derived IDs that aren't in the
            // pricingService's curated set. We could let `getPriceById`
            // miss and drop those tokens, but a single batched simple/price
            // request is cheap and gives the user the live fiat.
            const dynamicIds = tokenSpecs
              .map((t) => t.coingeckoId)
              .filter((id) => pricingService.getPriceById(id, fiatCurrency) === undefined);
            const dynamicPrices = dynamicIds.length
              ? await fetchSimplePrices(Array.from(new Set(dynamicIds)), [fiatCurrency])
              : new Map();
            const priceFor = (coingeckoId: string): number | undefined => {
              const cached = pricingService.getPriceById(coingeckoId, fiatCurrency);
              if (cached != null) return cached;
              const entry = dynamicPrices.get(coingeckoId);
              // eslint-disable-next-line security/detect-object-injection -- fiatCurrency is a typed FiatCurrency enum
              return entry?.[fiatCurrency];
            };

            for (const spec of specs) {
              const r = result.get(spec.assetId);
              if (!r) continue;
              if (!('rawBalance' in r)) continue;
              anyKnown = true;

              if (spec.isNative && native) {
                const balanceNum = toNumeric(formatBalance(r.rawBalance, native.decimals));
                if (balanceNum <= 0) continue;
                const price = priceFor(native.coingeckoId);
                assets.push({
                  chain,
                  symbol: native.symbol,
                  name: native.symbol,
                  contract: null,
                  rawBalance: r.rawBalance,
                  balance: balanceNum,
                  fiatValue: price != null ? balanceNum * price : null,
                });
                continue;
              }

              const token = tokenSpecs.find((t) => t.assetId === spec.assetId);
              if (!token) continue;
              const balanceNum = toNumeric(formatBalance(r.rawBalance, token.decimals));
              if (balanceNum <= 0) continue;
              const price = priceFor(token.coingeckoId);
              if (price == null) continue; // user spec: only CoinGecko-listed tokens
              assets.push({
                chain,
                symbol: token.symbol,
                name: token.name,
                contract: token.contract,
                rawBalance: r.rawBalance,
                balance: balanceNum,
                fiatValue: balanceNum * price,
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
  });

  const refetch = useMemo(
    () => async () => {
      await queryClient.invalidateQueries({ queryKey: LINKED_WALLET_DISCOVERY_KEY });
    },
    [queryClient],
  );

  return { data: data ?? EMPTY, isLoading: enabled && isLoading, refetch };
}
