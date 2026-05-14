import { FEATURES } from '@/config/features';

/**
 * Sell (fiat off-ramp) route. Companion to `buy/index.tsx`; gated by
 * the same flag and shares the disabled stub.
 */
const SellScreen = FEATURES.BUY_SELL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/SellScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/BuySellDisabled').default as React.ComponentType);

export default SellScreen;
