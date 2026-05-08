import { useCallback, useState } from 'react';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { dfxAuthService } from '@/services/dfx';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';

/**
 * Hook for DFX API authentication via wallet signature.
 *
 * Flow:
 * 1. Get ETH address from WDK
 * 2. GET /v1/auth/signMessage?address=... -> challenge
 * 3. Sign challenge with WDK wallet (inside Bare Worklet)
 * 4. POST /v1/auth -> exchange signature for JWT
 *
 * `authenticate()` throws on failure so callers can surface specific errors
 * (network, signature, backend code). Use `authenticateSilent()` from
 * background paths (e.g. dfxApi.onUnauthorized retry) where a `null` return
 * is the correct "give up and let the caller handle it" signal.
 */
export function useDfxAuth() {
  const { address, sign } = useAccount({ network: 'ethereum', accountIndex: 0 });
  const { setDfxAuthenticated } = useAuthStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async (): Promise<string> => {
    if (!address) {
      const msg = 'Wallet not ready — Ethereum address unavailable.';
      setError(msg);
      throw new Error(msg);
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const token = await dfxAuthService.login(
        address,
        async (message) => {
          const result = await sign(message);
          if (!result.success) {
            throw new Error(result.error ?? 'Failed to sign message');
          }
          return result.signature;
        },
        { wallet: 'DFX Wallet', blockchain: 'Ethereum' },
      );

      await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
      setDfxAuthenticated(true);
      return token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, sign, setDfxAuthenticated]);

  /** Best-effort variant for background callers: returns the new token or null. */
  const authenticateSilent = useCallback(async (): Promise<string | null> => {
    try {
      return await authenticate();
    } catch {
      return null;
    }
  }, [authenticate]);

  /**
   * Recovery for the "User is merged" 403 path. Drops the prior session
   * (which is bound to the merged-AWAY user), then signs in the WDK ETH
   * address fresh — DFX returns the JWT for the merge-target user (the
   * one that actually carries the email/KYC). Without this, calling
   * `authenticate()` keeps the stale Bearer attached and the server
   * returns the same 403 again.
   */
  const reauthenticateAsOwner = useCallback(async (): Promise<string> => {
    if (!address) {
      const msg = 'Wallet not ready — Ethereum address unavailable.';
      setError(msg);
      throw new Error(msg);
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const token = await dfxAuthService.loginAsAddressOwner(
        address,
        async (message) => {
          const result = await sign(message);
          if (!result.success) {
            throw new Error(result.error ?? 'Failed to sign message');
          }
          return result.signature;
        },
        { wallet: 'DFX Wallet', blockchain: 'Ethereum' },
      );

      await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
      // Different user → invalidate per-chain link cache so auto-link
      // re-evaluates against the new JWT.
      await secureStorage.remove(StorageKeys.DFX_LINKED_CHAINS);
      setDfxAuthenticated(true);
      return token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, sign, setDfxAuthenticated]);

  const logout = useCallback(async () => {
    dfxAuthService.logout();
    await Promise.all([
      secureStorage.remove(StorageKeys.DFX_AUTH_TOKEN),
      // Drop the per-chain link cache too — a fresh DFX session may belong
      // to a different account whose `user.blockchains` doesn't include
      // these chains yet, so we want auto-link to run again.
      secureStorage.remove(StorageKeys.DFX_LINKED_CHAINS),
    ]);
    setDfxAuthenticated(false);
  }, [setDfxAuthenticated]);

  return {
    authenticate,
    authenticateSilent,
    reauthenticateAsOwner,
    logout,
    isAuthenticating,
    error,
  };
}
