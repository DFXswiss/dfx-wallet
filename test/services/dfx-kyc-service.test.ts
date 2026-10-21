import { dfxApi } from '../../src/features/dfx-backend/services/api';
import { dfxUserService } from '../../src/features/dfx-backend/services/user-service';
import { dfxKycService } from '../../src/features/dfx-backend/services/kyc-service';

const KYC_HEADERS = { headers: { 'x-kyc-code': 'kyc-hash-xyz' } };

beforeEach(() => {
  // Every authenticated KYC call attaches the user's kyc.hash as x-kyc-code.
  jest
    .spyOn(dfxUserService, 'getUser')
    .mockResolvedValue({ kyc: { hash: 'kyc-hash-xyz' } } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('dfxKycService.registerEmail', () => {
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

  it('does not attach the kyc header to the public email-registration endpoint', async () => {
    jest.spyOn(dfxApi, 'post').mockResolvedValueOnce({ status: 'email_registered' });
    await dfxKycService.registerEmail('a@b.com');
    // registerEmail is the only call that runs before a kyc.hash exists.
    expect(dfxUserService.getUser).not.toHaveBeenCalled();
  });
});

describe('dfxKycService — KYC session', () => {
  it('reads the KYC status with the kyc header', async () => {
    const getSpy = jest.spyOn(dfxApi, 'get').mockResolvedValueOnce({ level: 30 });
    const result = await dfxKycService.getKycStatus();
    expect(result).toEqual({ level: 30 });
    expect(getSpy).toHaveBeenCalledWith('/v2/kyc', KYC_HEADERS);
  });

  it('continues the KYC session via PUT', async () => {
    const putSpy = jest.spyOn(dfxApi, 'put').mockResolvedValueOnce({ url: 'https://kyc' });
    const result = await dfxKycService.continueKyc();
    expect(result).toEqual({ url: 'https://kyc' });
    expect(putSpy).toHaveBeenCalledWith('/v2/kyc', undefined, KYC_HEADERS);
  });
});

describe('dfxKycService — data submission (PUT /v2/kyc/data/*)', () => {
  let putSpy: jest.SpyInstance;
  beforeEach(() => {
    putSpy = jest.spyOn(dfxApi, 'put').mockResolvedValue(undefined as never);
  });

  it('submits contact data to the id-scoped endpoint', async () => {
    await dfxKycService.submitContactData(42, { mail: 'x@y.com' });
    expect(putSpy).toHaveBeenCalledWith(
      '/v2/kyc/data/contact/42',
      { mail: 'x@y.com' },
      KYC_HEADERS,
    );
  });

  it('submits personal data', async () => {
    const data = { firstName: 'Ada', lastName: 'Lovelace', phone: '+41' };
    await dfxKycService.submitPersonalData(7, data);
    expect(putSpy).toHaveBeenCalledWith('/v2/kyc/data/personal/7', data, KYC_HEADERS);
  });

  it('submits nationality data', async () => {
    const data = { nationality: 'CH', country: 'CH' };
    await dfxKycService.submitNationalityData(9, data);
    expect(putSpy).toHaveBeenCalledWith('/v2/kyc/data/nationality/9', data, KYC_HEADERS);
  });

  it('submits financial data', async () => {
    const data = { income: 'high' };
    await dfxKycService.submitFinancialData(11, data);
    expect(putSpy).toHaveBeenCalledWith('/v2/kyc/data/financial/11', data, KYC_HEADERS);
  });
});

describe('dfxKycService — 2FA', () => {
  it('requests a Strict-level 2FA challenge', async () => {
    const postSpy = jest.spyOn(dfxApi, 'post').mockResolvedValueOnce(undefined as never);
    await dfxKycService.request2fa();
    expect(postSpy).toHaveBeenCalledWith('/v2/kyc/2fa?level=Strict', undefined, KYC_HEADERS);
  });

  it('verifies a 2FA token', async () => {
    const postSpy = jest.spyOn(dfxApi, 'post').mockResolvedValueOnce(undefined as never);
    await dfxKycService.verify2fa('123456');
    expect(postSpy).toHaveBeenCalledWith('/v2/kyc/2fa/verify', { token: '123456' }, KYC_HEADERS);
  });
});
