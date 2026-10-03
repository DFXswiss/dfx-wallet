import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import WalletsScreen from '@/features/dfx-backend/screens/WalletsScreenImpl';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';

const mockGetUser = jest.fn();
const mockLinkAddress = jest.fn<
  Promise<string>,
  [string, (message: string) => Promise<string>, { wallet: string; blockchain: string }]
>();
const mockSign = jest.fn<Promise<{ success: true; signature: string }>, [string]>();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useAccount: () => ({
    address: 'bc1q-wallet-address',
    sign: (message: string) => mockSign(message),
  }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  DfxApiError: class DfxApiError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  dfxAuthService: {
    linkAddress: (
      address: string,
      signMessage: (message: string) => Promise<string>,
      options: { wallet: string; blockchain: string },
    ) => mockLinkAddress(address, signMessage, options),
  },
  dfxUserService: {
    getUser: () => mockGetUser(),
  },
}));

jest.mock('@/features/dfx-backend/session-guard', () => ({
  isLocalSessionEndedError: (error: unknown) =>
    error instanceof Error && error.name === 'DfxAuthFlowInvalidatedError',
}));

jest.mock('@/hooks', () => ({
  useDfxAuth: () => ({
    isAuthenticating: false,
    reauthenticateAsOwner: jest.fn(),
  }),
}));

jest.mock('@/features/linked-wallets/useLinkedWalletNames', () => ({
  defaultLinkedWalletName: (blockchain: string) => blockchain,
  useLinkedWalletNames: () => ({
    getName: jest.fn(),
    setName: jest.fn(),
  }),
}));

jest.mock('@/features/linked-wallets/useLinkedWalletSelection', () => ({
  useLinkedWalletSelection: () => ({
    isSelected: jest.fn(() => false),
    toggle: jest.fn(),
  }),
}));

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    AppHeader: () => null,
    DfxBackgroundScreen: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      ReactActual.createElement(View, { testID }, children),
    EmptyState: () => null,
    Icon: () => null,
    PrimaryButton: () => null,
    RenameWalletModal: () => null,
    Skeleton: () => null,
  };
});

jest.mock('@/theme', () => {
  const color = 'mock-theme-color';
  return {
    Typography: {
      bodyMedium: {},
      bodySmall: {},
    },
    useColors: () => ({
      background: color,
      border: color,
      cardOverlay: color,
      error: color,
      primary: color,
      primaryLight: color,
      text: color,
      textSecondary: color,
      textTertiary: color,
      white: color,
    }),
  };
});

describe('WalletsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ activeAddress: null, addresses: [] });
    mockSign.mockResolvedValue({ success: true, signature: 'signed-message' });
  });

  it('silently stops linking when a newer authentication flow wins', async () => {
    const invalidated = new DfxAuthFlowInvalidatedError();
    let rejectLink!: (reason: unknown) => void;
    mockLinkAddress.mockImplementationOnce(
      () =>
        new Promise<string>((_resolve, reject) => {
          rejectLink = reject;
        }),
    );
    const screen = render(<WalletsScreen />);

    const linkButton = await screen.findByTestId('wallets-link-bitcoin');
    fireEvent.press(linkButton);

    await waitFor(() => expect(mockLinkAddress).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByTestId('wallets-link-bitcoin').props.accessibilityState?.disabled,
      ).toBe(true),
    );
    await act(async () => {
      rejectLink(invalidated);
    });
    await waitFor(() =>
      expect(
        screen.getByTestId('wallets-link-bitcoin').props.accessibilityState?.disabled,
      ).toBe(false),
    );
    expect(screen.queryByText(invalidated.message)).toBeNull();
  });
});
