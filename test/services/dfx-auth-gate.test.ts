import { DfxApiError } from '../../src/features/dfx-backend/services/api';
import { interpretDfxAuthError } from '../../src/features/dfx-backend/services/auth-gate';

describe('interpretDfxAuthError', () => {
  it('returns null for non-DfxApiError values', () => {
    expect(interpretDfxAuthError(null)).toBeNull();
    expect(interpretDfxAuthError(new Error('plain'))).toBeNull();
    expect(interpretDfxAuthError('string')).toBeNull();
  });

  it('maps KYC errors to the kyc gate kind', () => {
    const err = new DfxApiError(403, 'KYC_LEVEL_REQUIRED', 'KYC required');
    expect(interpretDfxAuthError(err)).toEqual({ kind: 'kyc', message: 'KYC required' });
  });

  it('maps KYC_DATA_REQUIRED to the kyc gate kind', () => {
    const err = new DfxApiError(403, 'KYC_DATA_REQUIRED', 'KYC data missing');
    expect(interpretDfxAuthError(err)).toEqual({ kind: 'kyc', message: 'KYC data missing' });
  });

  it('maps registration errors to the registration gate kind', () => {
    const err = new DfxApiError(403, 'REGISTRATION_REQUIRED', 'No DFX account');
    expect(interpretDfxAuthError(err)).toEqual({
      kind: 'registration',
      message: 'No DFX account',
    });
  });

  it('maps "Asset blockchain mismatch" to the linkChain gate kind', () => {
    const err = new DfxApiError(400, 'ASSET_UNSUPPORTED', 'Asset blockchain mismatch');
    const gate = interpretDfxAuthError(err);
    expect(gate).toEqual({ kind: 'linkChain', message: 'Asset blockchain mismatch' });
  });

  it('matches the mismatch message case-insensitively', () => {
    const err = new DfxApiError(400, 'ASSET_UNSUPPORTED', 'asset BLOCKCHAIN mismatch');
    expect(interpretDfxAuthError(err)?.kind).toBe('linkChain');
  });

  it('maps "EmailRequired" to the email gate kind', () => {
    const err = new DfxApiError(400, 'EMAIL_REQUIRED', 'EmailRequired');
    expect(interpretDfxAuthError(err)).toEqual({ kind: 'email', message: 'EmailRequired' });
  });

  it('matches the email message case-insensitively, with optional whitespace', () => {
    const err = new DfxApiError(400, 'EMAIL_REQUIRED', 'email required');
    expect(interpretDfxAuthError(err)?.kind).toBe('email');
  });

  it('falls back to login on plain 401', () => {
    const err = new DfxApiError(401, 'UNAUTHORIZED', 'Token expired');
    expect(interpretDfxAuthError(err)).toEqual({ kind: 'login', message: 'Token expired' });
  });

  it('returns null for unrelated 400s', () => {
    const err = new DfxApiError(400, 'AMOUNT_TOO_LOW', 'Amount is too low');
    expect(interpretDfxAuthError(err)).toBeNull();
  });

  it('returns null for unrelated 403s', () => {
    const err = new DfxApiError(403, 'COUNTRY_BLOCKED', 'Country not allowed');
    expect(interpretDfxAuthError(err)).toBeNull();
  });

  it('prioritises KYC over the generic 401 fallback', () => {
    const err = new DfxApiError(401, 'KYC_LEVEL_REQUIRED', 'KYC required');
    expect(interpretDfxAuthError(err)?.kind).toBe('kyc');
  });
});
