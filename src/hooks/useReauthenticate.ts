import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReauthPinModalProps } from '@/components/ReauthPinModal';
import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/store/auth';

const FIRST_LOCKOUT_ATTEMPT = 5;

type PendingRequest = {
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
  const mounted = useRef(true);

  const isLocked = lockedUntil !== null && lockedUntil > now;
  const remainingSeconds = isLocked ? Math.max(1, Math.ceil((lockedUntil - now) / 1000)) : 0;

  const finish = useCallback((result: boolean) => {
    const current = pending.current;
    if (!current) return;
    pending.current = null;
    setModalVisible(false);
    setError(null);
    setVerifying(false);
    current.resolve(result);
  }, []);

  useEffect(() => {
    return () => {
      mounted.current = false;
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

    let resolveRequest: (value: boolean) => void = () => undefined;
    const promise = new Promise<boolean>((resolve) => {
      resolveRequest = resolve;
    });
    pending.current = { promise, resolve: resolveRequest };

    void (async () => {
      const auth = useAuthStore.getState();
      if (biometricEnabled) {
        let authenticated = false;
        try {
          authenticated = await auth.authenticateBiometric({
            promptMessage: t('biometric.prompt'),
            cancelLabel: t('biometric.usePin'),
          });
        } catch {
          authenticated = false;
        }
        if (!mounted.current || pending.current?.promise !== promise) return;
        if (authenticated) {
          finish(true);
          return;
        }
        if (!FEATURES.PIN || !useAuthStore.getState().pinHash) {
          finish(false);
          return;
        }
      } else if (!FEATURES.PIN || !pinHash) {
        finish(true);
        return;
      }

      setNow(Date.now());
      setError(null);
      setModalVisible(true);
    })();

    return promise;
  }, [biometricEnabled, finish, pinHash, t]);

  const submitPin = useCallback(
    async (pin: string) => {
      if (verifying) return;
      const auth = useAuthStore.getState();
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
      if (!mounted.current || !pending.current) return;
      setVerifying(false);
      if (valid) {
        finish(true);
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
    },
    [finish, t, verifying],
  );

  const modalProps = useMemo<ReauthPinModalProps>(
    () => ({
      visible: modalVisible,
      error: isLocked ? t('pin.lockedFor', { count: remainingSeconds }) : error,
      locked: isLocked,
      verifying,
      onCancel: () => finish(false),
      onSubmit: (pin) => void submitPin(pin),
    }),
    [error, finish, isLocked, modalVisible, remainingSeconds, submitPin, t, verifying],
  );

  return { requestReauth, modalProps };
}
