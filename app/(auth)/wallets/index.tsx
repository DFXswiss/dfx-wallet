import { FEATURES } from '@/config/features';

const WalletsScreen = FEATURES.DFX_BACKEND
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/dfx-backend/screens/WalletsScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/dfx-backend/screens/DfxBackendDisabled').default as React.ComponentType);

export default WalletsScreen;
