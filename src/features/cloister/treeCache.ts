// Copyright (c) 2026 DFX AG. All rights reserved. Proprietary and confidential.
//
// Warm, incremental, persisted Merkle-leaf cache for the Cloister shielded pool — the
// relayer-less fallback source of the tree-insertion context. On app open (and before a
// fallback deposit) it fetches only the NEW NewCommitment events since the last cached
// block — a tiny delta, not the whole history — so it stays warm and ready without
// drawing meaningful power. The cached commitments feed the native prover.
//
// IMPORTANT: public RPCs (notably publicnode) silently DROP eth_getLogs results, so a
// single-RPC sync can be incomplete. Completeness is therefore verified by the caller
// against the on-chain leaf count (laneNextIndex); this module just fetches + caches.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contract, JsonRpcProvider } from 'ethers';

const POOL_ABI = ['event NewCommitment(uint256 indexed commitment, uint32 leafIndex, bytes encryptedOutput)'];
// Public RPCs cap eth_getLogs by block range — chunk to stay within the limit.
const CHUNK = 40000;

// getLogs sources, tried in order. Tenderly returns complete results; publicnode is a
// last resort (it drops logs). Override with EXPO_PUBLIC_CLOISTER_GETLOGS_RPCS (comma-sep).
const DEFAULT_GETLOGS_RPCS = [
  'https://base-sepolia.gateway.tenderly.co',
  'https://base-sepolia-rpc.publicnode.com',
];
export function getLogsRpcs(): string[] {
  const env = process.env.EXPO_PUBLIC_CLOISTER_GETLOGS_RPCS;
  const list = env ? env.split(',').map((s: string) => s.trim()).filter(Boolean) : DEFAULT_GETLOGS_RPCS;
  return list.length ? list : DEFAULT_GETLOGS_RPCS;
}

type LeafCache = { lastBlock: number; leaves: string[] };
const cacheKey = (pool: string) => `cloister.leafCache.${pool.toLowerCase()}`;

export async function loadCachedLeaves(pool: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(pool));
    if (raw) {
      const c = JSON.parse(raw) as LeafCache;
      if (Array.isArray(c.leaves)) return c.leaves;
    }
  } catch {
    /* corrupt/missing → empty */
  }
  return [];
}

async function saveCache(pool: string, lastBlock: number, leaves: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(pool), JSON.stringify({ lastBlock, leaves } satisfies LeafCache));
  } catch {
    /* non-fatal */
  }
}

function poolContract(rpc: string, pool: string) {
  return new Contract(pool, POOL_ABI, new JsonRpcProvider(rpc)) as unknown as {
    filters: { NewCommitment: () => unknown };
    queryFilter: (f: unknown, from?: number, to?: number) => Promise<Array<{ args: ReadonlyArray<unknown> }>>;
  };
}

/** Full chunked getLogs from one RPC → commitments in leaf-index order. */
export async function fetchLeavesFull(rpc: string, pool: string, fromBlock: number): Promise<string[]> {
  const provider = new JsonRpcProvider(rpc);
  const c = poolContract(rpc, pool);
  const latest = await provider.getBlockNumber();
  const byIdx = new Map<number, string>();
  const filter = c.filters.NewCommitment();
  for (let start = fromBlock; start <= latest; ) {
    const end = Math.min(start + CHUNK, latest);
    const logs = await c.queryFilter(filter, start, end);
    for (const l of logs) byIdx.set(Number(l.args[1]), String(l.args[0]));
    if (end === latest) break;
    start = end + 1;
  }
  // Return only the CONTIGUOUS prefix from leafIndex 0 — a gap means this RPC dropped
  // logs, so the (shorter) prefix fails the caller's count check and the next RPC is tried.
  const leaves: string[] = [];
  for (let i = 0; byIdx.has(i); i += 1) leaves.push(byIdx.get(i)!);
  return leaves;
}

/** Drop the cached leaves for a pool (e.g. after a root mismatch) so the next deposit re-syncs. */
export async function clearLeafCache(pool: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(pool));
  } catch {
    /* non-fatal */
  }
}

/**
 * Persist a verified-complete commitment set (called by the deposit flow once the leaf
 * count matches the on-chain leaf count), so the next deposit/warm-up starts warm.
 */
export async function cacheVerifiedLeaves(rpc: string, pool: string, leaves: string[]): Promise<void> {
  let lastBlock = 0;
  try {
    lastBlock = await new JsonRpcProvider(rpc).getBlockNumber();
  } catch {
    /* best-effort */
  }
  await saveCache(pool, lastBlock, leaves);
}

/**
 * Warm the cache on app open: incremental delta-sync (only new commitments since the last
 * cached block) on the first reliable getLogs RPC. Best-effort + cheap; the deposit flow
 * re-verifies completeness against the chain, so an incomplete warm is harmless.
 */
export async function warmLeafCache(opts: { pool: string; fromBlock: number }): Promise<void> {
  const rpc = getLogsRpcs()[0]!;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(opts.pool));
    const cache: LeafCache = raw ? JSON.parse(raw) : { lastBlock: Math.max(0, opts.fromBlock - 1), leaves: [] };
    const provider = new JsonRpcProvider(rpc);
    const c = poolContract(rpc, opts.pool);
    const latest = await provider.getBlockNumber();
    const byIdx = new Map<number, string>();
    const filter = c.filters.NewCommitment();
    for (let start = Math.max(cache.lastBlock + 1, opts.fromBlock); start <= latest; ) {
      const end = Math.min(start + CHUNK, latest);
      const logs = await c.queryFilter(filter, start, end);
      for (const l of logs) byIdx.set(Number(l.args[1]), String(l.args[0]));
      if (end === latest) break;
      start = end + 1;
    }
    // Append only strictly-contiguous next leaves so a delta gap can never misalign the cache.
    while (byIdx.has(cache.leaves.length)) cache.leaves.push(byIdx.get(cache.leaves.length)!);
    await saveCache(opts.pool, latest, cache.leaves);
  } catch {
    /* best-effort warm-up */
  }
}
