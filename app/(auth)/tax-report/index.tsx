import { FEATURES } from '@/config/features';

/**
 * Tax-report route entry. Same conditional-`require()` pattern as
 * `app/(auth)/pay/index.tsx`: the file stays in place because Expo
 * Router scans `app/`, but the body resolves to either the real screen
 * (which pulls in the DFX transaction service, `expo-file-system` and
 * the optional `expo-sharing` native module) or a tiny redirect stub.
 *
 * With `FEATURES.TAX_REPORT` off, a production build will not load the
 * CSV export pipeline or the share-sheet bridge.
 */
const TaxReportScreen = FEATURES.TAX_REPORT
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/tax-report/TaxReportScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/tax-report/TaxReportDisabled').default as React.ComponentType);

export default TaxReportScreen;
