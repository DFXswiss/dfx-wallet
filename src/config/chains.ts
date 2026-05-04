import type { NetworkConfigs } from '@tetherto/wdk-react-native-core';

export type ChainId = 'ethereum' | 'arbitrum' | 'polygon' | 'spark' | 'plasma' | 'sepolia';

type ChainConfig = {
  chainId: number;
  blockchain: string;
  provider?: string;
  bundlerUrl?: string;
  paymasterUrl?: string;
  paymasterAddress?: string;
  paymasterToken?: { address: string };
  entryPointAddress?: string;
  safeModulesVersion?: string;
  transferMaxFee?: number;
  network?: 'MAINNET' | 'TESTNET' | 'REGTEST';
};

const CANDIDE_PAYMASTER_ADDRESS = '0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba';
const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const SAFE_MODULES_VERSION = '0.3.0';

export const getNetworkConfigs = (): NetworkConfigs => {
  const configs: Record<string, ChainConfig> = {
    ethereum: {
      chainId: 1,
      blockchain: 'ethereum',
      provider: process.env.EXPO_PUBLIC_ETH_RPC_URL ?? 'https://eth.merkle.io',
      bundlerUrl: 'https://api.candide.dev/public/v3/ethereum',
      paymasterUrl: 'https://api.candide.dev/public/v3/ethereum',
      paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
      entryPointAddress: ENTRY_POINT_ADDRESS,
      safeModulesVersion: SAFE_MODULES_VERSION,
      paymasterToken: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
      transferMaxFee: 100000,
    },
    arbitrum: {
      chainId: 42161,
      blockchain: 'arbitrum',
      provider: process.env.EXPO_PUBLIC_ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
      bundlerUrl: 'https://api.candide.dev/public/v3/arbitrum',
      paymasterUrl: 'https://api.candide.dev/public/v3/arbitrum',
      paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
      entryPointAddress: ENTRY_POINT_ADDRESS,
      safeModulesVersion: SAFE_MODULES_VERSION,
      paymasterToken: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
      transferMaxFee: 100000,
    },
    polygon: {
      chainId: 137,
      blockchain: 'polygon',
      provider: process.env.EXPO_PUBLIC_POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
      bundlerUrl: 'https://api.candide.dev/public/v3/polygon',
      paymasterUrl: 'https://api.candide.dev/public/v3/polygon',
      paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
      entryPointAddress: ENTRY_POINT_ADDRESS,
      safeModulesVersion: SAFE_MODULES_VERSION,
      paymasterToken: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
      transferMaxFee: 100000,
    },
    spark: {
      chainId: 99999,
      blockchain: 'spark',
      network: 'MAINNET',
    },
    plasma: {
      chainId: 9745,
      blockchain: 'plasma',
      provider: process.env.EXPO_PUBLIC_PLASMA_RPC_URL ?? 'https://rpc.plasma.to',
      bundlerUrl: 'https://api.candide.dev/public/v3/9745',
      paymasterUrl: 'https://api.candide.dev/public/v3/9745',
      paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
      entryPointAddress: ENTRY_POINT_ADDRESS,
      safeModulesVersion: SAFE_MODULES_VERSION,
      transferMaxFee: 100000,
    },
    sepolia: {
      chainId: 11155111,
      blockchain: 'sepolia',
      provider: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co',
      bundlerUrl: 'https://api.candide.dev/public/v3/sepolia',
      paymasterUrl: 'https://api.candide.dev/public/v3/sepolia',
      paymasterAddress: CANDIDE_PAYMASTER_ADDRESS,
      entryPointAddress: ENTRY_POINT_ADDRESS,
      safeModulesVersion: SAFE_MODULES_VERSION,
      paymasterToken: { address: '0xd077a400968890eacc75cdc901f0356c943e4fdb' },
      transferMaxFee: 500000,
    },
  };
  return configs as unknown as NetworkConfigs;
};

export const CHAINS_CONFIG = getNetworkConfigs();
