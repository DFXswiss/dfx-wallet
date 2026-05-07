import { dfxApi } from './api';
import { dfxAssetService } from './asset-service';
import type { BankAccountDto, BuyPaymentInfoDto, SellPaymentInfoDto } from './dto';

async function buildAssetRef(symbol: string, blockchain: string) {
  // DFX /buy/quote expects asset as an object with id (and for EVM also
  // evmChainId + blockchain). We resolve the id by name+blockchain via /asset.
  const asset = await dfxAssetService.find(symbol, blockchain);
  if (!asset) {
    throw new Error(`Asset ${symbol} on ${blockchain} not found`);
  }
  return {
    id: asset.id,
    blockchain: asset.blockchain,
    ...(asset.evmChainId != null ? { evmChainId: asset.evmChainId } : {}),
  };
}

export class DfxPaymentService {
  // --- Buy ---

  async getBuyQuote(params: {
    amount: number;
    currency: string;
    asset: string;
    blockchain: string;
  }): Promise<BuyPaymentInfoDto> {
    return dfxApi.put<BuyPaymentInfoDto>('/buy/quote', {
      amount: params.amount,
      currency: { name: params.currency },
      asset: await buildAssetRef(params.asset, params.blockchain),
    });
  }

  async createBuyPaymentInfo(params: {
    amount: number;
    currency: string;
    asset: string;
    blockchain: string;
  }): Promise<BuyPaymentInfoDto> {
    return dfxApi.put<BuyPaymentInfoDto>('/buy/paymentInfos', {
      amount: params.amount,
      currency: { name: params.currency },
      asset: await buildAssetRef(params.asset, params.blockchain),
    });
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
    return dfxApi.put<SellPaymentInfoDto>('/sell/quote', {
      amount: params.amount,
      currency: { name: params.currency },
      asset: await buildAssetRef(params.asset, params.blockchain),
    });
  }

  async createSellPaymentInfo(params: {
    amount: number;
    asset: string;
    blockchain: string;
    currency: string;
    iban: string;
  }): Promise<SellPaymentInfoDto> {
    return dfxApi.put<SellPaymentInfoDto>('/sell/paymentInfos', {
      amount: params.amount,
      currency: { name: params.currency },
      asset: await buildAssetRef(params.asset, params.blockchain),
      iban: params.iban,
    });
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
