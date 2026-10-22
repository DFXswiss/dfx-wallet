import { FEATURES } from '@/config/features';

/**
 * Swap route. Buy/Sell/Swap are one module (`TradeScreen`) switched by an
 * in-place tab, not three routes navigating between each other — this route
 * only mounts `TradeScreen` with `initialMode="swap"`. Swap has no deep-link
 * params today, unlike Buy/Sell.
 */
const SwapScreen = FEATURES.BUY_SELL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/TradeScreen').default as React.ComponentType<{
      initialMode: 'swap';
    }>)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/BuySellDisabled').default as unknown as React.ComponentType<{
      initialMode: 'swap';
    }>);

export default function SwapRoute() {
  return <SwapScreen initialMode="swap" />;
}
