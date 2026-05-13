import { BaseAsset, type IAsset } from '@tetherto/wdk-react-native-core';
import type { ChainId } from './chains';

export type TokenCategory = 'btc' | 'stablecoin' | 'native' | 'other';

/**
 * Where the app loads an asset’s on-chain balance. The coordinator in
 * `src/services/balances` routes each asset to the source matching its
 * strategy; swapping a strategy's implementation (e.g. moving EVM from
 * direct RPC to WDK) is a change inside that source, not here.
 *
 * - `wdk`  — WDK worklet (Bitcoin variants, Spark/Lightning).
 * - `evm`  — Direct EVM JSON-RPC fetcher (native + ERC-20 balanceOf).
 * - `none` — Not fetched.
 */
export type BalanceFetchStrategy = 'wdk' | 'evm' | 'none';

/** EVM-family chains. Assets on these chains default to the `evm` strategy. */
export const EVM_CHAINS: ChainId[] = [
  'ethereum',
  'arbitrum',
  'polygon',
  'base',
  'plasma',
  'sepolia',
];

/** BTC-family chains. Assets on these chains default to the `wdk` strategy. */
export const BTC_CHAINS: ChainId[] = ['bitcoin', 'bitcoin-taproot', 'spark'];

const defaultStrategyForChain = (network: ChainId): BalanceFetchStrategy =>
  EVM_CHAINS.includes(network) ? 'evm' : 'wdk';

type AssetSpec = {
  network: ChainId;
  symbol: string;
  canonicalSymbol: string;
  canonicalName: string;
  name: string;
  decimals: number;
  isNative: boolean;
  category: TokenCategory;
  address?: string | null;
  defaultEnabled?: boolean;
  /** Defaults to `wdk` when omitted. */
  balanceFetchStrategy?: BalanceFetchStrategy;
};

