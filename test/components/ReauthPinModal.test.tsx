import React from 'react';
import { ActivityIndicator, Modal, TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ReauthPinModal, type ReauthPinModalProps } from '@/components/ReauthPinModal';
import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';
import { useAuthStore } from '@/store/auth';

jest.mock('react-i18next', () => {
  const en = jest.requireActual<typeof import('@/i18n/locales/en.json')>('@/i18n/locales/en.json');
  const lookup = (key: string): string => {
    const value = key.split('.').reduce<unknown>((node, part) => {
      if (node && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, part)) {
        return (node as Record<string, unknown>)[part];
      }
      return undefined;
    }, en);
    return typeof value === 'string' ? value : key;
  };
  return { useTranslation: () => ({ t: lookup }) };
});

function createProps(overrides: Partial<ReauthPinModalProps> = {}): ReauthPinModalProps {
  return {
    visible: true,
    error: null,
    locked: false,
    verifying: false,
    onCancel: jest.fn(),
    onSubmit: jest.fn(),
    ...overrides,
  };
}

describe('ReauthPinModal', () => {
  beforeEach(() => {
    useAuthStore.setState({ pinHash: 'pin$argon2id$current' });
  });

  it('describes reauthentication without requiring a six-digit PIN', () => {
    expect(en.reauth.description).toBe('Confirm your identity with your PIN.');
    expect(de.reauth.description).toBe('Bestätige deine Identität mit deiner PIN.');
    const view = render(<ReauthPinModal {...createProps()} />);
    expect(view.getByText(en.reauth.title)).toBeTruthy();
    expect(view.getByText(en.reauth.description)).toBeTruthy();
    expect(view.queryByText(/six-digit|6-digit|sechsstellig/i)).toBeNull();
  });

  it('accepts exactly six numeric digits, submits them, and clears the input', () => {
    const props = createProps();
    const view = render(<ReauthPinModal {...props} />);
    const input = view.getByTestId('reauth-pin-input');

    fireEvent.changeText(input, '12a34567');
    expect(input.props.value).toBe('123456');
    fireEvent.press(view.getByTestId('reauth-pin-confirm'));

    expect(props.onSubmit).toHaveBeenCalledWith('123456');
    expect(view.getByTestId('reauth-pin-input').props.value).toBe('');
  });

  it('does not submit fewer than 6 digits for a modern PIN hash', () => {
    const props = createProps();
    const view = render(<ReauthPinModal {...props} />);
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '12345');
    fireEvent.press(view.getByTestId('reauth-pin-confirm'));
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('submits a 4-digit PIN for a legacy hash', () => {
    useAuthStore.setState({ pinHash: 'abcdef' });
    const props = createProps();
    const view = render(<ReauthPinModal {...props} />);

    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '1234');
    fireEvent.press(view.getByTestId('reauth-pin-confirm'));

    expect(props.onSubmit).toHaveBeenCalledWith('1234');
  });

  it('clears the PIN and cancels from the button and native close request', () => {
    const props = createProps();
    const view = render(<ReauthPinModal {...props} />);
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '123456');
    fireEvent.press(view.getByTestId('reauth-pin-cancel'));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('reauth-pin-input').props.value).toBe('');
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '654321');
    expect(view.getByTestId('reauth-pin-input').props.value).toBe('654321');
    act(() => {
      view.UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(props.onCancel).toHaveBeenCalledTimes(2);
    expect(view.getByTestId('reauth-pin-input').props.value).toBe('');
  });

  it('disables PIN entry while locked and renders the lockout error', () => {
    const props = createProps({ locked: true, error: 'pin.lockedFor' });
    const view = render(<ReauthPinModal {...props} />);

    expect(view.UNSAFE_getByType(TextInput).props.editable).toBe(false);
    expect(view.getByTestId('reauth-pin-error').props.children).toBe('pin.lockedFor');
  });

  it('shows progress and disables cancellation while verifying', () => {
    const props = createProps({ verifying: true });
    const view = render(<ReauthPinModal {...props} />);

    expect(view.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(view.getByTestId('reauth-pin-cancel').props.accessibilityState?.disabled).toBe(true);
  });

  it('ignores a native close request while PIN verification is in progress', () => {
    const props = createProps({ verifying: true });
    const view = render(<ReauthPinModal {...props} />);

    act(() => {
      view.UNSAFE_getByType(Modal).props.onRequestClose();
    });

    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('is empty when the modal is shown again', () => {
    const props = createProps();
    const view = render(<ReauthPinModal {...props} />);
    fireEvent.changeText(view.getByTestId('reauth-pin-input'), '123456');
    view.rerender(<ReauthPinModal {...props} visible={false} />);
    view.rerender(<ReauthPinModal {...props} visible={true} />);
    expect(view.getByTestId('reauth-pin-input').props.value).toBe('');
  });

  it('does not offer password autofill for the PIN field', () => {
    const view = render(<ReauthPinModal {...createProps()} />);
    const input = view.getByTestId('reauth-pin-input');
    expect(input.props.textContentType).toBe('none');
    expect(input.props.autoComplete).toBe('off');
    expect(input.props.importantForAutofill).toBe('no');
    expect(input.props.secureTextEntry).toBe(true);
  });
});
