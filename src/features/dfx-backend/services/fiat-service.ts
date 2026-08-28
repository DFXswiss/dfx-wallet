import { dfxApi } from './api';

export type DfxFiat = {
  id: number;
  name: string;
  buyable: boolean;
  sellable: boolean;
};

let cache: Promise<DfxFiat[]> | null = null;

export class DfxFiatService {
  /** Fetch all DFX-supported fiat currencies. Cached per app session. */
  list(): Promise<DfxFiat[]> {
    cache ??= dfxApi.getPublic<DfxFiat[]>('/v1/fiat');
    return cache;
  }

  /** Look up a fiat by symbol/name (case-insensitive). */
  async find(name: string): Promise<DfxFiat | undefined> {
    const lower = name.toLowerCase();
    const all = await this.list();
    return all.find((f) => f.name.toLowerCase() === lower);
  }

  /** Reset the in-memory cache (e.g. after logout). */
  reset(): void {
    cache = null;
  }
}

export const dfxFiatService = new DfxFiatService();
