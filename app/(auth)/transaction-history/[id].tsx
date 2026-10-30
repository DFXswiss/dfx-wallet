import { FEATURES } from '@/config/features';

/**
 * Transaction-history detail route. Companion to the list screen;
 * gated by the same flag and shares the disabled stub.
 */
const TxHistoryDetailScreen = FEATURES.TX_HISTORY
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/tx-history/TxHistoryDetailScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/tx-history/TxHistoryDisabled').default as React.ComponentType);

export default TxHistoryDetailScreen;
