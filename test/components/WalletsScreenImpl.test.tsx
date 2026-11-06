import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import WalletsScreen from '@/features/dfx-backend/screens/WalletsScreenImpl';
import { DfxAuthFlowInvalidatedError } from '@/features/dfx-backend/services/auth-service';

const mockGetUser = jest.fn();
const mockReauthenticateAsOwner = jest.fn();
const mockLinkAddress = jest.fn<
  Promise<string>,
  [string, (message: string) => Promise<string>, { wallet: string; blockchain: string }]
>();
const mockSign = jest.fn<Promise<{ success: true; signature: string }>, [string]>();

jest.mock('react-i18next', () => {
  const translate = (key: string) => key;
  return {
    useTranslation: () => ({ t: translate }),
  };
});

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
  DfxApiError: class extends Error {},
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
    reauthenticateAsOwner: () => mockReauthenticateAsOwner(),
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
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    AppHeader: () => null,
    DfxBackgroundScreen: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      ReactActual.createElement(View, { testID }, children),
    EmptyState: ({
      action,
      description,
      testID,
    }: {
      action?: React.ReactNode;
      description?: string;
      testID?: string;
    }) =>
      ReactActual.createElement(
        View,
        { testID },
        description ? ReactActual.createElement(Text, null, description) : null,
        action,
      ),
    Icon: () => null,
    PrimaryButton: ({
      loading,
      onPress,
      testID,
    }: {
      loading?: boolean;
      onPress?: () => void;
      testID?: string;
    }) =>
      ReactActual.createElement(Pressable, {
        accessibilityState: { disabled: loading === true },
        onPress,
        testID,
      }),
    RenameWalletModal: () => null,
    Skeleton: () => ReactActual.createElement(View, { testID: 'wallets-skeleton' }),
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
    mockReauthenticateAsOwner.mockReset();
    mockGetUser.mockResolvedValue({ activeAddress: null, addresses: [] });
    mockSign.mockResolvedValue({ success: true, signature: 'signed-message' });
  });

  it('silently stops linking when the link flow is invalidated', async () => {
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
      expect(screen.getByTestId('wallets-link-bitcoin').props.accessibilityState?.disabled).toBe(
        true,
      ),
    );
    await act(async () => {
      rejectLink(invalidated);
    });
    await waitFor(() =>
      expect(screen.getByTestId('wallets-link-bitcoin').props.accessibilityState?.disabled).toBe(
        false,
      ),
    );
    expect(screen.queryByText(invalidated.message)).toBeNull();
  });

  it('returns from merged recovery without the invalidated authentication message', async () => {
    const services = jest.requireMock('@/features/dfx-backend/services') as {
      DfxApiError: new (message: string) => Error;
    };
    const invalidated = new DfxAuthFlowInvalidatedError();
    mockGetUser.mockReset();
    mockGetUser.mockRejectedValue(new services.DfxApiError('User is merged'));
    let rejectReauth: (error: unknown) => void = () => undefined;
    mockReauthenticateAsOwner.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectReauth = reject;
        }),
    );
    const screen = render(<WalletsScreen />);

    await waitFor(() => expect(screen.getByTestId('wallets-recover')).toBeTruthy());
    expect(screen.getByText('wallets.mergedExplanation')).toBeTruthy();
    fireEvent.press(screen.getByTestId('wallets-recover'));

    await waitFor(() => expect(mockReauthenticateAsOwner).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('wallets-recover')).toBeTruthy();
    expect(screen.getByText('wallets.mergedExplanation')).toBeTruthy();
    await act(async () => {
      rejectReauth(invalidated);
    });
    await waitFor(() => expect(screen.getByTestId('wallets-recover')).toBeTruthy());
    expect(screen.getByText('wallets.mergedExplanation')).toBeTruthy();
    expect(screen.queryByText(invalidated.message)).toBeNull();
    expect(screen.queryByText('wallets.noAddresses')).toBeNull();
  });

  it('hides no addresses while merged recovery reloads the user', async () => {
    const services = jest.requireMock('@/features/dfx-backend/services') as {
      DfxApiError: new (message: string) => Error;
    };
    let resolveUser: (user: { activeAddress: null; addresses: never[] }) => void = () => undefined;
    mockGetUser.mockReset();
    mockGetUser.mockRejectedValueOnce(new services.DfxApiError('User is merged'));
    mockGetUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUser = resolve;
        }),
    );
    mockReauthenticateAsOwner.mockResolvedValue(undefined);
    const screen = render(<WalletsScreen />);

    await waitFor(() => expect(screen.getByTestId('wallets-recover')).toBeTruthy());
    fireEvent.press(screen.getByTestId('wallets-recover'));

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('wallets.noAddresses')).toBeNull();
      expect(screen.queryByTestId('wallets-link-bitcoin')).toBeNull();
      expect(screen.getAllByTestId('wallets-skeleton').length).toBeGreaterThan(0);
    });

    await act(async () => {
      resolveUser({ activeAddress: null, addresses: [] });
    });
    await waitFor(() => expect(screen.getByText('wallets.noAddresses')).toBeTruthy());
    expect(screen.queryAllByTestId('wallets-skeleton')).toHaveLength(0);
  });
});
