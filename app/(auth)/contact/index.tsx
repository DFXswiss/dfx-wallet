import { FEATURES } from '@/config/features';

const ContactScreen = FEATURES.DFX_BACKEND
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/dfx-backend/screens/ContactScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/dfx-backend/screens/DfxBackendDisabled').default as React.ComponentType);

export default ContactScreen;
