import { FEATURES } from '@/config/features';

/**
 * Chain-enable/disable management route. Shares the portfolio flag
 * and disabled stub.
 */
const PortfolioManageScreen = FEATURES.PORTFOLIO
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/portfolio/PortfolioManageScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/portfolio/PortfolioDisabled').default as React.ComponentType);

export default PortfolioManageScreen;
