import { useCallback } from 'react';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { dfxAuthService } from '@/services/dfx';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useLdsWallet } from './useLdsWallet';

export type ReauthResult = { ok: true; token: string } | { ok: false; error: string };

/**
 * Switch the DFX session to one of the user's other linked wallets.
 *
 * Two paths, tried in that order:
 *
 *   1. **`changeActiveAddress` (no signature required).** Mirrors
 *      app.dfx.swiss: `POST /v2/user/change` with the target address
 *      lets the DFX backend rotate the JWT to the chosen linked wallet
 *      because the standing Bearer already proves account ownership.
 *      This is what unlocks "buy into a wallet linked from another
 *      device" — we don't need the wallet's private key locally to
 *      credit a SEPA there.
 *
 *   2. **`loginAsAddressOwner` (sign challenge).** Used only when (1)
 *      fails — typically because the target wallet is on a *different*
 *      DFX account (409 from `linkAddress`) and we need to drop the
 *      current session entirely. Works only for addresses derived from
 *      this device's WDK seed (BTC SegWit, EVM family) or the LDS
 *      Lightning identity.
 *
 * Lightning is special-cased to LDS-LNURL re-auth (the WDK Spark
 * signature is rejected by DFX' /v1/auth verifier).
 */
export function useLinkedWalletReauth() {
  const btc = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const eth = useAccount({ network: 'ethereum', accountIndex: 0 });
  const lds = useLdsWallet();

  const reauthAs = useCallback(
    async (address: string, blockchain: string): Promise<ReauthResult> => {
      // Path 1: cheap server-side switch via /v2/user/change. Works for
      // any wallet linked to the same DFX account, regardless of where
      // it was originally signed in from. We try this first because the
      // typical case is exactly that — the user linked the wallet
      // through DFX, so a JWT-rotation suffices and no biometric/sign
      // prompt fires.
      try {
        const token = await dfxAuthService.changeActiveAddress(address);
        await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
        return { ok: true, token };
      } catch {
        // Falls through to the per-blockchain sign re-auth.
      }

      // Path 2: full sign re-auth — only viable when the wallet is
      // locally signable (Bitcoin SegWit, EVM family, LDS Lightning).
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
   * Whether a given (address, blockchain) can be activated for buy/sell.
   * Returns `true` unconditionally now — the `change`-path of `reauthAs`
   * works for every linked wallet on the same DFX account regardless of
   * whether we have the private key. The buy/sell UI uses this to keep
   * the Continue button enabled; failures still surface in the modal's
   * error path if the server-side switch is rejected.
   */
  const canSignFor = useCallback((_address: string, _blockchain: string): boolean => true, []);

  return { reauthAs, canSignFor };
}
