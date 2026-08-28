import { FEATURES } from '@/config/features';

/**
 * Buy (fiat on-ramp) route. With `EXPO_PUBLIC_ENABLE_BUY_SELL` off,
 * resolves to a `<Redirect>` stub that bounces back to the dashboard.
 */
const BuyScreen = FEATURES.BUY_SELL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/BuyScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/BuySellDisabled').default as React.ComponentType);

export default BuyScreen;
