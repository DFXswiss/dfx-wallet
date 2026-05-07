import { dfxApi } from './api';
import type { UserDto } from './dto';

export type UpdateUserPayload = {
  language?: { id?: number; name?: string; symbol?: string };
  currency?: { id?: number; name?: string };
};

export class DfxUserService {
  async getUser(): Promise<UserDto> {
    return dfxApi.get<UserDto>('/v2/user');
  }

  async updateUser(data: UpdateUserPayload): Promise<UserDto> {
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
