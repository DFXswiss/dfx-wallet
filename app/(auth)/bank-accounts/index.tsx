import { FEATURES } from '@/config/features';

const BankAccountsScreen = FEATURES.BUY_SELL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/bank-accounts/BankAccountsScreen').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/bank-accounts/BankAccountsDisabled').default as React.ComponentType);

export default BankAccountsScreen;
