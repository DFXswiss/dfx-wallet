/**
 * Build-time E2E / visual-regression flag.
 *
 * Set `EXPO_PUBLIC_E2E=true` only in the deterministic visual-regression build
 * (the mvp/full legs of .github/workflows/visual-regression.yml). It gates off
 * live-network background work that makes the suite flaky and keeps the app
 * from ever reporting "idle" to Detox — see docs/visual-regression.md. Unset
 * everywhere else, so production and Maestro builds are unaffected.
 *
 * Read the named `IS_E2E` constant; never re-read `process.env.EXPO_PUBLIC_E2E`
 * directly elsewhere, so the build-time replacement stays auditable (mirrors
 * the src/config/features.ts convention).
 */
export const IS_E2E = process.env.EXPO_PUBLIC_E2E === 'true';
