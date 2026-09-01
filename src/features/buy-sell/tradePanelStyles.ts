import type { ViewStyle } from 'react-native';

export const TRADE_STEP_GAP = 18;

/** App2's shared selector geometry. Every pay/receive pill uses this object. */
export const SELECTOR_PILL_LAYOUT: Pick<
  ViewStyle,
  'flexGrow' | 'flexShrink' | 'flexBasis' | 'maxWidth' | 'minWidth' | 'width' | 'height'
> = {
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: 152,
  maxWidth: 152,
  minWidth: 152,
  width: 152,
  height: 48,
};

export const TRADE_PANEL_GEOMETRY = {
  panelPaddingVertical: 15,
  panelPaddingHorizontal: 16,
  panelRadius: 22,
  dividerWidth: 1,
  inputGap: 12,
  inputMarginTop: 9,
  flipSize: 40,
  flipRadius: 13,
} as const;

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
