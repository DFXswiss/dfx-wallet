import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack(),
  }),
}));

import { AppHeader } from '../../src/components/AppHeader';

describe('AppHeader', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
  });

  it('renders the title and the back-button', () => {
    const { getByText } = render(<AppHeader title="Receive" testID="hdr" />);
    expect(getByText('Receive')).toBeTruthy();
  });

  it('fires the provided onBack callback when the back button is pressed', () => {
    const onBack = jest.fn();
    const { getByLabelText } = render(<AppHeader title="X" onBack={onBack} testID="hdr" />);
    fireEvent.press(getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to router.back() when no onBack is provided and there is history', () => {
    mockCanGoBack.mockReturnValue(true);
    const { getByLabelText } = render(<AppHeader title="X" />);
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to router.replace(dashboard) when there is no history', () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = render(<AppHeader title="X" />);
    fireEvent.press(getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('renders the rightAction slot when provided', () => {
    const { getByText } = render(
      <AppHeader title="X" rightAction={<Text>edit</Text>} />,
    );
    expect(getByText('edit')).toBeTruthy();
  });
});
