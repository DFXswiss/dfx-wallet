import { Modal } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DfxAuthGate } from '@/features/dfx-backend/DfxAuthGate';
import type { DfxAuthGateKind } from '@/features/dfx-backend/services';
import { ThemeProvider } from '@/theme';

const mockPush = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

type CloseHandlers = {
  onClose: () => void;
  onCancel?: () => void;
};

function renderGate(kind: DfxAuthGateKind, handlers: CloseHandlers) {
  return render(
    <ThemeProvider>
      <DfxAuthGate
        gate={{ kind, message: kind }}
        onClose={handlers.onClose}
        {...(handlers.onCancel ? { onCancel: handlers.onCancel } : {})}
      />
    </ThemeProvider>,
  );
}

describe('DfxAuthGate', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('calls onCancel from Cancel and the back gesture when it is provided', () => {
    const onClose = jest.fn();
    const onCancel = jest.fn();
    const view = renderGate('login', { onClose, onCancel });

    fireEvent.press(view.getByTestId('dfx-auth-gate-cancel'));
    act(() => {
      view.UNSAFE_getByType(Modal).props.onRequestClose?.();
    });

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to onClose for Cancel and the back gesture when onCancel is omitted', () => {
    const onClose = jest.fn();
    const view = renderGate('login', { onClose });

    fireEvent.press(view.getByTestId('dfx-auth-gate-cancel'));
    act(() => {
      view.UNSAFE_getByType(Modal).props.onRequestClose?.();
    });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['login', '/(auth)/dfx-login'],
    ['kyc', '/(auth)/kyc'],
    ['email', '/(auth)/email'],
  ] as const)('primary %s calls onClose and not onCancel', (kind, route) => {
    const onClose = jest.fn();
    const onCancel = jest.fn();
    const view = renderGate(kind, { onClose, onCancel });

    fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(route);
  });

  it('calls onCancel when linkChain has nothing to link', () => {
    const onClose = jest.fn();
    const onCancel = jest.fn();
    const view = renderGate('linkChain', { onClose, onCancel });

    fireEvent.press(view.getByTestId('dfx-auth-gate-primary'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
