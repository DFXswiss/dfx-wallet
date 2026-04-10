export const CHAINS_CONFIG = {
  bitcoin: {
    host: 'electrum.blockstream.info',
    port: 50002,
  },
  ethereum: {
    chainId: 1,
    blockchain: 'ethereum',
    provider: process.env.EXPO_PUBLIC_ETH_RPC_URL ?? 'https://eth.drpc.org',
  },
  arbitrum: {
    chainId: 42161,
    blockchain: 'arbitrum',
    provider: process.env.EXPO_PUBLIC_ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
  },
  polygon: {
    chainId: 137,
    blockchain: 'polygon',
    provider: process.env.EXPO_PUBLIC_POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
  },
  optimism: {
    chainId: 10,
    blockchain: 'optimism',
    provider: process.env.EXPO_PUBLIC_OPTIMISM_RPC_URL ?? 'https://mainnet.optimism.io',
  },
  base: {
    chainId: 8453,
    blockchain: 'base',
    provider: process.env.EXPO_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org',
  },
} as const;

export type ChainId = keyof typeof CHAINS_CONFIG;
