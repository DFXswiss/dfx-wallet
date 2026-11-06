export type SignMessageDto = {
  message: string;
  blockchains: string[];
};

export type AuthRequestDto = {
  address: string;
  signature: string;
  wallet?: string;
  key?: string;
  blockchain?: string;
  specialCode?: string;
  usedRef?: string;
  language?: string;
  walletType?: string;
  recommendationCode?: string;
};

export type AuthResponseDto = {
  accessToken: string;
};
