import { AppState, Platform, type AppStateStatus } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';

const mockEnableAppSwitcherProtection = jest.fn<Promise<void>, [number?]>();
const mockDisableAppSwitcherProtection = jest.fn<Promise<void>, []>();
const mockPreventScreenCapture = jest.fn<Promise<void>, [string?]>();

jest.mock('expo-screen-capture', () => ({
  enableAppSwitcherProtectionAsync: (...args: [number?]) =>
    mockEnableAppSwitcherProtection(...args),
  disableAppSwitcherProtectionAsync: () => mockDisableAppSwitcherProtection(),
  preventScreenCaptureAsync: (...args: [string?]) => mockPreventScreenCapture(...args),
}));

jest.mock('@/components/BrandLogo', () => {
  const { View } = jest.requireActual('react-native');
  return { BrandLogo: () => <View testID="privacy-shield-logo" /> };
});

// eslint-disable-next-line import/first
import { PrivacyShield } from '@/components/PrivacyShield';

function setPlatform(os: 'ios' | 'android'): () => void {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  return () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('PrivacyShield', () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    listener = undefined;
    remove.mockReset();
    mockEnableAppSwitcherProtection.mockReset();
    mockDisableAppSwitcherProtection.mockReset();
    mockPreventScreenCapture.mockReset();
    mockEnableAppSwitcherProtection.mockResolvedValue(undefined);
    mockDisableAppSwitcherProtection.mockResolvedValue(undefined);
    mockPreventScreenCapture.mockResolvedValue(undefined);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, nextListener) => {
      listener = nextListener;
      return { remove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('covers inactive and background states and hides again when active', () => {
    const { getByTestId, queryByTestId } = render(
      <ThemeProvider>
        <PrivacyShield />
      </ThemeProvider>,
    );

    act(() => listener?.('inactive'));
    expect(getByTestId('privacy-shield', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('privacy-shield-logo', { includeHiddenElements: true })).toBeTruthy();

    act(() => listener?.('background'));
    expect(getByTestId('privacy-shield', { includeHiddenElements: true })).toBeTruthy();

    act(() => listener?.('active'));
    expect(queryByTestId('privacy-shield')).toBeNull();
  });

  it('removes its AppState listener on unmount', () => {
    const { unmount } = render(
      <ThemeProvider>
        <PrivacyShield />
      </ThemeProvider>,
    );
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('enables iOS app-switcher protection on mount and disables it on unmount', async () => {
    const restore = setPlatform('ios');
    try {
      const { unmount } = render(
        <ThemeProvider>
          <PrivacyShield />
        </ThemeProvider>,
      );
      await flush();
      expect(mockEnableAppSwitcherProtection).toHaveBeenCalledTimes(1);
      expect(mockEnableAppSwitcherProtection).toHaveBeenCalledWith();
      expect(mockDisableAppSwitcherProtection).not.toHaveBeenCalled();
      expect(mockPreventScreenCapture).not.toHaveBeenCalled();

      unmount();
      await flush();
      expect(mockDisableAppSwitcherProtection).toHaveBeenCalledTimes(1);
      expect(mockPreventScreenCapture).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('does not enable or disable app-switcher protection on Android', async () => {
    const restore = setPlatform('android');
    try {
      const { unmount } = render(
        <ThemeProvider>
          <PrivacyShield />
        </ThemeProvider>,
      );
      await flush();
      unmount();
      await flush();
      expect(mockEnableAppSwitcherProtection).not.toHaveBeenCalled();
      expect(mockDisableAppSwitcherProtection).not.toHaveBeenCalled();
      expect(mockPreventScreenCapture).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('keeps rendering when enabling iOS app-switcher protection rejects', async () => {
    const restore = setPlatform('ios');
    mockEnableAppSwitcherProtection.mockRejectedValueOnce(new Error('native failure'));
    try {
      const view = render(
        <ThemeProvider>
          <PrivacyShield />
        </ThemeProvider>,
      );
      await flush();
      expect(mockEnableAppSwitcherProtection).toHaveBeenCalledTimes(1);

      act(() => listener?.('inactive'));
      expect(view.getByTestId('privacy-shield', { includeHiddenElements: true })).toBeTruthy();
      expect(view.getByTestId('privacy-shield-logo', { includeHiddenElements: true })).toBeTruthy();

      act(() => listener?.('active'));
      expect(view.queryByTestId('privacy-shield')).toBeNull();
    } finally {
      restore();
    }
  });

  it('disables app-switcher protection only after a pending enable settles', async () => {
    const restore = setPlatform('ios');
    const calls: string[] = [];
    let resolveEnable: () => void = () => undefined;
    mockEnableAppSwitcherProtection.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveEnable = () => {
            calls.push('enable');
            resolve();
          };
        }),
    );
    mockDisableAppSwitcherProtection.mockImplementation(() => {
      calls.push('disable');
      return Promise.resolve();
    });
    try {
      const { unmount } = render(
        <ThemeProvider>
          <PrivacyShield />
        </ThemeProvider>,
      );
      await flush();
      expect(mockEnableAppSwitcherProtection).toHaveBeenCalledTimes(1);

      unmount();
      await flush();
      expect(mockDisableAppSwitcherProtection).not.toHaveBeenCalled();

      resolveEnable();
      await flush();
      expect(calls).toEqual(['enable', 'disable']);
      expect(mockDisableAppSwitcherProtection).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });
});
