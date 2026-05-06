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
 */
export function useDfxAuth() {
  const { address, sign } = useAccount({ network: 'ethereum', accountIndex: 0 });
  const { setDfxAuthenticated } = useAuthStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    if (!address) {
      setError('No Ethereum address available. Create a wallet first.');
      return null;
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
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, sign, setDfxAuthenticated]);

  const logout = useCallback(async () => {
    dfxAuthService.logout();
    await secureStorage.remove(StorageKeys.DFX_AUTH_TOKEN);
    setDfxAuthenticated(false);
  }, [setDfxAuthenticated]);

  return {
    authenticate,
    logout,
    isAuthenticating,
    error,
  };
}
