import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ replace: mockReplace }),
}));

const mockSetAuthenticated = jest.fn();
const mockSetOnboarded = jest.fn();
jest.mock('@/store', () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      setAuthenticated: mockSetAuthenticated,
      setOnboarded: mockSetOnboarded,
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    AppHeader: ({ title }: { title: string }) => ReactActual.createElement(Text, null, title),
    DfxBackgroundScreen: ({ children, testID }: { children: React.ReactNode; testID?: string }) =>
      ReactActual.createElement(View, { testID }, children),
    OnboardingStepIndicator: () => null,
    PrimaryButton: ({
      disabled,
      onPress,
      testID,
      title,
    }: {
      disabled?: boolean;
      onPress: () => void;
      testID?: string;
      title: string;
    }) =>
      ReactActual.createElement(
        Pressable,
        { disabled, onPress, testID },
        ReactActual.createElement(Text, null, title),
      ),
  };
});

import LegalDisclaimerScreen from '../../src/features/legal/LegalDisclaimerScreenImpl';

describe('LegalDisclaimerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetOnboarded.mockResolvedValue(undefined);
  });

  it('marks onboarding complete without changing authentication and opens the dashboard', async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <LegalDisclaimerScreen />
      </ThemeProvider>,
    );

    fireEvent.press(getByTestId('legal-accept-checkbox'));
    await act(async () => {
      fireEvent.press(getByTestId('legal-continue-button'));
    });

    await waitFor(() => expect(mockSetOnboarded).toHaveBeenCalledWith(true));
    expect(mockSetAuthenticated).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });
});
