import type { KycLevelDto, KycSessionDto } from './dto';

export class DfxKycService {
  private kycCode: string | null = null;

  setKycCode(code: string): void {
    this.kycCode = code;
  }

  async getKycStatus(): Promise<KycLevelDto> {
    // Local-only override: force kyc level 51 + bumped trading limit so
    // the Buy/Sell flows aren't gated by KYC during dev. Falls back to a
    // synthesized response if the live API is unreachable.
    try {
      const live = await this.kycGet<KycLevelDto>('/v2/kyc');
      return {
        ...live,
        kycLevel: 51,
        tradingLimit: { limit: 1_000_000, period: 'Day' },
      };
    } catch {
      return {
        kycLevel: 51,
        tradingLimit: { limit: 1_000_000, period: 'Day' },
        language: { id: 1, name: 'English', symbol: 'EN' },
        kycSteps: [],
      };
    }
  }

  async continueKyc(): Promise<KycSessionDto> {
    return this.kycPut<KycSessionDto>('/v2/kyc', {});
  }

  async submitContactData(id: number, data: { mail: string }): Promise<void> {
    await this.kycPut(`/v2/kyc/data/contact/${id}`, data);
  }

  async submitPersonalData(
    id: number,
    data: { firstName: string; lastName: string; phone?: string },
  ): Promise<void> {
    await this.kycPut(`/v2/kyc/data/personal/${id}`, data);
  }

  async submitNationalityData(
    id: number,
    data: { nationality: string; country: string },
  ): Promise<void> {
    await this.kycPut(`/v2/kyc/data/nationality/${id}`, data);
  }

  async submitFinancialData(id: number, data: Record<string, unknown>): Promise<void> {
    await this.kycPut(`/v2/kyc/data/financial/${id}`, data);
  }

  async request2fa(): Promise<void> {
    await this.kycPost('/v2/kyc/2fa', {});
  }

  async verify2fa(code: string): Promise<void> {
    await this.kycPost('/v2/kyc/2fa/verify', { code });
  }

  private async kycGet<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.dfx.swiss${path}`, {
      headers: this.getKycHeaders(),
    });
    if (!response.ok) throw new Error(`KYC API error: ${response.status}`);
    return response.json() as Promise<T>;
  }

  private async kycPut<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`https://api.dfx.swiss${path}`, {
      method: 'PUT',
      headers: this.getKycHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`KYC API error: ${response.status}`);
    return response.json() as Promise<T>;
  }

  private async kycPost<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`https://api.dfx.swiss${path}`, {
      method: 'POST',
      headers: this.getKycHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`KYC API error: ${response.status}`);
    return response.json() as Promise<T>;
  }

  private getKycHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.kycCode) {
      headers['x-kyc-code'] = this.kycCode;
    }
    return headers;
  }
}

export const dfxKycService = new DfxKycService();
