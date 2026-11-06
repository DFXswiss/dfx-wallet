import { FEATURES } from '@/config/features';

/**
 * Settings → Legal-documents launcher route. Pulls in the `Linking`
 * + `safe-url` chain to hand a list of legal-document URLs off to the
 * OS browser; with the flag off, the route is a `<Redirect>` stub.
 */
const LegalDocumentsScreen = FEATURES.LEGAL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/legal/LegalDocumentsScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/legal/LegalDisabled').default as React.ComponentType);

export default LegalDocumentsScreen;
