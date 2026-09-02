import { FEATURES } from '@/config/features';

const SwapScreen = FEATURES.BUY_SELL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/SwapScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/BuySellDisabled').default as React.ComponentType);

export default SwapScreen;
