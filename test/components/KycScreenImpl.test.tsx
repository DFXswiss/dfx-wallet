import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LOCAL_SESSION_ENDED_MESSAGE } from '@/features/dfx-backend/session-guard';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';
import { useAuthStore } from '@/store/auth';

const mockAuthenticate = jest.fn();
const mockGetKycStatus = jest.fn();
const mockRegisterEmail = jest.fn();
const mockGetAccessToken = jest.fn();
let mockAuthError: string | null = null;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: () => true,
    push: jest.fn(),
    replace: jest.fn(),
  }),
  Stack: { Screen: () => null },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) =>
      ReactActual.createElement(View, rest, children),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  };
});

jest.mock('@/hooks', () => ({
  useDfxAuth: () => ({
    authenticate: (...args: unknown[]) => mockAuthenticate(...args),
    reauthenticateAsOwner: jest.fn(),
    isAuthenticating: false,
    error: mockAuthError,
  }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  DfxApiError: class extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  dfxApi: { clearAuthToken: jest.fn() },
  dfxAuthService: {
    getAccessToken: () => mockGetAccessToken(),
    logout: jest.fn(),
  },
  dfxKycService: {
    continueKyc: jest.fn(),
    getKycStatus: () => mockGetKycStatus(),
    registerEmail: (...args: unknown[]) => mockRegisterEmail(...args),
  },
  decodeDfxJwt: () => ({ account: 1 }),
}));

// eslint-disable-next-line import/first
import KycScreen from '@/features/dfx-backend/screens/KycScreenImpl';

describe('KycScreenImpl', () => {
  beforeEach(() => {
    mockAuthError = null;
    mockAuthenticate.mockReset();
    mockGetKycStatus.mockReset();
    mockRegisterEmail.mockReset();
    mockGetAccessToken.mockReset();
    mockGetAccessToken.mockReturnValue(null);
    mockGetKycStatus.mockResolvedValue({ kycLevel: 0, kycSteps: [] });
  });

  async function openMailStep(): Promise<ReturnType<typeof render>> {
    const view = render(<KycScreen />);
    await waitFor(() => expect(mockGetKycStatus.mock.results.length).toBeGreaterThan(0));
    await mockGetKycStatus.mock.results[0]?.value;
    await waitFor(() => expect(view.getByText('kyc.legalYes')).toBeTruthy());
    fireEvent.press(view.getByText('kyc.legalYes'));
    fireEvent.press(view.getByText('kyc.legalYes'));
    await waitFor(() => expect(view.getByTestId('kyc-mail-input')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('kyc-mail-input'), 'user@example.com');
    return view;
  }

  it('stays on the mail step without an error when sending is invalidated', async () => {
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockAuthenticate.mockRejectedValue(invalidated);
    const view = await openMailStep();

    fireEvent.press(view.getByTestId('kyc-mail-send'));

    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(view.getByTestId('kyc-mail-send').props.accessibilityState?.disabled).toBe(false),
    );
    expect(view.getByTestId('kyc-mail-input')).toBeTruthy();
    expect(view.queryByText(invalidated.message)).toBeNull();
    expect(view.queryByText('kyc.mailSendError')).toBeNull();
  });

  it.each([
    ['local session ends', new Error(LOCAL_SESSION_ENDED_MESSAGE), true],
    ['authentication is superseded', new DfxAuthFlowInvalidatedError(), false],
  ] as const)('handles mail confirmation when %s', async (_label, error, ended) => {
    const previous = useAuthStore.getState();
    const originalSetter = previous.setDfxAuthenticated;
    useAuthStore.setState({ isDfxAuthenticated: true });
    const setDfxAuthenticated = jest.spyOn(useAuthStore.getState(), 'setDfxAuthenticated');
    setDfxAuthenticated.mockClear();
    mockAuthenticate.mockResolvedValueOnce('token-1').mockRejectedValueOnce(error);
    mockRegisterEmail.mockResolvedValue('merge_requested');
    let view: Awaited<ReturnType<typeof openMailStep>> | undefined;
    try {
      view = await openMailStep();
      fireEvent.press(view.getByTestId('kyc-mail-send'));
      await waitFor(() =>
        expect(view!.getByTestId('kyc-mail-verify').props.accessibilityState?.disabled).toBe(false),
      );
      fireEvent.press(view.getByTestId('kyc-mail-verify'));
      await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(view!.getByTestId('kyc-mail-verify').props.accessibilityState?.disabled).toBe(false),
      );
      if (ended) {
        expect(setDfxAuthenticated).toHaveBeenCalledTimes(1);
        expect(setDfxAuthenticated).toHaveBeenCalledWith(false);
        expect(useAuthStore.getState().isDfxAuthenticated).toBe(false);
      } else {
        expect(setDfxAuthenticated).not.toHaveBeenCalledWith(false);
        expect(useAuthStore.getState().isDfxAuthenticated).toBe(true);
      }
      expect(view.queryByText(error.message)).toBeNull();
      expect(view.queryByText('kyc.mailVerifyError')).toBeNull();
    } finally {
      view?.unmount();
      setDfxAuthenticated.mockRestore();
      useAuthStore.setState({
        isDfxAuthenticated: previous.isDfxAuthenticated,
        setDfxAuthenticated: originalSetter,
      });
    }
  });

  it('hides a session-ended or invalidated auth error on the merged account', async () => {
    mockGetKycStatus.mockRejectedValue(new Error('User is merged'));
    const messages = [LOCAL_SESSION_ENDED_MESSAGE, new DfxAuthFlowInvalidatedError().message];

    for (const message of messages) {
      mockAuthError = message;
      const view = render(<KycScreen />);
      await waitFor(() => expect(view.getByText('wallets.mergedExplanation')).toBeTruthy());
      expect(view.queryByText(message)).toBeNull();
      view.unmount();
    }
  });
});
