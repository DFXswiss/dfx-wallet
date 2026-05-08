import { useEffect, useRef } from 'react';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { dfxAuthService, jwtCoversBlockchain } from '@/services/dfx';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';
import { useLdsWallet } from './useLdsWallet';

/**
 * Silently attach every wallet a DFX user might want to buy on — Bitcoin
 * (SegWit), Spark, and the LDS-managed Lightning identity ("Taproot" in the
 * UI) — to the active DFX account once it's authenticated. Without this the
 * very first BTC / Spark / Taproot quote returns "Asset blockchain mismatch"
 * because DFX' default `jwt.blockchains` only contains the chain we signed
 * in with (Ethereum).
 *
 * The buy/sell screens still carry a `linkChain` recovery modal as a safety
 * net, but in the happy path the user never sees it: their wallets were
 * pre-linked behind the scenes here.
 *
 * Per-chain success is cached in secure storage so we sign each chain at
 * most once across app launches.
 */
type WdkBitcoinLinkChain = {
  kind: 'wdk-bitcoin';
  chain: 'bitcoin';
  blockchain: 'Bitcoin';
};

type WdkEvmLinkChain = {
  kind: 'wdk-evm';
  // Cache key — different from blockchain because we want one cache entry per
  // EVM chain even though the underlying ETH key is the same.
  chain: 'arbitrum' | 'polygon' | 'base';
  blockchain: 'Arbitrum' | 'Polygon' | 'Base';
};

type LdsLinkChain = {
  kind: 'lds';
  // Cache key only — the live address comes from the LDS user.
  chain: 'lightning';
  blockchain: 'Lightning';
};

type AutoLinkChain = WdkBitcoinLinkChain | WdkEvmLinkChain | LdsLinkChain;

// Spark intentionally omitted: DFX' /v1/auth verifier rejects WDK's
// DER-encoded ECDSA Spark signature ("Invalid signature"), so an auto-link
// attempt would just churn forever. We surface the working Lightning path
// (LDS LNURL) and SegWit instead.
//
// Ethereum is the LOGIN chain — already in `jwt.blockchains` from the initial
// sign-in, so no separate auto-link entry needed. The other EVM chains share
// the same key/address as Ethereum, so we sign once with the ETH account and
// reuse the signature for each of (Arbitrum, Polygon, Base) by varying only
// the `blockchain` hint. WDK signs silently via Bare Worklet — no UI prompt.
const CHAINS: AutoLinkChain[] = [
  { kind: 'wdk-bitcoin', chain: 'bitcoin', blockchain: 'Bitcoin' },
  { kind: 'lds', chain: 'lightning', blockchain: 'Lightning' },
  { kind: 'wdk-evm', chain: 'arbitrum', blockchain: 'Arbitrum' },
  { kind: 'wdk-evm', chain: 'polygon', blockchain: 'Polygon' },
  { kind: 'wdk-evm', chain: 'base', blockchain: 'Base' },
];

/**
 * Update the per-chain link cache after a buy/sell modal successfully
 * linked a chain — so that the next cold-start auto-link skips the
 * sign-prompt for it.
 */
export async function markChainLinkedInAutoLinkCache(autoLinkChain: string): Promise<void> {
  const cached = await secureStorage.get(StorageKeys.DFX_LINKED_CHAINS);
  const linked: Record<string, true> = cached ? (JSON.parse(cached) as Record<string, true>) : {};
  // eslint-disable-next-line security/detect-object-injection -- autoLinkChain is a hardcoded literal at every call site
  if (linked[autoLinkChain]) return;
  // eslint-disable-next-line security/detect-object-injection -- autoLinkChain is a hardcoded literal at every call site
  linked[autoLinkChain] = true;
  await secureStorage.set(StorageKeys.DFX_LINKED_CHAINS, JSON.stringify(linked));
}

export function useDfxAutoLink() {
  const isDfxAuthenticated = useAuthStore((s) => s.isDfxAuthenticated);
  const btc = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const eth = useAccount({ network: 'ethereum', accountIndex: 0 });
  const lds = useLdsWallet();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isDfxAuthenticated || inFlight.current) return;
    if (!btc.address && !eth.address && !lds.user) return;

    const run = async () => {
      inFlight.current = true;
      try {
        const cached = await secureStorage.get(StorageKeys.DFX_LINKED_CHAINS);
        const linked: Record<string, true> = cached
          ? (JSON.parse(cached) as Record<string, true>)
          : {};

        // Read the active JWT once and skip any chain DFX already lists in
        // `user.blockchains`. This is the source of truth — the cache is
        // just an optimisation for offline-fast paths.
        const token = await secureStorage.get(StorageKeys.DFX_AUTH_TOKEN);

        let cacheChanged = false;
        for (const c of CHAINS) {
          if (linked[c.chain]) continue;

          if (jwtCoversBlockchain(token, c.blockchain)) {
            linked[c.chain] = true;
            cacheChanged = true;
            continue;
          }

          try {
            if (c.kind === 'wdk-bitcoin') {
              if (!btc.address) continue;
              const newToken = await dfxAuthService.linkAddress(
                btc.address,
                async (message) => {
                  const result = await btc.sign(message);
                  if (!result.success) {
                    throw new Error(result.error ?? 'Failed to sign message');
                  }
                  return result.signature;
                },
                { wallet: 'DFX Wallet', blockchain: c.blockchain },
              );
              await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, newToken);
              linked[c.chain] = true;
              cacheChanged = true;
            } else if (c.kind === 'wdk-evm') {
              // Same address + key as Ethereum — DFX accepts the ETH-signed
              // payload for any EVM blockchain, so we don't even need a
              // separate WDK account per chain. Signs silently in the Bare
              // Worklet, no user prompt.
              if (!eth.address) continue;
              const newToken = await dfxAuthService.linkAddress(
                eth.address,
                async (message) => {
                  const result = await eth.sign(message);
                  if (!result.success) {
                    throw new Error(result.error ?? 'Failed to sign message');
                  }
                  return result.signature;
                },
                { wallet: 'DFX Wallet', blockchain: c.blockchain },
              );
              await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, newToken);
              linked[c.chain] = true;
              cacheChanged = true;
            } else {
              // Lightning via LDS: DFX skips its dynamic challenge for LNURL
              // addresses — we post the lnurl-encoded address with the static
              // ownership proof LDS issued, exactly like DFX' own e2e helper.
              if (!lds.user) continue;
              const newToken = await dfxAuthService.linkLnurlAddress(
                lds.user.lightning.addressLnurl,
                lds.user.lightning.addressOwnershipProof,
                { wallet: 'DFX Bitcoin', blockchain: c.blockchain },
              );
              await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, newToken);
              linked[c.chain] = true;
              cacheChanged = true;
            }
          } catch {
            // Swallow — the linkChain modal in buy/sell handles failure
            // when the user actually tries that chain.
          }
        }
        if (cacheChanged) {
          await secureStorage.set(StorageKeys.DFX_LINKED_CHAINS, JSON.stringify(linked));
        }
      } finally {
        inFlight.current = false;
      }
    };

    void run();
  }, [isDfxAuthenticated, btc.address, eth.address, lds.user, btc, eth]);
}
