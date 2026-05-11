import type { ChainId } from './chains';

/**
 * Curated list of ERC-20 tokens we scan for on every linked DFX wallet's
 * supported chains. The Portfolio's linked-wallet rail surfaces a card per
 * wallet with the fiat sum of *all* holdings the on-chain scan finds in
 * this list, the linked-wallet detail screen lists each non-zero entry
 * with its CoinGecko-derived price.
 *
 * Selection rationale:
 *   - Every entry must have a CoinGecko listing (the user's spec) — the
 *     `coingeckoId` is the `id` field of `/coins/list`.
 *   - Top-of-market-cap tokens per chain, plus the DFX-flagship
 *     stablecoins (ZCHF, dEURO) so a wallet linked specifically for
 *     buying those isn't reported as empty.
 *   - Wrapped BTC variants (WBTC, cbBTC) so a BTC-on-EVM holding shows
 *     up under the same wallet card it actually lives on.
 *   - Polygon and Base native gas tokens (POL, ETH) live in
 *     `tokens.ts` already; this file is contracts only.
 *
 * Update process: add new entries; if a token's CoinGecko ID drifts
 * (e.g. the matic-network → polygon-ecosystem-token migration), fix it
 * here AND in `pricing-service.ts`'s `COINGECKO_IDS` so the price
 * lookup stays consistent.
 */
export type DiscoverableToken = {
  chain: ChainId;
  symbol: string;
  name: string;
  /** ERC-20 contract address (checksummed or lowercase — both accepted). */
  contract: string;
  decimals: number;
  /** Matches a coin in /coins/list — required for the price lookup. */
  coingeckoId: string;
};

