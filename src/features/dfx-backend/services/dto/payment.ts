export type AssetDto = {
  id: number;
  name: string;
  uniqueName: string;
  blockchain: string;
};

export type FeeDto = {
  rate: number;
  fixed: number;
  network: number;
  min: number;
  dfx: number;
  total: number;
};

export type PriceStep = {
  source: string;
  from: string;
  to: string;
  price: number;
  timestamp: string;
};

export type PaymentError =
  | 'AmountTooLow'
  | 'AmountTooHigh'
  | 'KycRequired'
  | 'KycDataRequired'
  | 'LimitExceeded'
  | 'NationalityNotAllowed'
  | 'NameRequired'
  | 'PaymentMethodNotAllowed'
  | 'IbanCurrencyMismatch'
  | 'RecommendationRequired'
  | 'EmailRequired'
  | 'CountryNotAllowed'
  | 'AssetUnsupported'
  | 'CurrencyUnsupported';

export type BuyPaymentInfoDto = {
  id: number;
  uid: string;
  routeId: number;
  timestamp: string;
  iban: string;
  bic: string;
  name: string;
  street: string;
  number?: string;
  zip: string;
  city: string;
  country: string;
  sepaInstant: boolean;
  remittanceInfo: string;
  paymentRequest?: string;
  amount: number;
  currency: { id: number; name: string };
  estimatedAmount: number;
  asset: AssetDto;
  exchangeRate: number;
  rate: number;
  exactPrice: boolean;
  priceSteps: PriceStep[];
  minVolume: number;
  maxVolume: number;
  fees: FeeDto;
  feesTarget: FeeDto;
  isValid: boolean;
  /** DFX' BuyQuoteDto exposes a single error code on validation failure
   *  (e.g. ASSET_UNSUPPORTED). Older /v1/buy/quote responses sometimes send
   *  `errors` as an array — we support both shapes. */
  error?: PaymentError;
  errors?: PaymentError[];
  expiryDate?: string;
};

export type SellPaymentInfoDto = {
  id: number;
  uid: string;
  routeId: number;
  timestamp: string;
  depositAddress: string;
  amount: number;
  asset: AssetDto;
  estimatedAmount: number;
  currency: { id: number; name: string };
  beneficiary: { name?: string; iban: string };
  exchangeRate: number;
  rate: number;
  exactPrice: boolean;
  priceSteps: PriceStep[];
  fees: FeeDto;
  feesTarget: FeeDto;
  minVolume: number;
  maxVolume: number;
  isValid: boolean;
  error?: PaymentError;
  errors?: PaymentError[];
  gaslessAvailable?: boolean;
  expiryDate?: string;
};

export type BankAccountDto = {
  id: number;
  iban: string;
  label?: string;
  active: boolean;
  default: boolean;
};
