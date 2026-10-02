import { isIban, isPlausibleAddress, normalizeAddressInput } from '@/features/transfer/address';
import { isOpenCryptoPayQR } from '@/services/opencryptopay';

export type ScanResult =
  | { kind: 'ocp'; lnurl: string }
  | { kind: 'address'; address: string; amount?: string }
  | { kind: 'iban'; iban: string }
  | { kind: 'unknown'; data: string };

const BITCOIN_URI_PATTERN = /^bitcoin:/i;
const BITCOIN_AMOUNT_PATTERN = /^\d{1,21}\.?\d{0,8}$/;

export function parseBitcoinAmount(value: string | undefined): string | undefined {
  if (!value || !BITCOIN_AMOUNT_PATTERN.test(value)) return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? value : undefined;
}

const getBitcoinAmount = (data: string): string | undefined => {
  const trimmed = data.trim();
  if (!BITCOIN_URI_PATTERN.test(trimmed)) return undefined;

  const query = trimmed.split('?')[1];
  if (!query) return undefined;

  return parseBitcoinAmount(new URLSearchParams(query).get('amount') ?? undefined);
};

export function classifyScan(data: string): ScanResult {
  if (isOpenCryptoPayQR(data)) return { kind: 'ocp', lnurl: data };

  if (isIban(data)) return { kind: 'iban', iban: data.replace(/\s/g, '') };

  const address = normalizeAddressInput(data);
  if (isPlausibleAddress(address)) {
    const amount = getBitcoinAmount(data);
    return amount ? { kind: 'address', address, amount } : { kind: 'address', address };
  }

  return { kind: 'unknown', data };
}
