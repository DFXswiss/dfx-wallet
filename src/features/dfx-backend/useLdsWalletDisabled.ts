/**
 * No-op replacement for `useLdsWallet`. The real hook signs a Bitcoin
 * SegWit message and exchanges it for an LDS JWT to surface the user's
 * Lightning address. With `EXPO_PUBLIC_ENABLE_DFX_BACKEND` off, no
 * Lightning identity is fetched and the hook returns an empty state.
 */
type LdsApi = {
  user: null;
  isLoading: false;
  error: null;
  signIn: () => Promise<void>;
};

const NOOP_API: LdsApi = {
  user: null,
  isLoading: false,
  error: null,
  signIn: async () => undefined,
};

export function useLdsWallet(): LdsApi {
  return NOOP_API;
}
