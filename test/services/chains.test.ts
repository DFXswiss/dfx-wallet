import { getEvmRpcUrl, getPaymasterTokenInfo, getWdkConfigs } from '../../src/config/chains';

describe('getEvmRpcUrl', () => {
  // ENV overrides take precedence; the suite resets them around each test
  // so the public-default branch is reachable.
  const overrides = [
    'EXPO_PUBLIC_ETH_RPC_URL',
    'EXPO_PUBLIC_ARBITRUM_RPC_URL',
    'EXPO_PUBLIC_POLYGON_RPC_URL',
    'EXPO_PUBLIC_BASE_RPC_URL',
    'EXPO_PUBLIC_PLASMA_RPC_URL',
    'EXPO_PUBLIC_SEPOLIA_RPC_URL',
  ];
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of overrides) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns the PublicNode default for each EVM chain when no override is set', () => {
    expect(getEvmRpcUrl('ethereum')).toBe('https://ethereum-rpc.publicnode.com');
    expect(getEvmRpcUrl('arbitrum')).toBe('https://arbitrum-one-rpc.publicnode.com');
    expect(getEvmRpcUrl('polygon')).toBe('https://polygon-bor-rpc.publicnode.com');
    expect(getEvmRpcUrl('base')).toBe('https://base-rpc.publicnode.com');
    expect(getEvmRpcUrl('plasma')).toBe('https://rpc.plasma.to');
    expect(getEvmRpcUrl('sepolia')).toBe('https://sepolia.gateway.tenderly.co');
  });

  it('returns undefined for non-EVM chains', () => {
    expect(getEvmRpcUrl('bitcoin')).toBeUndefined();
    expect(getEvmRpcUrl('bitcoin-taproot')).toBeUndefined();
    expect(getEvmRpcUrl('spark')).toBeUndefined();
  });

  it('honours the EXPO_PUBLIC_<chain>_RPC_URL override', () => {
    process.env.EXPO_PUBLIC_ETH_RPC_URL = 'https://my-private.alchemy.example';
    expect(getEvmRpcUrl('ethereum')).toBe('https://my-private.alchemy.example');
  });
});

describe('getPaymasterTokenInfo', () => {
  it('returns USDT for the Candide-paymastered EVM chains', () => {
    expect(getPaymasterTokenInfo('ethereum')).toEqual({ symbol: 'USDT', decimals: 6 });
    expect(getPaymasterTokenInfo('arbitrum')).toEqual({ symbol: 'USDT', decimals: 6 });
    expect(getPaymasterTokenInfo('polygon')).toEqual({ symbol: 'USDT', decimals: 6 });
    expect(getPaymasterTokenInfo('sepolia')).toEqual({ symbol: 'USDT', decimals: 6 });
  });

  it('returns USDC for Base (the only chain with Candide-USDC paymaster)', () => {
    expect(getPaymasterTokenInfo('base')).toEqual({ symbol: 'USDC', decimals: 6 });
  });

  it('returns undefined for chains without an ERC-4337 paymaster', () => {
    expect(getPaymasterTokenInfo('plasma')).toBeUndefined();
    expect(getPaymasterTokenInfo('bitcoin')).toBeUndefined();
    expect(getPaymasterTokenInfo('bitcoin-taproot')).toBeUndefined();
    expect(getPaymasterTokenInfo('spark')).toBeUndefined();
  });
});

describe('getWdkConfigs', () => {
  it('produces one entry per supported chain', () => {
    const configs = getWdkConfigs();
    expect(Object.keys(configs.networks).sort()).toEqual(
      ['arbitrum', 'base', 'bitcoin', 'ethereum', 'plasma', 'polygon', 'sepolia', 'spark'].sort(),
    );
  });

  it('attaches a paymaster URL to every EVM chain', () => {
    const configs = getWdkConfigs();
    expect(configs.networks.ethereum?.config.paymasterUrl).toBeTruthy();
    expect(configs.networks.arbitrum?.config.paymasterUrl).toBeTruthy();
    expect(configs.networks.polygon?.config.paymasterUrl).toBeTruthy();
    expect(configs.networks.base?.config.paymasterUrl).toBeTruthy();
    expect(configs.networks.plasma?.config.paymasterUrl).toBeTruthy();
  });

  it('matches getEvmRpcUrl() for the EVM provider URL', () => {
    const configs = getWdkConfigs();
    expect(configs.networks.ethereum?.config.provider).toBe(getEvmRpcUrl('ethereum'));
    expect(configs.networks.base?.config.provider).toBe(getEvmRpcUrl('base'));
  });

  it('uses the Sepolia testnet chainId 11155111', () => {
    const configs = getWdkConfigs();
    expect(configs.networks.sepolia?.config.chainId).toBe(11155111);
  });
});
