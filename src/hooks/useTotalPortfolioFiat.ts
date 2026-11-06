import { FEATURES } from '@/config/features';

/**
 * Dashboard balance aggregator. Resolves at build time to one of two
 * implementations under `src/features/portfolio/`:
 *
 *   - `useTotalPortfolioFiatFull`  — includes the user's DFX-linked
 *     wallets in the sum, pulls in `useLinkedWalletDiscovery`,
 *     `useEnabledChains`, and the DFX user service. Used when all of
 *     `FEATURES.PORTFOLIO`, `FEATURES.LINKED_WALLETS`, and
 *     `FEATURES.DFX_BACKEND` are on.
 *   - `useTotalPortfolioFiatLocal` — sums only the local WDK balances
 *     against the pricing service. Used in MVP builds where any of the
 *     above flags is off.
 *
 * The conditional `require()` is intentional: the dashboard imports
 * `useTotalPortfolioFiat` unconditionally, while the feature gate keeps
 * the unused module from executing. Metro still includes both branches
 * in the JavaScript bundle.
 */
const useTotalPortfolioFiat: () => { totalFiat: number; isIncomplete: boolean } =
  FEATURES.PORTFOLIO && FEATURES.LINKED_WALLETS && FEATURES.DFX_BACKEND
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/features/portfolio/useTotalPortfolioFiatFull').useTotalPortfolioFiat
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/features/portfolio/useTotalPortfolioFiatLocal').useTotalPortfolioFiat;

export { useTotalPortfolioFiat };
