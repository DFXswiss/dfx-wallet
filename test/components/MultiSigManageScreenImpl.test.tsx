import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider, useThemeStore } from '@/theme';

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => {
        store.set(key, value);
      },
    }),
  };
});

// eslint-disable-next-line import/first
import { useMultiSigStore, type MultiSigVault } from '@/features/multi-sig/store';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0]! : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  const actual = jest.requireActual('@/components');
  return {
    ...actual,
    Icon: ({ name }: { name: string }) => ReactActual.createElement(Text, null, name),
    DarkBackdrop: () => ReactActual.createElement(View, { testID: 'dark-backdrop' }),
    PrimaryButton: ({
      title,
      onPress,
      testID,
    }: {
      title: string;
      onPress: () => void;
      testID?: string;
    }) =>
      ReactActual.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress, testID },
        ReactActual.createElement(Text, null, title),
      ),
  };
});

// eslint-disable-next-line import/first
import MultiSigManageScreenImpl from '../../src/features/multi-sig/MultiSigManageScreenImpl';

const LONG = 'bc1qverylongaddressxxxxxxxxxxxxxxxxxxxxxxxx';
const SHORT = 'short-addr';

const VAULT: MultiSigVault = {
  id: 'vault-1',
  name: 'Family vault',
  required: 2,
  total: 3,
  createdAt: 1,
  cosigners: [
    { id: 'c1', address: LONG, label: 'Alice' },
    { id: 'c2', address: SHORT },
  ],
};

function renderScreen() {
  return render(
    <ThemeProvider>
      <MultiSigManageScreenImpl />
    </ThemeProvider>,
  );
}

describe('MultiSigManageScreenImpl', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    useMultiSigStore.setState({ vaults: [] });
    useThemeStore.setState({ mode: 'light' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the empty state and routes to setup', () => {
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('multi-sig-manage')).toBeTruthy();
    expect(getByText('multiSig.manage.emptyTitle')).toBeTruthy();
    fireEvent.press(getByTestId('multi-sig-setup-cta'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/multi-sig/setup');
  });

  it('goes back from the header', () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('multi-sig-manage-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('lists vaults, truncates long addresses, keeps short ones, and uses the label fallback', () => {
    useMultiSigStore.setState({ vaults: [VAULT] });
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('vault-vault-1')).toBeTruthy();
    expect(getByText('Family vault')).toBeTruthy();
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('multiSig.manage.cosignerLabel:{"n":2}')).toBeTruthy();
    expect(getByText(`${LONG.slice(0, 8)}…${LONG.slice(-6)}`)).toBeTruthy();
    expect(getByText(SHORT)).toBeTruthy();
  });

  it('adds another vault from the filled list', () => {
    useMultiSigStore.setState({ vaults: [VAULT] });
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('multi-sig-add-another'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/multi-sig/setup');
  });

  it('removes a vault when the destructive alert is confirmed', () => {
    useMultiSigStore.setState({ vaults: [VAULT] });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const confirm = (buttons as { onPress?: () => void }[])[1];
      confirm?.onPress?.();
    });
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('vault-vault-1-remove'));
    expect(alertSpy).toHaveBeenCalled();
    expect(useMultiSigStore.getState().vaults).toEqual([]);
  });

  it('keeps the vault when the remove alert is cancelled', () => {
    useMultiSigStore.setState({ vaults: [VAULT] });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const cancel = (buttons as { onPress?: () => void }[])[0];
      cancel?.onPress?.();
    });
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('vault-vault-1-remove'));
    expect(useMultiSigStore.getState().vaults).toHaveLength(1);
  });

  it('renders the dark backdrop when the theme is dark', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId } = renderScreen();
    expect(getByTestId('dark-backdrop')).toBeTruthy();
  });
});
