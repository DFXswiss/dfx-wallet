import { dfxAuthService } from '@/features/dfx-backend/services';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';

export const LOCAL_SESSION_ENDED_MESSAGE = 'Local wallet session ended during DFX authentication';

export type DfxSessionGuard = {
  /** Throws after cleaning up only this flow's DFX auth when the local session ended or changed. */
  assertActive(ownToken?: string): Promise<void>;
  /** Persists a token only while the captured local wallet session remains active. */
  persistToken(token: string): Promise<void>;
};

export function createDfxSessionGuard(): DfxSessionGuard {
  const sessionEpoch = useAuthStore.getState().sessionEpoch;
  let flowToken: string | undefined;
  let hasWrittenToken = false;

  const assertActive = async (ownToken?: string): Promise<void> => {
    if (ownToken !== undefined) flowToken = ownToken;

    const state = useAuthStore.getState();
    if (state.sessionEpoch === sessionEpoch && state.isAuthenticated && state.isOnboarded) {
      return;
    }

    if (hasWrittenToken && flowToken !== undefined) {
      try {
        const storedToken = await secureStorage.get(StorageKeys.DFX_AUTH_TOKEN);
        if (storedToken === flowToken) {
          await secureStorage.remove(StorageKeys.DFX_AUTH_TOKEN);
        }
      } catch {
        // The local-session error must remain authoritative even when cleanup fails.
      }
    }
    if (flowToken !== undefined && dfxAuthService.getAccessToken() === flowToken) {
      dfxAuthService.logout();
    }
    throw new Error(LOCAL_SESSION_ENDED_MESSAGE);
  };

  return {
    assertActive,
    persistToken: async (token) => {
      flowToken = token;
      await assertActive(token);
      await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
      hasWrittenToken = true;
      await assertActive(token);
    },
  };
}
