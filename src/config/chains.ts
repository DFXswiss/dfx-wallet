import type { WdkConfigs } from '@tetherto/wdk-react-native-core';

export type ChainId =
  | 'ethereum'
  | 'arbitrum'
  | 'polygon'
  | 'base'
  | 'spark'
  | 'plasma'
  | 'sepolia'
  | 'bitcoin';

const CANDIDE_PAYMASTER_ADDRESS = '0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba';
const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const SAFE_MODULES_VERSION = '0.3.0';

export const getWdkConfigs = (): WdkConfigs => ({
  networks: {
    ethereum: {
      blockchain: 'ethereum',
      config: {
        chainId: 1,
        provider: process.env.EXPO_PUBLIC_ETH_RPC_URL ?? 'https://eth.merkle.io',
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
        provider: process.env.EXPO_PUBLIC_ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
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
        provider: process.env.EXPO_PUBLIC_POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
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
        provider: process.env.EXPO_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org',
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
        provider: process.env.EXPO_PUBLIC_PLASMA_RPC_URL ?? 'https://rpc.plasma.to',
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
        provider: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co',
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
