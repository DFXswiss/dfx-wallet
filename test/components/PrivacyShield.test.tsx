import { AppState, type AppStateStatus } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';

jest.mock('@/components/BrandLogo', () => {
  const { View } = jest.requireActual('react-native');
  return { BrandLogo: () => <View testID="privacy-shield-logo" /> };
});

import { PrivacyShield } from '@/components/PrivacyShield';

describe('PrivacyShield', () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    listener = undefined;
    remove.mockReset();
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
});
