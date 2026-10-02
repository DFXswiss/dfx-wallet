/**
 * No-op replacement for `useDfxAutoLink`. The real hook silently links
 * BTC / EVM / Lightning to the DFX account after sign-in; with the
 * flag off there is no DFX account, so the hook does nothing.
 */
export function useDfxAutoLink(): void {
  // intentionally empty
}
