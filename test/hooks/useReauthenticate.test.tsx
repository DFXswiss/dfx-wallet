import React from 'react';
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

import { ReauthPinModal } from '@/components/ReauthPinModal';
import {
  useReauthenticate,
  type UseReauthenticateResult,
} from '@/hooks/useReauthenticate';
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
      pinHash: null,
      failedAttempts: 0,
      lockedUntil: null,
      authenticateBiometric,
      verifyPin,
    });
  });

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
    render(<Harness />);
    await expect(requestReauth()).resolves.toBe(false);
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

    expect(view.getByTestId('reauth-pin-error').props.children).toContain(
      'pin.incorrectAttemptsLeft',
    );
    expect(current.modalProps.visible).toBe(true);
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
    expect(view.getByTestId('reauth-pin-error').props.children).toContain('pin.lockedFor');
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
    view.unmount();

    await expect(result).resolves.toBe(false);
    resolveBiometric(true);
    await Promise.resolve();
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
    render(<Harness />);
    await expect(requestReauth()).resolves.toBe(true);
  });
});
