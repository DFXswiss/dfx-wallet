import { useCallback, useState } from 'react';
import { dfxKycService, dfxUserService } from '@/services/dfx';
import type { KycLevelDto, KycSessionDto, KycStepDto } from '@/services/dfx/dto';

type KycState = {
  isLoading: boolean;
  kycLevel: KycLevelDto | null;
  currentSession: KycSessionDto | null;
  error: string | null;
};

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

  const loadKycStatus = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      // Get user to extract kyc.hash
      const user = await dfxUserService.getUser();
      dfxKycService.setKycCode(user.kyc.hash);

      // Get KYC level and steps
      const kycLevel = await dfxKycService.getKycStatus();
      setState({ isLoading: false, kycLevel, currentSession: null, error: null });
      return kycLevel;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load KYC status';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return null;
    }
  }, []);

  const continueKyc = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const session = await dfxKycService.continueKyc();
      setState((s) => ({ ...s, isLoading: false, currentSession: session }));
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to continue KYC';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return null;
    }
  }, []);

  const submitContactData = useCallback(async (stepId: number, mail: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await dfxKycService.submitContactData(stepId, { mail });
      setState((s) => ({ ...s, isLoading: false }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit contact data';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return false;
    }
  }, []);

  const submitPersonalData = useCallback(
    async (stepId: number, data: { firstName: string; lastName: string; phone?: string }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await dfxKycService.submitPersonalData(stepId, data);
        setState((s) => ({ ...s, isLoading: false }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit personal data';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return false;
      }
    },
    [],
  );

  const submitNationalityData = useCallback(
    async (stepId: number, data: { nationality: string; country: string }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await dfxKycService.submitNationalityData(stepId, data);
        setState((s) => ({ ...s, isLoading: false }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit nationality data';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return false;
      }
    },
    [],
  );

  const submitFinancialData = useCallback(async (stepId: number, data: Record<string, unknown>) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await dfxKycService.submitFinancialData(stepId, data);
      setState((s) => ({ ...s, isLoading: false }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit financial data';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return false;
    }
  }, []);

  const request2fa = useCallback(async () => {
    try {
      await dfxKycService.request2fa();
      return true;
    } catch {
      return false;
    }
  }, []);

  const verify2fa = useCallback(async (code: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await dfxKycService.verify2fa(code);
      setState((s) => ({ ...s, isLoading: false }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid 2FA code';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return false;
    }
  }, []);

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
