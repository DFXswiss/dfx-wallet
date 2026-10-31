import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LOCAL_SESSION_ENDED_MESSAGE } from '@/features/dfx-backend/session-guard';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';

const mockAuthenticate = jest.fn();
const mockGetAccessToken = jest.fn();
const mockRequestMailLogin = jest.fn();
const mockLogout = jest.fn();
const mockClearAuthToken = jest.fn();

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
  }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxApi: {
    clearAuthToken: () => mockClearAuthToken(),
  },
  dfxAuthService: {
    getAccessToken: () => mockGetAccessToken(),
    logout: () => mockLogout(),
    requestMailLogin: (...args: unknown[]) => mockRequestMailLogin(...args),
  },
  decodeDfxJwt: () => ({ account: 1 }),
}));

// eslint-disable-next-line import/first
import DfxLoginScreen from '@/features/dfx-backend/screens/DfxLoginScreenImpl';

describe('DfxLoginScreenImpl', () => {
  beforeEach(() => {
    mockAuthenticate.mockReset();
    mockGetAccessToken.mockReset();
    mockRequestMailLogin.mockReset();
    mockLogout.mockReset();
    mockClearAuthToken.mockReset();
    mockGetAccessToken.mockReturnValue(null);
    mockRequestMailLogin.mockResolvedValue(undefined);
  });

  async function typeMailAndSend(): Promise<ReturnType<typeof render>> {
    const view = render(<DfxLoginScreen />);
    fireEvent.changeText(view.getByTestId('dfx-login-mail-input'), 'user@example.com');
    fireEvent.press(view.getByTestId('dfx-login-send'));
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(view.getByTestId('dfx-login-send').props.accessibilityState?.disabled).toBe(false),
    );
    return view;
  }

  it('returns to the mail form without an error when sending is invalidated', async () => {
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockAuthenticate.mockRejectedValue(invalidated);

    const view = await typeMailAndSend();

    expect(view.getByTestId('dfx-login-mail-input')).toBeTruthy();
    expect(view.queryByText('dfxLogin.sendingBody')).toBeNull();
    expect(view.queryByText(invalidated.message)).toBeNull();
    expect(view.queryByText('dfxLogin.sendError')).toBeNull();
  });

  it('returns to the mail form without an error when the local session ends while sending', async () => {
    mockAuthenticate.mockRejectedValue(new Error(LOCAL_SESSION_ENDED_MESSAGE));

    const view = await typeMailAndSend();

    expect(view.getByTestId('dfx-login-mail-input')).toBeTruthy();
    expect(view.queryByText('dfxLogin.sendingBody')).toBeNull();
    expect(view.queryByText(LOCAL_SESSION_ENDED_MESSAGE)).toBeNull();
  });

  it('stays on verify without an error when confirmation is invalidated', async () => {
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockAuthenticate
      .mockResolvedValueOnce('token-1')
      .mockRejectedValueOnce(invalidated);
    const view = render(<DfxLoginScreen />);
    fireEvent.changeText(view.getByTestId('dfx-login-mail-input'), 'user@example.com');
    fireEvent.press(view.getByTestId('dfx-login-send'));

    await waitFor(() => expect(view.getByTestId('dfx-login-verify')).toBeTruthy());
    fireEvent.press(view.getByTestId('dfx-login-verify'));

    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(view.getByTestId('dfx-login-verify').props.accessibilityState?.disabled).toBe(false),
    );
    expect(view.queryByText(invalidated.message)).toBeNull();
    expect(view.queryByText('dfxLogin.verifyError')).toBeNull();
    expect(view.queryByText('dfxLogin.notVerifiedYet')).toBeNull();
  });
});
