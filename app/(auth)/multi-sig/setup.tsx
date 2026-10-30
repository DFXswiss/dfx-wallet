import { FEATURES } from '@/config/features';

/**
 * Multi-sig setup wizard route. Companion to `multi-sig/index.tsx`;
 * both routes are gated by the same `EXPO_PUBLIC_ENABLE_MULTISIG`
 * flag and share the disabled-path component.
 */
const MultiSigSetupScreen = FEATURES.MULTISIG
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/multi-sig/MultiSigSetupScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/multi-sig/MultiSigDisabled').default as React.ComponentType);

export default MultiSigSetupScreen;
