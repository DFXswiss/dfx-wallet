import { useCallback, useState } from 'react';
import { DfxApiError, dfxKycService } from '@/services/dfx';
import type { KycLevelDto, KycSessionDto, KycStepDto } from '@/services/dfx/dto';

type KycState = {
  isLoading: boolean;
  kycLevel: KycLevelDto | null;
  currentSession: KycSessionDto | null;
  error: string | null;
};

function isRecoverableKycSessionError(err: unknown): boolean {
  if (err instanceof DfxApiError && err.statusCode === 401) return true;
  return err instanceof Error && /invalid kyc hash/i.test(err.message);
}

/**
 * Hook for the DFX KYC verification flow.
 *
 * Flow:
 * 1. loadKycStatus() — fetch user + KYC level, set kyc code
 * 2. continueKyc() — get current step with session URL
 * 3. Submit data per step type (API/Browser/Token)
 * 4. Repeat until all steps completed
 */
export function useKycFlow() {
  const [state, setState] = useState<KycState>({
    isLoading: false,
    kycLevel: null,
    currentSession: null,
    error: null,
  });

  const runWithFreshKycCode = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        if (attempt === 0 && isRecoverableKycSessionError(err)) continue;
        throw err;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('KYC request failed');
  }, []);

  const loadKycStatus = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const kycLevel = await runWithFreshKycCode(() => dfxKycService.getKycStatus());
      setState({ isLoading: false, kycLevel, currentSession: null, error: null });
      return kycLevel;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load KYC status';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return null;
    }
  }, [runWithFreshKycCode]);

  const continueKyc = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const session = await runWithFreshKycCode(() => dfxKycService.continueKyc());
      setState((s) => ({ ...s, isLoading: false, currentSession: session }));
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to continue KYC';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return null;
    }
  }, [runWithFreshKycCode]);

  const submitContactData = useCallback(
    async (stepId: number, mail: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await runWithFreshKycCode(() => dfxKycService.submitContactData(stepId, { mail }));
        setState((s) => ({ ...s, isLoading: false }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit contact data';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return false;
      }
    },
    [runWithFreshKycCode],
  );

  const registerEmail = useCallback(async (mail: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const status = await dfxKycService.registerEmail(mail);
      setState((s) => ({ ...s, isLoading: false }));
      return status;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register email';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      throw err instanceof Error ? err : new Error(msg);
    }
  }, []);

  const submitPersonalData = useCallback(
    async (stepId: number, data: { firstName: string; lastName: string; phone?: string }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await runWithFreshKycCode(() => dfxKycService.submitPersonalData(stepId, data));
        setState((s) => ({ ...s, isLoading: false }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit personal data';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return false;
      }
    },
    [runWithFreshKycCode],
  );

  const submitNationalityData = useCallback(
    async (stepId: number, data: { nationality: string; country: string }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await runWithFreshKycCode(() => dfxKycService.submitNationalityData(stepId, data));
        setState((s) => ({ ...s, isLoading: false }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit nationality data';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return false;
      }
    },
    [runWithFreshKycCode],
  );

  const submitFinancialData = useCallback(
    async (stepId: number, data: Record<string, unknown>) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await runWithFreshKycCode(() => dfxKycService.submitFinancialData(stepId, data));
        setState((s) => ({ ...s, isLoading: false }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit financial data';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return false;
      }
    },
    [runWithFreshKycCode],
  );

  const request2fa = useCallback(async () => {
    try {
      await runWithFreshKycCode(() => dfxKycService.request2fa());
      return true;
    } catch {
      return false;
    }
  }, [runWithFreshKycCode]);

  const verify2fa = useCallback(
    async (code: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await runWithFreshKycCode(() => dfxKycService.verify2fa(code));
        setState((s) => ({ ...s, isLoading: false }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid 2FA code';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return false;
      }
    },
    [runWithFreshKycCode],
  );

  const getCompletedSteps = useCallback((): KycStepDto[] => {
    return state.kycLevel?.kycSteps.filter((s) => s.status === 'Completed') ?? [];
  }, [state.kycLevel]);

  const getCurrentStep = useCallback((): KycStepDto | undefined => {
    return state.kycLevel?.kycSteps.find((s) => s.isCurrent);
  }, [state.kycLevel]);

  const reset = useCallback(() => {
    setState({ isLoading: false, kycLevel: null, currentSession: null, error: null });
  }, []);

  return {
    ...state,
    loadKycStatus,
    continueKyc,
    registerEmail,
    submitContactData,
    submitPersonalData,
    submitNationalityData,
    submitFinancialData,
    request2fa,
    verify2fa,
    getCompletedSteps,
    getCurrentStep,
    reset,
  };
}
