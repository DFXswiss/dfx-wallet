import { dfxApi } from './api';

export type DfxAssetCategory = 'PublicAsset' | 'PrivateAsset';
export type DfxAssetType = 'Coin' | 'Token' | 'Custom';

/**
 * Asset record returned by the DFX `/asset` endpoint. The Buy/Sell flow
 * needs `id`, `blockchain`, and (for EVM chains) `evmChainId` to construct
 * a valid `/buy/quote` payload.
 */
export type DfxAsset = {
  id: number;
  name: string;
  uniqueName: string;
  description?: string;
  blockchain: string;
  category: DfxAssetCategory;
  type: DfxAssetType;
  buyable: boolean;
  sellable: boolean;
  comingSoon?: boolean;
  evmChainId?: number | null;
};

let cache: Promise<DfxAsset[]> | null = null;

export class DfxAssetService {
  /** Fetch all DFX-supported assets. Cached per app session. */
  list(): Promise<DfxAsset[]> {
    cache ??= dfxApi.get<DfxAsset[]>('/v1/asset');
    return cache;
  }

  /** Look up a single asset by symbol (`name`) and blockchain (case-insensitive). */
  async find(name: string, blockchain: string): Promise<DfxAsset | undefined> {
    const all = await this.list();
    const blockchainLower = blockchain.toLowerCase();
    return all.find(
      (a) =>
        a.name.toLowerCase() === name.toLowerCase() &&
        a.blockchain.toLowerCase() === blockchainLower,
    );
  }

  /** Reset the in-memory cache (e.g. after logout). */
  reset(): void {
    cache = null;
  }
}

export const dfxAssetService = new DfxAssetService();
