import { getAddress } from 'ethers';
import { getWdkConfigs } from '@/config/chains';
import { DISCOVERABLE_TOKENS } from '@/config/discoverable-tokens';
import { getAssetMeta, getAssets } from '@/config/tokens';

const TESTNET_NETWORKS = new Set(['sepolia']);
const CORRECTED_TOKEN_EXPECTATIONS = [
  {
    chain: 'ethereum',
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
  },
  {
    chain: 'polygon',
    symbol: 'USDC',
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimals: 6,
  },
  {
    chain: 'arbitrum',
    symbol: 'ZCHF',
    address: '0xD4dD9e2F021BB459D5A5f6c24C12fE09c5D45553',
    decimals: 18,
  },
  {
    chain: 'polygon',
    symbol: 'ZCHF',
    address: '0xD4dD9e2F021BB459D5A5f6c24C12fE09c5D45553',
    decimals: 18,
  },
  {
    chain: 'base',
    symbol: 'ZCHF',
    address: '0xD4dD9e2F021BB459D5A5f6c24C12fE09c5D45553',
    decimals: 18,
  },
  {
    chain: 'ethereum',
    symbol: 'dEURO',
    address: '0xbA3f535bbCcCcA2A154b573Ca6c5A49BAAE0a3ea',
    decimals: 18,
  },
  {
    chain: 'arbitrum',
    symbol: 'dEURO',
    address: '0x5e85fAf503621830CA857a5f38B982E0cc57D537',
    decimals: 18,
  },
  {
    chain: 'polygon',
    symbol: 'dEURO',
    address: '0xC2ff25dD99e467d2589b2c26EDd270F220F14E47',
    decimals: 18,
  },
  {
    chain: 'base',
    symbol: 'dEURO',
    address: '0x1B5F7fA46ED0F487F049C42f374cA4827d65A264',
    decimals: 18,
  },
] as const;

describe('configured token addresses', () => {
  it.each(CORRECTED_TOKEN_EXPECTATIONS)(
    'pins the corrected $symbol contract on $chain',
    ({ chain, symbol, address, decimals }) => {
      const configured = getAssets()
        .map((asset) => getAssetMeta(asset.getId()))
        .find((meta) => meta?.network === chain && meta.symbol === symbol);

      expect(configured).toMatchObject({ address, decimals });
      expect(DISCOVERABLE_TOKENS).toContainEqual(
        expect.objectContaining({ chain, symbol, contract: address, decimals }),
      );
    },
  );

  it('uses checksummed addresses for tokens and paymasters', () => {
    const configuredTokens = getAssets().flatMap((asset) => {
      const meta = getAssetMeta(asset.getId());
      return meta?.address ? [meta.address] : [];
    });
    const addresses = [
      ...configuredTokens,
      ...DISCOVERABLE_TOKENS.map((token) => token.contract),
      ...Object.values(getWdkConfigs().networks).flatMap((chain) => {
        const config = chain.config as {
          paymasterAddress?: string;
          paymasterToken?: { address: string };
        };
        return [config.paymasterAddress, config.paymasterToken?.address].filter(
          (address): address is string => Boolean(address),
        );
      }),
    ];

    for (const address of addresses) expect(getAddress(address)).toBe(address);
  });

  it('includes every configured contract token in the discoverable token superset', () => {
    for (const asset of getAssets()) {
      const configured = getAssetMeta(asset.getId());
      if (!configured?.address) continue;
      // Testnet tokens are intentionally not discoverable; they must never be priced as mainnet assets.
      if (TESTNET_NETWORKS.has(configured.network)) continue;

      expect(
        DISCOVERABLE_TOKENS.some(
          (token) =>
            token.chain === configured.network &&
            token.symbol === configured.symbol &&
            token.contract === configured.address,
        ),
      ).toBe(true);
    }
  });
});
