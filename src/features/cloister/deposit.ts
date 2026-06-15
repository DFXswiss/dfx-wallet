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

import { AbiCoder, Contract, JsonRpcProvider, Wallet, ZeroAddress, keccak256 } from 'ethers';
import { initProver, proveDeposit, proveDepositFromLeaves } from 'cloister-prover';
import { cacheVerifiedLeaves, fetchLeavesFull, getLogsRpcs, loadCachedLeaves, warmLeafCache } from './treeCache';

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
  deployerKey: string; // pilot signer; production swaps in the user's WDK wallet
  ownerPriv: string;
  fromBlock: number;
  relayerUrl?: string; // primary prepare source; falls back to the warm leaf cache
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
    return j && j.root && Array.isArray(j.pairPathEls) ? (j as PrepareCtx) : null;
  } catch {
    return null; // unreachable/timeout → fall back
  }
}

/** Warm the fallback leaf cache (call on app open; cheap, incremental delta-sync). */
export async function warmDepositContext(cfg: Pick<CloisterDepositConfig, 'pool' | 'fromBlock'>): Promise<void> {
  await warmLeafCache({ pool: cfg.pool, fromBlock: cfg.fromBlock });
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
): Promise<Awaited<ReturnType<typeof proveDeposit>>> {
  const sources: Array<() => Promise<string[]>> = [
    () => loadCachedLeaves(cfg.pool),
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
  await initProver();
  const ext = depositExtData(amount);
  const extDataHash = extDataHashOf(ext);

  const provider = new JsonRpcProvider(cfg.rpc);
  const wallet = new Wallet(cfg.deployerKey, provider);
  const pool = new Contract(cfg.pool, POOL_ABI, wallet) as unknown as PoolView;

  // 1) tree context + on-device proof — relayer first, completeness-verified cache as fallback
  let proof: Awaited<ReturnType<typeof proveDeposit>>;
  let via: 'relayer' | 'fallback';
  const prep = cfg.relayerUrl ? await prepareViaRelayer(cfg.relayerUrl, amount, 6000) : null;
  if (prep) {
    proof = await proveDeposit({
      amount,
      ownerPriv: cfg.ownerPriv,
      root: prep.root,
      pairIndex: prep.pairIndex,
      pairPathEls: prep.pairPathEls,
      extDataHash,
    });
    via = 'relayer';
  } else {
    const expectedCount = Number(await pool.laneNextIndex(0));
    proof = await proveViaFallback(amount, cfg, extDataHash, expectedCount);
    via = 'fallback';
  }

  // 2) safety: the proof's old-root MUST equal the current on-chain lane root, or the tx
  // would revert ("stale or unknown root"). Fail before broadcasting.
  const onchainRoot = await pool.laneRoot(0);
  const ps = proof.publicSignals; // [root, amount, extHash, nf0, nf1, out0, out1, newRoot, _, assocRoot]
  if (BigInt(ps[0]!) !== onchainRoot) {
    throw new Error('shielded root drift: a deposit landed during preparation — please retry');
  }

  // 3) broadcast transact() with the user's wallet (publicSignals are 0x-hex uint256)
  const tx = await pool.transact(
    [proof.a, proof.b, proof.c],
    ps[0],
    ps[7],
    ps[9],
    [ps[3], ps[4]],
    [ps[5], ps[6]],
    [ext.recipient, ext.extAmount, ext.relayer, ext.fee, ext.encryptedOutput1, ext.encryptedOutput2],
    { gasLimit: 900000 },
  );
  const rc = await tx.wait();
  if (!rc || rc.status !== 1) throw new Error(`transact reverted (${tx.hash})`);
  return { txHash: tx.hash, basescan: `https://sepolia.basescan.org/tx/${tx.hash}`, via };
}
