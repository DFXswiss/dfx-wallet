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

  async getBuyQuote(
    params: {
      amount: number;
      currency: string;
      asset: string;
      blockchain: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<BuyPaymentInfoDto> {
    const [currency, asset] = await Promise.all([
      buildCurrencyRef(params.currency),
      buildAssetRef(params.asset, params.blockchain),
    ]);
    return dfxApi.put<BuyPaymentInfoDto>(
      '/v1/buy/quote',
      {
        amount: params.amount,
        currency,
        asset,
        paymentMethod: 'Bank',
        exactPrice: false,
      },
      options,
    );
  }

  async createBuyPaymentInfo(
    params: {
      amount: number;
      currency: string;
      asset: string;
      blockchain: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<BuyPaymentInfoDto> {
    const [currency, asset] = await Promise.all([
      buildCurrencyRef(params.currency),
      buildAssetRef(params.asset, params.blockchain),
    ]);
    // `paymentMethod` and `exactPrice` are marked `@IsNotEmpty()` on DFX'
    // `GetBuyPaymentInfoDto`. The class has default initializers (`Bank`,
    // `false`) so the validator passes even when we omit them — but the
    // downstream `toPaymentInfoDto` branches on these values to decide
    // which bank info / reference to emit, and routes generated from an
    // omitted-default payload sometimes land in an indeterminate state
    // that DFX' SEPA-matcher refuses to pair. Sending them explicitly
    // mirrors what the @dfx.swiss/react reference SDK does and removes
    // that ambiguity.
    return dfxApi.put<BuyPaymentInfoDto>(
      '/v1/buy/paymentInfos',
      {
        amount: params.amount,
        currency,
        asset,
        paymentMethod: 'Bank',
        exactPrice: false,
      },
      options,
    );
  }

  async confirmBuy(id: number): Promise<void> {
    await dfxApi.put(`/v1/buy/paymentInfos/${id}/confirm`, {});
  }

  // --- Sell ---

  async getSellQuote(
    params: {
      amount: number;
      asset: string;
      blockchain: string;
      currency: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<SellPaymentInfoDto> {
    const [currency, asset] = await Promise.all([
      buildCurrencyRef(params.currency),
      buildAssetRef(params.asset, params.blockchain),
    ]);
    return dfxApi.put<SellPaymentInfoDto>(
      '/v1/sell/quote',
      {
        amount: params.amount,
        currency,
        asset,
        exactPrice: false,
      },
      options,
    );
  }

  async createSellPaymentInfo(
    params: {
      amount: number;
      asset: string;
      blockchain: string;
      currency: string;
      iban: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<SellPaymentInfoDto> {
    const [currency, asset] = await Promise.all([
      buildCurrencyRef(params.currency),
      buildAssetRef(params.asset, params.blockchain),
    ]);
    return dfxApi.put<SellPaymentInfoDto>(
      '/v1/sell/paymentInfos',
      {
        amount: params.amount,
        currency,
        asset,
        iban: params.iban,
        exactPrice: false,
      },
      options,
    );
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
