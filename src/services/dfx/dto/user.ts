export type UserDto = {
  accountId: number;
  accountType: 'Personal' | 'Organization' | 'SoleProprietorship';
  mail: string | null;
  phone: string | null;
  language: LanguageDto;
  currency: FiatDto;
  tradingLimit: TradingLimitDto;
  kyc: UserKycDto;
  volumes: VolumesDto;
  addresses: UserAddressDto[];
  activeAddress: UserAddressDto;
};

export type UserKycDto = {
  hash: string;
  level: KycLevel;
  dataComplete: boolean;
};

export type KycLevel = 0 | 10 | 20 | 30 | 40 | 50 | 51 | -10 | -20;

export type LanguageDto = {
  id: number;
  name: string;
  symbol: string;
};

export type FiatDto = {
  id: number;
  name: string;
};

export type TradingLimitDto = {
  limit: number;
  period: string;
};

export type VolumesDto = {
  buy: number;
  sell: number;
  swap: number;
};

export type UserAddressDto = {
  address: string;
  blockchain: string;
  blockchains: string[];
};