const ASSET_SPECS: AssetSpec[] = [
  // Bitcoin variants — canonical 'BTC'
  {
    network: 'bitcoin',
    symbol: 'BTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Bitcoin (SegWit)',
    decimals: 8,
    isNative: true,
    category: 'btc',
    defaultEnabled: true,
  },
  {
    network: 'bitcoin-taproot',
    symbol: 'BTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Bitcoin (Taproot)',
    decimals: 8,
    isNative: true,
    category: 'btc',
    defaultEnabled: true,
  },
  {
    network: 'spark',
    symbol: 'BTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Bitcoin (Lightning)',
    decimals: 8,
    isNative: true,
    category: 'btc',
    defaultEnabled: true,
  },
  {
    network: 'ethereum',
    symbol: 'WBTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    isNative: false,
    category: 'btc',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    defaultEnabled: true,
  },
  {
    network: 'arbitrum',
    symbol: 'WBTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    isNative: false,
    category: 'btc',
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    defaultEnabled: true,
  },
  {
    network: 'polygon',
    symbol: 'WBTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    isNative: false,
    category: 'btc',
    address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    defaultEnabled: true,
  },
  {
    network: 'base',
    symbol: 'cbBTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Coinbase Wrapped BTC',
    decimals: 8,
    isNative: false,
    category: 'btc',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    defaultEnabled: true,
  },

  // Ethereum native (used for gas)
  {
    network: 'ethereum',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Ethereum',
    decimals: 18,
    isNative: true,
    category: 'native',
    defaultEnabled: true,
  },

  // Dollar (USD) — USDT + USDC across EVMs
  {
    network: 'ethereum',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDT',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    defaultEnabled: true,
  },
  {
    network: 'ethereum',
    symbol: 'USDC',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDC',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xA0b86991c6218a36c1d19D4a2e9Eb0cE3606eB48',
    defaultEnabled: true,
  },
  {
    network: 'arbitrum',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDT',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    defaultEnabled: true,
  },
  {
    network: 'arbitrum',
    symbol: 'USDC',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDC',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  {
    network: 'polygon',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDT',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    defaultEnabled: true,
  },
  {
    network: 'polygon',
    symbol: 'USDC',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDC',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0x3c499c542cEF5E3811e1192cE70d8cC03d5c3359',
  },
  {
    network: 'base',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDT',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    defaultEnabled: true,
  },
  {
    network: 'base',
    symbol: 'USDC',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDC',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },

  // Frankencoin (CHF) — Ethereum confirmed; L2 contracts pending
  {
    network: 'ethereum',
    symbol: 'ZCHF',
    canonicalSymbol: 'CHF',
    canonicalName: 'CHF',
    name: 'Frankencoin',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
    defaultEnabled: true,
  },
  {
    network: 'arbitrum',
    symbol: 'ZCHF',
    canonicalSymbol: 'CHF',
    canonicalName: 'CHF',
    name: 'Frankencoin',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xd4DD9e2F021bB459d5A5F6C24c12FE09c5d45553',
  },
  {
    network: 'polygon',
    symbol: 'ZCHF',
    canonicalSymbol: 'CHF',
    canonicalName: 'CHF',
    name: 'Frankencoin',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xd4DD9e2F021bB459d5A5F6C24c12FE09c5d45553',
  },
  {
    network: 'base',
    symbol: 'ZCHF',
    canonicalSymbol: 'CHF',
    canonicalName: 'CHF',
    name: 'Frankencoin',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xd4DD9e2F021bB459d5A5F6C24c12FE09c5d45553',
  },

  // dEURO (EUR)
  {
    network: 'ethereum',
    symbol: 'dEURO',
    canonicalSymbol: 'EUR',
    canonicalName: 'Euro',
    name: 'dEURO',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xbA3f535bbCcCcA2A154b573Ca6c5A49BAAE0a3ea',
    defaultEnabled: true,
  },
  {
    network: 'arbitrum',
    symbol: 'dEURO',
    canonicalSymbol: 'EUR',
    canonicalName: 'Euro',
    name: 'dEURO',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0x5e85fAf503621830CA857a5f38B982E0cc57D537',
  },
  {
    network: 'polygon',
    symbol: 'dEURO',
    canonicalSymbol: 'EUR',
    canonicalName: 'Euro',
    name: 'dEURO',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xC2ff25dD99e467d2589b2c26EDd270F220F14E47',
  },
  {
    network: 'base',
    symbol: 'dEURO',
    canonicalSymbol: 'EUR',
    canonicalName: 'Euro',
    name: 'dEURO',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0x1B5F7fA46ED0F487F049C42f374cA4827d65A264',
  },

  // Arbitrum / Polygon / Base native (for gas display)
  {
    network: 'arbitrum',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Ethereum (Arbitrum)',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'polygon',
    symbol: 'MATIC',
    canonicalSymbol: 'MATIC',
    canonicalName: 'Polygon',
    name: 'Polygon',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'base',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Ethereum (Base)',
    decimals: 18,
    isNative: true,
    category: 'native',
  },

  // Test / experimental networks
  {
    network: 'plasma',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Ethereum (Plasma)',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'sepolia',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Sepolia ETH',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'sepolia',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USDT',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
  },
];

const buildId = (spec: Pick<AssetSpec, 'network' | 'isNative' | 'address'>): string =>
  spec.isNative ? `${spec.network}-native` : `${spec.network}-${spec.address?.toLowerCase()}`;

/** Always-on networks shown to the user as non-toggleable in the manage UI. */
export const ALWAYS_ON_CHAINS: ChainId[] = ['ethereum', 'bitcoin'];

/**
 * Networks that are always implicitly enabled but never appear in the
 * manage UI. Lightning + Taproot ride along with Bitcoin as transport /
 * address-type variants rather than user-facing chain choices — exposing
 * them as separate rows in the manage UI is noise.
 */
export const IMPLICIT_ENABLED_CHAINS: ChainId[] = ['spark', 'bitcoin-taproot'];

// Chains the WDK worklet bundle currently knows about. Anything outside this
// set is shown in the portfolio but skipped when querying live balances so
// `useBalancesForWallet` doesn't error with "no wallet manager for network".
export const WDK_SUPPORTED_CHAINS: ChainId[] = [
  'ethereum',
  'arbitrum',
  'polygon',
  'base',
  'spark',
  'bitcoin',
  'plasma',
  'sepolia',
];

/** Networks that the user can toggle on or off. */
export const SELECTABLE_CHAINS: ChainId[] = ['arbitrum', 'polygon', 'base'];

/** Initial set of enabled chains for a fresh install. */
export const DEFAULT_ENABLED_CHAINS: ChainId[] = Array.from(
  new Set([...ALWAYS_ON_CHAINS, ...IMPLICIT_ENABLED_CHAINS]),
);

export type AssetMeta = {
  id: string;
  network: ChainId;
  symbol: string;
  canonicalSymbol: string;
  canonicalName: string;
  name: string;
  decimals: number;
  isNative: boolean;
  category: TokenCategory;
  address?: string | null;
  balanceFetchStrategy: BalanceFetchStrategy;
};

const ASSET_META_BY_ID = new Map<string, AssetMeta>(
  ASSET_SPECS.map((spec) => [
    buildId(spec),
    {
      id: buildId(spec),
      network: spec.network,
      symbol: spec.symbol,
      canonicalSymbol: spec.canonicalSymbol,
      canonicalName: spec.canonicalName,
      name: spec.name,
      decimals: spec.decimals,
      isNative: spec.isNative,
      category: spec.category,
      address: spec.address ?? null,
      balanceFetchStrategy: spec.balanceFetchStrategy ?? defaultStrategyForChain(spec.network),
    },
  ]),
);

export const getAssetMeta = (assetId: string): AssetMeta | undefined =>
  ASSET_META_BY_ID.get(assetId);

/** Assets to pass into `useBalancesForWallet` (WDK balance fetch). */
export const assetIncludedInWdkBalanceQuery = (asset: IAsset): boolean => {
  const meta = getAssetMeta(asset.getId());
  if (!meta) return false;
  if (meta.balanceFetchStrategy !== 'wdk') return false;
  return WDK_SUPPORTED_CHAINS.includes(meta.network);
};

/** Assets the EVM JSON-RPC source should fetch. */
export const assetIncludedInEvmBalanceQuery = (asset: IAsset): boolean => {
  const meta = getAssetMeta(asset.getId());
  if (!meta) return false;
  return meta.balanceFetchStrategy === 'evm';
};

export const getCategoryForAsset = (assetId: string): TokenCategory =>
  ASSET_META_BY_ID.get(assetId)?.category ?? 'other';

export const getAssetsForCanonicalSymbol = (symbol: string, chains?: ChainId[]): AssetMeta[] => {
  // Wrapped BTC variants follow the user's chain selection (e.g. WBTC/Polygon
  // hides when Polygon is off). Only the BTC-native chains (mainnet + Lightning)
  // are always implicitly included via IMPLICIT_ENABLED_CHAINS in useEnabledChains.
  const filtered = chains
    ? ASSET_SPECS.filter((spec) => chains.includes(spec.network))
    : ASSET_SPECS;
  return filtered
    .filter((spec) => spec.canonicalSymbol === symbol)
    .map((spec) => ({
      id: buildId(spec),
      network: spec.network,
      symbol: spec.symbol,
      canonicalSymbol: spec.canonicalSymbol,
      canonicalName: spec.canonicalName,
      name: spec.name,
      decimals: spec.decimals,
      isNative: spec.isNative,
      category: spec.category,
      address: spec.address ?? null,
      balanceFetchStrategy: spec.balanceFetchStrategy ?? defaultStrategyForChain(spec.network),
    }));
};

/**
 * Map a token symbol (e.g. "USDC", "WBTC", "ZCHF") to its canonical group
 * symbol (USD, BTC, CHF, EUR). Fiat tickers (CHF/EUR/USD) map to themselves
 * so callers can pass any TX asset symbol and get something usable for
 * fiat conversion.
 */
export const getCanonicalForSymbol = (symbol: string): string | undefined => {
  if (symbol === 'CHF' || symbol === 'EUR' || symbol === 'USD') return symbol;
  return ASSET_SPECS.find((spec) => spec.symbol === symbol)?.canonicalSymbol;
};

export const getCanonicalNameForSymbol = (canonicalSymbol: string): string =>
  ASSET_SPECS.find((spec) => spec.canonicalSymbol === canonicalSymbol)?.canonicalName ??
  canonicalSymbol;

export const getCategoryForCanonicalSymbol = (canonicalSymbol: string): TokenCategory =>
  ASSET_SPECS.find((spec) => spec.canonicalSymbol === canonicalSymbol)?.category ?? 'other';

export const getAssets = (chains?: ChainId[]): IAsset[] => {
  // Wrapped BTC on EVM chains follows the user's chain selection, so disabling
  // Polygon hides WBTC/Polygon. Only the BTC-native chains (mainnet + Lightning)
  // are always implicitly included via IMPLICIT_ENABLED_CHAINS in useEnabledChains.
  const filtered = chains
    ? ASSET_SPECS.filter((spec) => chains.includes(spec.network))
    : ASSET_SPECS;
  return filtered.map(
    (spec) =>
      new BaseAsset({
        id: buildId(spec),
        network: spec.network,
        symbol: spec.symbol,
        name: spec.name,
        decimals: spec.decimals,
        isNative: spec.isNative,
        address: spec.address ?? null,
      }),
  );
};

export const getNativeAsset = (network: string): IAsset | undefined =>
  getAssets().find((asset) => asset.getNetwork() === network && asset.isNative());

/**
 * Resolve the actual `IAsset` to send when the user has picked a canonical
 * symbol (USD/CHF/EUR/BTC) and a chain. The send screen exposes the symbol
 * grouping rather than every concrete token, so this is where we map back.
 *
 * For USD on EVM chains, USDT wins over USDC because USDT has `defaultEnabled`
 * everywhere it exists and aligns with the wallet's primary stable.
 */
export const getSendAssetForCanonical = (
  canonicalSymbol: string,
  chain: ChainId,
): IAsset | undefined => {
  const candidates = getAssets([chain]).filter(
    (asset) => getAssetMeta(asset.getId())?.canonicalSymbol === canonicalSymbol,
  );
  if (candidates.length === 0) return undefined;
  if (canonicalSymbol === 'USD') {
    const usdt = candidates.find((asset) => getAssetMeta(asset.getId())?.symbol === 'USDT');
    if (usdt) return usdt;
  }
  return candidates[0];
};
