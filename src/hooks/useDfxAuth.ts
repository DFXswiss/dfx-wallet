import { useCallback, useRef, useState } from 'react';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { dfxAuthService } from '@/services/dfx';
import {
  EVM_AUTH_ADDRESS_PROBE_MESSAGE,
  recoverPersonalSignAddress,
} from '@/services/evm/signature';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';

type EvmAuthAddressCache = {
  accountAddress: string;
  signerAddress: string;
};

/**
 * Hook for DFX API authentication via wallet signature.
 *
 * Flow:
 * 1. Recover the EVM owner EOA from a WDK personal signature
 * 2. GET /v1/auth/signMessage?address=... -> challenge
 * 3. Sign challenge with WDK wallet (inside Bare Worklet)
 * 4. POST /v1/auth -> exchange signature for JWT
 *
 * WDK exposes a Safe/ERC-4337 account address for EVM chains, but personal
 * message signatures are produced by the owner EOA. DFX /v1/auth verifies
 * the recovered personal-sign signer, so authenticating with the Safe address
 * returns "Invalid signature". The recovered owner EOA is the auth address.
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
  const authAddressCache = useRef<EvmAuthAddressCache | null>(null);

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      const result = await sign(message);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to sign message');
      }
      return result.signature;
    },
    [sign],
  );

  const resolveAuthAddress = useCallback(async (): Promise<string> => {
    if (!address) {
      const msg = 'Wallet not ready — Ethereum address unavailable.';
      setError(msg);
      throw new Error(msg);
    }

    if (authAddressCache.current?.accountAddress === address) {
      return authAddressCache.current.signerAddress;
    }

    const signature = await signMessage(EVM_AUTH_ADDRESS_PROBE_MESSAGE);
    const signerAddress = recoverPersonalSignAddress(EVM_AUTH_ADDRESS_PROBE_MESSAGE, signature);
    authAddressCache.current = { accountAddress: address, signerAddress };
    return signerAddress;
  }, [address, signMessage]);

  const authenticate = useCallback(
    async (options?: { wallet?: string }): Promise<string> => {
      setIsAuthenticating(true);
      setError(null);

      try {
        const walletAddress = await resolveAuthAddress();
        const token = await dfxAuthService.login(walletAddress, signMessage, {
          wallet: options?.wallet ?? 'DFX Wallet',
        });

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
    },
    [resolveAuthAddress, signMessage, setDfxAuthenticated],
  );

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
    setIsAuthenticating(true);
    setError(null);

    try {
      const walletAddress = await resolveAuthAddress();
      const token = await dfxAuthService.loginAsAddressOwner(walletAddress, signMessage, {
        wallet: 'DFX Wallet',
      });

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
  }, [resolveAuthAddress, signMessage, setDfxAuthenticated]);

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
