import type { WdkConfigs } from '@tetherto/wdk-react-native-core';

export type ChainId =
  | 'ethereum'
  | 'arbitrum'
  | 'polygon'
  | 'base'
  | 'spark'
  | 'plasma'
  | 'sepolia'
  | 'bitcoin'
  | 'bitcoin-taproot';

const CANDIDE_PAYMASTER_ADDRESS = '0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba';
const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const SAFE_MODULES_VERSION = '0.3.0';

/**
 * EVM JSON-RPC endpoint per chain. Mirrors the `provider` field that the WDK
 * worklet reads from `getWdkConfigs()` so the direct-RPC balance fetcher and
 * the WDK stay on the same nodes. Returns undefined for non-EVM chains.
 */
export const getEvmRpcUrl = (network: ChainId): string | undefined => {
  switch (network) {
    // Defaults are PublicNode endpoints — they accept unauthenticated batched
    // JSON-RPC, which the official `eth.merkle.io` / `polygon-rpc.com`
    // endpoints reject (400 / 401). For production set
    // `EXPO_PUBLIC_<CHAIN>_RPC_URL` to a keyed provider (Alchemy / Infura /
    // QuickNode) to avoid PublicNode's shared rate limits.
    case 'ethereum':
      return process.env.EXPO_PUBLIC_ETH_RPC_URL ?? 'https://ethereum-rpc.publicnode.com';
    case 'arbitrum':
      return process.env.EXPO_PUBLIC_ARBITRUM_RPC_URL ?? 'https://arbitrum-one-rpc.publicnode.com';
    case 'polygon':
      return process.env.EXPO_PUBLIC_POLYGON_RPC_URL ?? 'https://polygon-bor-rpc.publicnode.com';
    case 'base':
      return process.env.EXPO_PUBLIC_BASE_RPC_URL ?? 'https://base-rpc.publicnode.com';
    case 'plasma':
      return process.env.EXPO_PUBLIC_PLASMA_RPC_URL ?? 'https://rpc.plasma.to';
    case 'sepolia':
      return process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';
    default:
      return undefined;
  }
};

export const getWdkConfigs = (): WdkConfigs => ({
  networks: {
    ethereum: {
      blockchain: 'ethereum',
      config: {
        chainId: 1,
        provider: getEvmRpcUrl('ethereum')!,
        bundlerUrl: 'https://api.candide.dev/public/v3/ethereum',
        paymasterUrl: 'https://api.candide.dev/public/v3/ethereum',
        paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
        entryPointAddress: ENTRY_POINT_ADDRESS,
        safeModulesVersion: SAFE_MODULES_VERSION,
        paymasterToken: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
        transferMaxFee: 100000,
      },
    },
    arbitrum: {
      blockchain: 'arbitrum',
      config: {
        chainId: 42161,
        provider: getEvmRpcUrl('arbitrum')!,
        bundlerUrl: 'https://api.candide.dev/public/v3/arbitrum',
        paymasterUrl: 'https://api.candide.dev/public/v3/arbitrum',
        paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
        entryPointAddress: ENTRY_POINT_ADDRESS,
        safeModulesVersion: SAFE_MODULES_VERSION,
        paymasterToken: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
        transferMaxFee: 100000,
      },
    },
    polygon: {
      blockchain: 'polygon',
      config: {
        chainId: 137,
        provider: getEvmRpcUrl('polygon')!,
        bundlerUrl: 'https://api.candide.dev/public/v3/polygon',
        paymasterUrl: 'https://api.candide.dev/public/v3/polygon',
        paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
        entryPointAddress: ENTRY_POINT_ADDRESS,
        safeModulesVersion: SAFE_MODULES_VERSION,
        paymasterToken: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
        transferMaxFee: 100000,
      },
    },
    base: {
      blockchain: 'base',
      config: {
        chainId: 8453,
        provider: getEvmRpcUrl('base')!,
        bundlerUrl: 'https://api.candide.dev/public/v3/base',
        paymasterUrl: 'https://api.candide.dev/public/v3/base',
        paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
        entryPointAddress: ENTRY_POINT_ADDRESS,
        safeModulesVersion: SAFE_MODULES_VERSION,
        paymasterToken: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
        transferMaxFee: 100000,
      },
    },
    spark: {
      blockchain: 'spark',
      config: {
        chainId: 99999,
        network: 'MAINNET',
      },
    },
    bitcoin: {
      blockchain: 'bitcoin',
      config: {
        chainId: 0,
        network: 'bitcoin',
        client: {
          type: 'electrum',
          clientConfig: {
            host: process.env.EXPO_PUBLIC_BTC_ELECTRUM_HOST ?? 'electrum.blockstream.info',
            port: Number(process.env.EXPO_PUBLIC_BTC_ELECTRUM_PORT ?? 50001),
          },
        },
      },
    },
    plasma: {
      blockchain: 'plasma',
      config: {
        chainId: 9745,
        provider: getEvmRpcUrl('plasma')!,
        bundlerUrl: 'https://api.candide.dev/public/v3/9745',
        paymasterUrl: 'https://api.candide.dev/public/v3/9745',
        paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
        entryPointAddress: ENTRY_POINT_ADDRESS,
        safeModulesVersion: SAFE_MODULES_VERSION,
        transferMaxFee: 100000,
      },
    },
    sepolia: {
      blockchain: 'sepolia',
      config: {
        chainId: 11155111,
        provider: getEvmRpcUrl('sepolia')!,
        bundlerUrl: 'https://api.candide.dev/public/v3/sepolia',
        paymasterUrl: 'https://api.candide.dev/public/v3/sepolia',
        paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
        entryPointAddress: ENTRY_POINT_ADDRESS,
        safeModulesVersion: SAFE_MODULES_VERSION,
        paymasterToken: { address: '0xd077a400968890eacc75cdc901f0356c943e4fdb' },
        transferMaxFee: 500000,
      },
    },
  },
});
