import { FEATURES } from '@/config/features';

/**
 * Pay route entry. Expo Router requires this file at
 * `app/(auth)/pay/index.tsx` (file-based routing), so it cannot be
 * removed when the feature is off. Instead we resolve to one of two
 * sibling modules under `src/features/pay/`:
 *
 *   - `PayScreenImpl` — the real QR-scanner screen, pulls in
 *     `expo-camera`, `CameraView`, `useCameraPermissions`, the
 *     translation/asset chain.
 *   - `PayDisabled`   — a tiny `<Redirect>` stub.
 *
 * `FEATURES.PAY` is a build-time boolean literal (Expo inlines
 * `process.env.EXPO_PUBLIC_*` via babel-preset-expo). Combined with
 * the conditional `require()`, Metro's dead-code elimination can drop
 * the unused module from the bundle: a production build with the flag
 * unset never loads `expo-camera` or the scanner logic.
 *
 * Don't refactor the ternary into a plain `import` — that would defeat
 * the DCE and reintroduce the camera-stack into every MVP build.
 */
const PayScreen = FEATURES.PAY
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/pay/PayScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/pay/PayDisabled').default as React.ComponentType);

export default PayScreen;
