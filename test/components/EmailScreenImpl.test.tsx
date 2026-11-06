import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LOCAL_SESSION_ENDED_MESSAGE } from '@/features/dfx-backend/session-guard';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';

const mockGetUser = jest.fn();
const mockPush = jest.fn();
let mockAuthError: string | null = null;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: () => true,
    push: mockPush,
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
    reauthenticateAsOwner: jest.fn(),
    isAuthenticating: false,
    error: mockAuthError,
  }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  DfxApiError: class extends Error {},
  dfxUserService: {
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
}));

// eslint-disable-next-line import/first
import EmailScreenImpl from '@/features/dfx-backend/screens/EmailScreenImpl';

describe('EmailScreenImpl', () => {
  beforeEach(() => {
    mockAuthError = null;
    mockGetUser.mockReset();
    mockPush.mockReset();
    mockGetUser.mockResolvedValue({ mail: 'user@example.com', phone: '+41000000000' });
  });

  it('labels both edit actions and routes the selected action to KYC', async () => {
    const { getAllByLabelText } = render(<EmailScreenImpl />);

    const editActions = await waitFor(() => getAllByLabelText('common.edit'));
    expect(editActions).toHaveLength(2);

    fireEvent.press(editActions[0]!);
    expect(mockPush).toHaveBeenCalledWith('/(auth)/kyc');
  });

  it('hides a session-ended or invalidated auth error on the merged account', async () => {
    const services = jest.requireMock('@/features/dfx-backend/services') as {
      DfxApiError: new (message: string) => Error;
    };
    mockGetUser.mockRejectedValue(new services.DfxApiError('User is merged'));
    const messages = [
      LOCAL_SESSION_ENDED_MESSAGE,
      new DfxAuthFlowInvalidatedError().message,
    ];

    for (const message of messages) {
      mockAuthError = message;
      const view = render(<EmailScreenImpl />);
      await waitFor(() => expect(view.getByText('wallets.mergedExplanation')).toBeTruthy());
      expect(view.queryByText(message)).toBeNull();
      view.unmount();
    }
  });
});
