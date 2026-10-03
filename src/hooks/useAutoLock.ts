import { FEATURES } from '@/config/features';
import { AUTO_LOCK_AFTER_MS } from '@/hooks/useAutoLockConstants';

const useAutoLock: () => void = FEATURES.PIN
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/hooks/useAutoLockImpl').useAutoLock
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/hooks/useAutoLockDisabled').useAutoLock;

export { AUTO_LOCK_AFTER_MS, useAutoLock };
