import { DfxApiError, normalizeDfxApiBaseUrl } from '../../src/features/dfx-backend/services/api';

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

describe('normalizeDfxApiBaseUrl', () => {
  it('keeps origin-only API URLs unchanged', () => {
    expect(normalizeDfxApiBaseUrl('https://api.dfx.swiss')).toBe('https://api.dfx.swiss');
  });

  it('removes a trailing v1 path because request paths include their API version', () => {
    expect(normalizeDfxApiBaseUrl('https://api.dfx.swiss/v1')).toBe('https://api.dfx.swiss');
  });

  it('normalizes trailing slashes before versioned requests are appended', () => {
    expect(normalizeDfxApiBaseUrl('https://api.dfx.swiss/v1/')).toBe('https://api.dfx.swiss');
  });
});
