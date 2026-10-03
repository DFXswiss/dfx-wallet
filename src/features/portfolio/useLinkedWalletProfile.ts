import { useEffect, useRef, useState } from 'react';
import { dfxUserService } from '@/features/dfx-backend/services';
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
    void dfxUserService
      .getUser()
      .then((user) => {
        if (cancelled) return;
        setLinkedAddresses(user.addresses ?? []);
        setActiveAddress(user.activeAddress?.address ?? null);
        setIsIncomplete(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsIncomplete(true);
      });

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
