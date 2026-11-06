import { dfxApi } from './api';
import { dfxUserService } from './user-service';
import type { KycLevelDto, KycSessionDto } from './dto';

export type RegistrationEmailStatus = 'email_registered' | 'merge_requested';

export class DfxKycService {
  async getKycStatus(): Promise<KycLevelDto> {
    return dfxApi.get<KycLevelDto>('/v2/kyc', { headers: await this.getKycHeaders() });
  }

  async continueKyc(): Promise<KycSessionDto> {
    return dfxApi.put<KycSessionDto>('/v2/kyc', undefined, {
      headers: await this.getKycHeaders(),
    });
  }

  async submitContactData(id: number, data: { mail: string }): Promise<void> {
    await dfxApi.put(`/v2/kyc/data/contact/${id}`, data, { headers: await this.getKycHeaders() });
  }

  async registerEmail(email: string): Promise<RegistrationEmailStatus> {
    const response = await dfxApi.post<{ status: RegistrationEmailStatus }>(
      '/v1/realunit/register/email',
      { email: email.toLowerCase(), wallet: 'DFX Wallet' },
    );
    return response.status;
  }

  async submitPersonalData(
    id: number,
    data: { firstName: string; lastName: string; phone?: string },
  ): Promise<void> {
    await dfxApi.put(`/v2/kyc/data/personal/${id}`, data, { headers: await this.getKycHeaders() });
  }

  async submitNationalityData(
    id: number,
    data: { nationality: string; country: string },
  ): Promise<void> {
    await dfxApi.put(`/v2/kyc/data/nationality/${id}`, data, {
      headers: await this.getKycHeaders(),
    });
  }

  async submitFinancialData(id: number, data: Record<string, unknown>): Promise<void> {
    await dfxApi.put(`/v2/kyc/data/financial/${id}`, data, {
      headers: await this.getKycHeaders(),
    });
  }

  async request2fa(): Promise<void> {
    await dfxApi.post('/v2/kyc/2fa?level=Strict', undefined, {
      headers: await this.getKycHeaders(),
    });
  }

  async verify2fa(code: string): Promise<void> {
    await dfxApi.post(
      '/v2/kyc/2fa/verify',
      { token: code },
      { headers: await this.getKycHeaders() },
    );
  }

  private async getKycHeaders(): Promise<Record<string, string>> {
    const user = await dfxUserService.getUser();
    return { 'x-kyc-code': user.kyc.hash };
  }
}

export const dfxKycService = new DfxKycService();
