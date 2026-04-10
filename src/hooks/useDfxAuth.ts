import { useCallback, useState } from 'react';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { dfxAuthService } from '@/services/dfx';
import { secureStorage, StorageKeys } from '@/services/storage';

/**
 * Hook for DFX API authentication via wallet signature.
 *
 * Flow:
 * 1. Get sign message challenge from DFX API
 * 2. Sign with WDK wallet (or BitBox hardware wallet)
 * 3. Exchange signature for JWT
 * 4. Store token for subsequent API calls
 */
export function useDfxAuth() {
  const { addresses } = useWallet();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(
    async (signFn?: (message: string) => Promise<string>) => {
      const ethAddress = addresses?.ethereum;
      if (!ethAddress) {
        setError('No Ethereum address available');
        return null;
      }

      setIsAuthenticating(true);
      setError(null);

      try {
        // Use provided signFn or default WDK signing
        const signer = signFn ?? (async (message: string) => {
          // TODO: Use WDK wallet signMessage when available
          // const signature = await wdkService.signMessage('ethereum', message);
          throw new Error('WDK message signing not yet implemented');
        });

        const token = await dfxAuthService.login(ethAddress, signer, {
          wallet: 'DFX Wallet',
          blockchain: 'Ethereum',
        });

        await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
        setIsAuthenticated(true);
        return token;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Authentication failed';
        setError(msg);
        return null;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [addresses],
  );

  const logout = useCallback(async () => {
    dfxAuthService.logout();
    await secureStorage.remove(StorageKeys.DFX_AUTH_TOKEN);
    setIsAuthenticated(false);
  }, []);

  const restoreSession = useCallback(async () => {
    const token = await secureStorage.get(StorageKeys.DFX_AUTH_TOKEN);
    if (token) {
      dfxAuthService.authenticate({ address: '', signature: '' }).catch(() => {
        // Token might be expired, will re-auth on next API call
      });
      setIsAuthenticated(true);
    }
  }, []);

  return {
    authenticate,
    logout,
    restoreSession,
    isAuthenticating,
    isAuthenticated,
    error,
  };
}
