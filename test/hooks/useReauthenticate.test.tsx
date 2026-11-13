import React from 'react';
import { Modal } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/config/features', () => ({ FEATURES: { BIOMETRIC: true, PIN: true } }));
const { FEATURES: mockFeatures } = jest.requireMock('@/config/features') as {
  FEATURES: { BIOMETRIC: boolean; PIN: boolean };
};
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

// eslint-disable-next-line import/first
import { ReauthPinModal } from '@/components/ReauthPinModal';
// eslint-disable-next-line import/first
import { useReauthenticate, type UseReauthenticateResult } from '@/hooks/useReauthenticate';
// eslint-disable-next-line import/first
import { useAuthStore } from '@/store/auth';

let current: UseReauthenticateResult;

function Harness() {
  current = useReauthenticate();
  return <ReauthPinModal {...current.modalProps} />;
}

function requestReauth(): Promise<boolean> {
  let result!: Promise<boolean>;
  act(() => {
    result = current.requestReauth();
  });
  return result;
}

function cancelReauth(): void {
  act(() => {
    current.modalProps.onCancel();
  });
}

describe('useReauthenticate', () => {
  const authenticateBiometric = jest.fn<Promise<boolean>, [unknown]>();
  const verifyPin = jest.fn<Promise<boolean>, [string]>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatures.BIOMETRIC = true;
    mockFeatures.PIN = true;
    authenticateBiometric.mockResolvedValue(false);
    verifyPin.mockResolvedValue(true);
    useAuthStore.setState({
      biometricEnabled: false,
      isAuthenticated: true,
      sessionEpoch: 0,
      pinHash: null,
      failedAttempts: 0,
      lockedUntil: null,
      authenticateBiometric,
      verifyPin,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('resolves false when the session locks during the biometric prompt', async () => {
    let resolve!: (value: boolean) => void;
    authenticateBiometric.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    useAuthStore.setState({ biometricEnabled: true });
    render(<Harness />);
    const result = requestReauth();
    act(() => useAuthStore.getState().lockSession());
    await act(async () => resolve(true));
    await expect(result).resolves.toBe(false);
  });

  it('resolves false when the session locks during PIN verification', async () => {
    let resolve!: (value: boolean) => void;
    verifyPin.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    useAuthStore.setState({ pinHash: 'hash' });
    const view = render(<Harness />);
    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '123456');
    act(() => fireEvent.press(view.getByTestId('reauth-pin-confirm')));
    expect(verifyPin).toHaveBeenCalledTimes(1);
    act(() => useAuthStore.getState().lockSession());
    await act(async () => resolve(true));
    await expect(result).resolves.toBe(false);
  });

  it.each(['epoch', 'authentication'] as const)(
    'resolves false when only %s changes during a successful biometric prompt',
    async (changed) => {
      let resolvePrompt!: (value: boolean) => void;
      authenticateBiometric.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePrompt = resolve;
        }),
      );
      const original = useAuthStore.getState();
      useAuthStore.setState({ biometricEnabled: true });
      const previous = useAuthStore.getState();
      const view = render(<Harness />);
      const result = requestReauth();
      try {
        expect(authenticateBiometric).toHaveBeenCalledTimes(1);
        act(() => {
          useAuthStore.setState(
            changed === 'epoch'
              ? { sessionEpoch: previous.sessionEpoch + 1 }
              : { isAuthenticated: false },
          );
        });
        expect(useAuthStore.getState().sessionEpoch).toBe(
          changed === 'epoch' ? previous.sessionEpoch + 1 : previous.sessionEpoch,
        );
        expect(useAuthStore.getState().isAuthenticated).toBe(changed === 'epoch');
        await act(async () => {
          resolvePrompt(true);
          await expect(result).resolves.toBe(false);
        });
      } finally {
        await act(async () => {
          resolvePrompt(true);
          current.modalProps.onCancel();
          await result;
        });
        view.unmount();
        useAuthStore.setState({
          isAuthenticated: original.isAuthenticated,
          sessionEpoch: original.sessionEpoch,
          biometricEnabled: original.biometricEnabled,
        });
        authenticateBiometric.mockReset();
        authenticateBiometric.mockResolvedValue(false);
      }
    },
  );

  it.each(['epoch', 'authentication'] as const)(
    'resolves false when only %s changes during successful PIN verification',
    async (changed) => {
      let resolvePin!: (value: boolean) => void;
      verifyPin.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePin = resolve;
        }),
      );
      const original = useAuthStore.getState();
      useAuthStore.setState({ pinHash: 'hash' });
      const previous = useAuthStore.getState();
      const view = render(<Harness />);
      const result = requestReauth();
      try {
        await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
        fireEvent.changeText(view.getByTestId('reauth-pin-input'), '123456');
        act(() => {
          fireEvent.press(view.getByTestId('reauth-pin-confirm'));
        });
        expect(verifyPin).toHaveBeenCalledTimes(1);
        act(() => {
          useAuthStore.setState(
            changed === 'epoch'
              ? { sessionEpoch: previous.sessionEpoch + 1 }
              : { isAuthenticated: false },
          );
        });
        expect(useAuthStore.getState().sessionEpoch).toBe(
          changed === 'epoch' ? previous.sessionEpoch + 1 : previous.sessionEpoch,
        );
        expect(useAuthStore.getState().isAuthenticated).toBe(changed === 'epoch');
        await act(async () => {
          resolvePin(true);
          await expect(result).resolves.toBe(false);
        });
      } finally {
        await act(async () => {
          resolvePin(true);
          current.modalProps.onCancel();
          await result;
        });
        view.unmount();
        useAuthStore.setState({
          isAuthenticated: original.isAuthenticated,
          sessionEpoch: original.sessionEpoch,
          pinHash: original.pinHash,
        });
        verifyPin.mockReset();
        verifyPin.mockResolvedValue(true);
      }
    },
  );

  it('allows the MVP path when neither biometrics nor PIN are configured', async () => {
    render(<Harness />);
    await expect(requestReauth()).resolves.toBe(true);
    expect(authenticateBiometric).not.toHaveBeenCalled();
    expect(verifyPin).not.toHaveBeenCalled();
  });

  it('opens the PIN modal without prompting when the biometric feature is disabled', async () => {
    mockFeatures.BIOMETRIC = false;
    useAuthStore.setState({ biometricEnabled: true, pinHash: 'hash' });
    const view = render(<Harness />);

    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    expect(authenticateBiometric).not.toHaveBeenCalled();
    cancelReauth();
    await expect(result).resolves.toBe(false);
  });

  it('opens the PIN modal without prompting when biometrics are disabled by the user', async () => {
    useAuthStore.setState({ biometricEnabled: false, pinHash: 'hash' });
    const view = render(<Harness />);

    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    expect(authenticateBiometric).not.toHaveBeenCalled();
    cancelReauth();
    await expect(result).resolves.toBe(false);
  });

  it('resolves true after successful biometric authentication', async () => {
    authenticateBiometric.mockResolvedValueOnce(true);
    useAuthStore.setState({ biometricEnabled: true });
    render(<Harness />);

    await expect(requestReauth()).resolves.toBe(true);
    expect(authenticateBiometric).toHaveBeenCalledWith({
      promptMessage: 'biometric.prompt',
      cancelLabel: 'biometric.usePin',
    });
  });

  it('resolves false when biometric authentication fails without a PIN fallback', async () => {
    useAuthStore.setState({ biometricEnabled: true, pinHash: null });
    const view = render(<Harness />);
    await expect(requestReauth()).resolves.toBe(false);
    expect(authenticateBiometric).toHaveBeenCalledTimes(1);
    expect(authenticateBiometric).toHaveBeenCalledWith({
      promptMessage: 'biometric.prompt',
      cancelLabel: 'biometric.usePin',
    });
    expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
  });

  it('falls back from a rejected biometric prompt to PIN verification', async () => {
    authenticateBiometric.mockRejectedValueOnce(new Error('cancelled'));
    useAuthStore.setState({ biometricEnabled: true, pinHash: 'hash' });
    const view = render(<Harness />);

    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '12a3456');
    await act(async () => {
      fireEvent.press(view.getByTestId('reauth-pin-confirm'));
    });

    await expect(result).resolves.toBe(true);
    expect(verifyPin).toHaveBeenCalledWith('123456');
  });

  it('shows remaining attempts after an incorrect PIN and keeps the request open', async () => {
    useAuthStore.setState({ pinHash: 'hash' });
    verifyPin.mockImplementationOnce(async () => {
      useAuthStore.setState({ failedAttempts: 2 });
      return false;
    });
    const view = render(<Harness />);

    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '000000');
    await act(async () => {
      fireEvent.press(view.getByTestId('reauth-pin-confirm'));
    });

    expect(view.getByTestId('reauth-pin-error').props.children).toBe(
      'pin.incorrectAttemptsLeft:{"count":3}',
    );
    expect(current.modalProps.visible).toBe(true);
    cancelReauth();
    await expect(result).resolves.toBe(false);
  });

  it('submits a wrong 4-digit legacy PIN as one counted verification call', async () => {
    useAuthStore.setState({ pinHash: 'abcdef' });
    verifyPin.mockImplementationOnce(async () => {
      useAuthStore.setState({ failedAttempts: 1 });
      return false;
    });
    const view = render(<Harness />);

    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '1234');
    await act(async () => {
      fireEvent.press(view.getByTestId('reauth-pin-confirm'));
    });

    expect(verifyPin).toHaveBeenCalledTimes(1);
    expect(verifyPin).toHaveBeenCalledWith('1234');
    expect(verifyPin.mock.calls[0]).toHaveLength(1);
    expect(useAuthStore.getState().failedAttempts).toBe(1);
    cancelReauth();
    await expect(result).resolves.toBe(false);
  });

  it('shows the generic incorrect-PIN error when verification throws', async () => {
    useAuthStore.setState({ pinHash: 'hash', failedAttempts: 5 });
    verifyPin.mockRejectedValueOnce(new Error('keychain unavailable'));
    const view = render(<Harness />);
    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '123456');
    await act(async () => {
      fireEvent.press(view.getByTestId('reauth-pin-confirm'));
    });

    expect(view.getByTestId('reauth-pin-error').props.children).toBe('pin.incorrect');
    cancelReauth();
    await expect(result).resolves.toBe(false);
  });

  it('switches to the lockout message when PIN verification starts a lockout', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    useAuthStore.setState({ pinHash: 'hash' });
    verifyPin.mockImplementationOnce(async () => {
      useAuthStore.setState({ failedAttempts: 5, lockedUntil: 31_000 });
      return false;
    });
    const view = render(<Harness />);
    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '123456');
    await act(async () => {
      fireEvent.press(view.getByTestId('reauth-pin-confirm'));
    });

    expect(view.getByTestId('reauth-pin-error').props.children).toContain('pin.lockedFor');
    cancelReauth();
    await expect(result).resolves.toBe(false);
    now.mockRestore();
  });

  it('refuses PIN verification during lockout and displays the remaining time', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    useAuthStore.setState({ pinHash: 'hash', lockedUntil: 31_000 });
    const view = render(<Harness />);

    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-error')).toBeTruthy());
    act(() => {
      current.modalProps.onSubmit('123456');
    });

    expect(verifyPin).not.toHaveBeenCalled();
    expect(view.getByTestId('reauth-pin-error').props.children).toBe('pin.lockedFor:{"count":30}');
    cancelReauth();
    await expect(result).resolves.toBe(false);
    now.mockRestore();
  });

  it('allows PIN verification after a persisted lockout has expired', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    useAuthStore.setState({ pinHash: 'hash', lockedUntil: 999 });
    render(<Harness />);
    const result = requestReauth();

    await act(async () => {
      current.modalProps.onSubmit('123456');
    });

    await expect(result).resolves.toBe(true);
    expect(verifyPin).toHaveBeenCalledWith('123456');
    now.mockRestore();
  });

  it('updates the displayed lockout countdown', async () => {
    jest.useFakeTimers();
    let currentTime = 1_000;
    const now = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
    useAuthStore.setState({ pinHash: 'hash', lockedUntil: 31_000 });
    const view = render(<Harness />);
    const result = requestReauth();
    await act(async () => Promise.resolve());
    expect(view.getByTestId('reauth-pin-error').props.children).toContain('"count":30');

    currentTime = 2_000;
    act(() => jest.advanceTimersByTime(1_000));
    expect(view.getByTestId('reauth-pin-error').props.children).toContain('"count":29');

    cancelReauth();
    await expect(result).resolves.toBe(false);
    now.mockRestore();
    jest.useRealTimers();
  });

  it('returns the same promise while biometric reauthentication is pending', async () => {
    let resolveFirstBiometric: (value: boolean) => void = () => undefined;
    authenticateBiometric.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveFirstBiometric = resolve;
      }),
    );
    useAuthStore.setState({ biometricEnabled: true, pinHash: 'hash' });
    render(<Harness />);

    const first = requestReauth();
    const second = requestReauth();
    expect(second).toBe(first);
    expect(authenticateBiometric).toHaveBeenCalledTimes(1);
    expect(current.modalProps.visible).toBe(false);

    await act(async () => resolveFirstBiometric(false));
    await waitFor(() => expect(current.modalProps.visible).toBe(true));

    cancelReauth();
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
  });

  it('ignores a stale PIN verification result after cancellation and a new request', async () => {
    let resolveFirstVerification: (value: boolean) => void = () => undefined;
    verifyPin.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveFirstVerification = resolve;
      }),
    );
    useAuthStore.setState({ pinHash: 'hash' });
    const view = render(<Harness />);
    const first = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());

    await act(async () => {
      current.modalProps.onSubmit('123456');
      await Promise.resolve();
    });
    expect(current.modalProps.verifying).toBe(true);

    cancelReauth();
    await expect(first).resolves.toBe(false);
    const second = requestReauth();
    expect(second).not.toBe(first);
    await waitFor(() => expect(current.modalProps.visible).toBe(true));
    expect(current.modalProps.verifying).toBe(false);
    const secondResolution = jest.fn();
    void second.then(secondResolution);

    await act(async () => resolveFirstVerification(false));
    expect(current.modalProps.visible).toBe(true);
    expect(current.modalProps.verifying).toBe(false);
    expect(current.modalProps.error).toBeNull();
    expect(secondResolution).not.toHaveBeenCalled();

    cancelReauth();
    await expect(second).resolves.toBe(false);
  });

  it('ignores another PIN submission while verification is in progress', async () => {
    let resolveVerification: (value: boolean) => void = () => undefined;
    verifyPin.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveVerification = resolve;
      }),
    );
    useAuthStore.setState({ pinHash: 'hash' });
    render(<Harness />);
    const result = requestReauth();

    await act(async () => {
      current.modalProps.onSubmit('123456');
      await Promise.resolve();
    });
    act(() => {
      current.modalProps.onSubmit('654321');
    });
    expect(verifyPin).toHaveBeenCalledTimes(1);

    await act(async () => resolveVerification(true));
    await expect(result).resolves.toBe(true);
  });

  it('counts two same-turn PIN submits as one verification attempt', async () => {
    let resolveVerification: (value: boolean) => void = () => undefined;
    verifyPin.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveVerification = resolve;
      }),
    );
    useAuthStore.setState({ pinHash: 'hash' });
    render(<Harness />);
    const result = requestReauth();

    act(() => {
      current.modalProps.onSubmit('123456');
      current.modalProps.onSubmit('654321');
    });

    expect(verifyPin).toHaveBeenCalledTimes(1);
    expect(verifyPin).toHaveBeenCalledWith('123456');

    await act(async () => resolveVerification(true));
    await expect(result).resolves.toBe(true);
  });

  it('ignores a PIN verification result after the request is cancelled', async () => {
    let resolveVerification: (value: boolean) => void = () => undefined;
    verifyPin.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveVerification = resolve;
      }),
    );
    useAuthStore.setState({ pinHash: 'hash' });
    render(<Harness />);
    const result = requestReauth();

    await act(async () => {
      current.modalProps.onSubmit('123456');
      await Promise.resolve();
    });
    cancelReauth();
    await expect(result).resolves.toBe(false);

    await act(async () => resolveVerification(true));
    expect(current.modalProps.visible).toBe(false);
  });

  it('resolves false and clears PIN input when the modal is cancelled', async () => {
    useAuthStore.setState({ pinHash: 'hash' });
    const view = render(<Harness />);
    const result = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '123456');
    fireEvent.press(view.getByTestId('reauth-pin-cancel'));

    await expect(result).resolves.toBe(false);
    const second = requestReauth();
    await waitFor(() => expect(view.getByTestId('reauth-pin-input').props.value).toBe(''));
    cancelReauth();
    cancelReauth();
    await expect(second).resolves.toBe(false);
  });

  it('resolves an open request as false on unmount', async () => {
    useAuthStore.setState({ pinHash: 'hash' });
    const view = render(<Harness />);
    const result = requestReauth();
    view.unmount();
    await expect(result).resolves.toBe(false);
  });

  it('ignores a biometric result that arrives after unmount', async () => {
    let resolveBiometric: (value: boolean) => void = () => undefined;
    authenticateBiometric.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveBiometric = resolve;
      }),
    );
    useAuthStore.setState({ biometricEnabled: true, pinHash: 'hash' });
    const view = render(<Harness />);
    const result = requestReauth();
    const resolutions: boolean[] = [];
    void result.then((value) => {
      resolutions.push(value);
    });
    view.unmount();

    await act(async () => {
      resolveBiometric(true);
      await Promise.resolve();
    });

    expect(resolutions).toEqual([false]);
    await expect(result).resolves.toBe(false);
    expect(current.modalProps.visible).toBe(false);
    expect(useAuthStore.getState()).toMatchObject({
      biometricEnabled: true,
      pinHash: 'hash',
      failedAttempts: 0,
      lockedUntil: null,
    });
  });

  it('ignores a biometric result after the request is cancelled', async () => {
    let resolveBiometric: (value: boolean) => void = () => undefined;
    authenticateBiometric.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveBiometric = resolve;
      }),
    );
    useAuthStore.setState({ biometricEnabled: true, pinHash: 'hash' });
    render(<Harness />);
    const result = requestReauth();

    cancelReauth();
    await expect(result).resolves.toBe(false);
    await act(async () => resolveBiometric(true));

    expect(current.modalProps.visible).toBe(false);
  });

  it('honors a disabled PIN feature', async () => {
    mockFeatures.PIN = false;
    useAuthStore.setState({ pinHash: 'hash' });
    const view = render(<Harness />);
    await expect(requestReauth()).resolves.toBe(true);
    expect(verifyPin).not.toHaveBeenCalled();
    expect(authenticateBiometric).not.toHaveBeenCalled();
    expect(view.queryByTestId('reauth-pin-input')).toBeNull();
  });

  it('opens a locked PIN modal without a biometric prompt while a lockout is active', async () => {
    useAuthStore.setState({
      biometricEnabled: true,
      pinHash: 'hash',
      lockedUntil: Date.now() + 60_000,
    });
    render(<Harness />);

    const result = requestReauth();
    const settled = jest.fn();
    void result.then(settled);
    await waitFor(() => expect(current.modalProps.visible).toBe(true));

    expect(authenticateBiometric).not.toHaveBeenCalled();
    expect(current.modalProps.locked).toBe(true);
    expect(current.modalProps.error).toEqual(expect.stringContaining('pin.lockedFor'));
    expect(settled).not.toHaveBeenCalled();
    cancelReauth();
    await expect(result).resolves.toBe(false);
  });

  it('rejects a locked biometric reauthentication when no PIN is available', async () => {
    useAuthStore.setState({
      biometricEnabled: true,
      pinHash: null,
      lockedUntil: Date.now() + 60_000,
    });
    render(<Harness />);

    await expect(requestReauth()).resolves.toBe(false);
    expect(authenticateBiometric).not.toHaveBeenCalled();
    expect(current.modalProps.visible).toBe(false);
  });

  it('does not accept a biometric success that lands during a PIN lockout', async () => {
    let resolveBiometric: (value: boolean) => void = () => undefined;
    authenticateBiometric.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveBiometric = resolve;
      }),
    );
    useAuthStore.setState({ biometricEnabled: true, pinHash: 'hash', lockedUntil: null });
    render(<Harness />);

    const result = requestReauth();
    const settled = jest.fn();
    void result.then(settled);
    await waitFor(() => expect(authenticateBiometric).toHaveBeenCalledTimes(1));
    useAuthStore.setState({ lockedUntil: Date.now() + 60_000 });
    await act(async () => {
      resolveBiometric(true);
    });

    expect(settled).not.toHaveBeenCalled();
    expect(current.modalProps.visible).toBe(true);
    expect(current.modalProps.locked).toBe(true);
    cancelReauth();
    await expect(result).resolves.toBe(false);
  });

  it('rejects a biometric success during lockout when no PIN is available', async () => {
    let resolveBiometric: (value: boolean) => void = () => undefined;
    authenticateBiometric.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveBiometric = resolve;
      }),
    );
    useAuthStore.setState({ biometricEnabled: true, pinHash: null, lockedUntil: null });
    render(<Harness />);

    const result = requestReauth();
    await waitFor(() => expect(authenticateBiometric).toHaveBeenCalledTimes(1));
    useAuthStore.setState({ lockedUntil: Date.now() + 60_000 });
    await act(async () => {
      resolveBiometric(true);
    });

    await expect(result).resolves.toBe(false);
    expect(current.modalProps.visible).toBe(false);
  });
});
