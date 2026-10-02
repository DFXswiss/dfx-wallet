import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

const mockRequestPermission = jest.fn(async () => ({ granted: false }));
const mockPermission: { current: { granted: boolean } | null } = { current: null };

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  function CameraView({ children }: { children?: React.ReactNode }) {
    return <View testID="camera-view">{children}</View>;
  }
  return {
    CameraView,
    useCameraPermissions: (): [
      typeof mockPermission.current,
      typeof mockRequestPermission,
    ] => [mockPermission.current, mockRequestPermission],
  };
});

import { QrScanner } from '../../src/components/QrScanner';

describe('QrScanner', () => {
  beforeEach(() => {
    mockRequestPermission.mockClear();
    mockPermission.current = null;
    jest.spyOn(Clipboard, 'getStringAsync').mockResolvedValue('');
  });

  it('renders nothing visible when `visible` is false (Modal is hidden)', () => {
    // The Modal still mounts but is hidden by RN; we only verify the
    // component does not crash and the permission-request side effect
    // does not fire.
    render(<QrScanner visible={false} onScan={jest.fn()} onClose={jest.fn()} />);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('requests camera permission on mount when opened without permission', () => {
    mockPermission.current = { granted: false };
    render(<QrScanner visible={true} onScan={jest.fn()} onClose={jest.fn()} />);
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('does not re-request permission when already granted', () => {
    mockPermission.current = { granted: true };
    render(<QrScanner visible={true} onScan={jest.fn()} onClose={jest.fn()} />);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('shows the camera surface when permission is granted', () => {
    mockPermission.current = { granted: true };
    const { getByTestId } = render(
      <QrScanner visible={true} onScan={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByTestId('camera-view')).toBeTruthy();
  });

  it('shows the permission fallback when permission is denied', () => {
    mockPermission.current = { granted: false };
    const { getByText } = render(
      <QrScanner visible={true} onScan={jest.fn()} onClose={jest.fn()} />,
    );
    expect(getByText('Camera permission is required to scan QR codes.')).toBeTruthy();
    expect(getByText('Grant Permission')).toBeTruthy();
  });

  it('re-requesting permission from the fallback dispatches the same hook', () => {
    mockPermission.current = { granted: false };
    const { getByText } = render(
      <QrScanner visible={true} onScan={jest.fn()} onClose={jest.fn()} />,
    );
    mockRequestPermission.mockClear();
    fireEvent.press(getByText('Grant Permission'));
    expect(mockRequestPermission).toHaveBeenCalled();
  });
});
