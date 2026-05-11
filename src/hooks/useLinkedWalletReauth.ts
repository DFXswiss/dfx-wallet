import { useCallback } from 'react';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { dfxAuthService } from '@/services/dfx';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useLdsWallet } from './useLdsWallet';

export type ReauthResult = { ok: true; token: string } | { ok: false; error: string };

/**
 * Switch the DFX session to the owner of a different *linked* wallet.
 *
 * The DFX `/buy/quote` and `/buy/paymentInfos` endpoints implicitly credit
 * the bank-transfer payout to whichever address the active JWT points at.
 * To buy *into* a different linked wallet (e.g. user's Lightning address
 * after signing in via Bitcoin) we drop the current Bearer and re-auth as
 * the target's owner via {@link DfxAuthService.loginAsAddressOwner} —
 * keeps the user inside the same merged DFX user account but pivots the
 * "active address" so subsequent calls land at the right wallet.
 *
 * Only works for addresses we can sign for locally — i.e. derived from this
 * device's WDK seed (Bitcoin SegWit + EVM family) or the LDS-managed
 * Lightning identity. Returns `{ ok: false }` for non-signable targets so
 * the UI can surface a hint instead of getting stuck on a stale signature.
 */
export function useLinkedWalletReauth() {
  const btc = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const eth = useAccount({ network: 'ethereum', accountIndex: 0 });
  const lds = useLdsWallet();

  const reauthAs = useCallback(
    async (address: string, blockchain: string): Promise<ReauthResult> => {
      try {
        if (blockchain === 'Lightning') {
          const user = lds.user ?? (await lds.signIn());
          if (!user) return { ok: false, error: 'LDS not ready' };
          const token = await dfxAuthService.loginAsLnurlAddressOwner(
            user.lightning.addressLnurl,
            user.lightning.addressOwnershipProof,
            { wallet: 'DFX Bitcoin', blockchain: 'Lightning' },
          );
          await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
          return { ok: true, token };
        }

        if (blockchain === 'Bitcoin') {
          if (!btc.address) return { ok: false, error: 'Bitcoin wallet not ready' };
          if (btc.address.toLowerCase() !== address.toLowerCase()) {
            return { ok: false, error: 'addressMismatch' };
          }
          const token = await dfxAuthService.loginAsAddressOwner(
            address,
            async (message) => {
              const r = await btc.sign(message);
              if (!r.success) throw new Error(r.error ?? 'Failed to sign message');
              return r.signature;
            },
            { wallet: 'DFX Wallet', blockchain: 'Bitcoin' },
          );
          await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
          return { ok: true, token };
        }

        // The whole EVM family (Ethereum + L2s) shares one local WDK
        // address — the same signature is accepted by DFX for any of
        // Ethereum/Arbitrum/Polygon/Base because the verifier checks the
        // EOA, not the chain id.
        if (
          blockchain === 'Ethereum' ||
          blockchain === 'Arbitrum' ||
          blockchain === 'Polygon' ||
          blockchain === 'Base'
        ) {
          if (!eth.address) return { ok: false, error: 'Ethereum wallet not ready' };
          if (eth.address.toLowerCase() !== address.toLowerCase()) {
            return { ok: false, error: 'addressMismatch' };
          }
          const token = await dfxAuthService.loginAsAddressOwner(
            address,
            async (message) => {
              const r = await eth.sign(message);
              if (!r.success) throw new Error(r.error ?? 'Failed to sign message');
              return r.signature;
            },
            { wallet: 'DFX Wallet', blockchain },
          );
          await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
          return { ok: true, token };
        }

        return { ok: false, error: `Unsupported blockchain ${blockchain}` };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Reauth failed' };
      }
    },
    [btc, eth, lds],
  );

  /**
   * Quick check whether a given (address, blockchain) is signable on this
   * device — surfaces the "linked from another device" case without paying
   * the round-trip of an actual /v1/auth attempt.
   */
  const canSignFor = useCallback(
    (address: string, blockchain: string): boolean => {
      const lc = address.toLowerCase();
      if (blockchain === 'Lightning') return true;
      if (blockchain === 'Bitcoin') return btc.address?.toLowerCase() === lc;
      if (
        blockchain === 'Ethereum' ||
        blockchain === 'Arbitrum' ||
        blockchain === 'Polygon' ||
        blockchain === 'Base'
      )
        return eth.address?.toLowerCase() === lc;
      return false;
    },
    [btc.address, eth.address],
  );

  return { reauthAs, canSignFor };
}
