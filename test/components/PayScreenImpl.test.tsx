import React from 'react';
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
  const actual = jest.requireActual('@/components');
  return {
    ...actual,
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useThemeStore.setState({ mode: 'light' });
  });

  it('shows unknown payment data in the sheet without navigating', () => {
    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <PayScreen />
      </ThemeProvider>,
    );

    fireEvent.press(getByTestId('pay-camera-view'));

    expect(getByTestId('scanner-unknown')).toBeTruthy();
    expect(getByText(mockScanData.current)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('pay-back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
