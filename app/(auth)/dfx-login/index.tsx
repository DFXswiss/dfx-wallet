import { FEATURES } from '@/config/features';

/**
 * DFX e-mail-login route. With `EXPO_PUBLIC_ENABLE_DFX_BACKEND` off,
 * resolves to a `<Redirect>` stub.
 */
const DfxLoginScreen = FEATURES.DFX_BACKEND
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/dfx-backend/screens/DfxLoginScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/dfx-backend/screens/DfxBackendDisabled').default as React.ComponentType);

export default DfxLoginScreen;
