import { useSyncExternalStore } from 'react';
import { pricingService } from '@/services/pricing-service';

const subscribe = (listener: () => void): (() => void) => pricingService.subscribe(listener);
const getSnapshot = (): number => pricingService.getSnapshot();

/** Re-renders consumers whenever the shared pricing cache changes. */
export function usePricingSnapshot(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
