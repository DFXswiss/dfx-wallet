import { FEATURES } from '@/config/features';

/**
 * Dashboard balance aggregator. Resolves at build time to one of two
 * implementations under `src/features/portfolio/`:
 *
 *   - `useTotalPortfolioFiatFull` — sums the internal WDK balances while
 *     respecting the user's enabled-chain settings. DFX-linked wallets are
 *     intentionally displayed separately and are not part of this available
 *     balance.
 *   - `useTotalPortfolioFiatLocal` — sums only the local WDK balances
 *     against the pricing service. Used in MVP builds where any of the
 *     above flags is off.
 *
 * The conditional `require()` is intentional: the dashboard imports
 * `useTotalPortfolioFiat` unconditionally, but Metro's dead-code
 * elimination should drop the unused module from the bundle, keeping
 * the deferred linked-wallets / DFX dependencies out of MVP builds.
 */
const useTotalPortfolioFiat: () => number =
  FEATURES.PORTFOLIO && FEATURES.LINKED_WALLETS && FEATURES.DFX_BACKEND
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/features/portfolio/useTotalPortfolioFiatFull').useTotalPortfolioFiat
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/features/portfolio/useTotalPortfolioFiatLocal').useTotalPortfolioFiat;

export { useTotalPortfolioFiat };
