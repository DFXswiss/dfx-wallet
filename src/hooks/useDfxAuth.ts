import { useCallback, useState } from 'react';
import { useWallet, useWalletManager } from '@tetherto/wdk-react-native-core';
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
  const { wallets, activeWalletId } = useWalletManager();
  const currentWalletId = activeWalletId || wallets[0]?.identifier || 'default';
  const { addresses, callAccountMethod } = useWallet({ walletId: currentWalletId });
  const { setDfxAuthenticated } = useAuthStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    const ethAddress = addresses['ethereum']?.[0];
    if (!ethAddress) {
      setError('No Ethereum address available. Create a wallet first.');
      return null;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const token = await dfxAuthService.login(
        ethAddress,
        async (message) => callAccountMethod<string>('ethereum', 0, 'sign', message),
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
  }, [addresses, callAccountMethod, setDfxAuthenticated]);

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
