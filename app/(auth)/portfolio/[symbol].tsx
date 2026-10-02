import { FEATURES } from '@/config/features';

/**
 * Asset-detail route. Companion to the portfolio index; gated by the
 * same flag and shares the disabled stub.
 */
const PortfolioAssetDetailScreen = FEATURES.PORTFOLIO
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/portfolio/PortfolioAssetDetailScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/portfolio/PortfolioDisabled').default as React.ComponentType);

export default PortfolioAssetDetailScreen;
