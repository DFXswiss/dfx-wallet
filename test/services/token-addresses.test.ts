import { getAddress } from 'ethers';
import { getWdkConfigs } from '@/config/chains';
import { DISCOVERABLE_TOKENS } from '@/config/discoverable-tokens';
import { getAssetMeta, getAssets } from '@/config/tokens';

const TESTNET_NETWORKS = new Set(['sepolia']);

describe('configured token addresses', () => {
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
