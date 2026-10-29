import { useEffect, useRef, useState } from 'react';
import { dfxApi, dfxUserService } from '@/features/dfx-backend/services';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';

export type LinkedWalletProfile = {
  linkedAddresses: UserAddressDto[];
  activeAddress: string | null;
  isIncomplete: boolean;
};

/**
 * Load the DFX profile fields needed to select linked wallets for portfolio totals.
 * Increment refreshKey to retry without discarding the last successful profile.
 */
export function useLinkedWalletProfile(
  isDfxAuthenticated: boolean,
  refreshKey = 0,
): LinkedWalletProfile {
  const [linkedAddresses, setLinkedAddresses] = useState<UserAddressDto[]>([]);
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [isIncomplete, setIsIncomplete] = useState(isDfxAuthenticated);
  const requestRef = useRef({ isDfxAuthenticated, refreshKey });
  const requestChanged =
    requestRef.current.isDfxAuthenticated !== isDfxAuthenticated ||
    requestRef.current.refreshKey !== refreshKey;

  useEffect(() => {
    requestRef.current = { isDfxAuthenticated, refreshKey };
    if (!isDfxAuthenticated) {
      setLinkedAddresses([]);
      setActiveAddress(null);
      setIsIncomplete(false);
      return;
    }

    setIsIncomplete(true);
    let cancelled = false;
    const loadProfile = async () => {
      while (!cancelled) {
        const generation = dfxApi.getAuthGeneration();
        try {
          const user = await dfxUserService.getUser();
          if (cancelled) return;
          // A generation change means this profile belongs to a session that has
          // already ended. Discard it and fetch again; isIncomplete stays true
          // until a fetch starts and ends on the same generation.
          if (dfxApi.getAuthGeneration() !== generation) continue;
          setLinkedAddresses(user.addresses ?? []);
          setActiveAddress(user.activeAddress?.address ?? null);
          setIsIncomplete(false);
          return;
        } catch {
          if (cancelled) return;
          setIsIncomplete(true);
          return;
        }
      }
    };
    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isDfxAuthenticated, refreshKey]);

  return {
    linkedAddresses,
    activeAddress,
    isIncomplete: isDfxAuthenticated && (requestChanged || isIncomplete),
  };
}
