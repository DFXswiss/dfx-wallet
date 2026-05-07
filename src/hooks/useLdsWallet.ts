import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { ldsService, type LdsUser } from '@/services/lds';

type State = {
  user: LdsUser | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Resolves the user's DFX Lightning identity (lightning.space-managed).
 *
 * The wallet's BIP-84 SegWit address signs a static ownership message;
 * LDS turns that into a Lightning Address (`name@dfx.swiss`) plus an
 * `addressOwnershipProof` that DFX accepts when registering the Lightning
 * blockchain on the user's account.
 *
 * Surfaces:
 *  - `user.lightning.address` — the LN address shown in the Taproot tab
 *  - `user.lightning.addressOwnershipProof` — passed to DFX when linking
 *  - `signIn()` — explicit trigger; otherwise the hook lazy-loads on mount
 */
export function useLdsWallet() {
  const { address, sign } = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const [state, setState] = useState<State>({ user: null, isLoading: false, error: null });
  const inFlight = useRef(false);

  const signIn = useCallback(async (): Promise<LdsUser | null> => {
    if (!address) return null;
    if (inFlight.current) return state.user;
    inFlight.current = true;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const user = await ldsService.getUser(address, async (message) => {
        const result = await sign(message);
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to sign message');
        }
        return result.signature;
      });
      setState({ user, isLoading: false, error: null });
      return user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'LDS sign-in failed';
      setState({ user: null, isLoading: false, error: msg });
      return null;
    } finally {
      inFlight.current = false;
    }
  }, [address, sign, state.user]);

  // Lazy-load on mount once the BTC address is available.
  useEffect(() => {
    if (address && !state.user && !state.isLoading && !state.error) {
      void signIn();
    }
  }, [address, state.user, state.isLoading, state.error, signIn]);

  return { ...state, signIn };
}
