import { useLocalSearchParams } from 'expo-router';
import { FEATURES } from '@/config/features';
import type { TradeScreenProps } from '@/features/buy-sell/TradeScreen';

/**
 * Buy (fiat on-ramp) route. With `EXPO_PUBLIC_ENABLE_BUY_SELL` off,
 * resolves to a `<Redirect>` stub that bounces back to the dashboard.
 *
 * Buy/Sell/Swap are one module (`TradeScreen`) switched by an in-place tab,
 * not three routes navigating between each other — this route only reads
 * the deep-link params and hands them to `TradeScreen` as the `initialMode`
 * adapter's props. See `src/features/buy-sell/TradeScreen.tsx`.
 */
const TradeScreen = FEATURES.BUY_SELL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/TradeScreen').default as React.ComponentType<TradeScreenProps>)
  : null;
const BuySellDisabled = !FEATURES.BUY_SELL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/buy-sell/BuySellDisabled').default as React.ComponentType)
  : null;

type BuyRouteParams = {
  asset?: string;
  chain?: string;
  targetAddress?: string;
  targetBlockchain?: string;
};

export default function BuyRoute() {
  const params = useLocalSearchParams<BuyRouteParams>();

  if (TradeScreen) {
    return (
      <TradeScreen
        initialMode="buy"
        asset={typeof params.asset === 'string' ? params.asset : undefined}
        chain={typeof params.chain === 'string' ? params.chain : undefined}
        targetAddress={typeof params.targetAddress === 'string' ? params.targetAddress : undefined}
        targetBlockchain={
          typeof params.targetBlockchain === 'string' ? params.targetBlockchain : undefined
        }
      />
    );
  }
  if (BuySellDisabled) {
    return <BuySellDisabled />;
  }
  return null;
}
