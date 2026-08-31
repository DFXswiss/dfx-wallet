import type { ViewStyle } from 'react-native';

/** App2's shared selector geometry. Every pay/receive pill uses this object. */
export const SELECTOR_PILL_LAYOUT: Pick<
  ViewStyle,
  'flexGrow' | 'flexShrink' | 'flexBasis' | 'maxWidth' | 'minWidth'
> = {
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: '46%',
  maxWidth: '46%',
  minWidth: 0,
};

/** Canonical identity for the quote inputs used by both Buy and Sell. */
export function makeTradeQuoteKey(input: {
  amount: number;
  currency: string;
  asset: string;
  blockchain: string;
  chain: string;
}): string | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return null;
  return [input.amount, input.currency, input.asset, input.blockchain, input.chain].join('|');
}

const ACCOUNT_GATE_ERRORS = new Set([
  'KycRequired',
  'KycDataRequired',
  'LimitExceeded',
  'NationalityNotAllowed',
  'NameRequired',
  'PaymentMethodNotAllowed',
  'IbanCurrencyMismatch',
  'RecommendationRequired',
  'EmailRequired',
  'CountryNotAllowed',
]);

export function isAccountGateError(error: string | null): boolean {
  return error !== null && ACCOUNT_GATE_ERRORS.has(error);
}
