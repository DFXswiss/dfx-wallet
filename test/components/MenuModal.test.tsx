import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) =>
      ReactActual.createElement(View, rest, children),
  };
});

// eslint-disable-next-line import/first
import { MenuModal } from '@/components/MenuModal';

describe('MenuModal', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('exposes the translated close-menu label', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(<MenuModal visible onClose={onClose} />);

    fireEvent.press(getByLabelText('common.closeMenu'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
