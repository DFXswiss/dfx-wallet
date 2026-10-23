import { dfxAuthService } from '@/features/dfx-backend/services';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';
import { constantTimeEqual } from '@/services/security/constant-time';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore } from '@/store';

export const LOCAL_SESSION_ENDED_MESSAGE = 'Local wallet session ended during DFX authentication';

export function isLocalSessionEndedError(error: unknown): boolean {
  return (
    error instanceof DfxAuthFlowInvalidatedError ||
    (error instanceof Error && error.message === LOCAL_SESSION_ENDED_MESSAGE)
  );
}

export type DfxSessionGuard = {
  /** Throws after cleaning up only this flow's DFX auth when the local session ended or changed. */
  assertActive(ownToken?: string): Promise<void>;
  /** Persists a token only while the captured local wallet session remains active. */
  persistToken(token: string): Promise<void>;
};

let tokenWriteQueue: Promise<void> = Promise.resolve();

function enqueueTokenWrite(token: string): Promise<void> {
  const write = tokenWriteQueue.then(async () => {
    const currentToken = dfxAuthService.getAccessToken();
    if (currentToken === null || !constantTimeEqual(currentToken, token)) {
      throw new DfxAuthFlowInvalidatedError();
    }
    await secureStorage.set(StorageKeys.DFX_AUTH_TOKEN, token);
  });
  tokenWriteQueue = write.catch(() => undefined);
  return write;
}

export function createDfxSessionGuard(): DfxSessionGuard {
  const sessionEpoch = useAuthStore.getState().sessionEpoch;
  let flowToken: string | undefined;
  let hasWrittenToken = false;

  const removeWrittenFlowToken = async (): Promise<void> => {
    if (!hasWrittenToken || flowToken === undefined) return;
    try {
      const storedToken = await secureStorage.get(StorageKeys.DFX_AUTH_TOKEN);
      if (storedToken !== null && constantTimeEqual(storedToken, flowToken)) {
        await secureStorage.remove(StorageKeys.DFX_AUTH_TOKEN);
      }
    } catch {
      // The invalidation error must remain authoritative even when cleanup fails.
    }
  };

  const assertActive = async (ownToken?: string): Promise<void> => {
    if (ownToken !== undefined) flowToken = ownToken;

    const state = useAuthStore.getState();
    const localSessionActive =
      state.sessionEpoch === sessionEpoch && state.isAuthenticated && state.isOnboarded;
    if (localSessionActive) {
      const currentToken = dfxAuthService.getAccessToken();
      if (
        ownToken === undefined ||
        (currentToken !== null && constantTimeEqual(currentToken, ownToken))
      ) {
        return;
      }
      await removeWrittenFlowToken();
      throw new DfxAuthFlowInvalidatedError();
    }

    await removeWrittenFlowToken();
    if (flowToken !== undefined) {
      const currentToken = dfxAuthService.getAccessToken();
      if (currentToken !== null && constantTimeEqual(currentToken, flowToken)) {
        dfxAuthService.logout();
      }
    }
    throw new Error(LOCAL_SESSION_ENDED_MESSAGE);
  };

  return {
    assertActive,
    persistToken: async (token) => {
      flowToken = token;
      await assertActive(token);
      await enqueueTokenWrite(token);
      hasWrittenToken = true;
      await assertActive(token);
    },
  };
}
