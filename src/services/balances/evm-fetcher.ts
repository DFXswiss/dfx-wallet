import type { ChainId } from '@/config/chains';

/**
 * EVM balance fetcher.
 *
 * Pure imperative core (no React, no hooks, no caching). Intended to be the
 * swappable implementation behind the `evm` strategy: a future migration to
 * WDK or any indexer happens by replacing this class — the hook + coordinator
 * above it stay put.
 *
 * Speaks plain JSON-RPC: `eth_getBalance` for native, `eth_call` against the
 * ERC-20 `balanceOf(address)` selector for tokens. Calls are batched per chain
 * in a single POST and chains are fanned out in parallel.
 */

export type EvmAssetSpec = {
  assetId: string;
  network: ChainId;
  isNative: boolean;
  /** ERC-20 contract address; required when `isNative` is false. */
  tokenAddress: string | null;
};

export type EvmBalanceResult =
  | { assetId: string; rawBalance: string }
  | { assetId: string; error: string };

type RpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown[];
};

type RpcResponse =
  | { jsonrpc: '2.0'; id: number; result: string }
  | { jsonrpc: '2.0'; id: number; error: { code: number; message: string } };

const ERC20_BALANCE_OF_SELECTOR = '0x70a08231';
const RPC_BATCH_SIZE = 50;

const padAddressArg = (addr: string): string =>
  addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');

const encodeBalanceOf = (holder: string): string =>
  `${ERC20_BALANCE_OF_SELECTOR}${padAddressArg(holder)}`;

const hexToDecimalString = (hex: string): string => {
  if (!hex || hex === '0x') return '0';
  try {
    return BigInt(hex).toString();
  } catch {
    return '0';
  }
};

const isErrorResponse = (
  r: RpcResponse,
): r is Extract<RpcResponse, { error: { code: number; message: string } }> => 'error' in r;

const chunk = <T>(arr: T[], size: number): T[][] => {
  if (size <= 0 || arr.length <= size) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Per-RPC-batch hard timeout. Public RPC nodes (publicnode, llamarpc, …)
 *  occasionally stall for tens of seconds; without a ceiling the whole
 *  portfolio spinner waits on the slowest chain forever. 15s is generous
 *  enough that no healthy round-trip ever trips it. */
const DEFAULT_RPC_TIMEOUT_MS = 15_000;

export class EvmBalanceFetcher {
  constructor(
    private readonly resolveRpcUrl: (network: ChainId) => string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly rpcTimeoutMs: number = DEFAULT_RPC_TIMEOUT_MS,
  ) {}

  async fetch(
    specs: EvmAssetSpec[],
    addressByChain: ReadonlyMap<ChainId, string>,
  ): Promise<Map<string, EvmBalanceResult>> {
    const out = new Map<string, EvmBalanceResult>();
    const byChain = new Map<ChainId, EvmAssetSpec[]>();
    for (const spec of specs) {
      const list = byChain.get(spec.network);
      if (list) list.push(spec);
      else byChain.set(spec.network, [spec]);
    }

    // `fetchChain` catches every internal error and folds it into the
    // returned map, so `Promise.all` is safe — no chain rejection can
    // poison the others.
    const chainResults = await Promise.all(
      Array.from(byChain.entries()).map(([network, chainSpecs]) =>
        this.fetchChain(network, chainSpecs, addressByChain.get(network)),
      ),
    );
    for (const chainMap of chainResults) {
      for (const [assetId, entry] of chainMap) out.set(assetId, entry);
    }
    return out;
  }

  private async fetchChain(
    network: ChainId,
    specs: EvmAssetSpec[],
    address: string | undefined,
  ): Promise<Map<string, EvmBalanceResult>> {
    const out = new Map<string, EvmBalanceResult>();
    const rpcUrl = this.resolveRpcUrl(network);
    if (!rpcUrl) {
      for (const s of specs) out.set(s.assetId, { assetId: s.assetId, error: 'no rpc url' });
      return out;
    }
    if (!address) {
      for (const s of specs) out.set(s.assetId, { assetId: s.assetId, error: 'no address' });
      return out;
    }

    let nextId = 1;
    const idToAsset = new Map<number, EvmAssetSpec>();
    const requests: RpcRequest[] = [];
    for (const spec of specs) {
      if (!spec.isNative && !spec.tokenAddress) {
        out.set(spec.assetId, { assetId: spec.assetId, error: 'token address missing' });
        continue;
      }
      const id = nextId++;
      idToAsset.set(id, spec);
      requests.push(
        spec.isNative
          ? { jsonrpc: '2.0', id, method: 'eth_getBalance', params: [address, 'latest'] }
          : {
              jsonrpc: '2.0',
              id,
              method: 'eth_call',
              params: [{ to: spec.tokenAddress, data: encodeBalanceOf(address) }, 'latest'],
            },
      );
    }
    if (requests.length === 0) return out;

    for (const batch of chunk(requests, RPC_BATCH_SIZE)) {
      try {
        const responses = await this.postBatch(rpcUrl, batch);
        const byId = new Map<number, RpcResponse>();
        for (const r of responses) byId.set(r.id, r);
        for (const req of batch) {
          // `idToAsset` is populated for every request id in the loop above,
          // so the lookup is always defined here.
          const spec = idToAsset.get(req.id)!;
          const res = byId.get(req.id);
          if (!res) {
            out.set(spec.assetId, { assetId: spec.assetId, error: 'no response' });
          } else if (isErrorResponse(res)) {
            out.set(spec.assetId, { assetId: spec.assetId, error: res.error.message });
          } else {
            out.set(spec.assetId, {
              assetId: spec.assetId,
              rawBalance: hexToDecimalString(res.result),
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'rpc error';
        for (const req of batch) {
          const spec = idToAsset.get(req.id)!;
          out.set(spec.assetId, { assetId: spec.assetId, error: message });
        }
      }
    }
    return out;
  }

  private async postBatch(rpcUrl: string, batch: RpcRequest[]): Promise<RpcResponse[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.rpcTimeoutMs);
    try {
      const res = await this.fetchImpl(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`rpc http ${res.status}`);
      const json = (await res.json()) as RpcResponse | RpcResponse[];
      return Array.isArray(json) ? json : [json];
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`rpc timeout after ${this.rpcTimeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
