import { FEATURES } from '@/config/features';

/**
 * Onboarding legal-disclaimer route. With `EXPO_PUBLIC_ENABLE_LEGAL`
 * off, the onboarding flow in `setup-pin.tsx` skips this screen
 * entirely. The wrapper is here as the file-system entry Expo Router
 * needs, plus a safety net for any code path that hard-references the
 * route (the disabled stub just redirects to the dashboard).
 */
const LegalDisclaimerScreen = FEATURES.LEGAL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/legal/LegalDisclaimerScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/legal/LegalDisabled').default as React.ComponentType);

export default LegalDisclaimerScreen;
