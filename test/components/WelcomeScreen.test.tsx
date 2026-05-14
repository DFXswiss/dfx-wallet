import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack(),
  }),
}));

// `isPasskeyOsSupported` is the OS-version gate (true on iOS 18+ /
// Android 14+). Mock it explicitly so the test isn't sensitive to the
// jest-expo runtime's Platform.Version setting.
const mockOsSupport = jest.fn();
jest.mock('@/config/platform', () => ({
  isPasskeyOsSupported: () => mockOsSupport(),
}));

import WelcomeScreen from '../../app/(onboarding)/welcome';

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockOsSupport.mockReset();
    mockOsSupport.mockReturnValue(true);
  });

  it('renders the welcome shell with the create-wallet CTA', () => {
    const { getByTestId } = render(<WelcomeScreen />);
    expect(getByTestId('welcome-screen')).toBeTruthy();
    expect(getByTestId('welcome-create-wallet-button')).toBeTruthy();
  });

  it('shows the create-passkey CTA when the OS gate + FEATURES.PASSKEY are on', () => {
    mockOsSupport.mockReturnValue(true);
    const { getByTestId } = render(<WelcomeScreen />);
    expect(getByTestId('welcome-create-passkey-button')).toBeTruthy();
  });

  it('hides the create-passkey CTA when the OS does not support passkeys', () => {
    mockOsSupport.mockReturnValue(false);
    const { queryByTestId } = render(<WelcomeScreen />);
    expect(queryByTestId('welcome-create-passkey-button')).toBeNull();
  });

  it('navigates to /(onboarding)/create-wallet when the seed CTA is pressed', () => {
    const { getByTestId } = render(<WelcomeScreen />);
    fireEvent.press(getByTestId('welcome-create-wallet-button'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/create-wallet');
  });

  it('navigates to /(onboarding)/create-passkey when the passkey CTA is pressed', () => {
    mockOsSupport.mockReturnValue(true);
    const { getByTestId } = render(<WelcomeScreen />);
    fireEvent.press(getByTestId('welcome-create-passkey-button'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/create-passkey');
  });

  it('toggles the restore menu and exposes the seed-restore button when expanded', () => {
    mockOsSupport.mockReturnValue(false); // restore-toggle still shows under FEATURES.RESTORE
    const { getByTestId, queryByTestId } = render(<WelcomeScreen />);
    expect(queryByTestId('welcome-restore-seed-button')).toBeNull();
    fireEvent.press(getByTestId('welcome-restore-toggle'));
    expect(getByTestId('welcome-restore-seed-button')).toBeTruthy();
  });

  it('navigates to /(onboarding)/restore-wallet from the expanded restore menu', () => {
    mockOsSupport.mockReturnValue(false);
    const { getByTestId } = render(<WelcomeScreen />);
    fireEvent.press(getByTestId('welcome-restore-toggle'));
    fireEvent.press(getByTestId('welcome-restore-seed-button'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/restore-wallet');
  });

  it('back button calls router.back() when history exists', () => {
    mockCanGoBack.mockReturnValue(true);
    const { getByTestId } = render(<WelcomeScreen />);
    fireEvent.press(getByTestId('welcome-back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('back button calls router.replace("/") when there is no history', () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByTestId } = render(<WelcomeScreen />);
    fireEvent.press(getByTestId('welcome-back-button'));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('navigates to /(onboarding)/restore-passkey when restore-passkey button is pressed', () => {
    mockOsSupport.mockReturnValue(true);
    const { getByTestId } = render(<WelcomeScreen />);
    fireEvent.press(getByTestId('welcome-restore-toggle'));
    fireEvent.press(getByTestId('welcome-restore-passkey-button'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/restore-passkey');
  });
});
