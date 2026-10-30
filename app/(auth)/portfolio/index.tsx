import { FEATURES } from '@/config/features';

/**
 * Portfolio (local + DFX-linked) screen entry. With
 * `EXPO_PUBLIC_ENABLE_PORTFOLIO` off, resolves to a `<Redirect>` stub.
 */
const PortfolioScreen = FEATURES.PORTFOLIO
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/portfolio/PortfolioScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/portfolio/PortfolioDisabled').default as React.ComponentType);

export default PortfolioScreen;
