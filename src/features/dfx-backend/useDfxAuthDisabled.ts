/**
 * No-op replacement for `useDfxAuth` when `EXPO_PUBLIC_ENABLE_DFX_BACKEND`
 * is off. Same return shape so existing call sites compile.
 *
 * Authenticate / silent-auth / reauth return falsy results; logout is a
 * no-op. Nothing reaches the DFX API, the auth service, or the JWT
 * round-trip.
 */
type DfxAuthApi = {
  authenticate: () => Promise<boolean>;
  authenticateSilent: () => Promise<boolean>;
  reauthenticateAsOwner: () => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticating: boolean;
  error: string | null;
};

const NOOP_API: DfxAuthApi = {
  authenticate: async () => false,
  authenticateSilent: async () => false,
  reauthenticateAsOwner: async () => false,
  logout: async () => undefined,
  isAuthenticating: false,
  error: null,
};

export function useDfxAuth(): DfxAuthApi {
  return NOOP_API;
}
