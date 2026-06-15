// Copyright (c) 2026 DFX AG. All rights reserved. Proprietary and confidential.
//
// Cloister shielded-deposit orchestration — runs entirely in the wallet (no go-ethereum
// in the native binary):
//   1. tree-insertion context: PRIMARY a relayer's /v1/deposit/prepare; FALLBACK the
//      warm on-device leaf cache (treeCache) — both feed the on-device prover.
//   2. proof: native gnark prover (proveDeposit / proveDepositFromLeaves) — on-device.
//   3. broadcast: the user's own wallet via ethers (transact()).
//
// extDataHash is computed locally and is byte-for-byte identical to the contract's
// keccak(extData) % FIELD (verified against the relayer/contract value).

import { AbiCoder, Contract, Interface, JsonRpcProvider, Wallet, ZeroAddress, keccak256 } from 'ethers';
import { initProver, proveDeposit, proveDepositFromLeaves } from 'cloister-prover';
import { cacheVerifiedLeaves, clearLeafCache, fetchLeavesFull, getLogsRpcs, loadCachedLeaves, warmLeafCache } from './treeCache';

// Merkle pair-path length = tree depth (20) − 1. The relayer-supplied path must match.
const PAIR_PATH_LEN = 19;
const BASE_MAINNET = 8453;

// BN254 scalar field — extData hash is reduced into the field for the circuit.
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const POOL_ABI = [
  'function laneRoot(uint256) view returns (uint256)',
  'function laneNextIndex(uint256) view returns (uint32)',
  'function transact((uint256[2] a,uint256[2][2] b,uint256[2] c) proof,uint256 oldRoot,uint256 newRoot,uint256 associationRoot,uint256[2] inputNullifiers,uint256[2] outputCommitments,(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2) extData)',
];
const EXTDATA_TUPLE =
  'tuple(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2)';

export interface CloisterDepositConfig {
  rpc: string;
  pool: string;
  chainId: number; // static network → skips ethers' eth_chainId auto-detection round-trip
  ownerPriv: string;
  fromBlock: number;
  relayerUrl?: string | undefined; // primary prepare source; falls back to the warm leaf cache
  // Exactly one signing path:
  //  • sendTx  — PRODUCTION: the user's own wallet (WDK) signs + broadcasts. No key here.
  //  • deployerKey — TESTNET PILOT ONLY: embedded demo key (the user's mainnet WDK wallet
  //    can't transact on the Sepolia pilot pool). Must NOT be present in a production build.
  sendTx?: ((req: { to: string; data: string }) => Promise<{ hash: string }>) | undefined;
  deployerKey?: string | undefined;
}

export interface CloisterDepositResult {
  txHash: string;
  basescan: string;
  via: 'relayer' | 'fallback';
}

function depositExtData(amount: string) {
  return {
    recipient: ZeroAddress,
    extAmount: amount,
    relayer: ZeroAddress,
    fee: '0',
    encryptedOutput1: '0x',
    encryptedOutput2: '0x',
  };
}

function extDataHashOf(ext: ReturnType<typeof depositExtData>): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    [EXTDATA_TUPLE],
    [[ext.recipient, ext.extAmount, ext.relayer, ext.fee, ext.encryptedOutput1, ext.encryptedOutput2]],
  );
  return (BigInt(keccak256(encoded)) % FIELD).toString();
}

interface PrepareCtx {
  root: string;
  pairIndex: number;
  pairPathEls: string[];
}

async function prepareViaRelayer(url: string, amount: string, timeoutMs: number): Promise<PrepareCtx | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${url}/v1/deposit/prepare?amount=${amount}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<PrepareCtx>;
    // Validate the trust-boundary payload shape before it reaches the native prover
    // (a wrong length would otherwise crash native code; the root check catches the rest).
    const ok =
      j &&
      typeof j.root === 'string' &&
      Array.isArray(j.pairPathEls) &&
      j.pairPathEls.length === PAIR_PATH_LEN &&
      Number.isInteger(j.pairIndex) &&
      (j.pairIndex as number) >= 0;
    return ok ? (j as PrepareCtx) : null;
  } catch {
    return null; // unreachable/timeout → fall back
  }
}

/**
 * Warm-up on entering Pay (cheap, non-blocking): load the prover keys into memory AND
 * incrementally sync the leaf cache, in parallel. This takes the ~1.5s key-load and the
 * tree-sync OUT of the payment's critical path so the deposit is just prove + broadcast.
 */
export async function warmDepositContext(cfg: Pick<CloisterDepositConfig, 'pool' | 'fromBlock'>): Promise<void> {
  await Promise.all([
    initProver().catch(() => false),
    warmLeafCache({ pool: cfg.pool, fromBlock: cfg.fromBlock }),
  ]);
}

type PoolView = {
  laneRoot: (lane: number) => Promise<bigint>;
  laneNextIndex: (lane: number) => Promise<bigint>;
  transact: (...args: unknown[]) => Promise<{ hash: string; wait: () => Promise<{ status: number } | null> }>;
};

