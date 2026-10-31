import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider, useThemeStore } from '@/theme';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRequestPermission = jest.fn();
const mockScanData = { current: '' };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { data?: string }) =>
      params?.data === undefined ? key : `${key}:${params.data}`,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
  Stack: { Screen: () => null },
}));

jest.mock('expo-camera', () => {
  const ReactActual = jest.requireActual('react');
  const { Pressable } = jest.requireActual('react-native');
  return {
    CameraView: ({
      onBarcodeScanned,
    }: {
      onBarcodeScanned?: ((event: { data: string }) => void) | undefined;
    }) =>
      ReactActual.createElement(Pressable, {
        testID: 'pay-camera-view',
        onPress: () => onBarcodeScanned?.({ data: mockScanData.current }),
      }),
    useCameraPermissions: () => [{ granted: true }, mockRequestPermission],
  };
});

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

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    BrandLogo: () => ReactActual.createElement(View, { testID: 'brand-logo' }),
    DarkBackdrop: () => ReactActual.createElement(View, { testID: 'dark-backdrop' }),
    Icon: () => ReactActual.createElement(View, { testID: 'icon' }),
  };
});

jest.mock('@/services/opencryptopay', () => ({
  isOpenCryptoPayQR: () => false,
}));

// eslint-disable-next-line import/first
import PayScreen from '@/features/pay/PayScreenImpl';

describe('PayScreenImpl', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockRequestPermission.mockReset();
    mockScanData.current = 'raw-non-opencryptopay-payment-data';
    useThemeStore.setState({ mode: 'dark' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useThemeStore.setState({ mode: 'light' });
  });

  it('hides raw non-OpenCryptoPay data and returns on alert confirmation', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <PayScreen />
      </ThemeProvider>,
    );

    fireEvent.press(getByTestId('pay-camera-view'));

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0]!;
    expect(title).toBe('pay.comingSoonTitle');
    expect(message).toBe('pay.comingSoonMessage');
    expect(message).not.toContain(mockScanData.current);

    const okButton = (buttons as { text: string; onPress?: () => void }[]).find(
      (button) => button.text === 'common.ok',
    );
    expect(okButton).toBeDefined();
    okButton?.onPress?.();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
