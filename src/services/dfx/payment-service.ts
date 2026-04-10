import { dfxApi } from './api';
import type { BankAccountDto, BuyPaymentInfoDto, SellPaymentInfoDto } from './dto';

export class DfxPaymentService {
  // --- Buy ---

  async getBuyQuote(params: {
    amount: number;
    currency: string;
    asset: string;
    blockchain: string;
  }): Promise<BuyPaymentInfoDto> {
    return dfxApi.put<BuyPaymentInfoDto>('/buy/quote', params);
  }

  async createBuyPaymentInfo(params: {
    amount: number;
    currency: string;
    asset: string;
    blockchain: string;
  }): Promise<BuyPaymentInfoDto> {
    return dfxApi.put<BuyPaymentInfoDto>('/buy/paymentInfos', params);
  }

  async confirmBuy(id: number): Promise<void> {
    await dfxApi.put(`/buy/paymentInfos/${id}/confirm`, {});
  }

  // --- Sell ---

  async getSellQuote(params: {
    amount: number;
    asset: string;
    blockchain: string;
    currency: string;
  }): Promise<SellPaymentInfoDto> {
    return dfxApi.put<SellPaymentInfoDto>('/sell/quote', params);
  }

  async createSellPaymentInfo(params: {
    amount: number;
    asset: string;
    blockchain: string;
    currency: string;
    iban: string;
  }): Promise<SellPaymentInfoDto> {
    return dfxApi.put<SellPaymentInfoDto>('/sell/paymentInfos', params);
  }

  async confirmSell(id: number): Promise<void> {
    await dfxApi.put(`/sell/paymentInfos/${id}/confirm`, {});
  }

  // --- Bank Accounts ---

  async getBankAccounts(): Promise<BankAccountDto[]> {
    return dfxApi.get<BankAccountDto[]>('/bankAccount');
  }

  async createBankAccount(iban: string, label?: string): Promise<BankAccountDto> {
    return dfxApi.post<BankAccountDto>('/bankAccount', { iban, label });
  }
}

export const dfxPaymentService = new DfxPaymentService();
