import { dfxApi } from './api';
import { dfxAssetService } from './asset-service';
import { dfxFiatService } from './fiat-service';
import type { BankAccountDto, BuyPaymentInfoDto, SellPaymentInfoDto } from './dto';

/**
 * DFX /buy/quote and friends expect `asset` and `currency` as fully-typed
 * objects with the backend's `id`. The user-facing buy/sell screen only knows
 * symbols ("BTC", "EUR"), so we resolve the IDs once via the public /asset
 * and /fiat endpoints (cached per session) before posting the request.
 */
async function buildAssetRef(symbol: string, blockchain: string) {
  const asset = await dfxAssetService.find(symbol, blockchain);
  if (!asset) {
    throw new Error(`Asset ${symbol} on ${blockchain} not found`);
  }
  // DFX `AssetInDto` requires *either* `id` alone *or* `blockchain` + `chainId`.
  // Sending both makes the backend reject with "Asset blockchain mismatch", so
  // we stick to the canonical id-only form.
  return { id: asset.id };
}

async function buildCurrencyRef(name: string) {
  const fiat = await dfxFiatService.find(name);
  if (!fiat) {
    throw new Error(`Currency ${name} not supported`);
  }
  return { id: fiat.id };
}

export class DfxPaymentService {
  // --- Buy ---

  async getBuyQuote(params: {
    amount: number;
    currency: string;
    asset: string;
    blockchain: string;
  }): Promise<BuyPaymentInfoDto> {
    const [currency, asset] = await Promise.all([
      buildCurrencyRef(params.currency),
      buildAssetRef(params.asset, params.blockchain),
    ]);
    return dfxApi.put<BuyPaymentInfoDto>('/v1/buy/quote', {
      amount: params.amount,
      currency,
      asset,
    });
  }

  async createBuyPaymentInfo(params: {
    amount: number;
    currency: string;
    asset: string;
    blockchain: string;
  }): Promise<BuyPaymentInfoDto> {
    const [currency, asset] = await Promise.all([
      buildCurrencyRef(params.currency),
      buildAssetRef(params.asset, params.blockchain),
    ]);
    return dfxApi.put<BuyPaymentInfoDto>('/v1/buy/paymentInfos', {
      amount: params.amount,
      currency,
      asset,
    });
  }

  async confirmBuy(id: number): Promise<void> {
    await dfxApi.put(`/v1/buy/paymentInfos/${id}/confirm`, {});
  }

  // --- Sell ---

  async getSellQuote(params: {
    amount: number;
    asset: string;
    blockchain: string;
    currency: string;
  }): Promise<SellPaymentInfoDto> {
    const [currency, asset] = await Promise.all([
      buildCurrencyRef(params.currency),
      buildAssetRef(params.asset, params.blockchain),
    ]);
    return dfxApi.put<SellPaymentInfoDto>('/v1/sell/quote', {
      amount: params.amount,
      currency,
      asset,
    });
  }

  async createSellPaymentInfo(params: {
    amount: number;
    asset: string;
    blockchain: string;
    currency: string;
    iban: string;
  }): Promise<SellPaymentInfoDto> {
    const [currency, asset] = await Promise.all([
      buildCurrencyRef(params.currency),
      buildAssetRef(params.asset, params.blockchain),
    ]);
    return dfxApi.put<SellPaymentInfoDto>('/v1/sell/paymentInfos', {
      amount: params.amount,
      currency,
      asset,
      iban: params.iban,
    });
  }

  async confirmSell(id: number): Promise<void> {
    await dfxApi.put(`/v1/sell/paymentInfos/${id}/confirm`, {});
  }

  // --- Bank Accounts ---

  async getBankAccounts(): Promise<BankAccountDto[]> {
    return dfxApi.get<BankAccountDto[]>('/v1/bankAccount');
  }

  async createBankAccount(iban: string, label?: string): Promise<BankAccountDto> {
    return dfxApi.post<BankAccountDto>('/v1/bankAccount', { iban, label });
  }
}

export const dfxPaymentService = new DfxPaymentService();
