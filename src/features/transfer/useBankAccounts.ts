import { useEffect, useState } from 'react';
import { FEATURES } from '@/config/features';
import type { BankAccountDto } from '@/features/dfx-backend/services/dto';
import { useAuthStore } from '@/store';

export type BankAccountRow = {
  id: number;
  iban: string;
  label?: string;
};

type PaymentModule = {
  dfxPaymentService: { getBankAccounts: () => Promise<BankAccountDto[]> };
};

/**
 * Lazy handle to the DFX payment service, resolved through a conditional
 * `require()` so a build without the buy/sell flag never loads the API
 * client just for the send overview (same pattern as the auth store). With
 * the flag off there are simply no bank accounts to list.
 */
const paymentModule: PaymentModule | null = FEATURES.BUY_SELL
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/services')
  : null;

/**
 * The user's active DFX bank accounts, for the "Meine Konten" list on the
 * send overview. Empty while signed out, while loading and on any error —
 * the overview then offers "add a bank account" instead.
 */
export function useBankAccounts(): BankAccountRow[] {
  const isDfxAuthenticated = useAuthStore((s) => s.isDfxAuthenticated);
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);

  useEffect(() => {
    if (!paymentModule || !isDfxAuthenticated) {
      setAccounts((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const list = await paymentModule.dfxPaymentService.getBankAccounts();
        if (cancelled) return;
        const active = list.filter((account) => account.active);
        setAccounts(
          active.map((account) => ({
            id: account.id,
            iban: account.iban,
            ...(account.label ? { label: account.label } : {}),
          })),
        );
      } catch {
        if (!cancelled) setAccounts([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isDfxAuthenticated]);

  return accounts;
}
