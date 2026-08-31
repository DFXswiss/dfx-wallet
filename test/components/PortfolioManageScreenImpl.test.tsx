import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider, useThemeStore } from '@/theme';
import { SELECTABLE_CHAINS } from '@/config/tokens';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), canGoBack: () => true }),
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

const mockToggleChain = jest.fn();
const mockEnabled: string[] = ['ethereum', 'bitcoin', 'polygon'];
jest.mock('../../src/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({
    enabledChains: mockEnabled,
    setEnabledChains: jest.fn(),
    toggleChain: mockToggleChain,
  }),
}));

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const actual = jest.requireActual('@/components');
  return {
    ...actual,
    Icon: ({ name }: { name: string }) => ReactActual.createElement(Text, null, name),
    DarkBackdrop: () => ReactActual.createElement(View, { testID: 'dark-backdrop' }),
  };
});

// eslint-disable-next-line import/first
import PortfolioManageScreenImpl from '../../src/features/portfolio/PortfolioManageScreenImpl';

function renderScreen() {
  return render(
    <ThemeProvider>
      <PortfolioManageScreenImpl />
    </ThemeProvider>,
  );
}

describe('PortfolioManageScreenImpl', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockToggleChain.mockReset();
    useThemeStore.setState({ mode: 'light' });
  });

  it('renders always-on + optional chains and goes back', () => {
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('manage-back-button')).toBeTruthy();
    expect(getByText('Ethereum')).toBeTruthy();
    expect(getByText('Bitcoin')).toBeTruthy();
    for (const chain of SELECTABLE_CHAINS) {
      expect(getByTestId(`manage-chain-${chain}`)).toBeTruthy();
    }
    fireEvent.press(getByTestId('manage-back-button'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('toggles an optional chain via the Switch', () => {
    const { getByTestId } = renderScreen();
    fireEvent(getByTestId('manage-chain-polygon'), 'valueChange', false);
    expect(mockToggleChain).toHaveBeenCalledWith('polygon');
    fireEvent(getByTestId('manage-chain-arbitrum'), 'valueChange', true);
    expect(mockToggleChain).toHaveBeenCalledWith('arbitrum');
  });

  it('renders the dark backdrop when the theme is dark', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId } = renderScreen();
    expect(getByTestId('dark-backdrop')).toBeTruthy();
  });
});
