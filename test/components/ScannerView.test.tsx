import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, render } from '@testing-library/react-native';

const MockPressable = Pressable;
const MockText = Text;
const MockView = View;

const mockRequestPermission = jest.fn(async () => ({ granted: false }));
const mockPermission: { current: { granted: boolean } | null } = { current: null };

jest.mock('expo-camera', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return {
    CameraView: (props: { onBarcodeScanned?: (event: { data: string }) => void }) => (
      <MockView testID="camera-view" {...props} />
    ),
    useCameraPermissions: (): [typeof mockPermission.current, typeof mockRequestPermission] => [
      mockPermission.current,
      mockRequestPermission,
    ],
  };
});

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(async () => ''),
  setStringAsync: jest.fn(async () => true),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => (
    <MockView {...props}>{children}</MockView>
  ),
}));

jest.mock('@/components', () => ({
  BrandLogo: () => <MockView testID="brand-logo" />,
  GlassIconButton: ({
    onPress,
    testID,
    accessibilityLabel,
  }: {
    onPress: () => void;
    testID: string;
    accessibilityLabel: string;
  }) => (
    <MockPressable onPress={onPress} testID={testID} accessibilityLabel={accessibilityLabel} />
  ),
  GlassPill: ({
    children,
    onPress,
    testID,
  }: {
    children?: React.ReactNode;
    onPress: () => void;
    testID: string;
  }) => (
    <MockPressable onPress={onPress} testID={testID}>
      {typeof children === 'string' ? <MockText>{children}</MockText> : children}
    </MockPressable>
  ),
  GlassSurface: ({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) => <MockView testID={testID}>{children}</MockView>,
  Icon: () => null,
  ScreenBackdrop: () => <MockView />,
}));

// eslint-disable-next-line import/first
import { ScannerView } from '../../src/features/scan/ScannerView';

const scan = (screen: ReturnType<typeof render>, data: string) => {
  act(() => {
    screen.getByTestId('camera-view').props.onBarcodeScanned({ data });
  });
};

describe('ScannerView', () => {
  beforeEach(() => {
    mockPermission.current = { granted: true };
    mockRequestPermission.mockClear();
    (Clipboard.getStringAsync as jest.Mock).mockReset().mockResolvedValue('');
    (Clipboard.setStringAsync as jest.Mock).mockReset().mockResolvedValue(true);
  });

  it('dispatches back and menu actions', () => {
    const onClose = jest.fn();
    const onOpenSettings = jest.fn();
    const screen = render(
      <ScannerView onScan={jest.fn(() => true)} onClose={onClose} onOpenSettings={onOpenSettings} />,
    );

    fireEvent.press(screen.getByTestId('pay-back-button'));
    fireEvent.press(screen.getByTestId('pay-menu-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('accepts only the first of two rapid camera scans', () => {
    const onScan = jest.fn(() => true);
    const screen = render(
      <ScannerView onScan={onScan} onClose={jest.fn()} onOpenSettings={jest.fn()} />,
    );
    const handler = screen.getByTestId('camera-view').props.onBarcodeScanned;

    act(() => {
      handler({ data: 'first' });
      handler({ data: 'second' });
    });

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('first');
  });

  it('shows the unknown sheet with the scanned text', () => {
    const screen = render(
      <ScannerView onScan={() => false} onClose={jest.fn()} onOpenSettings={jest.fn()} />,
    );

    scan(screen, 'unrecognised-data');

    expect(screen.getByTestId('scanner-unknown')).toBeTruthy();
    expect(screen.getByText('unrecognised-data')).toBeTruthy();
    expect(screen.getByText('scan.unknownTitle')).toBeTruthy();
  });

  it('copies unknown data to the clipboard', async () => {
    const screen = render(
      <ScannerView onScan={() => false} onClose={jest.fn()} onOpenSettings={jest.fn()} />,
    );
    scan(screen, 'copy-this');

    await act(async () => {
      fireEvent.press(screen.getByTestId('scanner-unknown-copy'));
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('copy-this');
  });

  it('hides the sheet on rescan and accepts a new scan', () => {
    const onScan = jest.fn(() => false);
    const screen = render(
      <ScannerView onScan={onScan} onClose={jest.fn()} onOpenSettings={jest.fn()} />,
    );
    scan(screen, 'first');

    fireEvent.press(screen.getByTestId('scanner-unknown-rescan'));
    expect(screen.queryByTestId('scanner-unknown')).toBeNull();
    scan(screen, 'second');

    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenLastCalledWith('second');
  });

  it('sends pasted clipboard text through the scan handler', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce('pasted-data');
    const onScan = jest.fn(() => false);
    const screen = render(
      <ScannerView onScan={onScan} onClose={jest.fn()} onOpenSettings={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('scanner-paste'));
    });

    expect(onScan).toHaveBeenCalledWith('pasted-data');
    expect(screen.getByTestId('scanner-unknown')).toBeTruthy();
  });

  it('shows the permission fallback and requests access again', () => {
    mockPermission.current = { granted: false };
    const screen = render(
      <ScannerView onScan={jest.fn()} onClose={jest.fn()} onOpenSettings={jest.fn()} />,
    );

    expect(screen.getByText('pay.cameraPermission')).toBeTruthy();
    mockRequestPermission.mockClear();
    fireEvent.press(screen.getByText('pay.grantPermission'));
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });
});