// Fallback context: produce a COMPLETE commitment set (leaf count == on-chain leaf count),
// then prove. Public RPCs drop getLogs results, so try the cache then each getLogs RPC
// until the count matches laneNextIndex — otherwise the proof's root won't match and the
// tx would revert. Returns the proof from the verified-complete set.
async function proveViaFallback(
  amount: string,
  cfg: CloisterDepositConfig,
  extDataHash: string,
  expectedCount: number,
  cachedLeaves: string[],
): Promise<Awaited<ReturnType<typeof proveDeposit>>> {
  const sources: Array<() => Promise<string[]>> = [
    async () => cachedLeaves, // warm cache first (instant if complete)
    ...getLogsRpcs().map((rpc) => () => fetchLeavesFull(rpc, cfg.pool, cfg.fromBlock)),
  ];
  for (const get of sources) {
    let leaves: string[];
    try {
      leaves = await get();
    } catch {
      continue;
    }
    if (leaves.length !== expectedCount) continue; // incomplete source → next
    const proof = await proveDepositFromLeaves({ amount, ownerPriv: cfg.ownerPriv, leaves, extDataHash });
    void cacheVerifiedLeaves(getLogsRpcs()[0]!, cfg.pool, leaves);
    return proof;
  }
  throw new Error(`shielded sync incomplete: no source returned all ${expectedCount} commitments`);
}

export async function runDeposit(amount: string, cfg: CloisterDepositConfig): Promise<CloisterDepositResult> {
  if (!cfg.sendTx && !cfg.deployerKey) {
    throw new Error('no signer configured (need the user wallet sendTx, or a pilot deployerKey)');
  }
  // Hard guard: the embedded demo key is testnet-only — never let it sign on Base mainnet.
  if (cfg.chainId === BASE_MAINNET && cfg.deployerKey) {
    throw new Error('refusing the embedded demo key on Base mainnet — production must sign with the user wallet');
  }
  const ext = depositExtData(amount);
  const extDataHash = extDataHashOf(ext);

  // staticNetwork → no eth_chainId auto-detection round-trip per provider use
  const provider = new JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true });
  // ethers polls receipts every 4s by default — a ~2s-block tx then waits up to 4s to be
  // seen. Poll faster so confirmation is detected close to when the block lands.
  provider.pollingInterval = 1000;
  const pool = new Contract(cfg.pool, POOL_ABI, provider) as unknown as PoolView;

  // Warm the prover and read the on-chain root concurrently with everything else; the
  // root is needed for the pre-broadcast safety check in both paths.
  const ready = initProver();
  const rootP = pool.laneRoot(0);

  // 1) tree context + on-device proof — relayer first, completeness-verified cache as fallback
  let proof: Awaited<ReturnType<typeof proveDeposit>> | null = null;
  let via: 'relayer' | 'fallback' = 'fallback';
  if (cfg.relayerUrl) {
    const prep = await prepareViaRelayer(cfg.relayerUrl, amount, 2500);
    if (prep) {
      await ready;
      proof = await proveDeposit({
        amount,
        ownerPriv: cfg.ownerPriv,
        root: prep.root,
        pairIndex: prep.pairIndex,
        pairPathEls: prep.pairPathEls,
        extDataHash,
      });
      via = 'relayer';
    }
  }
  if (!proof) {
    // fallback — read leaf count + warm cache in parallel, then prove
    const [expectedCount, cached] = await Promise.all([
      pool.laneNextIndex(0).then((n) => Number(n)),
      loadCachedLeaves(cfg.pool),
    ]);
    await ready;
    proof = await proveViaFallback(amount, cfg, extDataHash, expectedCount, cached);
    via = 'fallback';
  }

  // 2) safety: the proof's old-root MUST equal the current on-chain lane root, or the tx
  // would revert ("stale or unknown root"). Fail before broadcasting.
  const onchainRoot = await rootP;
  const ps = proof.publicSignals; // [root, amount, extHash, nf0, nf1, out0, out1, newRoot, _, assocRoot]
  if (BigInt(ps[0]!) !== onchainRoot) {
    // The cached/synced leaf set is stale or wrong — evict it so the next attempt re-syncs.
    await clearLeafCache(cfg.pool);
    throw new Error('shielded root drift: a deposit landed during preparation — please retry');
  }

  // 3) broadcast transact() (publicSignals are 0x-hex uint256)
  const args = [
    [proof.a, proof.b, proof.c],
    ps[0],
    ps[7],
    ps[9],
    [ps[3], ps[4]],
    [ps[5], ps[6]],
    [ext.recipient, ext.extAmount, ext.relayer, ext.fee, ext.encryptedOutput1, ext.encryptedOutput2],
  ];
  let hash: string;
  if (cfg.sendTx) {
    // PRODUCTION: the user's own wallet signs + broadcasts (no embedded key).
    const data = new Interface(POOL_ABI).encodeFunctionData('transact', args);
    ({ hash } = await cfg.sendTx({ to: cfg.pool, data }));
  } else {
    // TESTNET PILOT: embedded demo key signs (Sepolia; user's mainnet wallet can't).
    const wallet = new Wallet(cfg.deployerKey!, provider);
    const signed = new Contract(cfg.pool, POOL_ABI, wallet) as unknown as PoolView;
    const tx = await signed.transact(...args, { gasLimit: 900000 });
    hash = tx.hash;
  }
  const rc = await provider.waitForTransaction(hash, 1, 90_000);
  if (!rc || rc.status !== 1) throw new Error(`transact reverted (${hash})`);
  return { txHash: hash, basescan: `https://sepolia.basescan.org/tx/${hash}`, via };
}
