import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEvmRpcUrl, type ChainId } from '@/config/chains';
import { computeFiatValue, formatBalance, toNumeric } from '@/config/portfolio-presentation';
import { getAssets, getAssetMeta } from '@/config/tokens';
import { fetchBtcBalance } from '@/services/balances/btc-fetcher';
import { EvmBalanceFetcher, type EvmAssetSpec } from '@/services/balances/evm-fetcher';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';
import type { FiatCurrency } from '@/services/pricing-service';

const sharedFetcher = new EvmBalanceFetcher(getEvmRpcUrl);

/**
 * Map DFX' blockchain identifiers (`Ethereum`, `Bitcoin`, …) to the local
 * `ChainId` literals used everywhere else in the wallet. Lightning, Spark
 * and Monero are intentionally absent — those need bespoke balance APIs
 * that aren't worth the integration cost for the v1 portfolio rail.
 */
const BLOCKCHAIN_TO_CHAIN: Record<string, ChainId> = {
  Ethereum: 'ethereum',
  Arbitrum: 'arbitrum',
  Polygon: 'polygon',
  Base: 'base',
  Bitcoin: 'bitcoin',
};

const STALE_TIME_MS = 15_000;
const REFETCH_INTERVAL_MS = 30_000;
const EMPTY: ReadonlyMap<string, LinkedWalletBalance> = new Map();

export type LinkedWalletBalance = {
  /** Sum of fiat-converted balances across this wallet's app-supported
   *  assets (BTC + stablecoins). `0` when nothing was held; `known: false`
   *  flags wallets we couldn't fetch (e.g. Lightning-only). */
  fiatValue: number;
  known: boolean;
};

type WalletKey = { address: string; blockchains: string[] };

/**
 * Pre-flight: convert a wallet's DFX `blockchains[]` into the EVM `ChainId`s
 * we should poll for ERC-20 balances, plus a `hasBtc` flag for the
 * mempool.space leg. Wallets that contain neither end up with an empty
 * spec list and the hook reports them as `known: false`.
 */
function planFetch(wallet: WalletKey): { evmChains: ChainId[]; hasBtc: boolean } {
  const seenChains = new Set<ChainId>();
  let hasBtc = false;
  for (const bc of wallet.blockchains) {
    // eslint-disable-next-line security/detect-object-injection -- BLOCKCHAIN_TO_CHAIN is a closed lookup; misses fall through to the `continue` branch
    const chain = BLOCKCHAIN_TO_CHAIN[bc];
    if (!chain) continue;
    if (chain === 'bitcoin') hasBtc = true;
    else seenChains.add(chain);
  }
  return { evmChains: Array.from(seenChains), hasBtc };
}

/**
 * Per-linked-wallet fiat-balance lookup. Powers two surfaces:
 *
 *   1. The Portfolio's "Linked DFX wallets" cards display the fiat sum.
 *   2. The Portfolio's "Gesamtwert" total folds in the selected wallets'
 *      sums on top of the user's own holdings — so a buy that landed at
 *      a different linked wallet still counts toward what the user reads
 *      as "their balance".
 *
 * Independent from `useBalances` (the local-WDK pipe) on purpose: we want
 * arbitrary addresses, no React-Native Bare Worklet round-trip, and our
 * own staleness window. EVM uses the same `EvmBalanceFetcher` as the
 * local pipe (one batched JSON-RPC POST per chain per wallet), so wallets
 * the user owns locally still yield the same numbers as the in-app cards.
 */
