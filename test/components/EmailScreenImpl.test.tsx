import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockGetUser = jest.fn();
const mockPush = jest.fn();

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
    error: null,
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
});
