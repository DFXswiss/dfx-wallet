import { FEATURES } from '@/config/features';

/**
 * Transaction-history list route. Loads the DFX transaction service
 * and renders typed Buy/Sell/Send/Receive/Swap rows. With
 * `EXPO_PUBLIC_ENABLE_TX_HISTORY` off, resolves to a `<Redirect>` stub.
 */
const TxHistoryListScreen = FEATURES.TX_HISTORY
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/tx-history/TxHistoryListScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/tx-history/TxHistoryDisabled').default as React.ComponentType);

export default TxHistoryListScreen;