export function useLinkedWalletBalances(
  wallets: UserAddressDto[],
  fiatCurrency: FiatCurrency,
  pricingReady: boolean,
): { data: ReadonlyMap<string, LinkedWalletBalance>; isLoading: boolean } {
  const queryKey = useMemo(() => {
    const ids = wallets
      .map((w) => {
        const chains = (w.blockchains?.length ? w.blockchains : [w.blockchain]).slice().sort();
        return `${w.address.toLowerCase()}@${chains.join(',')}`;
      })
      .sort()
      .join('|');
    return ['balances', 'linked-wallets', ids, fiatCurrency, pricingReady] as const;
  }, [wallets, fiatCurrency, pricingReady]);

  const enabled = wallets.length > 0;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Map<string, LinkedWalletBalance>> => {
      const out = new Map<string, LinkedWalletBalance>();
      const allAssets = getAssets();

      const tasks = wallets.map(async (wallet) => {
        const blockchains = wallet.blockchains?.length ? wallet.blockchains : [wallet.blockchain];
        const plan = planFetch({ address: wallet.address, blockchains });
        // EVM RPCs are case-insensitive but the underlying smart contracts
        // and `eth_getBalance` parsers reject any whitespace, so normalise
        // once here. The DFX user payload occasionally returns addresses
        // with stray surrounding spaces.
        const cleanAddress = wallet.address.trim();
        const lc = cleanAddress.toLowerCase();

        let total = 0;
        let anyKnown = false;
        // Per-leg error sinks so a transient EVM hiccup still lets the BTC
        // leg's confirmed balance reach the UI (and vice-versa) instead of
        // collapsing the whole wallet to "—".
        const errors: string[] = [];

        if (plan.evmChains.length > 0) {
          const specs: EvmAssetSpec[] = [];
          for (const asset of allAssets) {
            const meta = getAssetMeta(asset.getId());
            if (!meta) continue;
            if (meta.balanceFetchStrategy !== 'evm') continue;
            // Sum *every* asset the user could be holding on the wallet's
            // chains — native gas tokens (ETH/POL/etc.) included. The main
            // Portfolio asset-cards hide natives because they're for fees,
            // but a linked-wallet card represents the wallet's total worth,
            // so leaving native ETH out would systematically underreport.
            if (!plan.evmChains.includes(meta.network)) continue;
            specs.push({
              assetId: asset.getId(),
              network: meta.network,
              isNative: meta.isNative,
              tokenAddress: meta.address ?? null,
            });
          }
          if (specs.length > 0) {
            try {
              const addressByChain = new Map(plan.evmChains.map((c) => [c, cleanAddress]));
              const result = await sharedFetcher.fetch(specs, addressByChain);
              let evmAnyOk = false;
              const evmErrors = new Set<string>();
              for (const spec of specs) {
                const r = result.get(spec.assetId);
                if (!r) continue;
                if (!('rawBalance' in r)) {
                  evmErrors.add(r.error);
                  continue;
                }
                const meta = getAssetMeta(spec.assetId);
                if (!meta) continue;
                const balanceNum = toNumeric(formatBalance(r.rawBalance, meta.decimals));
                total += computeFiatValue(
                  balanceNum,
                  meta.canonicalSymbol,
                  fiatCurrency,
                  pricingReady,
                );
                evmAnyOk = true;
                anyKnown = true;
              }
              if (!evmAnyOk && evmErrors.size > 0) {
                errors.push(`evm: ${Array.from(evmErrors).join('; ')}`);
              }
            } catch (err) {
              errors.push(`evm: ${err instanceof Error ? err.message : 'unknown'}`);
            }
          }
        }

        // BTC leg — mempool.space confirmed-balance endpoint.
        if (plan.hasBtc) {
          const r = await fetchBtcBalance(cleanAddress);
          if ('rawBalance' in r) {
            const balanceNum = toNumeric(formatBalance(r.rawBalance, 8));
            total += computeFiatValue(balanceNum, 'BTC', fiatCurrency, pricingReady);
            anyKnown = true;
          } else {
            errors.push(`btc: ${r.error}`);
          }
        }

        if (errors.length > 0) {
          // Surface in metro logs so we can diagnose RPC outages without
          // round-tripping a TestFlight build. Filtered by `LogBox.ignoreLogs`
          // would silence it; left as a plain console.warn so it always
          // appears.
          console.warn(`[linked-wallet-balances] ${cleanAddress}:`, errors.join(' · '));
        }

        out.set(lc, { fiatValue: total, known: anyKnown });
      });

      await Promise.all(tasks);
      return out;
    },
    enabled,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  return { data: data ?? EMPTY, isLoading: enabled && isLoading };
}
