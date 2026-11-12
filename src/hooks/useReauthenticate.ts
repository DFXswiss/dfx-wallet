import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReauthPinModalProps } from '@/components/ReauthPinModal';
import { FEATURES } from '@/config/features';
import { FIRST_LOCKOUT_ATTEMPT, useAuthStore } from '@/store/auth';

type PendingRequest = {
  id: number;
  promise: Promise<boolean>;
  resolve: (value: boolean) => void;
};

export type UseReauthenticateResult = {
  requestReauth: () => Promise<boolean>;
  modalProps: ReauthPinModalProps;
};

export function useReauthenticate(): UseReauthenticateResult {
  const { t } = useTranslation();
  const biometricEnabled = useAuthStore((state) => state.biometricEnabled);
  const pinHash = useAuthStore((state) => state.pinHash);
  const lockedUntil = useAuthStore((state) => state.lockedUntil);
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const pending = useRef<PendingRequest | null>(null);
  const requestGeneration = useRef(0);
  const mounted = useRef(true);
  const verifyingRef = useRef(false);

  const isLocked = lockedUntil !== null && lockedUntil > now;
  const remainingSeconds = isLocked ? Math.max(1, Math.ceil((lockedUntil - now) / 1000)) : 0;

  const isCurrentRequest = useCallback(
    (requestId: number) =>
      mounted.current &&
      requestGeneration.current === requestId &&
      pending.current?.id === requestId,
    [],
  );

  const finish = useCallback(
    (requestId: number, result: boolean) => {
      if (!isCurrentRequest(requestId)) return;
      const current = pending.current;
      pending.current = null;
      setModalVisible(false);
      setError(null);
      setVerifying(false);
      current?.resolve(result);
    },
    [isCurrentRequest],
  );

  const cancel = useCallback(() => {
    requestGeneration.current += 1;
    const current = pending.current;
    pending.current = null;
    setModalVisible(false);
    setError(null);
    setVerifying(false);
    current?.resolve(false);
  }, []);

  useEffect(() => {
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
      const current = pending.current;
      pending.current = null;
      current?.resolve(false);
    };
  }, []);

  useEffect(() => {
    if (!modalVisible || !isLocked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLocked, modalVisible]);

  const requestReauth = useCallback((): Promise<boolean> => {
    if (pending.current) return pending.current.promise;
    const requestId = ++requestGeneration.current;
    setModalVisible(false);
    setError(null);
    setVerifying(false);

    let resolveRequest: (value: boolean) => void = () => undefined;
    const promise = new Promise<boolean>((resolve) => {
      resolveRequest = resolve;
    });
    pending.current = { id: requestId, promise, resolve: resolveRequest };

    void (async () => {
      const auth = useAuthStore.getState();
      const pinIsConfigured = () => FEATURES.PIN && !!useAuthStore.getState().pinHash;
      const lockIsActive = () => {
        const lockedUntilNow = useAuthStore.getState().lockedUntil;
        return lockedUntilNow !== null && lockedUntilNow > Date.now();
      };
      const showLockedPinModal = () => {
        if (!pinIsConfigured()) {
          finish(requestId, false);
          return;
        }
        setNow(Date.now());
        setError(null);
        setModalVisible(true);
      };

      if (FEATURES.BIOMETRIC && biometricEnabled) {
        if (lockIsActive()) {
          showLockedPinModal();
          return;
        }
        const sessionEpoch = useAuthStore.getState().sessionEpoch;
        let authenticated = false;
        try {
          authenticated = await auth.authenticateBiometric({
            promptMessage: t('biometric.prompt'),
            cancelLabel: t('biometric.usePin'),
          });
        } catch {
          authenticated = false;
        }
        if (!isCurrentRequest(requestId)) return;
        const currentSession = useAuthStore.getState();
        if (currentSession.sessionEpoch !== sessionEpoch || !currentSession.isAuthenticated) {
          finish(requestId, false);
          return;
        }
        if (authenticated && lockIsActive()) {
          showLockedPinModal();
          return;
        }
        if (authenticated) {
          finish(requestId, true);
          return;
        }
        if (!pinIsConfigured()) {
          finish(requestId, false);
          return;
        }
      } else if (!FEATURES.PIN || !pinHash) {
        finish(requestId, true);
        return;
      }

      setNow(Date.now());
      setError(null);
      setModalVisible(true);
    })();

    return promise;
  }, [biometricEnabled, finish, isCurrentRequest, pinHash, t]);

  const submitPin = useCallback(
    async (pin: string) => {
      const currentRequest = pending.current;
      if (verifyingRef.current || !currentRequest) return;
      verifyingRef.current = true;
      const requestId = currentRequest.id;
      const auth = useAuthStore.getState();
      const sessionEpoch = auth.sessionEpoch;
      try {
        if (auth.lockedUntil && auth.lockedUntil > Date.now()) {
          setNow(Date.now());
          return;
        }

        setVerifying(true);
        setError(null);
        let valid = false;
        try {
          valid = await auth.verifyPin(pin);
        } catch {
          valid = false;
        }
        if (!isCurrentRequest(requestId)) return;
        const currentSession = useAuthStore.getState();
        if (currentSession.sessionEpoch !== sessionEpoch || !currentSession.isAuthenticated) {
          finish(requestId, false);
          return;
        }
        setVerifying(false);
        if (valid) {
          finish(requestId, true);
          return;
        }

        const nextState = useAuthStore.getState();
        setNow(Date.now());
        if (nextState.lockedUntil && nextState.lockedUntil > Date.now()) return;
        const attemptsLeft = Math.max(0, FIRST_LOCKOUT_ATTEMPT - nextState.failedAttempts);
        setError(
          attemptsLeft > 0
            ? t('pin.incorrectAttemptsLeft', { count: attemptsLeft })
            : t('pin.incorrect'),
        );
      } finally {
        verifyingRef.current = false;
      }
    },
    [finish, isCurrentRequest, t],
  );

  const modalProps = useMemo<ReauthPinModalProps>(
    () => ({
      visible: modalVisible,
      error: isLocked ? t('pin.lockedFor', { count: remainingSeconds }) : error,
      locked: isLocked,
      verifying,
      onCancel: cancel,
      onSubmit: (pin) => void submitPin(pin),
    }),
    [cancel, error, isLocked, modalVisible, remainingSeconds, submitPin, t, verifying],
  );

  return { requestReauth, modalProps };
}
