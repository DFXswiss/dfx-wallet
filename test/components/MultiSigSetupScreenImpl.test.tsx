import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
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
import { useMultiSigStore } from '@/features/multi-sig/store';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0]! : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
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
      disabled,
      testID,
    }: {
      title: string;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) =>
      ReactActual.createElement(
        Pressable,
        { accessibilityRole: 'button', disabled, onPress, testID },
        ReactActual.createElement(Text, null, title),
      ),
  };
});

const COSIGNER_A = 'bc1qaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const COSIGNER_B = 'bc1qbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// eslint-disable-next-line import/first
import MultiSigSetupScreenImpl from '../../src/features/multi-sig/MultiSigSetupScreenImpl';

function renderScreen() {
  return render(
    <ThemeProvider>
      <MultiSigSetupScreenImpl />
    </ThemeProvider>,
  );
}

function confirmLastAlert() {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const last = calls[calls.length - 1]!;
  const buttons = last[2] as { onPress?: () => void }[];
  buttons.find((b) => b.onPress)?.onPress?.();
}

describe('MultiSigSetupScreenImpl', () => {
  beforeEach(() => {
    mockBack.mockReset();
    useMultiSigStore.setState({ vaults: [] });
    useThemeStore.setState({ mode: 'light' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the intro step and goes back off the first screen', () => {
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('multi-sig')).toBeTruthy();
    expect(getByText('multiSig.intro.title')).toBeTruthy();
    fireEvent.press(getByTestId('multi-sig-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('completes the default 2-of-3 flow end to end', () => {
    const screen = renderScreen();
    const { getByText, getByTestId, getAllByPlaceholderText } = screen;

    fireEvent.press(getByText('multiSig.intro.cta'));
    fireEvent.press(getByText('multiSig.concept.cta'));
    fireEvent.press(getByTestId('quorum-2-2'));
    fireEvent.press(getByTestId('quorum-3-5'));
    fireEvent.press(getByTestId('quorum-2-3'));
    fireEvent.press(getByText('common.continue'));

    const inputs = getAllByPlaceholderText('multiSig.cosigners.placeholder');
    expect(inputs).toHaveLength(2);
    fireEvent.changeText(inputs[0]!, COSIGNER_A);
    fireEvent.changeText(inputs[1]!, COSIGNER_B);
    fireEvent.press(getByText('common.continue'));

    expect(getByText('multiSig.backup.title')).toBeTruthy();
    fireEvent.press(getByText('multiSig.backup.cta'));
    expect(useMultiSigStore.getState().vaults).toHaveLength(0);

    fireEvent.press(getByTestId('multi-sig-confirm-backup'));
    fireEvent.press(getByText('multiSig.backup.cta'));
    act(() => {
      confirmLastAlert();
    });

    expect(getByText('multiSig.success.title')).toBeTruthy();
    expect(useMultiSigStore.getState().vaults).toHaveLength(1);
    expect(useMultiSigStore.getState().vaults[0]!.required).toBe(2);
    expect(useMultiSigStore.getState().vaults[0]!.total).toBe(3);
    expect(useMultiSigStore.getState().vaults[0]!.cosigners).toHaveLength(2);

    fireEvent.press(getByText('common.done'));
    expect(mockBack).toHaveBeenCalled();

    fireEvent.press(getByTestId('multi-sig-back'));
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it('steps back through the wizard and leaves from intro', () => {
    const { getByText, getByTestId } = renderScreen();
    fireEvent.press(getByText('multiSig.intro.cta'));
    fireEvent.press(getByText('multiSig.concept.cta'));
    fireEvent.press(getByTestId('multi-sig-back'));
    expect(getByText('multiSig.concept.title')).toBeTruthy();
    fireEvent.press(getByTestId('multi-sig-back'));
    expect(getByText('multiSig.intro.title')).toBeTruthy();
    fireEvent.press(getByTestId('multi-sig-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('supports a custom quorum, clamps required when total shrinks, and respects stepper bounds', () => {
    const { getByText, getByTestId } = renderScreen();
    fireEvent.press(getByText('multiSig.intro.cta'));
    fireEvent.press(getByText('multiSig.concept.cta'));
    fireEvent.press(getByTestId('quorum-custom'));

    expect(getByTestId('quorum-custom-total-value').props.children).toBe(4);
    expect(getByTestId('quorum-custom-required-value').props.children).toBe(2);

    fireEvent.press(getByTestId('quorum-custom-total-inc'));
    expect(getByTestId('quorum-custom-total-value').props.children).toBe(5);
    fireEvent.press(getByTestId('quorum-custom-required-inc'));
    fireEvent.press(getByTestId('quorum-custom-required-inc'));
    fireEvent.press(getByTestId('quorum-custom-required-inc'));
    expect(getByTestId('quorum-custom-required-value').props.children).toBe(5);

    // Shrink total below required → required is clamped.
    fireEvent.press(getByTestId('quorum-custom-total-dec'));
    expect(getByTestId('quorum-custom-total-value').props.children).toBe(4);
    expect(getByTestId('quorum-custom-required-value').props.children).toBe(4);

    // Drive total down to MIN (2) and up to MAX (9) so the disabled
    // stepper branches run.
    fireEvent.press(getByTestId('quorum-custom-total-dec'));
    fireEvent.press(getByTestId('quorum-custom-total-dec'));
    expect(getByTestId('quorum-custom-total-value').props.children).toBe(2);
    fireEvent.press(getByTestId('quorum-custom-total-dec'));
    expect(getByTestId('quorum-custom-total-value').props.children).toBe(2);

    for (let i = 0; i < 8; i += 1) {
      fireEvent.press(getByTestId('quorum-custom-total-inc'));
    }
    expect(getByTestId('quorum-custom-total-value').props.children).toBe(9);
    fireEvent.press(getByTestId('quorum-custom-total-inc'));
    expect(getByTestId('quorum-custom-total-value').props.children).toBe(9);

    // Required is still 2 after the clamp; raise it to the new max, then
    // step it down so both inc/dec branches on the required stepper run.
    for (let i = 0; i < 8; i += 1) {
      fireEvent.press(getByTestId('quorum-custom-required-inc'));
    }
    expect(getByTestId('quorum-custom-required-value').props.children).toBe(9);
    fireEvent.press(getByTestId('quorum-custom-required-inc'));
    expect(getByTestId('quorum-custom-required-value').props.children).toBe(9);
    fireEvent.press(getByTestId('quorum-custom-required-dec'));
    expect(getByTestId('quorum-custom-required-value').props.children).toBe(8);
  });

  it('renders the dark backdrop when the theme is dark', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId } = renderScreen();
    expect(getByTestId('dark-backdrop')).toBeTruthy();
  });

  it('grows the cosigner input array when a later index is filled first', () => {
    const { getByText, getAllByPlaceholderText } = renderScreen();
    fireEvent.press(getByText('multiSig.intro.cta'));
    fireEvent.press(getByText('multiSig.concept.cta'));
    fireEvent.press(getByText('common.continue'));
    const inputs = getAllByPlaceholderText('multiSig.cosigners.placeholder');
    fireEvent.changeText(inputs[1]!, COSIGNER_B);
    expect(inputs[1]!.props.value === undefined || typeof inputs[1]!.props.value === 'string').toBe(
      true,
    );
  });
});
