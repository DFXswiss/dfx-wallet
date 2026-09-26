import React from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <View {...props} />;
  }
  return { BlurView };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// eslint-disable-next-line import/first
import { RenameWalletModal } from '../../src/components/RenameWalletModal';
// eslint-disable-next-line import/first
import { ThemeProvider } from '@/theme';

function renderModal(overrides: Partial<React.ComponentProps<typeof RenameWalletModal>> = {}) {
  return render(
    <ThemeProvider>
      <RenameWalletModal
        visible
        initialName=""
        defaultName="My wallet"
        walletAddressShort="0x1234...5678"
        onSave={() => undefined}
        onClose={() => undefined}
        {...overrides}
      />
    </ThemeProvider>,
  );
}

describe('RenameWalletModal', () => {
  it('wraps the sheet in a KeyboardAvoidingView so the keyboard never covers the input', () => {
    // Regression for G5: the pre-glass modal used
    // `KeyboardAvoidingView` directly; moving onto `GlassSheet` (G4) dropped
    // it until `avoidKeyboard` was added back to the module.
    const { UNSAFE_queryAllByType } = renderModal();
    expect(UNSAFE_queryAllByType(KeyboardAvoidingView)).toHaveLength(1);
  });

  it('renders the input pre-filled with the current name', () => {
    const { getByTestId } = renderModal({ initialName: 'Office cold' });
    expect(getByTestId('rename-wallet-input').props.value).toBe('Office cold');
  });
});
