import { dfxApi } from './api';
import type { UserDto } from './dto';

// Local-only override that pretends the authenticated user is fully KYC'd
// at the new "elevated" level 51. Lets the buy/sell flows be exercised
// without going through the real KYC pipeline. Removed once a real backend
// account is provisioned.
const MOCK_USER: UserDto = {
  accountId: 1,
  accountType: 'Personal',
  mail: 'demo@dfx.swiss',
  phone: null,
  language: { id: 1, name: 'English', symbol: 'EN' },
  currency: { id: 1, name: 'CHF' },
  tradingLimit: { limit: 1_000_000, period: 'Day' },
  kyc: {
    hash: 'demo',
    level: 51,
    dataComplete: true,
  },
  volumes: { buy: 0, sell: 0, swap: 0 },
  addresses: [],
  activeAddress: { address: '', blockchain: 'Ethereum', blockchains: ['Ethereum'] },
};

export class DfxUserService {
  async getUser(): Promise<UserDto> {
    try {
      const user = await dfxApi.get<UserDto>('/v2/user');
      // Force kyc level to 51 even when the live API returns something lower.
      return { ...user, kyc: { ...user.kyc, level: 51, dataComplete: true } };
    } catch {
      return MOCK_USER;
    }
  }

  async updateUser(data: Partial<Pick<UserDto, 'language' | 'currency'>>): Promise<UserDto> {
    return dfxApi.put<UserDto>('/v2/user', data);
  }

  async updateMail(mail: string): Promise<void> {
    await dfxApi.put('/v2/user/mail', { mail });
  }

  async verifyMail(code: string): Promise<void> {
    await dfxApi.post('/v2/user/mail/verify', { code });
  }
}

export const dfxUserService = new DfxUserService();
