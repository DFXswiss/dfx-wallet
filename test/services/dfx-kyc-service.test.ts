import { dfxApi } from '../../src/features/dfx-backend/services/api';
import { dfxKycService } from '../../src/features/dfx-backend/services/kyc-service';

describe('dfxKycService.registerEmail', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks KYC email registration as coming from DFX Wallet', async () => {
    const postSpy = jest.spyOn(dfxApi, 'post').mockResolvedValueOnce({
      status: 'merge_requested',
    });

    const status = await dfxKycService.registerEmail('User@Example.com');

    expect(status).toBe('merge_requested');
    expect(postSpy).toHaveBeenCalledWith('/v1/realunit/register/email', {
      email: 'user@example.com',
      wallet: 'DFX Wallet',
    });
  });
});