export const DISCOVERABLE_TOKENS: DiscoverableToken[] = [
  // -------- Ethereum --------
  {
    chain: 'ethereum',
    symbol: 'USDT',
    name: 'Tether USD',
    contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    coingeckoId: 'tether',
  },
  {
    chain: 'ethereum',
    symbol: 'USDC',
    name: 'USD Coin',
    contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    coingeckoId: 'usd-coin',
  },
  {
    chain: 'ethereum',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    contract: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    coingeckoId: 'dai',
  },
  {
    chain: 'ethereum',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    contract: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
  },
  {
    chain: 'ethereum',
    symbol: 'LINK',
    name: 'Chainlink',
    contract: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    decimals: 18,
    coingeckoId: 'chainlink',
  },
  {
    chain: 'ethereum',
    symbol: 'UNI',
    name: 'Uniswap',
    contract: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    decimals: 18,
    coingeckoId: 'uniswap',
  },
  {
    chain: 'ethereum',
    symbol: 'AAVE',
    name: 'Aave',
    contract: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    decimals: 18,
    coingeckoId: 'aave',
  },
  {
    chain: 'ethereum',
    symbol: 'MKR',
    name: 'Maker',
    contract: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    decimals: 18,
    coingeckoId: 'maker',
  },
  {
    chain: 'ethereum',
    symbol: 'SHIB',
    name: 'Shiba Inu',
    contract: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    decimals: 18,
    coingeckoId: 'shiba-inu',
  },
  {
    chain: 'ethereum',
    symbol: 'PEPE',
    name: 'Pepe',
    contract: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    decimals: 18,
    coingeckoId: 'pepe',
  },
  {
    chain: 'ethereum',
    symbol: 'LDO',
    name: 'Lido DAO',
    contract: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
    decimals: 18,
    coingeckoId: 'lido-dao',
  },
  {
    chain: 'ethereum',
    symbol: 'CRV',
    name: 'Curve DAO',
    contract: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    decimals: 18,
    coingeckoId: 'curve-dao-token',
  },
  {
    chain: 'ethereum',
    symbol: 'ZCHF',
    name: 'Frankencoin',
    contract: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
    decimals: 18,
    coingeckoId: 'frankencoin',
  },
  {
    chain: 'ethereum',
    symbol: 'dEURO',
    name: 'Decentralized Euro',
    contract: '0x1aB4973a48dc892Cd9971ECE8e01DcC7688f8F23',
    decimals: 18,
    coingeckoId: 'decentralized-euro',
  },
  {
    chain: 'ethereum',
    symbol: 'MATIC',
    name: 'Polygon (POL)',
    contract: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    decimals: 18,
    coingeckoId: 'polygon-ecosystem-token',
  },
  {
    chain: 'ethereum',
    symbol: 'XAUT',
    name: 'Tether Gold',
    contract: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
    decimals: 6,
    coingeckoId: 'tether-gold',
  },
  {
    chain: 'ethereum',
    symbol: 'ONDO',
    name: 'Ondo Finance',
    contract: '0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3',
    decimals: 18,
    coingeckoId: 'ondo-finance',
  },
  {
    chain: 'ethereum',
    symbol: 'ENS',
    name: 'Ethereum Name Service',
    contract: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72',
    decimals: 18,
    coingeckoId: 'ethereum-name-service',
  },
  {
    chain: 'ethereum',
    symbol: 'ARB',
    name: 'Arbitrum',
    contract: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1',
    decimals: 18,
    coingeckoId: 'arbitrum',
  },
  {
    chain: 'ethereum',
    symbol: 'GRT',
    name: 'The Graph',
    contract: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7',
    decimals: 18,
    coingeckoId: 'the-graph',
  },
  {
    chain: 'ethereum',
    symbol: 'RNDR',
    name: 'Render',
    contract: '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24',
    decimals: 18,
    coingeckoId: 'render-token',
  },
  {
    chain: 'ethereum',
    symbol: 'INJ',
    name: 'Injective',
    contract: '0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30',
    decimals: 18,
    coingeckoId: 'injective-protocol',
  },
  {
    chain: 'ethereum',
    symbol: 'MNT',
    name: 'Mantle',
    contract: '0x3c3a81e81dc49A522A592e7622A7E711c06bf354',
    decimals: 18,
    coingeckoId: 'mantle',
  },
  {
    chain: 'ethereum',
    symbol: 'FET',
    name: 'Fetch.ai',
    contract: '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85',
    decimals: 18,
    coingeckoId: 'fetch-ai',
  },
  {
    chain: 'ethereum',
    symbol: 'IMX',
    name: 'Immutable',
    contract: '0xF57e7e7C23978C3cAEC3C3548E3D615c346e79fF',
    decimals: 18,
    coingeckoId: 'immutable-x',
  },
  {
    chain: 'ethereum',
    symbol: 'STETH',
    name: 'Lido Staked ETH',
    contract: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    decimals: 18,
    coingeckoId: 'staked-ether',
  },
  {
    chain: 'ethereum',
    symbol: 'WSTETH',
    name: 'Wrapped Lido Staked ETH',
    contract: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
    decimals: 18,
    coingeckoId: 'wrapped-steth',
  },
  {
    chain: 'ethereum',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    contract: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    coingeckoId: 'weth',
  },
  {
    chain: 'ethereum',
    symbol: 'PYUSD',
    name: 'PayPal USD',
    contract: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    decimals: 6,
    coingeckoId: 'paypal-usd',
  },

  // -------- Arbitrum --------
  {
    chain: 'arbitrum',
    symbol: 'USDT',
    name: 'Tether USD',
    contract: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
    coingeckoId: 'tether',
  },
  {
    chain: 'arbitrum',
    symbol: 'USDC',
    name: 'USD Coin',
    contract: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
    coingeckoId: 'usd-coin',
  },
  {
    chain: 'arbitrum',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    contract: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    decimals: 18,
    coingeckoId: 'dai',
  },
  {
    chain: 'arbitrum',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    contract: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
  },
  {
    chain: 'arbitrum',
    symbol: 'ARB',
    name: 'Arbitrum',
    contract: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    decimals: 18,
    coingeckoId: 'arbitrum',
  },
  {
    chain: 'arbitrum',
    symbol: 'LINK',
    name: 'Chainlink',
    contract: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    decimals: 18,
    coingeckoId: 'chainlink',
  },
  {
    chain: 'arbitrum',
    symbol: 'UNI',
    name: 'Uniswap',
    contract: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
    decimals: 18,
    coingeckoId: 'uniswap',
  },
  {
    chain: 'arbitrum',
    symbol: 'GMX',
    name: 'GMX',
    contract: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    decimals: 18,
    coingeckoId: 'gmx',
  },
  {
    chain: 'arbitrum',
    symbol: 'ZCHF',
    name: 'Frankencoin',
    contract: '0xB33c4255938de7A6ec1200d397B2b2F329397F9B',
    decimals: 18,
    coingeckoId: 'frankencoin',
  },
  {
    chain: 'arbitrum',
    symbol: 'dEURO',
    name: 'Decentralized Euro',
    contract: '0x65FD03ec212c7506E37D27D5b13fF0B5b6e3F5cd',
    decimals: 18,
    coingeckoId: 'decentralized-euro',
  },
  {
    chain: 'arbitrum',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    contract: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    coingeckoId: 'weth',
  },
  {
    chain: 'arbitrum',
    symbol: 'PENDLE',
    name: 'Pendle',
    contract: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8',
    decimals: 18,
    coingeckoId: 'pendle',
  },
  {
    chain: 'arbitrum',
    symbol: 'RDNT',
    name: 'Radiant Capital',
    contract: '0x3082CC23568eA640225c2467653dB90e9250AaA0',
    decimals: 18,
    coingeckoId: 'radiant-capital',
  },

  // -------- Polygon --------
  {
    chain: 'polygon',
    symbol: 'USDT',
    name: 'Tether USD',
    contract: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    decimals: 6,
    coingeckoId: 'tether',
  },
  {
    chain: 'polygon',
    symbol: 'USDC',
    name: 'USD Coin',
    contract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimals: 6,
    coingeckoId: 'usd-coin',
  },
  {
    chain: 'polygon',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    contract: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    decimals: 18,
    coingeckoId: 'dai',
  },
  {
    chain: 'polygon',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    contract: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
  },
  {
    chain: 'polygon',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    contract: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    decimals: 18,
    coingeckoId: 'weth',
  },
  {
    chain: 'polygon',
    symbol: 'LINK',
    name: 'Chainlink',
    contract: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
    decimals: 18,
    coingeckoId: 'chainlink',
  },
  {
    chain: 'polygon',
    symbol: 'AAVE',
    name: 'Aave',
    contract: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
    decimals: 18,
    coingeckoId: 'aave',
  },
  {
    chain: 'polygon',
    symbol: 'ZCHF',
    name: 'Frankencoin',
    contract: '0x02567e4b14b25549331fCEe2B56c647A8bAB16FD',
    decimals: 18,
    coingeckoId: 'frankencoin',
  },
  {
    chain: 'polygon',
    symbol: 'dEURO',
    name: 'Decentralized Euro',
    contract: '0xAEF3d4c41995ee65d24d7e1deF31E25c14a5b9D6',
    decimals: 18,
    coingeckoId: 'decentralized-euro',
  },
  {
    chain: 'polygon',
    symbol: 'CRV',
    name: 'Curve DAO',
    contract: '0x172370d5Cd63279eFa6d502DAB29171933a610AF',
    decimals: 18,
    coingeckoId: 'curve-dao-token',
  },
  {
    chain: 'polygon',
    symbol: 'UNI',
    name: 'Uniswap',
    contract: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
    decimals: 18,
    coingeckoId: 'uniswap',
  },

  // -------- Base --------
  {
    chain: 'base',
    symbol: 'USDC',
    name: 'USD Coin',
    contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    coingeckoId: 'usd-coin',
  },
  {
    chain: 'base',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    contract: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    coingeckoId: 'dai',
  },
  {
    chain: 'base',
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    contract: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    decimals: 8,
    coingeckoId: 'coinbase-wrapped-btc',
  },
  {
    chain: 'base',
    symbol: 'AERO',
    name: 'Aerodrome',
    contract: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    decimals: 18,
    coingeckoId: 'aerodrome-finance',
  },
  {
    chain: 'base',
    symbol: 'ZCHF',
    name: 'Frankencoin',
    contract: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
    decimals: 18,
    coingeckoId: 'frankencoin',
  },
  {
    chain: 'base',
    symbol: 'dEURO',
    name: 'Decentralized Euro',
    contract: '0x4F8730E0b32B04beaa5757e5aea3aeF970E5B613',
    decimals: 18,
    coingeckoId: 'decentralized-euro',
  },
  {
    chain: 'base',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    contract: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    coingeckoId: 'weth',
  },
  {
    chain: 'base',
    symbol: 'BRETT',
    name: 'Brett',
    contract: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
    decimals: 18,
    coingeckoId: 'based-brett',
  },
  {
    chain: 'base',
    symbol: 'DEGEN',
    name: 'Degen',
    contract: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    decimals: 18,
    coingeckoId: 'degen-base',
  },
  {
    chain: 'base',
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    contract: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    decimals: 18,
    coingeckoId: 'coinbase-wrapped-staked-eth',
  },
  {
    chain: 'base',
    symbol: 'USDT',
    name: 'Tether USD',
    contract: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimals: 6,
    coingeckoId: 'tether',
  },
];

/**
 * Group the curated list by chain for easy iteration during a balance
 * scan. Computed once at module load to keep the `useLinkedWalletDiscovery`
 * hot path free of `Array.filter` allocations.
 */
export const DISCOVERABLE_TOKENS_BY_CHAIN: ReadonlyMap<ChainId, DiscoverableToken[]> = (() => {
  const map = new Map<ChainId, DiscoverableToken[]>();
  for (const token of DISCOVERABLE_TOKENS) {
    const list = map.get(token.chain);
    if (list) list.push(token);
    else map.set(token.chain, [token]);
  }
  return map;
})();

/** Unique CoinGecko IDs across every chain — used to pre-warm pricing. */
export const DISCOVERABLE_COINGECKO_IDS: string[] = Array.from(
  new Set(DISCOVERABLE_TOKENS.map((t) => t.coingeckoId)),
);
